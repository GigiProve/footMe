/**
 * Passo 2 del composer — Collegamento (§19, §20, §21, §22; screen 05-07).
 *
 * Una sola schermata per le tre varianti del master, perché sono la stessa
 * schermata con campi diversi: cambia il catalogo dei ruoli e la presenza
 * dell'ambito, non la struttura. Costruirne tre avrebbe prodotto tre
 * spaziature e tre validazioni.
 *
 * Tre regole del dominio, applicate qui e **riapplicate** dal server:
 *   · Calciatore e Allenatore hanno un ruolo statico e una squadra
 *     obbligatoria (§19). Il ruolo non è un selector disabilitato: non è un
 *     controllo affatto;
 *   · Staff sceglie da catalogo e, con «Altro ruolo staff», specifica un
 *     testo (§20);
 *   · Dirigente sceglie da catalogo **e** un ambito esplicito, che non si
 *     deduce dal ruolo (§21).
 */
import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../../../../theme/tokens";
import { AppText, Button, Input } from "../../../../ui";
import { useSession } from "../../../auth/use-session";
import { STALE_MS } from "../../cache/freshness-policy";
import { useDashboardIdentity } from "../../identity/use-dashboard-identity";
import { InviteFieldRow } from "../components/InviteFieldRow";
import { InviteOptionSheet } from "../components/InviteOptionSheet";
import { InvitePersonHeader } from "../components/InvitePersonHeader";
import { InvitesCenterHeader } from "../components/InvitesCenterHeader";
import { trackInvitesEvent } from "../invites-analytics";
import { INVITES_QK } from "../invites-keys";
import {
  FIELD_ERRORS,
  INVITES_COPY,
  missingConfigureFields,
  type ComposerField,
} from "../invites-presentation";
import { INVITES_HREFS } from "../invites-routes";
import {
  fetchAssignableTeams,
  fetchAssignmentRoles,
  fetchInvitesCenter,
} from "../invites-service";
import type { InviteScopeType } from "../invites-types";
import { useInviteCompose } from "./InviteComposeProvider";
import { useComposeExitGuard } from "./use-compose-exit-guard";

const SCOPE_OPTIONS = [
  { id: "society", label: "Intera società" },
  { id: "team", label: "Una squadra specifica" },
] as const;

type OpenSheet = "role" | "team" | "scope" | null;

export function InviteConfigureScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { current } = useDashboardIdentity();
  const clubId = current?.kind === "society" ? current.id : null;
  const { draft, isDirty, setCustomRole, setRole, setScope, setTeam } =
    useInviteCompose();

  const [sheet, setSheet] = useState<OpenSheet>(null);
  /* §22: «Non mostrare errori rossi prima che l'utente abbia interagito o
     provato a continuare.» */
  const [showErrors, setShowErrors] = useState(false);

  const confirmExit = useComposeExitGuard({ isDirty });

  const centerQuery = useQuery({
    enabled: !!clubId && !!actorId,
    queryFn: () => fetchInvitesCenter(clubId as string),
    queryKey: INVITES_QK.center(actorId, clubId ?? ""),
    staleTime: STALE_MS.operational,
  });

  const rolesQuery = useQuery({
    enabled: !!actorId,
    queryFn: fetchAssignmentRoles,
    queryKey: INVITES_QK.roles(actorId),
    staleTime: STALE_MS.presentation,
  });

  const teamsQuery = useQuery({
    enabled: !!clubId && !!actorId,
    queryFn: () => fetchAssignableTeams(clubId as string),
    queryKey: INVITES_QK.assignableTeams(actorId, clubId ?? ""),
    staleTime: STALE_MS.management,
  });

  const center = centerQuery.data ?? null;
  const person = draft.person;
  const profileType = person?.profileType ?? null;
  const customRoleMax = rolesQuery.data?.customRoleMax ?? 60;

  const roles = useMemo(
    () =>
      (rolesQuery.data?.roles ?? []).filter(
        (role) => role.profileType === profileType,
      ),
    [profileType, rolesQuery.data],
  );

  /**
   * §19: per Calciatore e Allenatore il catalogo ha una voce sola, e quella
   * voce **è** il ruolo. Non viene "preselezionata" in uno stato: è derivata,
   * così che un refetch non possa perderla.
   */
  const staticRole =
    profileType === "player" || profileType === "coach" ? roles[0] : undefined;

  const selectedRole =
    staticRole ?? roles.find((role) => role.roleId === draft.roleId);

  const roleId = selectedRole?.roleId ?? null;
  const isCustomRole = selectedRole?.isCustom === true;

  /* §21: l'ambito è una scelta esplicita e solo il Dirigente ce l'ha. */
  const needsScopeChoice = profileType === "director";
  const scopeType: InviteScopeType = needsScopeChoice
    ? draft.scopeType
    : "team";

  const teams = useMemo(() => teamsQuery.data ?? [], [teamsQuery.data]);

  const selectedTeam = teams.find((team) => team.teamId === draft.teamId);

  const missing = missingConfigureFields({
    customRole: draft.customRole,
    customRoleMax,
    isCustomRole,
    needsScopeChoice,
    roleId,
    scopeType,
    teamId: draft.teamId,
  });

  const errorFor = useCallback(
    (field: ComposerField): string | null =>
      showErrors && missing.includes(field) ? FIELD_ERRORS[field] : null,
    [missing, showErrors],
  );

  const goNext = useCallback(() => {
    if (missing.length > 0) {
      setShowErrors(true);

      return;
    }

    trackInvitesEvent("invite_step_advanced", { step: "link" });
    router.push(INVITES_HREFS.composeReview as never);
  }, [missing.length, router]);

  if (!person) {
    /* Stato locale perso (ripresa da background, deep link diretto): si
       torna alla scelta della persona, senza inventarne una. */
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.navWrap}>
          <InvitesCenterHeader
            isVerified={center?.clubIsVerified ?? false}
            logoUrl={center?.clubLogoUrl ?? null}
            name={center?.clubName ?? ""}
            onBack={confirmExit}
            title={INVITES_COPY.configureTitle}
          />
          <AppText color="neutralMuted" variant="bodySm">
            {FIELD_ERRORS.person}
          </AppText>
          <Button
            label="Scegli una persona"
            onPress={() => router.replace(INVITES_HREFS.composeSearch() as never)}
            size="md"
            style={styles.recover}
            variant="neutralOutline"
          />
        </View>
      </View>
    );
  }

  const noTeams = teamsQuery.isSuccess && teams.length === 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.navWrap}>
        <InvitesCenterHeader
          isVerified={center?.clubIsVerified ?? false}
          logoUrl={center?.clubLogoUrl ?? null}
          name={center?.clubName ?? ""}
          onBack={() => router.back()}
          onCancel={confirmExit}
          step="2 di 3 · Collegamento"
          title={INVITES_COPY.configureTitle}
        />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: spacing[48] + spacing[40] + insets.bottom },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <InvitePersonHeader
          avatarUrl={person.avatarUrl}
          name={person.fullName}
          subtitle={ROLE_SUBTITLE[person.profileType]}
        />

        <InviteFieldRow
          error={errorFor("role")}
          label={INVITES_COPY.roleFieldLabel}
          /* §19: nessun chevron su un ruolo statico. */
          onPress={staticRole ? null : () => setSheet("role")}
          showDivider
          testID="invite-role-field"
          value={selectedRole?.label ?? null}
        />

        {isCustomRole ? (
          <View style={styles.customBlock}>
            <Input
              error={Boolean(errorFor("customRole"))}
              label={INVITES_COPY.customRoleFieldLabel}
              maxLength={customRoleMax}
              onChangeText={setCustomRole}
              placeholder="Es. Data analyst"
              testID="invite-custom-role"
              value={draft.customRole}
            />

            {errorFor("customRole") ? (
              <AppText accessibilityRole="alert" color="danger" variant="meta">
                {FIELD_ERRORS.customRole}
              </AppText>
            ) : null}
          </View>
        ) : null}

        {needsScopeChoice ? (
          <InviteFieldRow
            error={errorFor("scope")}
            label={INVITES_COPY.scopeFieldLabel}
            onPress={() => setSheet("scope")}
            showDivider
            testID="invite-scope-field"
            value={
              SCOPE_OPTIONS.find((option) => option.id === scopeType)?.label ??
              null
            }
          />
        ) : null}

        {/* §21: «Con Intera società non mostrare Squadra: Nessuna, una riga
            vuota o una Team fittizia.» La riga non esiste proprio. */}
        {scopeType === "team" ? (
          <InviteFieldRow
            error={errorFor("team")}
            label={INVITES_COPY.teamFieldLabel}
            onPress={noTeams ? null : () => setSheet("team")}
            placeholder={noTeams ? INVITES_COPY.noTeams : "Seleziona"}
            showDivider
            testID="invite-team-field"
            value={selectedTeam?.label ?? draft.teamLabel}
          />
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: spacing[16] + insets.bottom }]}>
        <Button
          /* §22: disabilitata solo quando la validità nota non consente di
             proseguire — e «nessuna squadra disponibile» è uno di quei casi. */
          disabled={scopeType === "team" && noTeams}
          fullWidth
          label={INVITES_COPY.continueLabel}
          onPress={goNext}
          size="md"
          testID="invite-configure-continue"
          variant="primary"
        />
      </View>

      <InviteOptionSheet
        emptyMessage="Nessun ruolo disponibile."
        onClose={() => setSheet(null)}
        onSelect={(id) => {
          const role = roles.find((item) => item.roleId === id);

          if (role) {
            trackInvitesEvent("invite_role_selected", {
              custom: role.isCustom,
              profile_type: role.profileType,
            });
            setRole({ isCustom: role.isCustom, roleId: role.roleId });
          }
        }}
        options={roles.map((role) => ({ id: role.roleId, label: role.label }))}
        selected={roleId}
        title={INVITES_COPY.roleFieldLabel}
        visible={sheet === "role"}
      />

      <InviteOptionSheet
        emptyMessage={INVITES_COPY.noTeams}
        onClose={() => setSheet(null)}
        onSelect={(id) => {
          const team = teams.find((item) => item.teamId === id);

          if (team) {
            trackInvitesEvent("invite_team_selected");
            setTeam({ label: team.label, teamId: team.teamId });
          }
        }}
        options={teams.map((team) => ({
          id: team.teamId,
          label: team.label,
          meta: team.category,
        }))}
        selected={draft.teamId}
        title={INVITES_COPY.teamFieldLabel}
        visible={sheet === "team"}
      />

      <InviteOptionSheet
        emptyMessage="Nessun ambito disponibile."
        onClose={() => setSheet(null)}
        onSelect={(id) => {
          const next: InviteScopeType = id === "society" ? "society" : "team";

          trackInvitesEvent("invite_scope_selected", { scope: next });
          setScope(next);
        }}
        options={SCOPE_OPTIONS.map((option) => ({ ...option }))}
        selected={scopeType}
        title={INVITES_COPY.scopeFieldLabel}
        visible={sheet === "scope"}
      />
    </View>
  );
}

const ROLE_SUBTITLE: Record<string, string> = {
  coach: "Allenatore",
  director: "Dirigente",
  player: "Calciatore",
  staff: "Staff",
};


const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  navWrap: {
    paddingHorizontal: spacing[20],
  },
  content: {
    paddingHorizontal: spacing[20],
  },
  customBlock: {
    gap: spacing[4],
    paddingBottom: spacing[8],
  },
  recover: {
    alignSelf: "flex-start",
    marginTop: spacing[16],
  },
  footer: {
    backgroundColor: colors.surface,
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
  },
});
