/**
 * Liste da recuperare (DAS-REV-27 §19).
 *
 * «Con una lista può aprire direttamente lo screen 12; con più liste usa un
 * elenco semplice di nome e ambito che porta allo stesso screen, senza terza
 * tab o duplicazione del Centro. Con zero risultati mostra Nessuna lista da
 * recuperare.» Solo metadati minimi: nessun count, owner o contenuto.
 *
 * Superficie amministrativa focalizzata, fuori dalle tab: niente bottom
 * navigation (§4).
 */
import { useEffect } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, sizes, spacing } from "../../../../../theme/tokens";
import { AppText, Avatar } from "../../../../../ui";
import { useSession } from "../../../../auth/use-session";
import {
  DashboardGlobalEmpty,
  DashboardGlobalError,
} from "../../../components/DashboardStates";
import { useDashboardIdentity } from "../../../identity/use-dashboard-identity";
import { ShortlistSectionSkeleton } from "../../components/ShortlistSection";
import { SHORTLIST_QK } from "../../shortlist-keys";
import { SHORTLIST_COPY } from "../../shortlist-presentation";
import { SHORTLIST_HREFS } from "../../shortlist-routes";
import { ShortlistError } from "../../shortlist-types";
import { CUSTOM_COPY, recoveryRoute } from "../custom-shortlist-presentation";
import { fetchRecoverableShortlists } from "../custom-shortlist-service";
import type { RecoverablePage } from "../custom-shortlist-types";

export function RecoveryListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { current } = useDashboardIdentity();
  const clubId = current?.kind === "society" ? current.id : null;

  const query = useInfiniteQuery<
    RecoverablePage,
    Error,
    { pageParams: (string | null)[]; pages: RecoverablePage[] },
    readonly unknown[],
    string | null
  >({
    enabled: !!actorId && !!clubId,
    getNextPageParam: (last) => last.nextCursor,
    initialPageParam: null,
    queryFn: ({ pageParam }) => fetchRecoverableShortlists(clubId as string, pageParam),
    queryKey: SHORTLIST_QK.recoverable(actorId, clubId ?? ""),
    retry: (count, error) => !(error instanceof ShortlistError && error.kind !== "network") && count < 1,
    staleTime: 0,
  });

  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const route = query.data ? recoveryRoute(items, query.hasNextPage) : null;
  const direct = route?.kind === "direct" ? route.shortlistId : null;

  useEffect(() => {
    if (direct) {
      router.replace(SHORTLIST_HREFS.recovery(direct) as never);
    }
  }, [direct, router]);

  const denied = query.error instanceof ShortlistError && query.error.kind !== "network";

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <Pressable
          accessibilityLabel="Indietro"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => router.back()}
          style={styles.barAction}
          testID="recovery-list-back"
        >
          <Ionicons color={colors.textNeutral} name="chevron-back" size={24} />
        </Pressable>
        <AppText accessibilityRole="header" color="neutral" style={styles.barTitle} variant="titleMd">
          {CUSTOM_COPY.recoveryListTitle}
        </AppText>
        <View style={styles.barAction} />
      </View>

      {denied || !clubId ? (
        <DashboardGlobalEmpty
          copy={{
            actionLabel: SHORTLIST_COPY.backToDashboard,
            body: SHORTLIST_COPY.unavailableBody,
            icon: "document-lock-outline",
            title: SHORTLIST_COPY.unavailableTitle,
          }}
          onAction={() => router.replace(SHORTLIST_HREFS.center() as never)}
        />
      ) : query.isError ? (
        <DashboardGlobalError
          body={SHORTLIST_COPY.errorBody}
          onRetry={() => void query.refetch()}
          title={CUSTOM_COPY.recoveryListTitle}
        />
      ) : !query.data || direct ? (
        <ShortlistSectionSkeleton rows={3} />
      ) : route?.kind === "empty" ? (
        <DashboardGlobalEmpty
          copy={{
            actionLabel: SHORTLIST_COPY.backToDashboard,
            body: CUSTOM_COPY.noneToRecoverBody,
            icon: "checkmark-done-outline",
            title: CUSTOM_COPY.noneToRecover,
          }}
          onAction={() => router.replace(SHORTLIST_HREFS.center() as never)}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.shortlistId}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) {
              void query.fetchNextPage();
            }
          }}
          renderItem={({ index, item }) => (
            <Pressable
              accessibilityLabel={`${item.name}, ${item.scopeLabel}`}
              accessibilityRole="button"
              onPress={() => router.push(SHORTLIST_HREFS.recovery(item.shortlistId) as never)}
              style={({ pressed }) => [styles.row, index > 0 ? styles.divider : null, pressed ? styles.pressed : null]}
              testID={`recovery-row-${item.shortlistId}`}
            >
              <Avatar name={current?.name ?? ""} size="sm" square tone="ink" uri={current?.avatarUrl ?? undefined} />
              <View style={styles.flex}>
                <AppText color="neutral" numberOfLines={2} variant="bodySm">
                  {item.name}
                </AppText>
                <AppText color="neutralMuted" variant="meta">
                  {item.scopeLabel}
                </AppText>
              </View>
              <Ionicons color={colors.textNeutralSoft} name="chevron-forward" size={18} />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    flex: 1,
    paddingHorizontal: spacing[20],
  },
  bar: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: sizes.touchTarget + spacing[4],
  },
  barAction: {
    height: sizes.touchTarget,
    justifyContent: "center",
    marginLeft: -spacing[10],
    width: sizes.touchTarget,
  },
  barTitle: {
    flex: 1,
    textAlign: "center",
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget + spacing[12],
  },
  divider: {
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  flex: {
    flex: 1,
    gap: spacing[4],
  },
  pressed: {
    opacity: 0.6,
  },
});
