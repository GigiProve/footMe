import { useMemo, useState } from "react";
import { Alert, ScrollView, SectionList, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Screen } from "../../components/ui/screen";
import { useSession } from "../auth/use-session";
import { colors, spacing } from "../../styles";
import {
  ActionSheet,
  AppText,
  Button,
  EmptyState,
  ScreenHeader,
  useToast,
  type ActionSheetAction,
} from "../../ui";
import {
  deleteReadNotifications,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../clubs/notification-service";
import type { AppNotification } from "../clubs/membership-types";
import { NotificationRow } from "./NotificationRow";
import {
  filterNotificationsByCategory,
  filterUnread,
  groupNotifications,
  groupNotificationsByTime,
  NOTIFICATION_FILTERS,
  type NotificationCategoryFilter,
} from "./notifications-helpers";

export function NotificationCenterScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const profileId = profile?.id ?? "";

  const [categoryFilter, setCategoryFilter] =
    useState<NotificationCategoryFilter>("tutte");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [isActionSheetVisible, setIsActionSheetVisible] = useState(false);

  const { data: notifications = [], isLoading, isError } = useQuery({
    queryKey: ["notifications", profileId],
    queryFn: () => fetchNotifications(profileId),
    enabled: !!profileId,
  });

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onMutate: async (notificationId: string) => {
      await queryClient.cancelQueries({ queryKey: ["notifications", profileId] });
      const previous = queryClient.getQueryData<AppNotification[]>([
        "notifications",
        profileId,
      ]);
      queryClient.setQueryData<AppNotification[]>(
        ["notifications", profileId],
        (old) =>
          (old ?? []).map((n) =>
            n.id === notificationId ? { ...n, is_read: true } : n,
          ),
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["notifications", profileId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["notifications-unread", profileId],
      });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", profileId] });
      queryClient.invalidateQueries({
        queryKey: ["notifications-unread", profileId],
      });
      showToast({
        message: "Tutte le notifiche sono state segnate come lette",
        tone: "success",
      });
    },
    onError: () => {
      showToast({ message: "Impossibile aggiornare le notifiche" });
    },
  });

  const deleteReadMutation = useMutation({
    mutationFn: deleteReadNotifications,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", profileId] });
      showToast({ message: "Notifiche lette eliminate", tone: "success" });
    },
    onError: () => {
      showToast({ message: "Impossibile eliminare le notifiche" });
    },
  });

  function handlePress(item: AppNotification) {
    if (!item.is_read) {
      markReadMutation.mutate(item.id);
    }

    if (item.type === "content_tag") {
      const contentType = item.data?.content_type;
      const postId = item.data?.post_id;
      if (contentType && postId) {
        router.push({
          pathname: "/content/[type]/[id]",
          params: { type: contentType, id: postId },
        });
      }
    } else if (item.type === "agent_representation_request") {
      const representationId = item.data?.representation_id;
      if (representationId) {
        router.push(`/representation/${representationId}` as never);
      }
    } else if (item.type === "agent_representation_responded") {
      const representationId = item.data?.representation_id;
      if (representationId) {
        router.push(`/representation/assistito/${representationId}` as never);
      }
    } else if (item.type === "agent_representation_visibility_proposed") {
      const representationId = item.data?.representation_id;
      if (representationId) {
        router.push(`/representation/manage/${representationId}` as never);
      }
    } else if (
      item.type === "application_received" ||
      item.type === "application_status"
    ) {
      router.push("/(tabs)/announcements" as never);
    } else if (item.type === "new_follower") {
      const followerProfileId = item.data?.follower_profile_id;
      if (followerProfileId) {
        router.push(`/profile/${followerProfileId}` as never);
      }
    }
    // agent_representation_removed: mark read only, no navigation
  }

  function handleMarkAllRead() {
    markAllReadMutation.mutate();
  }

  function handleToggleUnreadOnly() {
    setShowUnreadOnly((prev) => !prev);
  }

  function handleOpenPreferences() {
    router.push("/notification-preferences" as never);
  }

  function handleDeleteRead() {
    Alert.alert(
      "Elimina notifiche lette",
      "Sei sicuro di voler eliminare tutte le notifiche già lette? L'operazione non è reversibile.",
      [
        { style: "cancel", text: "Annulla" },
        {
          onPress: () => deleteReadMutation.mutate(),
          style: "destructive",
          text: "Elimina",
        },
      ],
    );
  }

  const actionSheetActions: ActionSheetAction[] = [
    {
      icon: "checkmark-done-outline",
      label: "Segna tutte come lette",
      onPress: handleMarkAllRead,
    },
    {
      icon: "filter-outline",
      label: showUnreadOnly ? "Mostra tutte" : "Mostra solo non lette",
      onPress: handleToggleUnreadOnly,
    },
    {
      icon: "settings-outline",
      label: "Preferenze notifiche",
      onPress: handleOpenPreferences,
    },
    {
      destructive: true,
      icon: "trash-outline",
      label: "Elimina notifiche lette",
      onPress: handleDeleteRead,
    },
  ];

  const sections = useMemo(() => {
    const byCategory = filterNotificationsByCategory(
      notifications,
      categoryFilter,
    );
    const byReadState = showUnreadOnly ? filterUnread(byCategory) : byCategory;
    const grouped = groupNotifications(byReadState);
    return groupNotificationsByTime(grouped);
  }, [notifications, categoryFilter, showUnreadOnly]);

  const header = (
    <View style={styles.headerWrapper}>
      <View style={styles.topRow}>
        <Button
          label="Indietro"
          onPress={() => router.back()}
          size="sm"
          variant="link"
        />
      </View>
      <ScreenHeader
        action={
          <Button
            accessibilityLabel="Gestisci notifiche"
            label=""
            leftIcon={
              <Ionicons
                color={colors.textPrimary}
                name="options-outline"
                size={20}
              />
            }
            onPress={() => setIsActionSheetVisible(true)}
            size="sm"
            variant="icon"
          />
        }
        title="Notifiche"
      />
      <ScrollView
        contentContainerStyle={styles.chipsRow}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
      >
        {NOTIFICATION_FILTERS.map((filter) => (
          <Button
            key={filter.value}
            label={filter.label}
            onPress={() => setCategoryFilter(filter.value)}
            selected={categoryFilter === filter.value}
            size="sm"
            style={styles.chip}
            variant="chipAction"
          />
        ))}
      </ScrollView>
    </View>
  );

  if (isLoading) {
    return (
      <Screen>
        <View style={styles.container}>
          {header}
          <View style={styles.center}>
            <AppText variant="bodySm" color="muted">
              Caricamento...
            </AppText>
          </View>
        </View>
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen>
        <View style={styles.container}>
          {header}
          <View style={styles.center}>
            <EmptyState
              icon="alert-circle-outline"
              title="Errore"
              description="Impossibile caricare le notifiche. Riprova."
              variant="error"
            />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.container}>
        {header}

        <SectionList
          contentContainerStyle={
            sections.length === 0 ? styles.emptyContainer : styles.listContent
          }
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <EmptyState
              icon="notifications-outline"
              title="Nessuna notifica"
              description={
                showUnreadOnly
                  ? "Non hai notifiche non lette in questa categoria."
                  : "Qui troverai gli aggiornamenti, ad esempio quando vieni taggato in un contenuto."
              }
            />
          }
          renderItem={({ item }) => (
            <NotificationRow notification={item} onPress={handlePress} />
          )}
          renderSectionHeader={({ section: { title } }) => (
            <AppText color="muted" style={styles.sectionTitle} variant="titleSm">
              {title}
            </AppText>
          )}
          sections={sections}
          stickySectionHeadersEnabled={false}
        />
      </View>

      <ActionSheet
        actions={actionSheetActions}
        onClose={() => setIsActionSheetVisible(false)}
        title="Gestisci notifiche"
        visible={isActionSheetVisible}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerWrapper: {
    paddingHorizontal: spacing[16],
    paddingTop: spacing[12],
    paddingBottom: spacing[8],
    gap: spacing[12],
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  chipsScroll: {
    flexGrow: 0,
  },
  chipsRow: {
    alignItems: "center",
    paddingVertical: spacing[4],
  },
  chip: {
    marginRight: spacing[8],
  },
  listContent: {
    paddingHorizontal: spacing[12],
    paddingBottom: spacing[24],
  },
  emptyContainer: {
    flex: 1,
    padding: spacing[20],
    justifyContent: "center",
  },
  sectionTitle: {
    paddingHorizontal: spacing[16],
    paddingTop: spacing[16],
    paddingBottom: spacing[8],
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing[20],
  },
});
