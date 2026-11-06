/**
 * Compilazione della richiesta (§12, §13 — screen 02, 03, 04, 05).
 *
 * Una schermata per tutte e quattro le categorie: §29 — «Non creare quattro
 * form per categoria moltiplicati per due actor». Le differenze fra gli
 * screen 02, 04 e 05 del PNG non sono tre layout, sono tre stati della
 * stessa matrice di §9.
 *
 * Non chiede posizione tattica, curriculum, preferenze geografiche né un
 * messaggio per il club: §12 li vieta tutti — «È la dichiarazione di un
 * rapporto già esistente nella realtà, non una ricerca di un posto in
 * squadra».
 */
import { useEffect, useMemo, useState } from "react";
import { StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { spacing } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { STALE_MS } from "../../dashboard/cache/freshness-policy";
import {
  DashboardGlobalError,
  DashboardSkeleton,
} from "../../dashboard/components/DashboardStates";
import { ClubIdentityRow } from "../components/ClubIdentityRow";
import {
  RoleAssignmentFields,
  hasFieldErrors,
  validateRoleFields,
  type RoleFieldsErrors,
} from "../components/RoleAssignmentFields";
import { RoleLinkScaffold } from "../components/RoleLinkScaffold";
import { trackRoleLinkEvent } from "../role-link-analytics";
import { ROLE_LINK_FAILURES, ROLE_LINK_COPY } from "../role-link-presentation";
import { ROLE_LINK_HREFS } from "../role-link-routes";
import { ROLE_LINK_QK } from "../role-link-keys";
import {
  fetchRoleCatalog,
  fetchRoleIdentities,
  fetchRoleLinkBlock,
  fetchRoleTeams,
} from "../role-link-service";
import { useRoleLinkExitGuard } from "../use-role-link-exit-guard";
import { useRoleRequestDraft } from "./RoleRequestProvider";

export function RoleRequestFormScreen({ clubId }: { clubId: string }) {
  const router = useRouter();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { draft, isDirty, setDraft } = useRoleRequestDraft();
  const [errors, setErrors] = useState<RoleFieldsErrors>({});

  /* §43: «Fetch in parallelo quando le richieste sono indipendenti.» Il
     catalogo, le identità e le squadre non dipendono l'uno dall'altro. */
  const blockQuery = useQuery({
    enabled: !!actorId && !!clubId,
    queryFn: () => fetchRoleLinkBlock(clubId),
    queryKey: ROLE_LINK_QK.block(actorId, clubId),
    staleTime: STALE_MS.operational,
  });

  const identitiesQuery = useQuery({
    enabled: !!actorId,
    queryFn: fetchRoleIdentities,
    queryKey: ROLE_LINK_QK.identities(actorId),
    staleTime: STALE_MS.management,
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

  const identities = useMemo(
    () => identitiesQuery.data ?? [],
    [identitiesQuery.data],
  );
  const catalog = catalogQuery.data ?? null;
  const teams = useMemo(() => teamsQuery.data ?? [], [teamsQuery.data]);

  /*
   * §12: «Profilo Calciatore read-only.» Con una sola identità reale la
   * scelta non esiste e il draft la riceve dal server, non dall'utente.
   * Con più identità resta nulla finché la persona non sceglie: §13 vieta di
   * «offrire identità inesistenti», e sceglierne una d'ufficio sarebbe la
   * stessa cosa al contrario.
   */
  useEffect(() => {
    if (draft.profileType || identities.length !== 1 || !catalog) return;

    const only = identities[0].profileType;
    const implicit = catalog.roles.find(
      (role) => role.profileType === only && !role.isCustom,
    );

    setDraft({
      ...draft,
      profileType: only,
      roleId: only === "player" || only === "coach" ? (implicit?.roleId ?? null) : null,
    });
  }, [catalog, draft, identities, setDraft]);

  useEffect(() => {
    trackRoleLinkEvent("role_request_form_opened");
  }, []);

  const onBack = useRoleLinkExitGuard({
    fallbackHref: `/club/${clubId}`,
    isDirty,
  });

  const club = blockQuery.data;
  const isLoading =
    blockQuery.isLoading ||
    identitiesQuery.isLoading ||
    catalogQuery.isLoading ||
    teamsQuery.isLoading;

  const hasError =
    blockQuery.isError ||
    identitiesQuery.isError ||
    catalogQuery.isError ||
    teamsQuery.isError;

  function onContinue() {
    const next = validateRoleFields(
      {
        customRole: draft.customRole,
        profileType: draft.profileType,
        roleId: draft.roleId,
        scopeType: draft.scopeType,
        teamId: draft.teamId,
      },
      catalog,
    );

    setErrors(next);

    if (hasFieldErrors(next)) return;

    router.push(ROLE_LINK_HREFS.requestReview(clubId) as never);
  }

  if (isLoading) {
    return (
      <RoleLinkScaffold onBack={onBack} title={ROLE_LINK_COPY.requestTitle}>
        <DashboardSkeleton />
      </RoleLinkScaffold>
    );
  }

  if (hasError || !club) {
    return (
      <RoleLinkScaffold onBack={onBack} title={ROLE_LINK_COPY.requestTitle}>
        <DashboardGlobalError
          body={ROLE_LINK_FAILURES.load}
          onRetry={() => {
            void blockQuery.refetch();
            void identitiesQuery.refetch();
            void catalogQuery.refetch();
            void teamsQuery.refetch();
          }}
          title="Richiesta non disponibile"
        />
      </RoleLinkScaffold>
    );
  }

  const clubName = club.clubName;

  return (
    <RoleLinkScaffold
      footer={
        <Button
          fullWidth
          label={ROLE_LINK_COPY.continueLabel}
          onPress={onContinue}
          size="lg"
          testID="role-request-continue"
          variant="primary"
        />
      }
      onBack={onBack}
      subheader={
        <ClubIdentityRow
          city={club.clubCity}
          isVerified={club.clubIsVerified}
          logoUrl={club.clubLogoUrl}
          name={clubName}
          region={club.clubRegion}
          testID="role-request-club"
        />
      }
      testID="role-request-form"
      title={ROLE_LINK_COPY.requestTitle}
    >
      <AppText color="neutralMuted" style={styles.helper} variant="bodySm">
        {ROLE_LINK_COPY.requestHelper}
      </AppText>

      <RoleAssignmentFields
        catalog={catalog}
        errors={errors}
        identities={identities}
        mode="request"
        onChange={(next) =>
          setDraft({
            ...draft,
            customRole: next.customRole,
            profileType: next.profileType,
            roleId: next.roleId,
            scopeType: next.scopeType,
            teamId: next.teamId,
            teamLabel:
              teams.find((team) => team.teamId === next.teamId)?.label ?? null,
          })
        }
        teams={teams}
        value={{
          customRole: draft.customRole,
          profileType: draft.profileType,
          roleId: draft.roleId,
          scopeType: draft.scopeType,
          teamId: draft.teamId,
        }}
      />

      <AppText color="neutralMuted" style={styles.footerNote} variant="meta">
        {ROLE_LINK_COPY.requestFooter(clubName)}
      </AppText>
    </RoleLinkScaffold>
  );
}

const styles = StyleSheet.create({
  helper: {
    paddingBottom: spacing[8],
  },
  footerNote: {
    paddingTop: spacing[24],
  },
});
