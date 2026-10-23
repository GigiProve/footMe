/**
 * Step 1 del composer Position — «Nuova posizione» (DAS-REV-16, screen 01,
 * 02, 03, 09).
 *
 * Un solo schermo raccoglie identità minima (profilo, ruolo, ambito,
 * squadra): §6 vieta campi opzionali obbligatori «perché una schermata è
 * stata aperta», e infatti nessun dettaglio vive qui. §21 vieta di creare
 * record server vuoti all'apertura: la Position nasce solo quando l'utente
 * preme «Continua».
 */
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../../../../theme/tokens";
import { AppText, Button } from "../../../../ui";
import { useSession } from "../../../auth/use-session";
import { STALE_MS } from "../../cache/freshness-policy";
import {
  DashboardGlobalEmpty,
  DashboardSkeleton,
} from "../../components/DashboardStates";
import { useDashboardIdentity } from "../../identity/use-dashboard-identity";
import { BatchSummary } from "./components/BatchSummary";
import { ComposerFieldRow } from "./components/ComposerFieldRow";
import { ComposerFooter } from "./components/ComposerFooter";
import { ComposerNavBar } from "./components/ComposerNavBar";
import {
  ComposerOptionSheet,
  type ComposerOption,
} from "./components/ComposerOptionSheet";
import { ComposerStepHeader } from "./components/ComposerStepHeader";
import { ComposerTextField } from "./components/ComposerTextField";
import { useComposeSession } from "./ComposeSessionProvider";
import { trackComposeEvent } from "./compose-analytics";
import { COMPOSE_QK } from "./compose-keys";
import { COMPOSE_HREFS } from "./compose-routes";
import {
  CUSTOM_ROLE_PLACEHOLDER,
  POSITION_PROFILE_ORDER,
  POSITION_SCHEMAS,
} from "./compose-schema";
import {
  COMPOSE_COPY,
  describeComposeError,
  validateCustomRoleName,
} from "./compose-presentation";
import {
  createPositionDrafts,
  fetchCatalogs,
  fetchComposerContext,
  fetchEligibleTeams,
  toComposeError,
} from "./compose-service";
import type {
  PositionEligibleTeam,
  PositionProfileType,
  PositionScope,
} from "./compose-types";

const SCOPE_LABELS: Record<PositionScope, string> = {
  society: "Intera società",
  team: "Una squadra specifica",
};

export function PositionComposeStartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { current } = useDashboardIdentity();
  const clubId = current?.kind === "society" ? current.id : null;

  const params = useLocalSearchParams<{
    from?: string;
    scope?: string;
    teamId?: string;
  }>();
  const routeTeamId = typeof params.teamId === "string" ? params.teamId : null;

  const { createOperationKey, createdIds, proposal, setCreatedIds, setProposal } =
    useComposeSession();

  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const [roleSheetOpen, setRoleSheetOpen] = useState(false);
  const [scopeSheetOpen, setScopeSheetOpen] = useState(false);
  const [teamSheetOpen, setTeamSheetOpen] = useState(false);
  const [additionalSheetOpen, setAdditionalSheetOpen] = useState(false);
  const [additionalDraft, setAdditionalDraft] = useState<string[]>([]);
  const [customRoleTouched, setCustomRoleTouched] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const contextQuery = useQuery({
    enabled: !!clubId && !!actorId,
    queryFn: () => fetchComposerContext(clubId as string),
    queryKey: COMPOSE_QK.context(actorId, clubId ?? ""),
    staleTime: STALE_MS.operational,
  });

  const teamsQuery = useQuery({
    enabled: !!clubId && !!actorId,
    queryFn: () => fetchEligibleTeams(clubId as string),
    queryKey: COMPOSE_QK.teams(actorId, clubId ?? ""),
    staleTime: STALE_MS.operational,
  });

  const catalogsQuery = useQuery({
    enabled: !!proposal.profileType,
    queryFn: () => fetchCatalogs(proposal.profileType as PositionProfileType),
    queryKey: COMPOSE_QK.catalogs(proposal.profileType ?? "player"),
    staleTime: STALE_MS.management,
  });

  const roles = catalogsQuery.data?.roles ?? [];
  const selectedRole = roles.find((role) => role.id === proposal.roleId) ?? null;
  const showRoleField = !!proposal.profileType && roles.length > 1;
  const roleLoadFailed =
    !!proposal.profileType && catalogsQuery.isSuccess && roles.length === 0;

  /* §8: «Ruolo unico assegnato senza selector.» Un solo ruolo nel catalogo
     non è una scelta: si applica e il campo non compare.
     La dipendenza è l'**id** e non l'array: `roles` nasce da un `??` e ha
     identità nuova a ogni render, quindi l'effetto ripartirebbe sempre. */
  const soleRoleId = roles.length === 1 ? roles[0].id : null;

  useEffect(() => {
    if (soleRoleId && proposal.roleId !== soleRoleId) {
      setProposal({ roleId: soleRoleId });
    }
  }, [proposal.roleId, setProposal, soleRoleId]);

  const eligibleTeams = (teamsQuery.data ?? []).filter((team) => team.canCreate);
  const selectedTeam =
    eligibleTeams.find((team) => team.teamId === proposal.primaryTeamId) ?? null;
  /* §5: «Con più Team e nessuna scelta contestuale non assegnare la Prima
     squadra arbitrariamente.» L'unica preselezione automatica lecita è
     quando esiste davvero una sola squadra eleggibile e nessuna è arrivata
     esplicitamente dalla route. */
  const isTeamFieldInformative = eligibleTeams.length === 1 && !routeTeamId;

  useEffect(() => {
    if (proposal.scope !== "team" || routeTeamId) {
      return;
    }

    if (eligibleTeams.length === 1 && proposal.primaryTeamId !== eligibleTeams[0].teamId) {
      setProposal({ primaryTeamId: eligibleTeams[0].teamId });
    }
  }, [proposal.scope, proposal.primaryTeamId, eligibleTeams, routeTeamId, setProposal]);

  const scopeOptions: ComposerOption[] = [
    { disabled: !contextQuery.data?.canCreateSociety, id: "society", label: SCOPE_LABELS.society },
    { id: "team", label: SCOPE_LABELS.team },
  ];
  const enabledScopeOptions = scopeOptions.filter((option) => !option.disabled);
  const isScopeFieldInformative = enabledScopeOptions.length <= 1;

  /* Quando l'unica modalità autorizzata è TEAM, lo stato di sessione non deve
     restare su SOCIETY: §9 riserva l'ambito Society-level al Dirigente
     autorizzato, non a un default residuo di un'altra schermata. */
  useEffect(() => {
    if (
      proposal.profileType === "director" &&
      !contextQuery.data?.canCreateSociety &&
      proposal.scope !== "team"
    ) {
      setProposal({ scope: "team" });
    }
  }, [proposal.profileType, proposal.scope, contextQuery.data?.canCreateSociety, setProposal]);

  const otherTeams = eligibleTeams.filter((team) => team.teamId !== proposal.primaryTeamId);
  const showSecondSearchAction =
    proposal.scope === "team" && !!proposal.primaryTeamId && otherTeams.length > 0;

  /**
   * Il riepilogo elenca **tutte** le Position che nasceranno, principale
   * compresa: §10 mostra Prima squadra e Primavera e conclude con «2
   * posizioni distinte», e un elenco delle sole aggiuntive conterebbe una
   * ricerca in meno di quante ne crea «Continua».
   */
  const batchRows = [proposal.primaryTeamId, ...proposal.additionalTeamIds]
    .map((id) => eligibleTeams.find((team) => team.teamId === id))
    .filter((team): team is PositionEligibleTeam => !!team)
    .map((team) => ({ contextLabel: team.contextLabel, teamName: team.teamName }));

  const customRoleError = selectedRole?.isCustom
    ? validateCustomRoleName(proposal.customRoleName, contextQuery.data?.limits ?? {
        ageMax: 70,
        ageMin: 5,
        customRoleName: 80,
        description: 2000,
        requirements: 1000,
        responsibilities: 1500,
        staffQualification: 300,
      })
    : null;

  const canContinue =
    !!proposal.profileType &&
    !!proposal.roleId &&
    (!selectedRole?.isCustom || customRoleError === null) &&
    (proposal.scope !== "team" || !!proposal.primaryTeamId);

  const createMutation = useMutation({
    mutationFn: () =>
      createPositionDrafts({
        clubId: clubId as string,
        customRoleName: selectedRole?.isCustom
          ? proposal.customRoleName.trim() || null
          : null,
        operationKey: createOperationKey,
        profileType: proposal.profileType as PositionProfileType,
        roleId: proposal.roleId as string,
        scope: proposal.scope,
        teamIds:
          proposal.scope === "society"
            ? []
            : [proposal.primaryTeamId as string, ...proposal.additionalTeamIds],
      }),
    onError: (err) => {
      const composeError = toComposeError(err);
      setSubmitError(describeComposeError(composeError));
    },
    onSuccess: (rows) => {
      const ids = rows.map((row) => row.positionId);

      setSubmitError(null);
      setCreatedIds(ids);
      trackComposeEvent("position_compose_drafts_created", {
        count: ids.length,
        mode: ids.length > 1 ? "batch" : "single",
        profileType: proposal.profileType ?? undefined,
        scope: proposal.scope,
      });
      navigateAfterCreate(ids);
    },
  });

  function navigateAfterCreate(ids: string[]) {
    if (ids.length === 1) {
      router.replace(COMPOSE_HREFS.details(ids[0], { from: "single" }) as never);

      return;
    }

    router.replace(COMPOSE_HREFS.hub() as never);
  }

  function handleProfileSelect(next: PositionProfileType) {
    const supportsSociety = POSITION_SCHEMAS[next].supportsSocietyScope;

    setProposal({
      customRoleName: "",
      profileType: next,
      roleId: null,
      /* Cambiare profilo non porta con sé un ambito che il nuovo profilo non
         supporta — solo il Dirigente ammette SOCIETY (§9, §17). */
      scope: supportsSociety ? proposal.scope : "team",
    });
    setCustomRoleTouched(false);
    setProfileSheetOpen(false);
    trackComposeEvent("position_compose_profile_selected", { profileType: next });
  }

  function handleRoleSelect(id: string) {
    setProposal({ customRoleName: "", roleId: id });
    setCustomRoleTouched(false);
    setRoleSheetOpen(false);
  }

  function handleScopeSelect(id: string) {
    setProposal({ scope: id as PositionScope });
    setScopeSheetOpen(false);
  }

  function handleTeamSelect(id: string) {
    setProposal({
      additionalTeamIds: proposal.additionalTeamIds.filter((teamId) => teamId !== id),
      primaryTeamId: id,
    });
    setTeamSheetOpen(false);
  }

  function openAdditionalSheet() {
    setAdditionalDraft(proposal.additionalTeamIds);
    setAdditionalSheetOpen(true);
  }

  function toggleAdditionalDraft(id: string) {
    setAdditionalDraft((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );
  }

  function confirmAdditionalSheet() {
    setProposal({ additionalTeamIds: additionalDraft });
    setAdditionalSheetOpen(false);

    if (additionalDraft.length > 0) {
      trackComposeEvent("position_compose_second_search_added", {
        count: additionalDraft.length,
      });
    }
  }

  function handleContinue() {
    /* §4: l'errore del ruolo custom deve comparire anche se qualcuno riesce
       a premere Continua prima di toccare il campo. */
    setCustomRoleTouched(true);

    if (!canContinue) {
      return;
    }

    if (createdIds.length > 0) {
      navigateAfterCreate(createdIds);

      return;
    }

    createMutation.mutate();
  }

  const notAuthorized =
    contextQuery.error instanceof Error &&
    contextQuery.error.message.includes("POSITION_COMPOSER_NOT_AUTHORIZED");

  if (!clubId || (contextQuery.isError && notAuthorized)) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <DashboardGlobalEmpty
          copy={{
            actionLabel: "Torna indietro",
            body: "Non hai più accesso alle posizioni di questa società.",
            icon: "lock-closed-outline",
            title: "Accesso non disponibile",
          }}
          onAction={() => router.back()}
        />
      </View>
    );
  }

  if (contextQuery.isPending || !contextQuery.data) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <DashboardSkeleton />
      </View>
    );
  }

  const context = contextQuery.data;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ComposerNavBar
        isVerified={context.clubIsVerified}
        logoUrl={context.clubLogoUrl}
        name={context.clubName}
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: spacing[32] + insets.bottom },
        ]}
        keyboardShouldPersistTaps="handled"
        testID="position-compose-start-scroll"
      >
        <ComposerStepHeader step={1} title="Nuova posizione" />

        <ComposerFieldRow
          label="Profilo ricercato"
          onPress={() => setProfileSheetOpen(true)}
          testID="compose-field-profile"
          value={
            proposal.profileType ? POSITION_SCHEMAS[proposal.profileType].choiceLabel : null
          }
        />

        {roleLoadFailed ? (
          <View style={styles.roleError}>
            <AppText color="danger" variant="meta">
              {COMPOSE_COPY.loadOptionsFailed}
            </AppText>

            <Button
              label="Riprova"
              onPress={() => catalogsQuery.refetch()}
              variant="secondary"
            />
          </View>
        ) : showRoleField ? (
          <ComposerFieldRow
            label="Ruolo"
            onPress={() => setRoleSheetOpen(true)}
            testID="compose-field-role"
            value={selectedRole?.label ?? null}
          />
        ) : null}

        {selectedRole?.isCustom ? (
          <ComposerTextField
            error={customRoleTouched ? customRoleError : null}
            label="Specifica il ruolo"
            limit={context.limits.customRoleName}
            multiline={false}
            onChangeText={(value) => {
              setProposal({ customRoleName: value });
              setCustomRoleTouched(true);
            }}
            optional={false}
            placeholder={CUSTOM_ROLE_PLACEHOLDER[proposal.profileType ?? "player"]}
            testID="compose-field-custom-role"
            value={proposal.customRoleName}
          />
        ) : null}

        {proposal.profileType === "director" ? (
          <>
            <ComposerFieldRow
              label="Ambito dell'incarico"
              onPress={isScopeFieldInformative ? undefined : () => setScopeSheetOpen(true)}
              testID="compose-field-scope"
              value={SCOPE_LABELS[proposal.scope]}
            />

            {proposal.scope === "society" ? (
              <AppText color="neutralMuted" variant="meta">
                Un incarico per il club, senza una squadra specifica.
              </AppText>
            ) : null}
          </>
        ) : null}

        {proposal.scope === "team" ? (
          <ComposerFieldRow
            helper={selectedTeam?.contextLabel ?? undefined}
            label="Squadra"
            onPress={isTeamFieldInformative ? undefined : () => setTeamSheetOpen(true)}
            testID="compose-field-team"
            value={selectedTeam?.teamName ?? null}
          />
        ) : null}

        {showSecondSearchAction ? (
          <Pressable
            accessibilityLabel="Cerca questo profilo anche per un'altra squadra"
            accessibilityRole="button"
            onPress={openAdditionalSheet}
            style={({ pressed }) => [styles.secondSearch, pressed ? styles.pressed : null]}
            testID="compose-second-search"
          >
            <AppText color="accent" style={styles.secondSearchText} variant="actionLabel">
              Cerca questo profilo anche per un&apos;altra squadra
            </AppText>

            <Ionicons color={colors.accent} name="chevron-forward" size={18} />
          </Pressable>
        ) : null}

        {proposal.additionalTeamIds.length > 0 ? <BatchSummary rows={batchRows} /> : null}
      </ScrollView>

      {submitError ? (
        <View style={styles.errorBanner}>
          <AppText accessibilityRole="alert" color="danger" variant="meta">
            {submitError}
          </AppText>
        </View>
      ) : null}

      <ComposerFooter
        onPrimary={handleContinue}
        primaryDisabled={!canContinue || createMutation.isPending}
        primaryLabel="Continua"
        primaryLoading={createMutation.isPending}
        primaryTestID="compose-start-continue"
      />

      <ComposerOptionSheet
        emptyMessage="Nessun profilo disponibile."
        onClose={() => setProfileSheetOpen(false)}
        onToggle={(id) => handleProfileSelect(id as PositionProfileType)}
        options={POSITION_PROFILE_ORDER.map((profileType) => ({
          id: profileType,
          label: POSITION_SCHEMAS[profileType].choiceLabel,
        }))}
        selected={proposal.profileType ? [proposal.profileType] : []}
        title="Profilo ricercato"
        visible={profileSheetOpen}
      />

      <ComposerOptionSheet
        emptyMessage={COMPOSE_COPY.loadOptionsFailed}
        loading={catalogsQuery.isPending}
        onClose={() => setRoleSheetOpen(false)}
        onToggle={handleRoleSelect}
        options={roles.map((role) => ({ id: role.id, label: role.label }))}
        selected={proposal.roleId ? [proposal.roleId] : []}
        title="Ruolo"
        visible={roleSheetOpen}
      />

      <ComposerOptionSheet
        emptyMessage="Nessun ambito disponibile."
        onClose={() => setScopeSheetOpen(false)}
        onToggle={handleScopeSelect}
        options={scopeOptions}
        selected={[proposal.scope]}
        title="Ambito dell'incarico"
        visible={scopeSheetOpen}
      />

      <ComposerOptionSheet
        emptyMessage="Nessuna squadra disponibile."
        onClose={() => setTeamSheetOpen(false)}
        onToggle={handleTeamSelect}
        options={eligibleTeams.map((team) => ({
          id: team.teamId,
          label: team.teamName,
          meta: team.contextLabel,
        }))}
        selected={proposal.primaryTeamId ? [proposal.primaryTeamId] : []}
        title="Squadra"
        visible={teamSheetOpen}
      />

      <ComposerOptionSheet
        contextLabel="Squadra principale"
        contextValue={selectedTeam?.teamName ?? null}
        emptyMessage="Nessun'altra squadra disponibile."
        helper="Per ogni squadra selezionata verrà creata una posizione distinta."
        multiple
        onClose={() => setAdditionalSheetOpen(false)}
        onConfirm={confirmAdditionalSheet}
        onToggle={toggleAdditionalDraft}
        options={otherTeams.map((team) => ({
          id: team.teamId,
          label: team.teamName,
          meta: team.contextLabel,
        }))}
        selected={additionalDraft}
        title="Aggiungi un'altra squadra"
        visible={additionalSheetOpen}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[4],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[16],
  },
  errorBanner: {
    paddingHorizontal: spacing[20],
    paddingTop: spacing[8],
  },
  pressed: {
    opacity: 0.7,
  },
  roleError: {
    borderBottomColor: colors.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing[10],
    paddingVertical: spacing[12],
  },
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  /* §4: «il footer resta sopra safe area e tastiera, con spazio di
     scorrimento sufficiente dopo l'ultimo campo.» Senza `flex: 1` la
     ScrollView si dimensiona sul contenuto e il footer risale sotto
     l'ultimo campo invece di restare in fondo. */
  scroll: {
    flex: 1,
  },
  secondSearch: {
    alignItems: "center",
    borderBottomColor: colors.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing[12],
  },
  secondSearchText: {
    flex: 1,
    marginRight: spacing[8],
  },
});
