/**
 * Conferma del trasferimento di ownership (DAS-REV-14, screen 12).
 *
 * «Mostra Society, nuovo Owner, precedente Owner e conseguenze prima della
 * CTA finale» (§20). È l'ultimo passo: Annulla torna alla selezione senza
 * nessuna modifica server.
 *
 * Due rami, non due schermate:
 *
 *   A — il vecchio Owner ha già un ruolo operativo valido: §20 vuole un
 *       riepilogo in sola lettura, «non obbligare a riconfigurarli soltanto
 *       per aprire questa schermata».
 *   B — non ce l'ha: §20 chiede «un ruolo normale attivo e un ambito validi
 *       prima di permettere il trasferimento». È il caso del mockup, con i
 *       selector compilati ma **non ancora salvati**: la configurazione
 *       viaggia dentro il comando di trasferimento, non prima.
 *
 * Nessun fallback invisibile: se il ramo B non è compilato la CTA resta
 * disabilitata, e §20 vieta di assegnare un ruolo per conto dell'utente.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radius, sizes, spacing } from "../../../../theme/tokens";
import {
  AppText,
  Avatar,
  BottomSheet,
  Button,
  ConfirmModal,
  Radio,
} from "../../../../ui";
import { useToast } from "../../../../ui/Toast/ToastProvider";
import { useSession } from "../../../auth/use-session";
import { NetworkNavBar } from "../../../network/components/NetworkNavBar";
import { STALE_MS } from "../../cache/freshness-policy";
import {
  DashboardGlobalEmpty,
  DashboardGlobalError,
  DashboardSkeleton,
} from "../../components/DashboardStates";
import { SocietyIdentityHeader } from "../../components/SocietyIdentityHeader";
import { useDashboardIdentity } from "../../identity/use-dashboard-identity";
import { DASHBOARD_QK } from "../../dashboard-keys";
import { ROLES_COPY } from "../../roles/roles-presentation";
import { trackRolesEvent } from "../../roles/roles-analytics";
import { AdminOptionSheet } from "../components/AdminOptionSheet";
import { useOperationKey } from "../../roles/use-operation-key";
import { ADMINS_QK } from "../admins-keys";
import { ADMIN_HREFS } from "../admins-routes";
import { fetchAssignableRoles } from "../admins-service";
import { AccessFieldRow } from "./components/AccessFieldRow";
import { describeRolesErrorSafe } from "./access-error";
import { ACCESS_QK, ACCESS_QK_PREFIXES } from "./access-keys";
import {
  ACCESS_COPY,
  newOwnerHelper,
  scopeSummary,
  teamSelectionLabel,
} from "./access-presentation";
import {
  fetchAdminAccessDetail,
  fetchScopeTeams,
  transferOwnership,
} from "./access-service";
import type { AdminScopeMode } from "./access-types";

const INVALIDATE_PREFIXES = [
  ...ACCESS_QK_PREFIXES,
  "society-admin-center",
  "society-admins",
] as const;

export function OwnerTransferScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { current } = useDashboardIdentity();
  const clubId = current?.kind === "society" ? current.id : null;
  const clubName = current?.name ?? "";
  const params = useLocalSearchParams<{ newOwnerId?: string }>();
  const newOwnerId =
    typeof params.newOwnerId === "string" ? params.newOwnerId : null;

  const [legacyRoleId, setLegacyRoleId] = useState<string | null>(null);
  const [legacyScopeMode, setLegacyScopeMode] =
    useState<AdminScopeMode | null>(null);
  const [legacyTeamIds, setLegacyTeamIds] = useState<string[]>([]);
  const [roleSheetVisible, setRoleSheetVisible] = useState(false);
  const [scopeSheetVisible, setScopeSheetVisible] = useState(false);
  const [teamSheetVisible, setTeamSheetVisible] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [forceLegacy, setForceLegacy] = useState(false);

  /* La configurazione operativa del vecchio Owner fa parte del comando
     (§21 punto 4): cambiarla cambia l'operazione, e con essa la chiave. */
  const operationKey = useOperationKey(
    `${newOwnerId ?? ""}|${legacyRoleId ?? ""}|${legacyScopeMode ?? ""}|${[...legacyTeamIds].sort().join(",")}`,
  );

  const enabled = !!clubId && !!actorId && !!newOwnerId;

  /* Quattro letture indipendenti: §2 della Foundation chiede di «fetchare in
     parallelo quando le richieste sono indipendenti», e qui nessuna dipende
     dall'altra. */
  const [newOwnerQuery, currentOwnerQuery, rolesQuery, teamsQuery] = useQueries({
    queries: [
      {
        enabled,
        queryFn: () =>
          fetchAdminAccessDetail({
            clubId: clubId as string,
            profileId: newOwnerId as string,
          }),
        queryKey: ACCESS_QK.detail(actorId, clubId ?? "", newOwnerId ?? ""),
        staleTime: STALE_MS.management,
      },
      {
        enabled,
        queryFn: () =>
          fetchAdminAccessDetail({
            clubId: clubId as string,
            profileId: actorId,
          }),
        queryKey: ACCESS_QK.detail(actorId, clubId ?? "", actorId),
        staleTime: STALE_MS.management,
      },
      {
        enabled,
        queryFn: () => fetchAssignableRoles(clubId as string),
        queryKey: ADMINS_QK.roles(actorId, clubId ?? ""),
        staleTime: STALE_MS.management,
      },
      {
        enabled,
        queryFn: () => fetchScopeTeams(clubId as string),
        queryKey: ACCESS_QK.scopeTeams(actorId, clubId ?? ""),
        staleTime: STALE_MS.management,
      },
    ],
  });

  const newOwner = newOwnerQuery.data ?? null;
  const currentOwner = currentOwnerQuery.data ?? null;
  /* `?? []` produrrebbe un array nuovo a ogni render, e i useMemo che lo
     leggono ricalcolerebbero sempre. */
  const roles = useMemo(() => rolesQuery.data ?? [], [rolesQuery.data]);
  const teams = useMemo(() => teamsQuery.data ?? [], [teamsQuery.data]);

  /**
   * Ramo A quando il vecchio Owner ha già una configurazione operativa
   * valida. `forceLegacy` lo scavalca quando il server risponde
   * OWNER_LEGACY_CONFIG_REQUIRED: la sua verità vince su questa lettura.
   */
  const needsLegacyConfig =
    forceLegacy ||
    !currentOwner ||
    !currentOwner.roleIsNamed ||
    !currentOwner.membershipId;

  useEffect(() => {
    trackRolesEvent("owner_transfer_reviewed");
  }, []);

  const selectedTeamNames = useMemo(
    () =>
      teams
        .filter((team) => legacyTeamIds.includes(team.teamId))
        .map((team) => team.name),
    [legacyTeamIds, teams],
  );

  const legacyRoleLabel = useMemo(
    () => roles.find((role) => role.roleId === legacyRoleId)?.name ?? null,
    [legacyRoleId, roles],
  );

  const legacyScopeLabel = useMemo(() => {
    if (legacyScopeMode === "society") {
      return ACCESS_COPY.scopeSocietyLabel;
    }

    if (legacyScopeMode === "teams") {
      return scopeSummary(selectedTeamNames) ?? ACCESS_COPY.scopeTeamsLabel;
    }

    return null;
  }, [legacyScopeMode, selectedTeamNames]);

  const legacyReady =
    !needsLegacyConfig ||
    (!!legacyRoleId &&
      (legacyScopeMode === "society" ||
        (legacyScopeMode === "teams" && legacyTeamIds.length > 0)));

  const hasPartialDraft =
    needsLegacyConfig && (!!legacyRoleId || legacyScopeMode !== null);

  const transfer = useMutation({
    mutationFn: () =>
      transferOwnership({
        clubId: clubId as string,
        expectedVersion: null,
        idempotencyKey: operationKey(),
        legacyRoleId: needsLegacyConfig ? legacyRoleId : null,
        legacyScopeMode: needsLegacyConfig ? legacyScopeMode : null,
        legacyTeamIds:
          needsLegacyConfig && legacyScopeMode === "teams"
            ? legacyTeamIds
            : null,
        newOwnerId: newOwnerId as string,
      }),
    onError: (error) => {
      const message = describeRolesErrorSafe(error);

      setBannerError(message);
      trackRolesEvent("owner_transfer_result", { outcome: "error" });

      if (String(error).includes("OWNER_LEGACY_CONFIG_REQUIRED")) {
        setForceLegacy(true);
      }

      if (String(error).includes("OWNER_CHANGED")) {
        void currentOwnerQuery.refetch();
        void newOwnerQuery.refetch();
      }
    },
    onSuccess: async () => {
      showToast({ message: ACCESS_COPY.transferredToast, tone: "success" });
      trackRolesEvent("owner_transfer_result", { outcome: "success" });

      for (const prefix of INVALIDATE_PREFIXES) {
        await queryClient.invalidateQueries({ queryKey: [prefix] });
      }

      /* Le capability dell'actor sono appena cambiate: l'identità della
         Dashboard va riletta, altrimenti la sessione continuerebbe a
         mostrare i poteri dell'Owner. */
      await queryClient.invalidateQueries({
        queryKey: DASHBOARD_QK.identities(actorId),
      });

      /* Il dettaglio Owner da cui si è arrivati non descrive più questa
         persona: `replace`, non `back`. */
      router.replace(ADMIN_HREFS.center("dashboard") as never);
    },
  });

  const goBack = useCallback(() => {
    if (transfer.isPending) {
      return;
    }

    if (teamSheetVisible) {
      setTeamSheetVisible(false);

      return;
    }

    if (scopeSheetVisible) {
      setScopeSheetVisible(false);

      return;
    }

    if (roleSheetVisible) {
      setRoleSheetVisible(false);

      return;
    }

    if (hasPartialDraft) {
      setConfirmExit(true);

      return;
    }

    router.back();
  }, [
    hasPartialDraft,
    roleSheetVisible,
    router,
    scopeSheetVisible,
    teamSheetVisible,
    transfer.isPending,
  ]);

  if (!clubId || !newOwnerId) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <DashboardGlobalEmpty
          copy={{
            actionLabel: "Torna al centro",
            body: ACCESS_COPY.transferEmptyHelper,
            icon: "swap-horizontal-outline",
            title: ACCESS_COPY.transferEmptyTitle,
          }}
          onAction={() => router.replace(ADMIN_HREFS.center() as never)}
        />
      </View>
    );
  }

  if ((newOwnerQuery.isLoading && !newOwner) || (currentOwnerQuery.isLoading && !currentOwner)) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <NetworkNavBar onBack={goBack} title={ACCESS_COPY.transferTitle} />
        <View style={styles.content}>
          <DashboardSkeleton />
        </View>
      </View>
    );
  }

  if (!newOwner) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <NetworkNavBar onBack={goBack} title={ACCESS_COPY.transferTitle} />
        <DashboardGlobalError
          body={ACCESS_COPY.candidatesError}
          onRetry={() => void newOwnerQuery.refetch()}
          title={ACCESS_COPY.transferTitle}
        />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <NetworkNavBar onBack={goBack} title={ACCESS_COPY.transferTitle} />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing[24] },
        ]}
      >
        <SocietyIdentityHeader
          isVerified={current?.isVerified ?? false}
          logoUrl={current?.avatarUrl ?? null}
          name={clubName}
        />

        <AppText color="neutral" variant="titleMd">
          {ACCESS_COPY.transferQuestion}
        </AppText>

        <AppText color="neutral" variant="eyebrow">
          {ACCESS_COPY.transferNewOwnerSection}
        </AppText>

        <View style={styles.card}>
          <Avatar
            name={newOwner.fullName}
            size="md"
            uri={newOwner.avatarUrl ?? undefined}
          />

          <View style={styles.cardBody}>
            <AppText color="neutral" numberOfLines={2} variant="titleSm">
              {newOwner.fullName}
            </AppText>

            <AppText color="neutralMuted" variant="meta">
              {ACCESS_COPY.transferNewOwnerBadge}
            </AppText>
          </View>
        </View>

        <AppText color="neutralMuted" variant="meta">
          {newOwnerHelper(newOwner.fullName, clubName)}
        </AppText>

        <AppText color="neutral" variant="eyebrow">
          {ACCESS_COPY.transferAfterSection}
        </AppText>

        <View style={styles.card}>
          <Avatar
            name={currentOwner?.fullName ?? ""}
            size="md"
            uri={currentOwner?.avatarUrl ?? undefined}
          />

          <View style={styles.cardBody}>
            <AppText color="neutral" numberOfLines={2} variant="titleSm">
              {currentOwner?.fullName ?? ""}
            </AppText>
          </View>
        </View>

        <View>
          <AccessFieldRow
            label={ACCESS_COPY.roleRow}
            onPress={
              needsLegacyConfig ? () => setRoleSheetVisible(true) : undefined
            }
            testID="owner-transfer-role"
            value={
              needsLegacyConfig
                ? legacyRoleLabel
                : (currentOwner?.roleLabel ?? null)
            }
          />

          <AccessFieldRow
            label={ACCESS_COPY.scopeRow}
            onPress={
              needsLegacyConfig ? () => setScopeSheetVisible(true) : undefined
            }
            testID="owner-transfer-scope"
            value={
              needsLegacyConfig
                ? legacyScopeLabel
                : (currentOwner?.scopeLabel ?? null)
            }
          />
        </View>

        <AppText color="neutralMuted" variant="meta">
          {ACCESS_COPY.transferAfterHelper}
        </AppText>

        {bannerError ? (
          <View style={styles.banner}>
            <AppText accessibilityRole="alert" color="danger" variant="bodySm">
              {bannerError}
            </AppText>
          </View>
        ) : null}

        <Button
          disabled={!legacyReady || transfer.isPending}
          fullWidth
          label={ACCESS_COPY.transferCta}
          loading={transfer.isPending}
          onPress={() => {
            setBannerError(null);
            trackRolesEvent("owner_transfer_submitted");
            transfer.mutate();
          }}
          size="lg"
          testID="owner-transfer-submit"
          variant="primary"
        />

        <Button
          label={ACCESS_COPY.transferCancelCta}
          onPress={goBack}
          testID="owner-transfer-cancel"
          variant="link"
        />
      </ScrollView>

      <AdminOptionSheet
        emptyMessage={ACCESS_COPY.noAssignableRoles}
        onClose={() => setRoleSheetVisible(false)}
        onToggle={(id) => setLegacyRoleId(id)}
        options={roles.map((role) => ({ id: role.roleId, label: role.name }))}
        selected={legacyRoleId ? [legacyRoleId] : []}
        title={ACCESS_COPY.roleRow}
        visible={roleSheetVisible}
      />

      <BottomSheet
        onClose={() => setScopeSheetVisible(false)}
        title={ACCESS_COPY.scopeTitle}
        visible={scopeSheetVisible}
      >
        <View style={styles.sheet}>
          <Radio
            checked={legacyScopeMode === "society"}
            label={ACCESS_COPY.scopeSocietyLabel}
            onPress={() => {
              setLegacyScopeMode("society");
              setLegacyTeamIds([]);
            }}
            tone="neutral"
          />

          <AppText color="neutralMuted" style={styles.sheetHelper} variant="bodySm">
            {ACCESS_COPY.scopeSocietyHelper}
          </AppText>

          <Radio
            checked={legacyScopeMode === "teams"}
            label={ACCESS_COPY.scopeTeamsLabel}
            onPress={() => setLegacyScopeMode("teams")}
            tone="neutral"
          />

          <AppText color="neutralMuted" style={styles.sheetHelper} variant="bodySm">
            {ACCESS_COPY.scopeTeamsHelper}
          </AppText>

          {legacyScopeMode === "teams" ? (
            <Button
              label={
                legacyTeamIds.length > 0
                  ? `${ACCESS_COPY.scopeEditSelection} · ${teamSelectionLabel(legacyTeamIds.length)}`
                  : ACCESS_COPY.scopeTeamsLabel
              }
              onPress={() => setTeamSheetVisible(true)}
              testID="owner-transfer-teams"
              variant="link"
            />
          ) : null}

          <Button
            disabled={
              legacyScopeMode === null ||
              (legacyScopeMode === "teams" && legacyTeamIds.length === 0)
            }
            fullWidth
            label={ACCESS_COPY.transferContinueCta}
            onPress={() => setScopeSheetVisible(false)}
            size="lg"
            variant="primary"
          />
        </View>
      </BottomSheet>

      <AdminOptionSheet
        emptyMessage={ACCESS_COPY.teamPickerEmpty}
        multiple
        onClose={() => setTeamSheetVisible(false)}
        onToggle={(id) =>
          setLegacyTeamIds((value) =>
            value.includes(id)
              ? value.filter((item) => item !== id)
              : [...value, id],
          )
        }
        options={teams.map((team) => ({ id: team.teamId, label: team.name }))}
        selected={legacyTeamIds}
        title={ACCESS_COPY.teamPickerTitle}
        visible={teamSheetVisible}
      />

      <ConfirmModal
        cancelLabel={ROLES_COPY.exitKeep}
        confirmLabel={ROLES_COPY.exitLeave}
        message={ROLES_COPY.exitBody}
        onCancel={() => setConfirmExit(false)}
        onConfirm={() => {
          setConfirmExit(false);
          trackRolesEvent("roles_unsaved_exit", { surface: "owner_transfer" });
          router.back();
        }}
        title={ROLES_COPY.exitTitle}
        visible={confirmExit}
      />
    </View>
  );
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
  card: {
    alignItems: "center",
    borderColor: colors.borderNeutral,
    borderRadius: radius[16],
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget,
    padding: spacing[12],
  },
  cardBody: {
    flex: 1,
    gap: spacing[4],
  },
  sheet: {
    gap: spacing[12],
  },
  sheetHelper: {
    paddingLeft: spacing[32],
  },
  banner: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius[12],
    padding: spacing[12],
  },
});
