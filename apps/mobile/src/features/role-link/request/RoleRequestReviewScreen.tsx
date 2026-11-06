/**
 * Riepilogo prima dell'invio (§14, screen 06).
 *
 * «Il riepilogo è l'unica conferma del submit: niente ulteriore modal Sei
 * sicuro.» Per questo la CTA primaria esegue direttamente la mutation, e
 * l'unica azione secondaria è Modifica.
 *
 * «Durante l'invio disabilita il doppio submit e mostra loading nella CTA.
 * Non chiudere o cancellare il draft prima dell'esito server»: il draft vive
 * nel provider e sopravvive a un errore, così che Modifica torni a un form
 * compilato e non vuoto.
 */
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { spacing } from "../../../theme/tokens";
import { AppText, Avatar, Button, useToast } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { STALE_MS } from "../../dashboard/cache/freshness-policy";
import {
  DashboardGlobalError,
  DashboardSkeleton,
} from "../../dashboard/components/DashboardStates";
import { InviteFieldRow } from "../../dashboard/invites/components/InviteFieldRow";
import { ClubIdentityRow } from "../components/ClubIdentityRow";
import { trackRoleLinkEvent } from "../role-link-analytics";
import { ROLE_LINK_QK, ROLE_LINK_QK_PREFIXES } from "../role-link-keys";
import {
  ROLE_LINK_COPY,
  ROLE_LINK_FAILURES,
  profileTypeLabel,
  roleLinkErrorMessage,
} from "../role-link-presentation";
import { ROLE_LINK_HREFS } from "../role-link-routes";
import {
  createRoleRequest,
  fetchRoleCatalog,
  fetchRoleLinkBlock,
  fetchRoleTeams,
  toRoleLinkError,
} from "../role-link-service";
import { RoleLinkScaffold } from "../components/RoleLinkScaffold";
import { useRoleRequestDraft } from "./RoleRequestProvider";

export function RoleRequestReviewScreen({ clubId }: { clubId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { draft, operationKey } = useRoleRequestDraft();
  const [error, setError] = useState<string | null>(null);

  const blockQuery = useQuery({
    enabled: !!actorId && !!clubId,
    queryFn: () => fetchRoleLinkBlock(clubId),
    queryKey: ROLE_LINK_QK.block(actorId, clubId),
    staleTime: STALE_MS.operational,
  });

  const catalogQuery = useQuery({
    enabled: !!actorId,
    queryFn: fetchRoleCatalog,
    queryKey: ROLE_LINK_QK.catalog(actorId),
    staleTime: STALE_MS.presentation,
  });

  const teamsQuery = useQuery({
    enabled: !!actorId && !!clubId,
    queryFn: () => fetchRoleTeams(clubId),
    queryKey: ROLE_LINK_QK.teams(actorId, clubId),
    staleTime: STALE_MS.management,
  });

  useEffect(() => {
    trackRoleLinkEvent("role_request_review_opened");
  }, []);

  const club = blockQuery.data;
  const catalog = catalogQuery.data ?? null;
  const teams = useMemo(() => teamsQuery.data ?? [], [teamsQuery.data]);

  const role = catalog?.roles.find((item) => item.roleId === draft.roleId) ?? null;
  const roleLabel = role?.isCustom
    ? draft.customRole.trim()
    : (role?.label ?? null);
  const teamLabel =
    teams.find((team) => team.teamId === draft.teamId)?.label ?? draft.teamLabel;

  const submit = useMutation({
    mutationFn: () => {
      if (!draft.profileType || !draft.roleId) {
        throw new Error("ROLE_REQUEST_ROLE_INVALID");
      }

      return createRoleRequest({
        clubId,
        customRole: role?.isCustom ? draft.customRole : null,
        operationKey,
        profileType: draft.profileType,
        roleId: draft.roleId,
        scopeType: draft.scopeType,
        teamId: draft.teamId,
      });
    },
    onError: (raw) => {
      const failure = toRoleLinkError(raw);

      trackRoleLinkEvent("role_request_submit_result", {
        outcome: "error",
        reason: failure.code,
      });

      /*
       * §16: due casi non sono errori ma destinazioni. «Apri la richiesta
       * esistente; non duplicarla» e «Visualizza invito verso il flusso
       * DAS-REV-19».
       */
      if (failure.code === "ROLE_REQUEST_DUPLICATE" && failure.recordId) {
        router.replace(ROLE_LINK_HREFS.myRequest(failure.recordId) as never);

        return;
      }

      if (failure.code === "ROLE_REQUEST_INVITE_EXISTS" && failure.recordId) {
        showToast({
          message: roleLinkErrorMessage(failure.code, { club: club?.clubName }),
        });
        router.replace(`/invitation/${failure.recordId}` as never);

        return;
      }

      if (failure.code === "ROLE_REQUEST_ALREADY_ASSIGNED") {
        showToast({ message: roleLinkErrorMessage(failure.code) });
        router.replace(ROLE_LINK_HREFS.society(clubId) as never);

        return;
      }

      setError(
        failure.code === "UNKNOWN"
          ? ROLE_LINK_FAILURES.create
          : roleLinkErrorMessage(failure.code, { club: club?.clubName }),
      );
    },
    onSuccess: (result) => {
      trackRoleLinkEvent("role_request_submit_result", { outcome: "created" });

      /* §15: «Dopo successo aggiorna il blocco del profilo Società e apri il
         dettaglio in attesa dello screen 07 con feedback Richiesta
         inviata.» */
      for (const prefix of ROLE_LINK_QK_PREFIXES) {
        void queryClient.invalidateQueries({ queryKey: [prefix] });
      }

      showToast({
        message: ROLE_LINK_COPY.submitted,
        tone: "success",
      });

      router.replace(
        ROLE_LINK_HREFS.myRequest(result.requestId, { from: "club" }) as never,
      );
    },
  });

  const onBack = () => {
    if (router.canGoBack()) {
      router.back();

      return;
    }

    router.replace(ROLE_LINK_HREFS.requestForm(clubId) as never);
  };

  if (blockQuery.isLoading || catalogQuery.isLoading || teamsQuery.isLoading) {
    return (
      <RoleLinkScaffold onBack={onBack} title={ROLE_LINK_COPY.reviewTitle}>
        <DashboardSkeleton />
      </RoleLinkScaffold>
    );
  }

  if (!club || !roleLabel || !draft.profileType) {
    return (
      <RoleLinkScaffold onBack={onBack} title={ROLE_LINK_COPY.reviewTitle}>
        <DashboardGlobalError
          body="Torna al form e controlla i dati."
          onRetry={onBack}
          title="Riepilogo non disponibile"
        />
      </RoleLinkScaffold>
    );
  }

  return (
    <RoleLinkScaffold
      footer={
        <Button
          fullWidth
          label={ROLE_LINK_COPY.submit}
          loading={submit.isPending}
          onPress={() => {
            setError(null);
            trackRoleLinkEvent("role_request_submitted", {
              scope_type: draft.scopeType,
            });
            submit.mutate();
          }}
          size="lg"
          testID="role-request-submit"
          variant="primary"
        />
      }
      onBack={onBack}
      subheader={
        <ClubIdentityRow
          city={club.clubCity}
          isVerified={club.clubIsVerified}
          logoUrl={club.clubLogoUrl}
          name={club.clubName}
          region={club.clubRegion}
        />
      }
      testID="role-request-review"
      title={ROLE_LINK_COPY.reviewTitle}
    >
      <View style={styles.person}>
        <Avatar
          name={profile?.full_name ?? ""}
          size="md"
          uri={profile?.avatar_url ?? undefined}
        />

        <AppText color="neutral" variant="titleSm">
          {profile?.full_name ?? ""}
        </AppText>
      </View>

      <InviteFieldRow
        label={ROLE_LINK_COPY.profileFieldLabel}
        showDivider
        value={profileTypeLabel(draft.profileType)}
      />

      {/* §14: «Le varianti Staff/Dirigente mostrano anche il ruolo specifico
          e il custom quando presente.» Per Calciatore e Allenatore il ruolo
          coincide con il profilo e ripeterlo sarebbe rumore. */}
      {draft.profileType === "staff" || draft.profileType === "director" ? (
        <InviteFieldRow
          label={ROLE_LINK_COPY.roleFieldLabel}
          showDivider
          value={roleLabel}
        />
      ) : null}

      {/* §14: «Intera società non deve essere accompagnata da una squadra
          residua.» */}
      {draft.scopeType === "society" ? (
        <InviteFieldRow
          label={ROLE_LINK_COPY.scopeFieldLabel}
          showDivider
          value={ROLE_LINK_COPY.societyScope}
        />
      ) : (
        <InviteFieldRow
          label={ROLE_LINK_COPY.teamFieldLabel}
          showDivider
          value={teamLabel}
        />
      )}

      <AppText color="neutralMuted" style={styles.helper} variant="meta">
        {ROLE_LINK_COPY.reviewHelper(club.clubName)}
      </AppText>

      <Button
        label={ROLE_LINK_COPY.reviewEdit}
        onPress={onBack}
        size="sm"
        testID="role-request-edit"
        variant="link"
      />

      {error ? (
        <AppText
          accessibilityRole="alert"
          color="danger"
          style={styles.error}
          variant="meta"
        >
          {error}
        </AppText>
      ) : null}
    </RoleLinkScaffold>
  );
}

const styles = StyleSheet.create({
  person: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    paddingBottom: spacing[8],
  },
  helper: {
    paddingTop: spacing[16],
  },
  error: {
    paddingTop: spacing[12],
  },
});
