/**
 * Centro Rete societaria (DAS-REV-11, master 01 e 02).
 *
 * Un solo centro (§2): "Società collegate" della Dashboard Società porta
 * qui e non a una pagina intermedia con un secondo elenco delle stesse
 * relazioni. Collegate e Richieste non sono due schermate ma due tab dello
 * stesso provider, perché la shell — identità, conteggi, CTA — è identica e
 * duplicarla le avrebbe fatte divergere.
 *
 * La bottom navigation resta visibile con Dashboard selezionata (§4): la
 * route vive nello Stack annidato nella tab Dashboard. Ricerca, form e
 * revisione del consenso sono invece flussi focalizzati e stanno fuori.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { colors, sizes, spacing } from "../../theme/tokens";
import { AppText, Button, TabBar } from "../../ui";
import { useSession } from "../auth/use-session";
import { useDashboardIdentity } from "../dashboard/identity/use-dashboard-identity";
import {
  DashboardGlobalError,
  DashboardOfflineNotice,
  DashboardSkeleton,
} from "../dashboard/components/DashboardStates";
import { useDashboardConnection } from "../dashboard/state/use-dashboard-connection";
import { STALE_MS } from "../dashboard/cache/freshness-policy";
import { InviteActionsSheet } from "./components/InviteActionsSheet";
import { NetworkNavBar } from "./components/NetworkNavBar";
import { SocietyIdentityRow } from "./components/SocietyIdentityRow";
import { SocietyListRow } from "./components/SocietyListRow";
import { NETWORK_QK } from "./network-keys";
import {
  NETWORK_EMPTY,
  activeCountLabel,
  groupActiveRelationships,
  groupRequests,
  hasNetworkCapability,
  inviteStateLabel,
  inviteTitle,
  locationLabel,
  requestStatusLabel,
} from "./network-presentation";
import {
  fetchNetworkHeader,
  fetchNetworkPage,
  fetchNetworkRequests,
} from "./network-service";
import { trackNetworkEvent } from "./network-analytics";
import type {
  NetworkListPage,
  NetworkRequestItem,
  NetworkRequestsPage,
  PendingInviteItem,
  RelationshipView,
} from "./network-types";

const PAGE_SIZE = 20;

type NetworkTab = "links" | "requests";

type ListEntry =
  | { kind: "heading"; title: string; key: string }
  | { kind: "relationship"; item: RelationshipView; key: string }
  | { kind: "request"; item: NetworkRequestItem; key: string }
  | { kind: "note"; text: string; key: string }
  | { kind: "history"; key: string };

export function SocietyNetworkScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { current } = useDashboardIdentity();
  const clubId = current?.kind === "society" ? current.id : null;
  const { connection, reportFailure, reportSuccess } = useDashboardConnection();
  const [tab, setTab] = useState<NetworkTab>("links");
  const [activeInvite, setActiveInvite] = useState<PendingInviteItem | null>(null);

  const headerQuery = useQuery({
    enabled: !!clubId && !!actorId,
    queryFn: () => fetchNetworkHeader(clubId as string),
    queryKey: NETWORK_QK.center(actorId, clubId ?? ""),
    staleTime: STALE_MS.operational,
  });

  const header = headerQuery.data ?? null;
  const canViewLinks = hasNetworkCapability(header, "network_view");
  const canViewRequests = hasNetworkCapability(header, "network_requests_view");
  const canSend = hasNetworkCapability(header, "network_request_send");
  const canViewHistory = hasNetworkCapability(header, "network_history_view");
  const canManageInvites = hasNetworkCapability(header, "network_invite_create");

  const linksQuery = useInfiniteQuery({
    enabled: !!clubId && !!actorId && canViewLinks,
    getNextPageParam: (last: NetworkListPage) => last.nextCursor,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      fetchNetworkPage(clubId as string, pageParam, PAGE_SIZE),
    queryKey: NETWORK_QK.links(actorId, clubId ?? ""),
    staleTime: STALE_MS.operational,
  });

  const requestsQuery = useInfiniteQuery({
    enabled: !!clubId && !!actorId && canViewRequests,
    getNextPageParam: (last: NetworkRequestsPage) => last.nextCursor,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      fetchNetworkRequests(clubId as string, pageParam, PAGE_SIZE),
    queryKey: NETWORK_QK.requests(actorId, clubId ?? ""),
    staleTime: STALE_MS.operational,
  });

  /**
   * §5: «Mostrare solo le tab/accessi leggibili. Se manca accesso alle
   * richieste, non esporne i conteggi, le anteprime o una tab inutilizzabile.»
   * Una tab sola non è più una scelta e la barra sparisce con lei.
   */
  const tabs = useMemo(() => {
    const items: { label: string; value: NetworkTab }[] = [];

    if (canViewLinks) {
      items.push({ label: "Collegate", value: "links" });
    }

    if (canViewRequests) {
      items.push({ label: "Richieste", value: "requests" });
    }

    return items;
  }, [canViewLinks, canViewRequests]);

  useEffect(() => {
    if (clubId) {
      trackNetworkEvent("network_center_opened", { has_links: canViewLinks });
    }
  }, [canViewLinks, clubId]);

  // La tab attiva è **derivata**: se una capability scompare fra due refresh,
  // la tab che non è più leggibile non resta selezionata e non serve un
  // effetto che insegua lo stato (§5).
  const activeTab: NetworkTab = tabs.some((item) => item.value === tab)
    ? tab
    : (tabs[0]?.value ?? "links");

  const relationships = useMemo(
    () => linksQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [linksQuery.data],
  );

  const requests = useMemo(
    () => requestsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [requestsQuery.data],
  );

  const entries = useMemo<ListEntry[]>(() => {
    if (activeTab === "links") {
      const rows: ListEntry[] = [];

      for (const section of groupActiveRelationships(relationships)) {
        rows.push({ key: `h:${section.key}`, kind: "heading", title: section.title });

        for (const item of section.data) {
          rows.push({
            item,
            key: `r:${item.relationshipId}`,
            kind: "relationship",
          });
        }
      }

      if (canViewHistory && rows.length > 0) {
        rows.push({ key: "history", kind: "history" });
      }

      return rows;
    }

    const rows: ListEntry[] = [];

    for (const section of groupRequests(requests)) {
      rows.push({ key: `h:${section.key}`, kind: "heading", title: section.title });

      for (const item of section.data) {
        const id =
          item.kind === "invite"
            ? `i:${item.invite.inviteId}`
            : `q:${item.relationship.relationshipId}`;

        rows.push({ item, key: id, kind: "request" });
      }
    }

    if (rows.length > 0) {
      rows.push({
        key: "note",
        kind: "note",
        text: "Il collegamento si attiva dopo l'accettazione.",
      });
    }

    return rows;
  }, [activeTab, canViewHistory, relationships, requests]);

  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: NETWORK_QK.center(actorId, clubId ?? ""),
      }),
      queryClient.invalidateQueries({
        queryKey: NETWORK_QK.links(actorId, clubId ?? ""),
      }),
      queryClient.invalidateQueries({
        queryKey: NETWORK_QK.requests(actorId, clubId ?? ""),
      }),
    ]);
  }, [actorId, clubId, queryClient]);

  const isLoading =
    headerQuery.isLoading ||
    (activeTab === "links" ? linksQuery.isLoading : requestsQuery.isLoading);

  const error =
    headerQuery.error ??
    (activeTab === "links" ? linksQuery.error : requestsQuery.error);

  useEffect(() => {
    if (error) {
      reportFailure(error);
    } else if (!isLoading) {
      reportSuccess();
    }
  }, [error, isLoading, reportFailure, reportSuccess]);

  const openSearch = useCallback(() => {
    if (!clubId) {
      return;
    }

    trackNetworkEvent("network_search_opened", { origin: activeTab });
    router.push(`/society-link/search?clubId=${encodeURIComponent(clubId)}`);
  }, [activeTab, clubId, router]);

  const openRelationship = useCallback(
    (item: RelationshipView) => {
      if (!clubId) {
        return;
      }

      trackNetworkEvent("network_detail_opened", { status: item.status });

      // §9: una richiesta apre la revisione del consenso (flusso focalizzato),
      // una relazione attiva o conclusa apre il dettaglio dentro la tab.
      if (item.status === "pending") {
        router.push(
          `/society-link/review?clubId=${encodeURIComponent(clubId)}&relationshipId=${encodeURIComponent(item.relationshipId)}`,
        );
        return;
      }

      router.push(`/(tabs)/dashboard/network/${item.relationshipId}`);
    },
    [clubId, router],
  );

  if (!clubId) {
    return (
      <View style={styles.root}>
        <NetworkNavBar onBack={() => router.back()} title="Rete societaria" />
        <DashboardGlobalError
          body="Seleziona una società per gestire la rete."
          onRetry={() => router.back()}
          title="Nessuna società selezionata"
        />
      </View>
    );
  }

  if (isLoading && !header) {
    return (
      <View style={styles.root}>
        <NetworkNavBar onBack={() => router.back()} title="Rete societaria" />
        <DashboardSkeleton />
      </View>
    );
  }

  if (error && !header) {
    return (
      <View style={styles.root}>
        <NetworkNavBar onBack={() => router.back()} title="Rete societaria" />
        <DashboardGlobalError
          body="Riprova tra poco."
          onRetry={() => void refresh()}
          title="Non è stato possibile caricare i collegamenti"
        />
      </View>
    );
  }

  const countLabel =
    activeTab === "links"
      ? activeCountLabel(header?.activeRelationshipCount ?? null)
      : null;

  const empty = activeTab === "links" ? NETWORK_EMPTY.links : NETWORK_EMPTY.requests;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <NetworkNavBar onBack={() => router.back()} title="Rete societaria" />

        {header ? (
          <SocietyIdentityRow
            society={{
              city: header.city,
              clubId: header.clubId,
              isVerified: header.isVerified,
              logoUrl: header.logoUrl,
              name: header.name,
              province: header.province,
              region: header.region,
            }}
            subtitle="Società"
            testID="network-identity"
          />
        ) : null}
      </View>

      {tabs.length > 1 ? (
        <TabBar
          active={activeTab}
          items={tabs}
          onChange={(value) => {
            setTab(value);
            trackNetworkEvent("network_tab_changed", { tab: value });
          }}
          testID="network-tabs"
          tone="neutral"
        />
      ) : null}

      {connection === "offline" ? <DashboardOfflineNotice /> : null}

      <FlatList
        contentContainerStyle={styles.listContent}
        data={entries}
        keyExtractor={(entry) => entry.key}
        ListEmptyComponent={
          <View style={styles.empty} testID="network-empty">
            <AppText color="neutral" variant="titleMd">
              {empty.title}
            </AppText>
            <AppText color="neutralMuted" variant="bodySm">
              {empty.body}
            </AppText>
          </View>
        }
        ListFooterComponent={
          (activeTab === "links"
            ? linksQuery.isFetchingNextPage
            : requestsQuery.isFetchingNextPage) ? (
            <ActivityIndicator color={colors.textNeutralMuted} style={styles.footerSpinner} />
          ) : null
        }
        ListHeaderComponent={
          countLabel ? (
            <AppText color="neutralMuted" style={styles.count} variant="meta">
              {countLabel}
            </AppText>
          ) : null
        }
        onEndReached={() => {
          if (activeTab === "links") {
            if (linksQuery.hasNextPage && !linksQuery.isFetchingNextPage) {
              void linksQuery.fetchNextPage();
            }
            return;
          }

          if (requestsQuery.hasNextPage && !requestsQuery.isFetchingNextPage) {
            void requestsQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            onRefresh={() => void refresh()}
            refreshing={headerQuery.isRefetching}
            tintColor={colors.textNeutralMuted}
          />
        }
        renderItem={({ item: entry }) => (
          <NetworkEntry
            entry={entry}
            onOpenHistory={() => {
              trackNetworkEvent("network_history_opened", {});
              router.push("/(tabs)/dashboard/network/history");
            }}
            onOpenInvite={setActiveInvite}
            onOpenRelationship={openRelationship}
          />
        )}
      />

      {/* §20: revoca e rigenerazione del link vivono nello stesso percorso
          gestionale, la tab Richieste, non in una seconda schermata. */}
      <InviteActionsSheet
        canManage={canManageInvites}
        clubId={clubId}
        invite={activeInvite}
        inviterName={header?.name ?? ""}
        onChanged={() => void refresh()}
        onClose={() => setActiveInvite(null)}
      />

      {canSend ? (
        <View style={styles.footer}>
          {/* §3, riga 01/02 della matrice: primaria blu PROLINK, testo bianco. */}
          <Button
            fullWidth
            label="Collega una società"
            onPress={openSearch}
            size="lg"
            testID="network-link-cta"
            variant="primary"
          />
        </View>
      ) : null}
    </View>
  );
}

function NetworkEntry({
  entry,
  onOpenHistory,
  onOpenInvite,
  onOpenRelationship,
}: {
  entry: ListEntry;
  onOpenHistory: () => void;
  onOpenInvite: (invite: PendingInviteItem) => void;
  onOpenRelationship: (item: RelationshipView) => void;
}) {
  if (entry.kind === "heading") {
    return (
      <AppText color="neutral" style={styles.heading} variant="titleSm">
        {entry.title}
      </AppText>
    );
  }

  if (entry.kind === "note") {
    return (
      <AppText color="neutralSoft" style={styles.note} variant="meta">
        {entry.text}
      </AppText>
    );
  }

  if (entry.kind === "history") {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onOpenHistory}
        style={({ pressed }) => [styles.historyRow, pressed ? styles.pressed : null]}
        testID="network-history-row"
      >
        <AppText color="neutral" variant="bodyLg">
          Storico collegamenti
        </AppText>
        <Ionicons color={colors.textNeutralMuted} name="chevron-forward" size={18} />
      </Pressable>
    );
  }

  if (entry.kind === "relationship") {
    const item = entry.item;

    return (
      <SocietyListRow
        detail={item.rowLabel}
        location={locationLabel(
          item.counterpart.city,
          item.counterpart.province,
          item.counterpart.region,
        )}
        onPress={() => onOpenRelationship(item)}
        society={item.counterpart}
        testID={`network-row-${item.relationshipId}`}
      />
    );
  }

  const request = entry.item;

  if (request.kind === "invite") {
    /**
     * §17: «Evitare di presentare il nome descrittivo come profilo
     * registrato e di mostrare una verifica inventata.» Per questo l'invito
     * non passa da `SocietyListRow`: non ha una Society, quindi non ha uno
     * stemma né un check.
     */
    return (
      <Pressable
        accessibilityLabel={`${inviteTitle(request.invite)}. ${inviteStateLabel(request.invite)}`}
        accessibilityRole="button"
        onPress={() => onOpenInvite(request.invite)}
        style={({ pressed }) => [styles.inviteRow, pressed ? styles.pressed : null]}
        testID={`network-invite-${request.invite.inviteId}`}
      >
        <AppText color="neutral" numberOfLines={1} variant="titleSm">
          {inviteTitle(request.invite)}
        </AppText>
        <AppText color="neutralSoft" variant="meta">
          {inviteStateLabel(request.invite)}
        </AppText>
      </Pressable>
    );
  }

  return (
    <SocietyListRow
      detail={requestStatusLabel(request)}
      location={locationLabel(
        request.relationship.counterpart.city,
        request.relationship.counterpart.province,
        request.relationship.counterpart.region,
      )}
      onPress={() => onOpenRelationship(request.relationship)}
      society={request.relationship.counterpart}
      testID={`network-request-${request.relationship.relationshipId}`}
    />
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  header: {
    gap: spacing[12],
    paddingBottom: spacing[12],
    paddingHorizontal: spacing[20],
  },
  listContent: {
    paddingBottom: spacing[24],
    paddingHorizontal: spacing[20],
  },
  count: {
    paddingBottom: spacing[8],
    paddingTop: spacing[16],
  },
  heading: {
    paddingBottom: spacing[4],
    paddingTop: spacing[16],
  },
  note: {
    paddingTop: spacing[16],
  },
  historyRow: {
    alignItems: "center",
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing[16],
    minHeight: sizes.touchTarget,
  },
  inviteRow: {
    gap: spacing[4],
    minHeight: sizes.touchTarget,
    justifyContent: "center",
    paddingVertical: spacing[10],
  },
  empty: {
    gap: spacing[8],
    paddingTop: spacing[40],
  },
  footer: {
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: 1,
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
    paddingBottom: spacing[12],
  },
  footerSpinner: {
    paddingVertical: spacing[16],
  },
  pressed: {
    opacity: 0.7,
  },
});
