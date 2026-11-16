/**
 * Impostazioni → Privacy e sicurezza → Profili bloccati (HOM-12 §141–§151, §155,
 * §227, §247, Screen Master 7).
 *
 * Il luogo affidabile dove gestire i Block, dato che Cerca e Discovery nascondono le
 * identità bloccate (§142). Normale lista Settings, non una dashboard (§227): righe, non
 * card. Ordine `blocked_at desc` e paginazione keyset dal server (§149–§150). Le
 * intestazioni per identità blocker compaiono SOLO con più di un blocker (D7).
 * Sblocca è immediato, senza conferma (§152): la riga sparisce appena il server conferma
 * (§155) e le cache di eleggibilità si invalidano. Vuoto: «Nessun profilo bloccato».
 */

import { useEffect } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { Screen } from "../../../components/ui/screen";
import { colors, spacing } from "../../../theme/tokens";
import { AppText, Button, EmptyState, ScreenHeader } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { DASHBOARD_QK } from "../../dashboard/dashboard-keys";
import { fetchDashboardIdentities } from "../../dashboard/identity/identity-service";
import { blockedIdentityStore, useBlockEntry } from "../blocked-identity-store";
import { trackBlocking } from "../blocking-analytics";
import { BLOCK_QK } from "../blocking-keys";
import {
  BLOCK_COPY,
  blockTargetKey,
  groupBlockedIdentities,
} from "../blocking-presentation";
import { fetchBlockedIdentities } from "../blocking-service";
import type { BlockedIdentitiesPage, BlockedIdentity } from "../blocking-types";
import { useBlockActions } from "../use-block-actions";
import { BlockedIdentityRow } from "./BlockedIdentityRow";

type ListRow =
  | { kind: "header"; key: string; title: string }
  | { kind: "item"; key: string; item: BlockedIdentity };

export function BlockedProfilesScreen() {
  const router = useRouter();
  const { profile, session } = useSession();
  const viewerId = session?.user?.id ?? profile?.id ?? "";

  useEffect(() => {
    trackBlocking({ name: "blocked_profiles_open" });
  }, []);

  const listQuery = useInfiniteQuery({
    enabled: viewerId.length > 0,
    getNextPageParam: (lastPage: BlockedIdentitiesPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: null as Record<string, unknown> | null,
    queryFn: ({ pageParam }) => fetchBlockedIdentities(pageParam),
    queryKey: BLOCK_QK.list(viewerId),
  });

  // I nomi delle identità blocker per le intestazioni (D7): stessa cache della Dashboard.
  const identitiesQuery = useQuery({
    enabled: viewerId.length > 0,
    queryFn: fetchDashboardIdentities,
    queryKey: DASHBOARD_QK.identities(viewerId),
    staleTime: 5 * 60 * 1000,
  });

  const items = listQuery.data?.pages.flatMap((page: BlockedIdentitiesPage) => page.items) ?? [];

  // Il server è la fonte di verità: ogni lista letta riallinea le celle (§194, §209).
  useEffect(() => {
    if (!listQuery.dataUpdatedAt) {
      return;
    }
    for (const item of listQuery.data?.pages.flatMap((page: BlockedIdentitiesPage) => page.items) ?? []) {
      blockedIdentityStore.seed(
        blockTargetKey({ id: item.identityId, type: item.identityType }),
        true,
        item.blockId,
        listQuery.dataUpdatedAt,
      );
    }
  }, [listQuery.data, listQuery.dataUpdatedAt]);

  const blockerNames = new Map<string, string>(
    (identitiesQuery.data ?? []).map((identity) => [`${identity.kind}:${identity.id}`, identity.name]),
  );
  const sections = groupBlockedIdentities(items, blockerNames);
  const rows = sections.flatMap((section): ListRow[] => [
    ...(section.title ? [{ key: `h-${section.key}`, kind: "header" as const, title: section.title }] : []),
    ...section.items.map((item) => ({ item, key: item.blockId, kind: "item" as const })),
  ]);

  return (
    <Screen>
      <View style={styles.header}>
        <Button label="Torna indietro" onPress={() => router.back()} size="sm" variant="link" />
        <ScreenHeader title={BLOCK_COPY.listTitle} />
      </View>

      {listQuery.isPending ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : listQuery.isError ? (
        <View style={styles.center}>
          <AppText align="center" color="secondary" variant="bodyLg">
            {BLOCK_COPY.listError}
          </AppText>
          <Button label={BLOCK_COPY.retry} onPress={() => void listQuery.refetch()} variant="secondary" />
        </View>
      ) : (
        <FlatList
          ListEmptyComponent={
            <EmptyState description={BLOCK_COPY.emptyBody} title={BLOCK_COPY.emptyTitle} />
          }
          data={rows}
          keyExtractor={(row) => row.key}
          onEndReached={() => {
            if (listQuery.hasNextPage && !listQuery.isFetchingNextPage) {
              void listQuery.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          renderItem={({ item: row }) =>
            row.kind === "header" ? (
              <AppText accessibilityRole="header" color="secondary" style={styles.sectionTitle} variant="eyebrow">
                {row.title}
              </AppText>
            ) : (
              <Row item={row.item} />
            )
          }
        />
      )}
    </Screen>
  );
}

function Row({ item }: { item: BlockedIdentity }) {
  const actions = useBlockActions();
  const key = blockTargetKey({ id: item.identityId, type: item.identityType });
  const entry = useBlockEntry(key);

  // §155: la riga sparisce appena lo Sblocca è confermato.
  if (entry?.phase === "unblocked") {
    return null;
  }

  return (
    <BlockedIdentityRow
      isBusy={entry?.phase === "pending_unblock"}
      item={item}
      onUnblock={() => {
        trackBlocking({ identityType: item.identityType, name: "unblock_from_settings" });
        void actions.unblock({
          blockId: item.blockId,
          blocker: { id: item.blockerId, type: item.blockerType },
          surface: "settings",
          target: { id: item.identityId, name: item.name, type: item.identityType },
        });
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    flex: 1,
    gap: spacing[16],
    justifyContent: "center",
  },
  header: {
    gap: spacing[8],
    marginBottom: spacing[8],
  },
  sectionTitle: {
    paddingTop: spacing[16],
  },
});
