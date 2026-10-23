/**
 * Crea e Modifica ruolo (DAS-REV-14, screen 02 e 03).
 *
 * Un solo controller per due stati: §4 dice che «i dodici screen non
 * richiedono dodici controller separati», e creazione e modifica
 * differiscono per il ruolo di partenza, non per la logica.
 *
 * Qui vive il **draft**. Il selector rapido (screen 04) e il livello
 * granulare (screen 05) lo modificano e basta: §11 e §12 dicono che Conferma
 * e Conferma permessi «non aggiornano ancora i permessi server». Solo Crea
 * ruolo / Salva modifiche invia un comando.
 *
 * Il draft si semina **una volta sola** (`seededRef`): un refetch in
 * background che lo riscrivesse cancellerebbe ciò che l'utente ha appena
 * toccato.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button, ConfirmModal, Input } from "../../../ui";
import { useToast } from "../../../ui/Toast/ToastProvider";
import { useSession } from "../../auth/use-session";
import { NetworkNavBar } from "../../network/components/NetworkNavBar";
import { STALE_MS } from "../cache/freshness-policy";
import {
  DashboardGlobalEmpty,
  DashboardGlobalError,
  DashboardSkeleton,
} from "../components/DashboardStates";
import { SocietyIdentityHeader } from "../components/SocietyIdentityHeader";
import { useDashboardIdentity } from "../identity/use-dashboard-identity";
import { newAdminOperationKey } from "../admins/operation-key";
import { useOperationKey } from "./use-operation-key";
import { AreaLevelRow } from "./components/AreaLevelRow";
import { AreaLevelSheet } from "./components/AreaLevelSheet";
import { RoleImpactNotice } from "./components/RoleImpactNotice";
import { RolePermissionsModal } from "./components/RolePermissionsModal";
import {
  areaIsConfigurable,
  areaLevel,
  controlsFromKeys,
  describeChanges,
  findArea,
} from "./permission-catalog";
import { ROLES_QK, ROLES_QK_PREFIXES } from "./roles-keys";
import { trackRolesEvent } from "./roles-analytics";
import {
  ROLES_COPY,
  ROLES_LOAD_ERROR,
  describeRolesError,
  normalizeRoleName,
  validateRoleName,
} from "./roles-presentation";
import {
  RolesAccessError,
  archiveRole,
  fetchPermissionCatalog,
  fetchRoleDetail,
  fetchRolesCenter,
  saveRole,
  toRolesError,
} from "./roles-service";

/** Codici che appartengono al campo nome, non alla banda di errore (§29). */
const NAME_ERROR_CODES = [
  "ROLE_NAME_DUPLICATE",
  "ROLE_NAME_INVALID",
  "ROLE_NAME_RESERVED",
];

const INVALIDATE_PREFIXES = [
  ...ROLES_QK_PREFIXES,
  "society-admin-center",
  "society-admins",
] as const;

export function RoleEditorScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { current } = useDashboardIdentity();
  const clubId = current?.kind === "society" ? current.id : null;
  const params = useLocalSearchParams<{ roleId?: string }>();
  const roleId = typeof params.roleId === "string" ? params.roleId : null;

  const [name, setName] = useState("");
  const [controlIds, setControlIds] = useState<string[]>([]);
  const [serverControlIds, setServerControlIds] = useState<string[]>([]);
  const [nameTouched, setNameTouched] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [sheetAreaId, setSheetAreaId] = useState<string | null>(null);
  const [customAreaId, setCustomAreaId] = useState<string | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [seededFor, setSeededFor] = useState<string | null>(null);

  /* §13: «Prevenire doppio submit e duplicati concorrenti con vincolo
     server e idempotenza.» La chiave segue il contenuto: correggere il nome
     dopo un errore è un'operazione diversa, non lo stesso tentativo. */
  const operationKey = useOperationKey(
    `${roleId ?? "new"}|${normalizeRoleName(name)}|${[...controlIds].sort().join(",")}`,
  );

  const centerQuery = useQuery({
    enabled: !!clubId && !!actorId,
    queryFn: () => fetchRolesCenter(clubId as string),
    queryKey: ROLES_QK.center(actorId, clubId ?? ""),
    retry: (failureCount, error) =>
      !(error instanceof RolesAccessError) && failureCount < 1,
    staleTime: STALE_MS.management,
  });

  const catalogQuery = useQuery({
    enabled: !!clubId && !!actorId,
    queryFn: () => fetchPermissionCatalog(clubId as string),
    queryKey: ROLES_QK.catalog(actorId, clubId ?? ""),
    retry: (failureCount, error) =>
      !(error instanceof RolesAccessError) && failureCount < 1,
    staleTime: STALE_MS.management,
  });

  const detailQuery = useQuery({
    enabled: !!clubId && !!actorId && !!roleId,
    queryFn: () =>
      fetchRoleDetail({ clubId: clubId as string, roleId: roleId as string }),
    queryKey: ROLES_QK.detail(actorId, clubId ?? "", roleId ?? ""),
    retry: (failureCount, error) =>
      !(error instanceof RolesAccessError) && failureCount < 1,
    staleTime: STALE_MS.management,
  });

  const center = centerQuery.data ?? null;
  const catalog = catalogQuery.data ?? null;
  const detail = detailQuery.data ?? null;

  /**
   * Semina del draft, una volta sola, in fase di render.
   *
   * `seededFor` è la chiave di ciò che è già stato seminato: un refetch in
   * background non la cambia, quindi non può riscrivere ciò che l'utente ha
   * appena toccato. Un `useEffect` avrebbe mostrato un frame con il form
   * vuoto prima di riempirlo.
   */
  const seedKey = catalog ? (roleId ?? "new") : null;

  if (seedKey && seededFor !== seedKey && (!roleId || detail)) {
    const seeded =
      roleId && detail && catalog
        ? controlsFromKeys(catalog, detail.permissionKeys)
        : [];

    setSeededFor(seedKey);
    setName(roleId && detail ? detail.name : "");
    setControlIds(seeded);
    setServerControlIds(seeded);
  }

  useEffect(() => {
    trackRolesEvent("role_editor_opened", { mode: roleId ? "edit" : "create" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const configurableAreas = useMemo(
    () => (catalog?.areas ?? []).filter(areaIsConfigurable),
    [catalog],
  );

  const changes = useMemo(
    () => (catalog ? describeChanges(catalog, serverControlIds, controlIds) : []),
    [catalog, controlIds, serverControlIds],
  );

  const canEdit = roleId
    ? (detail?.canEdit ?? false)
    : (center?.canCreateRole ?? false);

  const nameChanged = normalizeRoleName(name) !== (detail?.name ?? "");
  const hasChanges = nameChanged || changes.length > 0;

  /**
   * §13: «Prevenire doppio submit.» La chiave idempotente nasce al primo
   * tentativo e sopravvive al retry: riusarla è ciò che impedisce che una
   * risposta persa diventi un secondo ruolo.
   */
  const submit = useMutation({
    mutationFn: () =>
      saveRole({
        catalogRevision: catalog?.revision ?? 1,
        clubId: clubId as string,
        controlIds,
        expectedImpact: detail?.adminsCount ?? null,
        expectedVersion: detail?.version ?? null,
        idempotencyKey: operationKey(),
        name: normalizeRoleName(name),
        roleId,
      }),
    onError: (error) => {
      const code = toRolesError(error).code;
      const message = describeRolesError(code);

      if (NAME_ERROR_CODES.includes(code)) {
        setNameError(message);
        setBannerError(null);
      } else {
        setBannerError(message);
      }

      trackRolesEvent("role_save_result", {
        mode: roleId ? "edit" : "create",
        outcome: "error",
      });
    },
    onSuccess: async () => {
      showToast({
        message: roleId ? ROLES_COPY.updatedToast : ROLES_COPY.createdToast,
        tone: "success",
      });

      trackRolesEvent("role_save_result", {
        mode: roleId ? "edit" : "create",
        outcome: "success",
      });

      for (const prefix of INVALIDATE_PREFIXES) {
        await queryClient.invalidateQueries({ queryKey: [prefix] });
      }

      /* §13: «non annullare un salvataggio riuscito solo perché la pagina
         non è più accessibile.» Si torna indietro, non si rilegge il ruolo
         per decidere se il commit vale. */
      router.back();
    },
  });

  const archive = useMutation({
    mutationFn: () =>
      archiveRole({
        clubId: clubId as string,
        expectedVersion: detail?.version ?? null,
        idempotencyKey: newAdminOperationKey(),
        roleId: roleId as string,
      }),
    onError: (error) => {
      setConfirmArchive(false);
      setBannerError(describeRolesError(toRolesError(error).code));
      trackRolesEvent("role_archive_result", { outcome: "error" });
    },
    onSuccess: async () => {
      setConfirmArchive(false);
      showToast({ message: ROLES_COPY.archivedToast, tone: "success" });
      trackRolesEvent("role_archive_result", { outcome: "success" });

      for (const prefix of INVALIDATE_PREFIXES) {
        await queryClient.invalidateQueries({ queryKey: [prefix] });
      }

      router.back();
    },
  });

  const goBack = useCallback(() => {
    /* §30: un pannello aperto si chiude per conto suo — «non aggiungere due
       popup consecutivi per la stessa uscita». */
    if (customAreaId) {
      setCustomAreaId(null);

      return;
    }

    if (sheetAreaId) {
      setSheetAreaId(null);

      return;
    }

    if (hasChanges && !submit.isPending) {
      setConfirmExit(true);

      return;
    }

    router.back();
  }, [customAreaId, hasChanges, router, sheetAreaId, submit.isPending]);

  /**
   * Conferma di un pannello: sostituisce i controlli **di quell'area** e
   * lascia intatte le altre (§11, QA-26, QA-30).
   */
  const applyAreaControls = useCallback(
    (areaId: string, next: string[]) => {
      const area = findArea(catalog, areaId);

      if (!area) {
        return;
      }

      const others = controlIds.filter(
        (id) => !area.controls.some((control) => control.id === id),
      );

      setControlIds([...others, ...next]);
    },
    [catalog, controlIds],
  );

  if (!clubId) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <DashboardGlobalEmpty
          copy={{
            actionLabel: "Apri la Dashboard",
            body: "Scegli la società da amministrare dalla Dashboard.",
            icon: "shield-outline",
            title: "Nessuna società selezionata",
          }}
          onAction={null}
        />
      </View>
    );
  }

  const title = roleId ? ROLES_COPY.editTitle : ROLES_COPY.createTitle;

  if ((catalogQuery.isLoading && !catalog) || (roleId && detailQuery.isLoading && !detail)) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <NetworkNavBar onBack={() => router.back()} title={title} />
        <View style={styles.content}>
          <DashboardSkeleton />
        </View>
      </View>
    );
  }

  if (!catalog || !center || (roleId && !detail)) {
    /* §29: «Se non è disponibile il catalogo completo necessario, impedisci
       il salvataggio senza trattare aree mancanti come Nessun accesso.» */
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <NetworkNavBar onBack={() => router.back()} title={title} />
        <DashboardGlobalError
          body={ROLES_LOAD_ERROR.catalog}
          onRetry={() => {
            void catalogQuery.refetch();
            void centerQuery.refetch();

            if (roleId) {
              void detailQuery.refetch();
            }
          }}
          title={title}
        />
      </View>
    );
  }

  const inlineNameError =
    nameError ?? (nameTouched ? validateRoleName(name) : null);
  const saveDisabled =
    !canEdit ||
    submit.isPending ||
    !hasChanges ||
    validateRoleName(name) !== null;

  const sheetArea = findArea(catalog, sheetAreaId);
  const customArea = findArea(catalog, customAreaId);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <NetworkNavBar onBack={goBack} title={title} />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing[24] },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <SocietyIdentityHeader
          isVerified={center.clubIsVerified}
          logoUrl={center.clubLogoUrl}
          name={center.clubName}
        />

        <View style={styles.field}>
          <AppText color="neutralMuted" variant="meta">
            {ROLES_COPY.nameLabel}
          </AppText>

          <Input
            editable={canEdit}
            error={!!inlineNameError}
            onBlur={() => setNameTouched(true)}
            onChangeText={(value) => {
              setName(value);
              setNameError(null);
            }}
            placeholder={ROLES_COPY.namePlaceholder}
            testID="role-editor-name"
            value={name}
          />

          {roleId && detail ? (
            <AppText color="neutralMuted" variant="meta">
              {/* §10: «Utilizzato da {n} amministratori», zero compreso. */}
              {roleUsage(detail.adminsCount)}
            </AppText>
          ) : null}

          {inlineNameError ? (
            <AppText accessibilityRole="alert" color="danger" variant="meta">
              {inlineNameError}
            </AppText>
          ) : null}
        </View>

        <AppText color="neutral" variant="eyebrow">
          {ROLES_COPY.permissionsSection}
        </AppText>

        <View>
          {configurableAreas.map((area, index) => (
            <AreaLevelRow
              areaLabel={area.label}
              key={area.id}
              level={areaLevel(area, controlIds)}
              onPress={
                canEdit
                  ? () => {
                      setSheetAreaId(area.id);
                      trackRolesEvent("role_area_sheet_opened");
                    }
                  : undefined
              }
              showDivider={index > 0}
              testID={`role-area-${area.id}`}
            />
          ))}
        </View>

        {controlIds.length === 0 ? (
          <AppText color="neutralMuted" variant="meta">
            {ROLES_COPY.noAreasHelper}
          </AppText>
        ) : null}

        {!canEdit ? (
          <AppText color="neutralMuted" variant="meta">
            {ROLES_COPY.readOnly}
          </AppText>
        ) : null}

        {roleId && detail && hasChanges ? (
          <RoleImpactNotice adminsCount={detail.adminsCount} changes={changes} />
        ) : null}

        {bannerError ? (
          <View style={styles.banner}>
            <AppText accessibilityRole="alert" color="danger" variant="bodySm">
              {bannerError}
            </AppText>
          </View>
        ) : null}

        {canEdit ? (
          <Button
            disabled={saveDisabled}
            fullWidth
            label={roleId ? ROLES_COPY.saveCta : ROLES_COPY.createCta}
            loading={submit.isPending}
            onPress={() => {
              setBannerError(null);
              trackRolesEvent("role_save_submitted", {
                mode: roleId ? "edit" : "create",
              });
              submit.mutate();
            }}
            size="lg"
            testID="role-editor-save"
            variant="primary"
          />
        ) : null}

        {roleId && canEdit ? (
          <Button
            label={ROLES_COPY.cancelCta}
            onPress={goBack}
            testID="role-editor-cancel"
            variant="link"
          />
        ) : null}

        {roleId && detail?.canArchive ? (
          <Button
            destructive
            label={ROLES_COPY.archiveCta}
            onPress={() => setConfirmArchive(true)}
            testID="role-editor-archive"
            variant="link"
          />
        ) : null}
      </ScrollView>

      <AreaLevelSheet
        area={sheetArea}
        /* Rimonta la sheet a ogni apertura: è ciò che rende lo stato locale
           un draft usa-e-getta invece di qualcosa da risincronizzare. */
        key={`sheet-${sheetAreaId ?? "closed"}`}
        onClose={() => setSheetAreaId(null)}
        onConfirm={(next) => {
          if (!sheetAreaId) {
            return;
          }

          applyAreaControls(sheetAreaId, next);
          trackRolesEvent("role_area_level_confirmed", {
            level: sheetArea ? areaLevelOf(sheetArea, next) : "unknown",
          });
          setSheetAreaId(null);
        }}
        onCustomize={() => {
          setCustomAreaId(sheetAreaId);
          setSheetAreaId(null);
          trackRolesEvent("role_custom_opened");
        }}
        selectedControlIds={controlIds}
        visible={!!sheetArea}
      />

      <RolePermissionsModal
        area={customArea}
        key={`custom-${customAreaId ?? "closed"}`}
        clubIsVerified={center.clubIsVerified}
        clubLogoUrl={center.clubLogoUrl}
        clubName={center.clubName}
        onClose={() => setCustomAreaId(null)}
        onConfirm={(next) => {
          if (!customAreaId) {
            return;
          }

          applyAreaControls(customAreaId, next);
          trackRolesEvent("role_custom_confirmed");
          setCustomAreaId(null);
        }}
        selectedControlIds={
          customArea
            ? controlIds.filter((id) =>
                customArea.controls.some((control) => control.id === id),
              )
            : []
        }
        visible={!!customArea}
      />

      <ConfirmModal
        cancelLabel={ROLES_COPY.exitKeep}
        confirmLabel={ROLES_COPY.exitLeave}
        message={ROLES_COPY.exitBody}
        onCancel={() => setConfirmExit(false)}
        onConfirm={() => {
          setConfirmExit(false);
          trackRolesEvent("roles_unsaved_exit", {
            mode: roleId ? "edit" : "create",
          });
          router.back();
        }}
        title={ROLES_COPY.exitTitle}
        visible={confirmExit}
      />

      <ConfirmModal
        cancelLabel={ROLES_COPY.archiveKeep}
        confirmLabel={ROLES_COPY.archiveConfirm}
        destructive
        isBusy={archive.isPending}
        message={ROLES_COPY.archiveBody}
        onCancel={() => setConfirmArchive(false)}
        onConfirm={() => {
          trackRolesEvent("role_archive_submitted");
          archive.mutate();
        }}
        title={ROLES_COPY.archiveTitle}
        visible={confirmArchive}
      />
    </View>
  );
}

function roleUsage(adminsCount: number): string {
  return adminsCount === 0
    ? "Non ancora utilizzato"
    : adminsCount === 1
      ? "Utilizzato da 1 amministratore"
      : `Utilizzato da ${adminsCount} amministratori`;
}

/** Livello risultante da una conferma, per l'evento di analytics (§35). */
function areaLevelOf(
  area: Parameters<typeof areaLevel>[0],
  controls: string[],
): string {
  return areaLevel(area, controls);
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  content: {
    gap: spacing[16],
    padding: spacing[16],
  },
  field: {
    gap: spacing[6],
  },
  banner: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius[12],
    padding: spacing[12],
  },
});
