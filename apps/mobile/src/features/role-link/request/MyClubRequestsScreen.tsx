/**
 * Le proprie richieste verso una società (§11, terzo caso).
 *
 * «Più richieste lecite per incarichi distinti: riepilogo localizzato e
 * accesso ai propri record reali con ruolo/ambito, senza sceglierne
 * arbitrariamente una.»
 *
 * È la destinazione del blocco contestuale quando le proposte aperte sono
 * più d'una. Non è una seconda inbox personale (§18): elenca soltanto le
 * richieste verso **questa** società.
 */
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { STALE_MS } from "../../dashboard/cache/freshness-policy";
import {
  DashboardGlobalError,
  DashboardSkeleton,
} from "../../dashboard/components/DashboardStates";
import { ClubIdentityRow } from "../components/ClubIdentityRow";
import { RoleLinkScaffold } from "../components/RoleLinkScaffold";
import { RoleListRow } from "../components/RoleListRow";
import { ROLE_LINK_QK } from "../role-link-keys";
import {
  ROLE_LINK_COPY,
  ROLE_LINK_FAILURES,
  formatLongDate,
} from "../role-link-presentation";
import { ROLE_LINK_HREFS } from "../role-link-routes";
import {
  fetchMyClubRoleRequests,
  fetchRoleLinkBlock,
} from "../role-link-service";

export function MyClubRequestsScreen({ clubId }: { clubId: string }) {
  const router = useRouter();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";

  const blockQuery = useQuery({
    enabled: !!actorId && !!clubId,
    queryFn: () => fetchRoleLinkBlock(clubId),
    queryKey: ROLE_LINK_QK.block(actorId, clubId),
    staleTime: STALE_MS.operational,
  });

  const requestsQuery = useQuery({
    enabled: !!actorId && !!clubId,
    queryFn: () => fetchMyClubRoleRequests(clubId),
    queryKey: ROLE_LINK_QK.myClubRequests(actorId, clubId),
    staleTime: STALE_MS.operational,
  });

  const onBack = () => {
    if (router.canGoBack()) {
      router.back();

      return;
    }

    router.replace(`/club/${clubId}` as never);
  };

  const club = blockQuery.data;
  const requests = requestsQuery.data ?? [];

  return (
    <RoleLinkScaffold
      onBack={onBack}
      subheader={
        club ? (
          <ClubIdentityRow
            city={club.clubCity}
            isVerified={club.clubIsVerified}
            logoUrl={club.clubLogoUrl}
            name={club.clubName}
            region={club.clubRegion}
          />
        ) : null
      }
      testID="role-link-my-requests"
      title={ROLE_LINK_COPY.myRequestTitle}
    >
      {requestsQuery.isLoading ? (
        <DashboardSkeleton />
      ) : requestsQuery.isError ? (
        <DashboardGlobalError
          body={ROLE_LINK_FAILURES.load}
          onRetry={() => void requestsQuery.refetch()}
          title="Richieste non disponibili"
        />
      ) : (
        <View style={styles.list}>
          {requests.map((request, index) => (
            <RoleListRow
              key={request.requestId}
              onPress={() =>
                router.push(
                  ROLE_LINK_HREFS.myRequest(request.requestId) as never,
                )
              }
              showDivider={index > 0}
              subtitle={[
                request.contextLabel,
                formatLongDate(request.createdAt),
              ]
                .filter(Boolean)
                .join(" · ")}
              testID={`role-link-my-request-${request.requestId}`}
              title={request.roleLabel}
            />
          ))}
        </View>
      )}

      <AppText color="neutralMuted" style={styles.helper} variant="meta">
        {club ? ROLE_LINK_COPY.pendingHelper(club.clubName) : ""}
      </AppText>
    </RoleLinkScaffold>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingTop: spacing[8],
  },
  helper: {
    paddingTop: spacing[16],
  },
});
