/**
 * Centro Notifiche (HOM-14 §20–§32, §216–§230).
 *
 * Una sola timeline per tutti i tipi (§21), a sezioni Oggi / Questa settimana /
 * Precedenti (§23). Niente tab, filtri, «solo non lette» né «Segna tutte come
 * lette» (§18, §237). Header: titolo e icona sliders verso le Preferenze (§30–
 * §32); un solo menu minimo per «Elimina notifiche aperte» (decisione Luigi).
 *
 * Stati (§10–§13): aprire il Centro marca VISTE le notifiche fino all'ora del
 * server della prima pagina (il badge si azzera, l'azzurrino resta, §216–§217);
 * toccare una riga la marca APERTA (diventa bianca, §9) e apre il target dal
 * Target Resolver. Il client non crea mai notifiche (§171).
 */

import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, SafeAreaView, SectionList, StyleSheet, View, type ViewToken } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";

import { useSession } from "../auth/use-session";
import { colors, spacing } from "../../styles";
import {
  ActionSheet,
  AppText,
  Button,
  ScreenHeader,
  Skeleton,
  useToast,
  type ActionSheetAction,
} from "../../ui";
import { trackNotification } from "./notification-analytics";
import { notificationKeys } from "./notification-keys";
import {
  flattenNotificationPages,
  groupNotificationsByTime,
} from "./notification-presentation";
import {
  deleteOpenedNotifications,
  fetchNotificationPage,
  markNotificationCenterSeen,
  markNotificationOpened,
} from "./notification-service";
import type { InboxNotification, NotificationCursor, NotificationPage } from "./notification-types";
import type { ConversationLink } from "./conversation-target-presentation";
import {
  openNotificationTarget,
  useOpenConversationFromLink,
  useOpenNotificationFromPush,
} from "./use-notification-navigation";
import { NotificationRow } from "./NotificationRow";

type TimelineData = InfiniteData<NotificationPage, NotificationCursor | null>;

/** §229: la lista si legge già a metà riga; l'impression conta solo ciò che resta visibile. */
const VIEWABILITY = { itemVisiblePercentThreshold: 60, minimumViewTime: 600 };

const SKELETON_ROWS = [0, 1, 2, 3, 4];

function cursorAfter(page: NotificationPage): NotificationCursor | undefined {
  const last = page.items[page.items.length - 1];

  return page.hasMore && last ? { beforeAt: last.displayAt, beforeId: last.id } : undefined;
}

/** §229: skeleton leggeri, con la stessa geometria della riga. */
function NotificationSkeleton() {
  return (
    <View accessibilityLabel="Caricamento notifiche" style={styles.skeleton}>
      {SKELETON_ROWS.map((row) => (
        <View key={row} style={styles.skeletonRow}>
          <Skeleton.Circle />
          <View style={styles.skeletonText}>
            <Skeleton.Row style={styles.skeletonShort} />
            <Skeleton.Row />
          </View>
        </View>
      ))}
    </View>
  );
}

export function NotificationCenterScreen({
  openConversation = null,
  openNotificationId = null,
}: {
  /** `/notifications?conversation=…`: il tap su una push chat ripreso dopo il login (DAS-REV-34 §293). */
  openConversation?: ConversationLink | null;
  /** `/notifications?open=<id>`: il tap su un push (§177). */
  openNotificationId?: string | null;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const profileId = profile?.id ?? "";
  const timelineKey = notificationKeys.timeline(profileId);

  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useOpenNotificationFromPush(openNotificationId);
  useOpenConversationFromLink(openConversation);

  const query = useInfiniteQuery({
    enabled: !!profileId,
    getNextPageParam: cursorAfter,
    initialPageParam: null as NotificationCursor | null,
    queryFn: ({ pageParam }) => fetchNotificationPage(pageParam),
    queryKey: timelineKey,
  });

  const pages = query.data?.pages ?? [];
  const items = flattenNotificationPages(pages);
  const sections = groupNotificationsByTime(items);

  /* §14–§16, §216–§217: aprire il Centro vede tutto fino all'ora del SERVER della prima
     pagina (mai l'orologio del device): una riga arrivata dopo resta NEW. Al refresh la
     stessa regola vede ciò che il Centro mostra davvero (§17). */
  const asOf = pages[0]?.asOf ?? null;
  const seenAsOf = useRef<string | null>(null);
  const openTracked = useRef(false);
  const { mutate: markSeen } = useMutation({
    mutationFn: markNotificationCenterSeen,
    onSuccess: (seenCount) => {
      trackNotification({ name: "notification_center_seen_batch", seenCount });
      void queryClient.invalidateQueries({ queryKey: notificationKeys.badge(profileId) });
    },
  });

  useEffect(() => {
    if (!asOf || seenAsOf.current === asOf) {
      return;
    }
    seenAsOf.current = asOf;

    if (!openTracked.current) {
      openTracked.current = true;
      const badgeCount = queryClient.getQueryData<number>(notificationKeys.badge(profileId)) ?? 0;

      trackNotification({ badgeCount, name: "notification_center_open" });
      if (badgeCount > 0) {
        trackNotification({ clearedCount: badgeCount, name: "notification_badge_cleared_on_center_open" });
      }
    }
    markSeen(asOf);
  }, [asOf, markSeen, profileId, queryClient]);

  /* §9, §121: aperta = bianca subito (ottimistico). Se il server rifiuta perché l'aggregato
     ha avuto nuova attività, la riga si rilegge e torna azzurrina (§122). */
  const openMutation = useMutation({
    mutationFn: (item: InboxNotification) => markNotificationOpened(item.id, item.revision),
    onError: (_error: Error, _item: InboxNotification, context: { previous?: TimelineData } | undefined) => {
      if (context?.previous) {
        queryClient.setQueryData(timelineKey, context.previous);
      }
    },
    onMutate: async (item) => {
      await queryClient.cancelQueries({ queryKey: timelineKey });
      const previous = queryClient.getQueryData<TimelineData>(timelineKey);

      queryClient.setQueryData<TimelineData>(timelineKey, (old) =>
        old
          ? {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                items: page.items.map((row) => (row.id === item.id ? { ...row, isOpened: true } : row)),
              })),
            }
          : old,
      );

      return { previous };
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.badge(profileId) });
    },
    onSuccess: (marked) => {
      if (!marked) {
        void queryClient.invalidateQueries({ queryKey: timelineKey });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteOpenedNotifications,
    onError: () => showToast({ message: "Impossibile eliminare le notifiche" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: timelineKey });
      showToast({ message: "Notifiche aperte eliminate", tone: "success" });
    },
  });

  /* §256: impression di una notifica visibile, una volta per versione. */
  const impressions = useRef(new Set<string>());
  const [handleViewable] = useState(() => ({ viewableItems }: { viewableItems: ViewToken[] }) => {
    for (const token of viewableItems) {
      const item = token.item as InboxNotification | undefined;

      // Gli header di sezione arrivano come token senza `id`: non sono notifiche.
      if (item?.id && !impressions.current.has(`${item.id}:${item.revision}`)) {
        impressions.current.add(`${item.id}:${item.revision}`);
        trackNotification({
          eventCount: item.eventCount,
          isOpened: item.isOpened,
          name: "notification_impression",
          notificationType: item.type,
        });
      }
    }
  });

  function handlePress(item: InboxNotification) {
    trackNotification({
      name: "notification_open",
      notificationType: item.type,
      origin: "center",
      wasOpened: item.isOpened,
    });

    if (!item.isOpened) {
      openMutation.mutate(item);
    }

    // §161: anche con target non disponibile la notifica risulta aperta; la
    // destinazione mostra lo stato neutro (§157–§159).
    openNotificationTarget(router, item, "center", (message) =>
      showToast({ id: "notification-unavailable", message }),
    );
  }

  async function handleRefresh() {
    setIsRefreshing(true);
    trackNotification({ name: "notification_refresh" });
    try {
      await query.refetch();
    } finally {
      setIsRefreshing(false);
    }
  }

  function handleEndReached() {
    if (query.hasNextPage && !query.isFetchingNextPage && !query.isFetchNextPageError) {
      trackNotification({ loadedCount: items.length, name: "notification_load_more" });
      void query.fetchNextPage();
    }
  }

  function handleDeleteOpened() {
    Alert.alert(
      "Elimina notifiche aperte",
      "Eliminare tutte le notifiche già aperte? L'operazione non è reversibile.",
      [
        { style: "cancel", text: "Annulla" },
        { onPress: () => deleteMutation.mutate(), style: "destructive", text: "Elimina" },
      ],
    );
  }

  const menuActions: ActionSheetAction[] = [
    {
      destructive: true,
      icon: "trash-outline",
      id: "delete-opened",
      label: "Elimina notifiche aperte",
      onPress: handleDeleteOpened,
    },
  ];

  const header = (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <Button label="Indietro" onPress={() => router.back()} size="sm" variant="link" />
      </View>
      <ScreenHeader
        action={
          <View style={styles.actions}>
            <Button
              accessibilityLabel="Preferenze notifiche"
              label=""
              leftIcon={<Ionicons color={colors.textPrimary} name="options-outline" size={22} />}
              onPress={() => router.push("/notification-preferences" as never)}
              size="sm"
              variant="icon"
            />
            <Button
              accessibilityLabel="Altre azioni"
              label=""
              leftIcon={<Ionicons color={colors.textPrimary} name="ellipsis-horizontal" size={22} />}
              onPress={() => setIsMenuVisible(true)}
              size="sm"
              variant="icon"
            />
          </View>
        }
        title="Notifiche"
      />
    </View>
  );

  const showSkeleton = query.isPending;
  const showError = query.isError && items.length === 0;

  return (
    /* §25: lista aperta a tutta larghezza su fondo chiaro: lo `Screen` condiviso aggiunge 20px di
       margine che, sommati al padding della riga, staccavano l'azzurrino dai bordi. */
    <SafeAreaView style={styles.root}>
      <View style={styles.container}>
        {header}

        {showSkeleton ? (
          <NotificationSkeleton />
        ) : showError ? (
          // §230: stato compatto; tutto il blocco riprova.
          <Pressable
            accessibilityHint="Tocca per riprovare"
            accessibilityRole="button"
            onPress={() => void query.refetch()}
            style={styles.centered}
          >
            <AppText align="center" color="muted" variant="bodyLg">
              Non è stato possibile caricare le notifiche. Riprova.
            </AppText>
          </Pressable>
        ) : (
          <SectionList
            ListEmptyComponent={
              // §227–§228: nessuna illustrazione.
              <View style={styles.centered}>
                <AppText align="center" variant="headingSm">
                  Ancora nessuna notifica
                </AppText>
                <AppText align="center" color="muted" variant="bodyLg">
                  Qui troverai gli aggiornamenti sulle attività che ti riguardano.
                </AppText>
              </View>
            }
            ListFooterComponent={
              query.isFetchNextPageError ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void query.fetchNextPage()}
                  style={styles.footer}
                >
                  <AppText align="center" color="accent" variant="bodyLg">
                    Non è stato possibile caricare altre notifiche. Riprova.
                  </AppText>
                </Pressable>
              ) : null
            }
            contentContainerStyle={sections.length === 0 ? styles.emptyContainer : styles.listContent}
            keyExtractor={(item) => item.id}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.6}
            onRefresh={() => void handleRefresh()}
            onViewableItemsChanged={handleViewable}
            refreshing={isRefreshing}
            renderItem={({ item }) => <NotificationRow notification={item} onPress={handlePress} />}
            renderSectionHeader={({ section }) => (
              <AppText accessibilityRole="header" color="muted" style={styles.sectionTitle} variant="titleSm">
                {section.title}
              </AppText>
            )}
            sections={sections}
            stickySectionHeadersEnabled={false}
            viewabilityConfig={VIEWABILITY}
          />
        )}
      </View>

      <ActionSheet
        actions={menuActions}
        onClose={() => setIsMenuVisible(false)}
        title="Notifiche"
        visible={isMenuVisible}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  actions: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
  },
  centered: {
    alignItems: "center",
    flex: 1,
    gap: spacing[8],
    justifyContent: "center",
    padding: spacing[24],
  },
  container: {
    flex: 1,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  footer: {
    padding: spacing[20],
  },
  header: {
    gap: spacing[8],
    paddingBottom: spacing[8],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
  },
  listContent: {
    paddingBottom: spacing[24],
  },
  sectionTitle: {
    paddingBottom: spacing[8],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[20],
  },
  skeleton: {
    paddingHorizontal: spacing[20],
    paddingTop: spacing[8],
  },
  skeletonRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    paddingVertical: spacing[14],
  },
  skeletonShort: {
    width: "55%",
  },
  skeletonText: {
    flex: 1,
  },
  topRow: {
    alignItems: "center",
    flexDirection: "row",
  },
});
