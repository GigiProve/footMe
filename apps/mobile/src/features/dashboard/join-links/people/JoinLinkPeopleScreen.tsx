/**
 * Persone collegate (DAS-REV-20, screen 18, §33-§34).
 *
 * Elenco di sole persone con un incarico attivo assegnato tramite questo
 * link — mai chi ha solo aperto la landing, iniziato la registrazione o
 * ricevuto un invito individuale. Un link disattivato può comunque avere
 * persone collegate: la schermata resta raggiungibile in quel caso. Non è un
 * CRM: nessuna azione di massa, nessuna rimozione inline, nessun ordinamento
 * per rilevanza.
 *
 * Il conteggio mostrato sotto il titolo viene sempre da `totalCount`, mai dal
 * numero di righe effettivamente caricate in pagina.
 */
import { useCallback, useEffect } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import { useSession } from "../../../auth/use-session";
import { STALE_MS } from "../../cache/freshness-policy";
import { DashboardModuleError } from "../../components/DashboardSection";
import {
  DashboardGlobalEmpty,
  DashboardGlobalError,
  DashboardGlobalOffline,
  DashboardSkeleton,
} from "../../components/DashboardStates";
import { SocietyContextHeader } from "../../components/SocietyContextHeader";
import { useAccessWindow } from "../../state/use-access-window";
import { useDashboardConnection } from "../../state/use-dashboard-connection";
import { JoinLinkPersonRow } from "../components/JoinLinkPersonRow";
import { trackJoinLinksEvent } from "../join-links-analytics";
import { JOIN_LINKS_QK } from "../join-links-keys";
import { JOIN_LINKS_COPY, peopleLabel } from "../join-links-presentation";
import { JOIN_LINKS_HREFS } from "../join-links-routes";
import {
  isAuthorizationError,
  fetchJoinLink,
  fetchJoinLinkPeoplePage,
} from "../join-links-service";
import type { JoinLinkPerson, JoinLinkPeoplePage } from "../join-links-types";

export function JoinLinkPeopleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { connection } = useDashboardConnection();

  const params = useLocalSearchParams<{ linkId?: string }>();
  const linkId = typeof params.linkId === "string" ? params.linkId : "";

  const linkQuery = useQuery({
    enabled: !!actorId && !!linkId,
    queryFn: () => fetchJoinLink(linkId),
    queryKey: JOIN_LINKS_QK.detail(actorId, linkId),
    retry: (failureCount, error) =>
      !isAuthorizationError(error) && failureCount < 1,
    staleTime: STALE_MS.operational,
  });

  const link = linkQuery.data ?? null;

  const accessWindow = useAccessWindow({
    accessVerifiedAt: link?.accessVerifiedAt ?? null,
    isOrganizational: true,
  });

  const validLink = accessWindow.isValid ? link : null;

  const peopleQuery = useInfiniteQuery<
    JoinLinkPeoplePage,
    Error,
    { pageParams: (string | null)[]; pages: JoinLinkPeoplePage[] },
    readonly unknown[],
    string | null
  >({
    enabled: !!actorId && !!linkId && !!validLink,
    getNextPageParam: (last) => (last.hasMore ? last.nextCursor : undefined),
    initialPageParam: null,
    queryFn: ({ pageParam }) =>
      fetchJoinLinkPeoplePage({ cursor: pageParam, linkId }),
    queryKey: JOIN_LINKS_QK.people(actorId, linkId),
    retry: (failureCount, error) =>
      !isAuthorizationError(error) && failureCount < 1,
    staleTime: STALE_MS.operational,
  });

  const pages = peopleQuery.data?.pages ?? [];
  const rows = pages.flatMap((page) => page.rows);
  const totalCount = pages[pages.length - 1]?.totalCount ?? 0;

  useFocusEffect(
    useCallback(() => {
      trackJoinLinksEvent("join_link_people_opened");
    }, []),
  );

  useEffect(() => {
    if (!accessWindow.isValid && link && !linkQuery.isFetching) {
      void linkQuery.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessWindow.isValid]);

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();

      return;
    }

    router.replace(JOIN_LINKS_HREFS.detail(linkId) as never as Parameters<typeof router.replace>[0]);
  }, [linkId, router]);

  const refresh = useCallback(async () => {
    await Promise.all([linkQuery.refetch(), peopleQuery.refetch()]);
  }, [linkQuery, peopleQuery]);

  const shell = (body: React.ReactNode) => (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.navWrap}>
        <SocietyContextHeader
          isVerified={link?.clubIsVerified ?? false}
          logoUrl={link?.clubLogoUrl ?? null}
          name={link?.clubName ?? ""}
          onBack={goBack}
          title={JOIN_LINKS_COPY.peopleTitle}
        />
      </View>
      {body}
    </View>
  );

  if (isAuthorizationError(linkQuery.error)) {
    return shell(
      <DashboardGlobalEmpty
        copy={{
          actionLabel: JOIN_LINKS_COPY.cancel,
          body: JOIN_LINKS_COPY.notAuthorized,
          icon: "lock-closed-outline",
          title: JOIN_LINKS_COPY.notAuthorized,
        }}
        onAction={goBack}
      />,
    );
  }

  if (linkQuery.isLoading && !link) {
    return shell(
      <View style={styles.content}>
        <DashboardSkeleton />
      </View>,
    );
  }

  if (!validLink) {
    if (connection === "offline") {
      return shell(
        <DashboardGlobalOffline onRetry={() => void refresh()} />,
      );
    }

    return shell(
      <DashboardGlobalError
        onRetry={() => void refresh()}
        title={JOIN_LINKS_COPY.peopleError}
      />,
    );
  }

  const listLoading = peopleQuery.isLoading && rows.length === 0;
  const listFailed = Boolean(peopleQuery.error) && rows.length === 0;
  const empty =
    !listLoading && !listFailed && rows.length === 0 && peopleQuery.isSuccess;

  const header = (
    <View style={styles.headerBlock}>
      <AppText color="neutralMuted" variant="bodySm">
        {`${validLink.teamName} · ${peopleLabel(totalCount)}`}
      </AppText>

      {listLoading ? (
        <View style={styles.listLoading}>
          <DashboardSkeleton />
        </View>
      ) : null}

      {listFailed ? (
        <View style={styles.listError}>
          <DashboardModuleError
            isRetrying={peopleQuery.isRefetching}
            message={JOIN_LINKS_COPY.peopleError}
            onRetry={() => void peopleQuery.refetch()}
          />
        </View>
      ) : null}

      {empty ? (
        <View style={styles.empty}>
          <DashboardGlobalEmpty
            copy={{
              actionLabel: "",
              body: JOIN_LINKS_COPY.emptyPeopleBody,
              icon: "people-outline",
              title: JOIN_LINKS_COPY.emptyPeople,
            }}
            onAction={null}
          />
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.navWrap}>
        <SocietyContextHeader
          isVerified={validLink.clubIsVerified}
          logoUrl={validLink.clubLogoUrl}
          name={validLink.clubName}
          onBack={goBack}
          title={JOIN_LINKS_COPY.peopleTitle}
        />
      </View>

      <FlatList<JoinLinkPerson>
        contentContainerStyle={[
          styles.content,
          { paddingBottom: spacing[32] + insets.bottom },
        ]}
        data={rows}
        keyExtractor={(item) => item.assignmentId}
        ListFooterComponent={
          peopleQuery.hasNextPage && peopleQuery.isFetchingNextPage ? (
            <View style={styles.footer}>
              <AppText color="neutralMuted" variant="meta">
                Caricamento…
              </AppText>
            </View>
          ) : null
        }
        ListHeaderComponent={header}
        onEndReached={() => {
          if (peopleQuery.hasNextPage && !peopleQuery.isFetchingNextPage) {
            void peopleQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            onRefresh={() => void refresh()}
            refreshing={linkQuery.isRefetching}
            tintColor={colors.textNeutralMuted}
          />
        }
        renderItem={({ index, item }) => (
          <JoinLinkPersonRow
            linkTeamName={validLink.teamName}
            onPress={() => {
              trackJoinLinksEvent("join_link_person_opened");
              router.push(
                JOIN_LINKS_HREFS.person(linkId, item.assignmentId) as never,
              );
            }}
            person={item}
            showDivider={index > 0}
          />
        )}
        testID="join-link-people-list"
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
    paddingHorizontal: spacing[20],
  },
  headerBlock: {
    paddingBottom: spacing[8],
    paddingTop: spacing[20],
  },
  subheading: {
    marginTop: spacing[4],
  },
  listLoading: {
    paddingTop: spacing[20],
  },
  listError: {
    paddingTop: spacing[20],
  },
  empty: {
    paddingTop: spacing[24],
  },
  footer: {
    paddingVertical: spacing[16],
  },
});
