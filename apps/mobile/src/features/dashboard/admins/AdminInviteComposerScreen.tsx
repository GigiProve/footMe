/**
 * Configura invito (DAS-REV-13, screen 03).
 *
 * Destinatario interno già scelto, due selector, una CTA. «Nessun ruolo
 * preselezionato per il solo fatto che la persona è un Dirigente» (§9): il
 * master rappresenta uno stato compilato, non un default.
 *
 * «Il client invia riferimenti e versione della proposta; il backend
 * ricalcola l'autorizzazione» (§11): da qui parte un `role_id`, mai un
 * elenco di capability.
 */
import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, Button, ConfirmModal } from "../../../ui";
import { useToast } from "../../../ui/Toast/ToastProvider";
import { useSession } from "../../auth/use-session";
import { formatRole } from "../../profiles/profile-display-helpers";
import { NetworkNavBar } from "../../network/components/NetworkNavBar";
import { STALE_MS } from "../cache/freshness-policy";
import {
  DashboardGlobalEmpty,
  DashboardSkeleton,
} from "../components/DashboardStates";
import { SocietyIdentityHeader } from "../components/SocietyIdentityHeader";
import { useDashboardIdentity } from "../identity/use-dashboard-identity";
import { AdminInviteFields } from "./components/AdminInviteFields";
import { AdminPersonRow } from "./components/AdminPersonRow";
import { ADMINS_QK } from "./admins-keys";
import { ADMIN_HREFS } from "./admins-routes";
import { trackAdminEvent } from "./admins-analytics";
import {
  ADMIN_COPY,
  consentHelper,
  describeAdminError,
  validateDraft,
} from "./admins-presentation";
import {
  createAdminInvite,
  fetchAdminCenter,
  fetchAssignableRoles,
  fetchAssignableTeams,
  searchAdminCandidates,
  toAdminError,
} from "./admins-service";
import { newAdminOperationKey } from "./admin-invite-link";
import type { AdminScopeMode } from "./admins-types";

export function AdminInviteComposerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { current } = useDashboardIdentity();
  const clubId = current?.kind === "society" ? current.id : null;
  const params = useLocalSearchParams<{ profileId?: string; query?: string }>();
  const profileId =
    typeof params.profileId === "string" ? params.profileId : null;
  const query = typeof params.query === "string" ? params.query : "";

  const [roleId, setRoleId] = useState<string | null>(null);
  const [scopeMode, setScopeMode] = useState<AdminScopeMode>("society");
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);

  /**
   * §19: «I retry di create/accept/reject riusano la stessa chiave finché
   * l'esito non è conosciuto.» La chiave nasce con la proposta e cambia solo
   * quando cambia ciò che si sta proponendo — «Se cambiano termini o
   * destinatario, è una nuova operazione da confermare».
   */
  const proposalKey = `${roleId ?? ""}|${scopeMode}|${[...teamIds].sort().join(",")}`;
  const operationKey = useMemo(
    () => newAdminOperationKey(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [proposalKey],
  );

  const centerQuery = useQuery({
    enabled: !!clubId && !!actorId,
    queryFn: () => fetchAdminCenter(clubId as string),
    queryKey: ADMINS_QK.center(actorId, clubId ?? ""),
    staleTime: STALE_MS.operational,
  });

  /**
   * Il destinatario arriva dalla stessa ricerca dello screen 02, non da un
   * payload passato nella route: §27 vieta di fidarsi di un id arbitrario, e
   * il backend restituisce qui anche lo stato amministrativo aggiornato.
   */
  const candidateQuery = useQuery({
    enabled: !!clubId && !!actorId && !!profileId && query.length > 0,
    queryFn: () =>
      searchAdminCandidates({ clubId: clubId as string, query }),
    queryKey: ADMINS_QK.candidates(actorId, clubId ?? "", query),
    staleTime: STALE_MS.operational,
  });

  const recipient =
    candidateQuery.data?.rows.find((row) => row.profileId === profileId) ??
    null;

  const rolesQuery = useQuery({
    enabled: !!clubId && !!actorId,
    queryFn: () => fetchAssignableRoles(clubId as string),
    queryKey: ADMINS_QK.roles(actorId, clubId ?? ""),
    staleTime: STALE_MS.management,
  });

  const teamsQuery = useQuery({
    enabled: !!clubId && !!actorId,
    queryFn: () => fetchAssignableTeams(clubId as string),
    queryKey: ADMINS_QK.teams(actorId, clubId ?? ""),
    staleTime: STALE_MS.management,
  });

  const submit = useMutation({
    mutationFn: () =>
      createAdminInvite({
        clubId: clubId as string,
        idempotencyKey: operationKey,
        profileId,
        roleId: roleId as string,
        scopeMode,
        teamIds,
      }),
    onError: (raw) => {
      const parsed = toAdminError(raw);
      setError(describeAdminError(parsed.code));
      trackAdminEvent("admin_invite_result", {
        error_code: parsed.code,
        outcome: "error",
        path: "internal",
      });
    },
    onSuccess: () => {
      trackAdminEvent("admin_invite_result", {
        outcome: "ok",
        path: "internal",
        scope: scopeMode,
      });

      /* §11: «aggiorna la lista pending e il summary dell'hub; chiudi il
         composer e ritorna al centro della stessa Society». Nessuna success
         screen, nessuna chat, nessuna membership attiva. */
      void queryClient.invalidateQueries({
        queryKey: ADMINS_QK.invites(actorId, clubId ?? ""),
      });
      void queryClient.invalidateQueries({
        queryKey: ADMINS_QK.center(actorId, clubId ?? ""),
      });

      showToast({ message: "Invito inviato", tone: "success" });
      router.replace(ADMIN_HREFS.center() as never);
    },
  });

  const hasDraft = roleId !== null || teamIds.length > 0;

  const goBack = useCallback(() => {
    /* §24: «Se ruolo, ambito o email compilati andrebbero persi uscendo dal
       flusso prima dell'invio, usa il pattern condiviso.» La sola query non
       richiede conferma. */
    if (hasDraft && !submit.isPending) {
      setConfirmExit(true);

      return;
    }

    router.back();
  }, [hasDraft, router, submit.isPending]);

  if (!clubId || !profileId) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <DashboardGlobalEmpty
          copy={{
            actionLabel: "Torna al centro",
            body: "Scegli di nuovo la persona da invitare.",
            icon: "person-outline",
            title: "Destinatario non disponibile",
          }}
          onAction={() => router.replace(ADMIN_HREFS.center() as never)}
        />
      </View>
    );
  }

  const center = centerQuery.data ?? null;
  const validation = validateDraft({
    isExternal: false,
    roleId,
    scopeMode,
    teamIds,
  });

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.navWrap}>
        <NetworkNavBar onBack={goBack} title={ADMIN_COPY.searchTitle} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: spacing[32] + insets.bottom },
        ]}
        keyboardShouldPersistTaps="handled"
        testID="admin-composer-scroll"
      >
        {center ? (
          <SocietyIdentityHeader
            isVerified={center.clubIsVerified}
            logoUrl={center.clubLogoUrl}
            name={center.clubName}
          />
        ) : null}

        <View style={styles.section}>
          <AppText color="neutralMuted" variant="meta">
            {ADMIN_COPY.recipientSection}
          </AppText>

          {candidateQuery.isLoading && !recipient ? (
            <DashboardSkeleton />
          ) : recipient ? (
            <View style={styles.recipient}>
              <AdminPersonRow
                avatarUrl={recipient.avatarUrl}
                /* §9: «Non sovrascrivere il profilo pubblico con la scelta
                   amministrativa.» Qui resta il descrittore pubblico. */
                meta={formatRole(recipient.role)}
                title={recipient.fullName}
              />
            </View>
          ) : (
            <AppText color="neutralMuted" variant="bodySm">
              Non siamo riusciti a caricare il destinatario. Riprova.
            </AppText>
          )}
        </View>

        <AdminInviteFields
          onRoleChange={(value) => {
            setRoleId(value);
            setError(null);
            trackAdminEvent("admin_invite_role_selected");
          }}
          onScopeModeChange={(mode) => {
            setScopeMode(mode);
            setError(null);
            trackAdminEvent("admin_invite_scope_selected", { scope: mode });
          }}
          onTeamsChange={setTeamIds}
          roleId={roleId}
          roles={rolesQuery.data ?? []}
          scopeMode={scopeMode}
          teamIds={teamIds}
          teams={teamsQuery.data ?? []}
        />

        {rolesQuery.data?.length === 0 ? (
          <AppText color="neutralMuted" variant="bodySm">
            Non ci sono ruoli disponibili per questo invito.
          </AppText>
        ) : null}

        <AppText color="neutralSoft" variant="bodySm">
          {consentHelper(recipient?.fullName ?? "La persona invitata")}
        </AppText>

        {error ? (
          <AppText accessibilityRole="alert" color="danger" variant="bodySm">
            {error}
          </AppText>
        ) : null}

        <Button
          disabled={validation !== null || submit.isPending}
          fullWidth
          label={ADMIN_COPY.sendCta}
          loading={submit.isPending}
          onPress={() => {
            const message = validateDraft({
              isExternal: false,
              roleId,
              scopeMode,
              teamIds,
            });

            if (message) {
              setError(message);

              return;
            }

            setError(null);
            trackAdminEvent("admin_invite_submitted", { path: "internal" });
            submit.mutate();
          }}
          size="lg"
          testID="admin-composer-submit"
          variant="primary"
        />
      </ScrollView>

      <ConfirmModal
        cancelLabel={ADMIN_COPY.exitKeep}
        confirmLabel={ADMIN_COPY.exitLeave}
        message={ADMIN_COPY.exitBody}
        onCancel={() => setConfirmExit(false)}
        onConfirm={() => {
          setConfirmExit(false);
          trackAdminEvent("admin_unsaved_exit", { path: "internal" });
          router.back();
        }}
        title={ADMIN_COPY.exitTitle}
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
  navWrap: {
    paddingHorizontal: spacing[20],
  },
  content: {
    gap: spacing[20],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
  },
  section: {
    gap: spacing[6],
  },
  recipient: {
    borderColor: colors.borderNeutral,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: spacing[14],
  },
});
