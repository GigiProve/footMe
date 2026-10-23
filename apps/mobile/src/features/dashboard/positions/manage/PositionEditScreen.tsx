/**
 * Editor di una Position già persistita (DAS-REV-17 §11, §20; screen 02,
 * 03, 08, 09).
 *
 * Una schermata sola per le quattro del mockup: 02/03 e 08/09 sono **due
 * posizioni di scroll dello stesso form**, non quattro passi. §6 lo dice
 * per lettera — «Non mostrare "1 di 3", progressi del wizard, "Continua" o
 * una sequenza obbligatoria di creazione nell'editor di una Position
 * esistente» — ed è il motivo per cui qui non compare
 * `ComposerStepHeader`.
 *
 * Bozza e attiva sono lo stesso form con whitelist diverse (§20): in bozza
 * profilo, ruolo, ambito e squadra sono righe modificabili; dopo la
 * pubblicazione diventano righe leggibili con una spiegazione accessibile
 * (§19). I **dettagli** sono gli stessi in entrambi i casi, e infatti
 * arrivano dallo stesso `PositionSchemaFields`.
 *
 * Flusso focalizzato: nessuna bottom navigation sopra i campi (§6).
 */
import { useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, sizes, spacing } from "../../../../theme/tokens";
import { AppText, useToast } from "../../../../ui";
import { useSession } from "../../../auth/use-session";
import { useUnsavedChangesGuard } from "../../../profiles/edit/use-unsaved-changes-guard";
import { STALE_MS } from "../../cache/freshness-policy";
import {
  DashboardGlobalEmpty,
  DashboardSkeleton,
} from "../../components/DashboardStates";
import { COMPOSE_QK, COMPOSE_INVALIDATION_PREFIXES } from "../compose/compose-keys";
import {
  COMPOSE_COPY,
  buildDetailsPatch,
  describeComposeError,
  detailsFormErrors,
  formFromDraft,
  incompatibleAreas,
  mergeSecondaryTeamOptions,
  validateCustomRoleName,
} from "../compose/compose-presentation";
import {
  CUSTOM_ROLE_PLACEHOLDER,
  POSITION_PROFILE_ORDER,
  POSITION_SCHEMAS,
} from "../compose/compose-schema";
import {
  fetchCatalogs,
  fetchComposerContext,
  fetchEligibleTeams,
  toComposeError,
  updatePositionDraft,
  type PositionPatch,
} from "../compose/compose-service";
import { ComposerFieldRow } from "../compose/components/ComposerFieldRow";
import { ComposerFooter } from "../compose/components/ComposerFooter";
import { ComposerNavBar } from "../compose/components/ComposerNavBar";
import { ComposerOptionSheet } from "../compose/components/ComposerOptionSheet";
import { ComposerTextField } from "../compose/components/ComposerTextField";
import {
  PositionSchemaFields,
  PositionSchemaFieldsError,
} from "../compose/components/PositionSchemaFields";
import type {
  PositionDetailsForm,
  PositionProfileType,
  PositionScope,
} from "../compose/compose-types";
import { POSITIONS_QK, POSITIONS_QK_PREFIXES } from "../positions-keys";
import { LockedIdentitySheet } from "./components/LockedIdentitySheet";
import { MANAGE_COPY, lockedInfoBody } from "./manage-presentation";
import { DETAILS_SECTION_ANCHOR } from "./manage-routes";
import {
  fetchPositionManageDetail,
  updatePublishedPosition,
  type PublishedPositionPatch,
} from "./manage-service";

const PROFILE_LABELS: Record<PositionProfileType, string> = {
  coach: "Allenatore",
  director: "Dirigente",
  player: "Calciatore",
  staff: "Staff",
};

const SCOPE_LABELS: Record<PositionScope, string> = {
  society: "Intera società",
  team: "Una squadra specifica",
};

/** Identità sportiva: ciò che la bozza può cambiare e l'attiva no (§19). */
type IdentityForm = {
  customRoleName: string;
  profileType: PositionProfileType;
  roleId: string | null;
  scope: PositionScope;
  teamId: string | null;
};

const DEFAULT_LIMITS = {
  ageMax: 70,
  ageMin: 5,
  customRoleName: 80,
  description: 2000,
  requirements: 1000,
  responsibilities: 1500,
  staffQualification: 300,
};

export function PositionEditScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";

  const params = useLocalSearchParams<{ anchor?: string; id?: string }>();
  const positionId = typeof params.id === "string" ? params.id : "";
  const anchor = typeof params.anchor === "string" ? params.anchor : null;

  const detailQuery = useQuery({
    enabled: !!positionId && !!actorId,
    queryFn: () => fetchPositionManageDetail(positionId),
    queryKey: POSITIONS_QK.detail(actorId, positionId),
    staleTime: STALE_MS.operational,
  });

  const detail = detailQuery.data ?? null;
  const clubId = detail?.clubId ?? null;

  const contextQuery = useQuery({
    enabled: !!clubId && !!actorId,
    queryFn: () => fetchComposerContext(clubId as string),
    queryKey: COMPOSE_QK.context(actorId, clubId ?? ""),
    staleTime: STALE_MS.operational,
  });

  const [identity, setIdentity] = useState<IdentityForm | null>(null);
  const [identityOriginal, setIdentityOriginal] = useState<IdentityForm | null>(null);
  const [form, setForm] = useState<PositionDetailsForm | null>(null);
  const [original, setOriginal] = useState<PositionDetailsForm | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [syncedKey, setSyncedKey] = useState<string | null>(null);
  const [isDirty, setDirty] = useState(false);

  /**
   * Il campo «Specifica il ruolo» è aperto?
   *
   * Si apre da solo quando il nome custom manca — §11 lo esige per
   * pubblicare — e quando l'utente riseleziona un ruolo «Altro», che è il
   * modo per rinominarlo. Resta chiuso su una bozza che un nome ce l'ha
   * già, come nello screen 02.
   */
  const [customRoleOpen, setCustomRoleOpen] = useState(false);
  const [profileSheet, setProfileSheet] = useState(false);
  const [roleSheet, setRoleSheet] = useState(false);
  const [scopeSheet, setScopeSheet] = useState(false);
  const [teamSheet, setTeamSheet] = useState(false);
  const [lockedSheet, setLockedSheet] = useState(false);

  /* Il buffer si risincronizza solo su una **versione** nuova, non a ogni
     refetch: §13 vieta di confondere «non ancora caricato» con «appena
     sovrascritto dall'utente». */
  const syncKey = detail ? `${detail.id}:${detail.resourceVersion}` : null;

  if (detail && syncKey && syncKey !== syncedKey) {
    setSyncedKey(syncKey);
    setForm(formFromDraft(detail));
    setOriginal(formFromDraft(detail));
    setIdentity(identityFromDetail(detail));
    setIdentityOriginal(identityFromDetail(detail));
    setCustomRoleOpen((detail.customRoleName ?? "").trim() === "");
    setFieldErrors({});
    setSaveError(null);
    setDirty(false);
  }

  const profileType = identity?.profileType ?? detail?.profileType ?? null;

  const catalogsQuery = useQuery({
    enabled: profileType !== null,
    queryFn: () => fetchCatalogs(profileType ?? "player"),
    queryKey: COMPOSE_QK.catalogs(profileType ?? "player"),
    staleTime: STALE_MS.management,
  });

  const teamsQuery = useQuery({
    enabled: !!clubId && !!actorId,
    queryFn: () => fetchEligibleTeams(clubId as string),
    queryKey: COMPOSE_QK.teams(actorId, clubId ?? ""),
    staleTime: STALE_MS.operational,
  });

  const scrollRef = useRef<ScrollView | null>(null);
  const anchorsRef = useRef<Record<string, number>>({});
  const detailsOffsetRef = useRef(0);
  const scrolledRef = useRef(false);

  const isDraft = detail?.lifecycle === "draft";
  const limits = contextQuery.data?.limits ?? DEFAULT_LIMITS;
  const schema = profileType ? POSITION_SCHEMAS[profileType] : null;

  const mutation = useMutation({
    mutationFn: (input: {
      patch: PositionPatch | PublishedPositionPatch;
    }) =>
      isDraft
        ? updatePositionDraft({
            expectedVersion: detail!.resourceVersion,
            patch: input.patch as PositionPatch,
            positionId: detail!.id,
          })
        : updatePublishedPosition({
            expectedVersion: detail!.resourceVersion,
            patch: input.patch as PublishedPositionPatch,
            positionId: detail!.id,
          }),
    onError: (error) => {
      /* §27: «Un errore di salvataggio conserva il buffer e mantiene
         l'editor aperto.» Nessuna navigazione, nessun reset. */
      setSaveError(describeComposeError(toComposeError(error)));
    },
    onSuccess: () => {
      /* §14 e §26: si invalidano dettaglio, Centro, conteggi e superfici
         collegate — per prefisso, perché le chiavi del Centro portano
         actor, Society, tab e filtro. */
      for (const prefix of [
        ...POSITIONS_QK_PREFIXES,
        ...COMPOSE_INVALIDATION_PREFIXES,
      ]) {
        queryClient.invalidateQueries({ queryKey: [prefix] });
      }

      setDirty(false);
      showToast({ message: MANAGE_COPY.saveSuccess, tone: "success" });
      router.back();
    },
  });

  const confirmExit = useUnsavedChangesGuard({
    isDirty: isDirty && detail !== null,
    isSaving: mutation.isPending,
    onLeave: () => {
      /* §13: «La seconda azione elimina soltanto le modifiche della
         sessione; non elimina la bozza già salvata né la Position
         attiva.» */
      setDirty(false);
      router.back();
    },
  });

  if (detailQuery.isLoading && !detail) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <DashboardSkeleton />
      </View>
    );
  }

  if (!detail || !form || !original || !identity || !identityOriginal || !schema) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <DashboardGlobalEmpty
          copy={{
            actionLabel: "Torna indietro",
            body: "Potrebbe essere stata eliminata o non essere più nel tuo perimetro.",
            icon: "briefcase-outline",
            title: MANAGE_COPY.gone,
          }}
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const catalogs = catalogsQuery.data ?? null;
  const roles = catalogs?.roles ?? [];
  const selectedRole = roles.find((role) => role.id === identity.roleId) ?? null;
  const eligibleTeams = (teamsQuery.data ?? []).filter((team) => team.canCreate);
  const selectedTeam =
    (teamsQuery.data ?? []).find((team) => team.teamId === identity.teamId) ?? null;

  function updateDetails(patch: Partial<PositionDetailsForm>) {
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));
    setFieldErrors((prev) => {
      const next = { ...prev };

      for (const key of Object.keys(patch)) {
        delete next[
          key === "ageMode" || key === "ageMin" || key === "ageMax"
            ? "ageRange"
            : key
        ];
      }

      return next;
    });
    setDirty(true);
  }

  function updateIdentity(patch: Partial<IdentityForm>) {
    setIdentity((prev) => (prev ? { ...prev, ...patch } : prev));
    setDirty(true);
  }

  /**
   * §11: «Cambio profilo, ruolo o scope deve rivalutare lo schema. Conserva
   * i dati compatibili; per quelli incompatibili applica il flusso di
   * conferma già previsto dal composer.»
   *
   * La conferma è richiesta **prima** di applicare, e annullarla lascia il
   * form com'era: §11 chiede di «conservare uno snapshot precedente fino
   * alla conferma del cambio».
   */
  function requestIdentityChange(patch: Partial<IdentityForm>) {
    const next = { ...identity!, ...patch };
    const areas = incompatibleAreas(detail!, {
      profileType: next.profileType,
      scope: next.scope,
    });

    if (areas.length === 0) {
      applyIdentityChange(patch);

      return;
    }

    Alert.alert(
      "Conferma modifica",
      `${COMPOSE_COPY.changeConfirmBody}\n\n${areas.join("\n")}`,
      [
        { style: "cancel", text: COMPOSE_COPY.changeConfirmKeep },
        {
          onPress: () => applyIdentityChange(patch),
          style: "destructive",
          text: COMPOSE_COPY.changeConfirmOk,
        },
      ],
    );
  }

  function applyIdentityChange(patch: Partial<IdentityForm>) {
    const next = { ...identity!, ...patch };

    /* §11: «Passando da Altro a un ruolo noto, elimina l'etichetta custom
       dalla nuova configurazione confermata.» E il cambio di profilo
       invalida il ruolo, che appartiene al catalogo del profilo
       precedente. */
    if (patch.profileType && patch.profileType !== identity!.profileType) {
      next.roleId = null;
      next.customRoleName = "";
    }

    /* §11: «Il cambio TEAM → SOCIETY rimuove il riferimento principale
       nella stessa trasformazione.» */
    if (next.scope === "society") {
      next.teamId = null;
    }

    setIdentity(next);

    /* Le secondarie seguono la squadra principale: §11 — «Se una secondaria
       diventa principale, rimuovi atomicamente il collegamento secondario
       duplicato nella modifica confermata.» */
    if (next.teamId !== identity!.teamId || next.scope !== identity!.scope) {
      updateDetails({
        secondaryTeamIds: form!.secondaryTeamIds.filter(
          (id) => id !== next.teamId,
        ),
      });
    }

    setDirty(true);
  }

  const customRoleError = selectedRole?.isCustom
    ? validateCustomRoleName(identity.customRoleName, limits)
    : null;

  function localErrors(): Record<string, string | null> {
    const errors = detailsFormErrors(form!, schema!.fields, limits);

    if (isDraft && customRoleError) {
      errors.customRoleName = customRoleError;
    }

    return errors;
  }

  function handleSave() {
    const errors = localErrors();

    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      /* §11: «porta focus/scroll al primo problema dopo un salvataggio non
         valido». L'ordine è quello dello schema, che è quello del form. */
      scrollToAnchor(Object.keys(errors)[0]);

      return;
    }

    const patch: Record<string, unknown> = buildDetailsPatch(original!, form!);

    if (isDraft) {
      /* §19 vieta questi campi **dopo** la pubblicazione, non prima: in
         bozza fanno parte della patch come gli altri. */
      if (identity!.profileType !== identityOriginal!.profileType) {
        patch.profileType = identity!.profileType;
      }

      if (identity!.roleId && identity!.roleId !== identityOriginal!.roleId) {
        patch.roleId = identity!.roleId;
      }

      if (identity!.customRoleName !== identityOriginal!.customRoleName) {
        patch.customRoleName = identity!.customRoleName.trim() || null;
      }

      if (identity!.scope !== identityOriginal!.scope) {
        patch.scope = identity!.scope;
      }

      if (identity!.teamId !== identityOriginal!.teamId) {
        patch.teamId = identity!.teamId;
      }
    }

    if (Object.keys(patch).length === 0) {
      /* §14: una patch vuota non bumpa la versione per nulla, e §21 vieta
         di dichiarare «Modifiche salvate» senza una conferma del server. */
      setDirty(false);
      router.back();

      return;
    }

    setSaveError(null);
    mutation.mutate({ patch: patch as PositionPatch });
  }

  function scrollToAnchor(key: string) {
    const base = key === DETAILS_SECTION_ANCHOR ? 0 : (anchorsRef.current[key] ?? null);

    if (key === DETAILS_SECTION_ANCHOR) {
      scrollRef.current?.scrollTo({
        animated: true,
        y: Math.max(detailsOffsetRef.current - spacing[16], 0),
      });

      return;
    }

    if (base === null) {
      return;
    }

    scrollRef.current?.scrollTo({ animated: true, y: Math.max(base - spacing[16], 0) });
  }

  /**
   * Lo scroll iniziale sull'ancora richiesta (§6).
   *
   * Una sola volta per montaggio: riportare lo scroll a ogni layout
   * impedirebbe all'utente di muoversi nel form.
   */
  function maybeScrollToInitialAnchor() {
    if (!anchor || scrolledRef.current) {
      return;
    }

    if (anchor === DETAILS_SECTION_ANCHOR || anchorsRef.current[anchor] !== undefined) {
      scrolledRef.current = true;
      scrollToAnchor(anchor);
    }
  }

  const identityLocked = !isDraft;
  const showRoleField = roles.length > 1;

  /**
   * Il ruolo è una scelta «Altro»?
   *
   * Il catalogo è la fonte quando è arrivato; finché non lo è — o se non
   * contiene più quel ruolo — vale quanto il server ha già detto sulla
   * Position. §27 vieta di «usare una lista di opzioni vuota come prova»
   * di qualcosa, e senza questo fallback una riga bloccata mostrerebbe
   * «Altro» al posto del nome che identifica l'annuncio.
   */
  const roleIsCustom = selectedRole
    ? selectedRole.isCustom
    : identity.roleId === detail.roleId && detail.roleIsCustom;

  const roleValue = roleIsCustom
    ? identity.customRoleName || selectedRole?.label || detail.roleLabel
    : (selectedRole?.label ?? detail.roleLabel);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ComposerNavBar
        isVerified={detail.clubIsVerified}
        logoUrl={detail.clubLogoUrl}
        name={detail.clubName}
        onBack={confirmExit}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        ref={scrollRef}
        style={styles.scroll}
        testID="position-edit-form"
      >
        <View style={styles.header}>
          <AppText accessibilityRole="header" color="neutral" variant="screenTitle">
            {MANAGE_COPY.editTitle}
          </AppText>

          {/* §11: «contesto sintetico della bozza». Lo stato e il titolo
              reale, non un passo di wizard. */}
          <AppText color="neutralMuted" variant="bodySm">
            {`${isDraft ? "Bozza" : "Attiva"} · ${detail.title ?? "Posizione"}`}
          </AppText>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <AppText color="neutral" variant="metaStrong">
              {MANAGE_COPY.lockedGroupLabel}
            </AppText>

            {/* §19: «Una piccola azione informativa accanto al titolo del
                gruppo apre lo sheet.» Con nome accessibile, non solo
                icona. */}
            {identityLocked ? (
              <Pressable
                accessibilityLabel={MANAGE_COPY.lockedInfoAction}
                accessibilityRole="button"
                hitSlop={10}
                onPress={() => setLockedSheet(true)}
                style={({ pressed }) => (pressed ? styles.pressed : null)}
                testID="position-edit-locked-info"
              >
                <Ionicons
                  color={colors.accent}
                  name="information-circle-outline"
                  size={20}
                />
              </Pressable>
            ) : null}
          </View>

          <View
            onLayout={(event) => {
              anchorsRef.current.profileType = event.nativeEvent.layout.y;
            }}
          >
            <ComposerFieldRow
              label="Profilo ricercato"
              locked={identityLocked}
              onPress={
                identityLocked
                  ? undefined
                  : () => setProfileSheet(true)
              }
              testID="position-edit-profile"
              value={PROFILE_LABELS[identity.profileType]}
            />
          </View>

          {showRoleField || identityLocked ? (
            <View
              onLayout={(event) => {
                anchorsRef.current.roleId = event.nativeEvent.layout.y;
              }}
            >
              <ComposerFieldRow
                label="Ruolo"
                locked={identityLocked}
                onPress={
                  identityLocked || !showRoleField
                    ? undefined
                    : () => setRoleSheet(true)
                }
                testID="position-edit-role"
                value={roleValue}
              />
            </View>
          ) : null}

          {/* §11: «passando a Altro, richiedi il nome custom per
              pubblicare». Il campo compare quando serve davvero — nome
              ancora assente, oppure ruolo custom appena riscelto — perché
              lo screen 02 mostra il nome **dentro** la riga Ruolo e non un
              input sempre aperto sotto di essa. Dopo la pubblicazione non
              compare mai: il nome identifica l'annuncio ed è fisso (§19). */}
          {!identityLocked && roleIsCustom && customRoleOpen ? (
            <View
              onLayout={(event) => {
                anchorsRef.current.customRoleName = event.nativeEvent.layout.y;
              }}
            >
              <ComposerTextField
                error={fieldErrors.customRoleName}
                label="Specifica il ruolo"
                limit={limits.customRoleName}
                multiline={false}
                onChangeText={(value) => updateIdentity({ customRoleName: value })}
                optional={false}
                placeholder={CUSTOM_ROLE_PLACEHOLDER[identity.profileType]}
                testID="position-edit-custom-role"
                value={identity.customRoleName}
              />
            </View>
          ) : null}

          {/* Su una Position attiva di squadra l'ambito è già detto dalla
              riga «Squadra principale»: lo screen 08 non lo ripete. Su un
              incarico societario quella riga non esiste, e allora l'ambito
              è l'unica cosa che lo dice (§19). In bozza resta sempre, perché
              lì è una scelta. */}
          {!identityLocked || identity.scope === "society" ? (
            <View
              onLayout={(event) => {
                anchorsRef.current.scope = event.nativeEvent.layout.y;
              }}
            >
              <ComposerFieldRow
                label="Ambito dell'incarico"
                locked={identityLocked}
                onPress={
                  identityLocked || !canChooseScope()
                    ? undefined
                    : () => setScopeSheet(true)
                }
                testID="position-edit-scope"
                value={SCOPE_LABELS[identity.scope]}
              />
            </View>
          ) : null}

          {identity.scope === "team" ? (
            <View
              onLayout={(event) => {
                anchorsRef.current.teamId = event.nativeEvent.layout.y;
              }}
            >
              <ComposerFieldRow
                /* La categoria è il **contesto** della squadra, non parte
                   del suo nome: lo screen 02 la mostra grigia sotto, e lo
                   screen 08 la affianca al nome perché lì la riga è
                   bloccata e non ha un secondo rigo. */
                helper={
                  identityLocked
                    ? null
                    : (selectedTeam?.contextLabel ?? detail.contextLabel)
                }
                label={identityLocked ? "Squadra principale" : "Squadra"}
                locked={identityLocked}
                onPress={identityLocked ? undefined : () => setTeamSheet(true)}
                testID="position-edit-team"
                value={
                  identityLocked
                    ? [detail.teamName, detail.contextLabel]
                        .filter(Boolean)
                        .join(" · ")
                    : (selectedTeam?.teamName ?? detail.teamName)
                }
              />
            </View>
          ) : null}

          {/* §19: «Sotto mostra "Queste informazioni restano fisse dopo la
              pubblicazione."» */}
          {identityLocked ? (
            <AppText color="neutralMuted" variant="meta">
              {MANAGE_COPY.lockedGroupNote}
            </AppText>
          ) : null}
        </View>

        <View
          onLayout={(event) => {
            detailsOffsetRef.current = event.nativeEvent.layout.y;
            maybeScrollToInitialAnchor();
          }}
          style={styles.section}
        >
          <AppText color="neutral" variant="metaStrong">
            {MANAGE_COPY.sectionDetails}
          </AppText>

          {catalogsQuery.isError ? (
            /* §27: «Se falliscono soltanto opzioni di un selector …, isola
               l'errore.» Il resto del form resta usabile. */
            <PositionSchemaFieldsError
              message={describeComposeError(toComposeError(catalogsQuery.error))}
              onRetry={() => void catalogsQuery.refetch()}
            />
          ) : (
            <PositionSchemaFields
              catalogs={catalogs}
              context={{
                contextLabel: detail.contextLabel,
                primaryTeamId: identity.teamId,
                primaryTeamName: selectedTeam?.teamName ?? detail.teamName,
                profileType: identity.profileType,
                scope: identity.scope,
              }}
              errors={fieldErrors}
              fields={schema.fields}
              limits={limits}
              onChange={updateDetails}
              onLayoutField={(key, y) => {
                anchorsRef.current[key] = detailsOffsetRef.current + y;
                maybeScrollToInitialAnchor();
              }}
              teams={mergeSecondaryTeamOptions(
                teamsQuery.data ?? [],
                detail.secondaryTeams,
              )}
              value={form}
            />
          )}
        </View>
      </ScrollView>

      {saveError ? (
        <AppText
          accessibilityRole="alert"
          color="danger"
          style={styles.saveError}
          variant="meta"
        >
          {saveError}
        </AppText>
      ) : null}

      {/* §11: «CTA sticky "Salva modifiche"». Mai «Pubblica», «Ripubblica»,
          «Programma» o «Salva come bozza» (§21). */}
      <ComposerFooter
        onPrimary={handleSave}
        primaryDisabled={!isDirty}
        primaryLabel={MANAGE_COPY.saveAction}
        primaryLoading={mutation.isPending}
        primaryTestID="position-edit-save"
      />

      <ComposerOptionSheet
        emptyMessage="Nessun profilo disponibile."
        onClose={() => setProfileSheet(false)}
        onToggle={(id) => {
          setProfileSheet(false);
          requestIdentityChange({ profileType: id as PositionProfileType });
        }}
        options={POSITION_PROFILE_ORDER.map((type) => ({
          id: type,
          label: PROFILE_LABELS[type],
        }))}
        selected={[identity.profileType]}
        title="Profilo ricercato"
        visible={profileSheet}
      />

      <ComposerOptionSheet
        emptyMessage="Nessun ruolo disponibile."
        onClose={() => setRoleSheet(false)}
        onToggle={(id) => {
          const isCustom = !!roles.find((role) => role.id === id)?.isCustom;

          setRoleSheet(false);
          /* Riselezionare «Altro» è il modo per rinominare: il campo si
             apre, col nome corrente dentro. */
          setCustomRoleOpen(isCustom);
          /* §11: «Passando da Altro a un ruolo noto, elimina l'etichetta
             custom dalla nuova configurazione confermata.» */
          updateIdentity({
            customRoleName: isCustom ? identity.customRoleName : "",
            roleId: id,
          });
        }}
        options={roles.map((role) => ({ id: role.id, label: role.label }))}
        selected={identity.roleId ? [identity.roleId] : []}
        title="Ruolo"
        visible={roleSheet}
      />

      <ComposerOptionSheet
        emptyMessage="Nessun ambito disponibile."
        onClose={() => setScopeSheet(false)}
        onToggle={(id) => {
          setScopeSheet(false);
          requestIdentityChange({ scope: id as PositionScope });
        }}
        options={[
          {
            /* §9: «Solo il profilo Dirigente può utilizzare l'ambito
               "Intera società"», e serve l'autorizzazione societaria. */
            disabled:
              identity.profileType !== "director" ||
              !contextQuery.data?.canCreateSociety,
            id: "society",
            label: SCOPE_LABELS.society,
          },
          { id: "team", label: SCOPE_LABELS.team },
        ]}
        selected={[identity.scope]}
        title="Ambito dell'incarico"
        visible={scopeSheet}
      />

      <ComposerOptionSheet
        emptyMessage="Nessuna squadra disponibile."
        onClose={() => setTeamSheet(false)}
        onToggle={(id) => {
          setTeamSheet(false);
          applyIdentityChange({ teamId: id });
        }}
        options={eligibleTeams.map((team) => ({
          id: team.teamId,
          label: team.teamName,
          meta: team.contextLabel,
        }))}
        selected={identity.teamId ? [identity.teamId] : []}
        title="Squadra"
        visible={teamSheet}
      />

      <LockedIdentitySheet
        body={lockedInfoBody(detail)}
        onClose={() => setLockedSheet(false)}
        visible={lockedSheet}
      />
    </View>
  );

  function canChooseScope(): boolean {
    return (
      identity!.profileType === "director" &&
      !!contextQuery.data?.canCreateSociety
    );
  }
}

function identityFromDetail(detail: {
  customRoleName: string | null;
  profileType: PositionProfileType;
  roleId: string | null;
  scope: PositionScope;
  teamId: string | null;
}): IdentityForm {
  return {
    customRoleName: detail.customRoleName ?? "",
    profileType: detail.profileType,
    roleId: detail.roleId,
    scope: detail.scope,
    teamId: detail.teamId,
  };
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[24],
    paddingBottom: spacing[32],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[8],
  },
  header: {
    gap: spacing[4],
  },
  pressed: {
    opacity: 0.6,
  },
  saveError: {
    paddingHorizontal: spacing[20],
    paddingTop: spacing[8],
  },
  screen: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  section: {
    gap: spacing[8],
  },
  sectionHead: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    minHeight: sizes.touchTarget - spacing[12],
  },
});
