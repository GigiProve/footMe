import { FlatList, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Screen } from "../../components/ui/screen";
import { useSession } from "../auth/use-session";
import { colors, spacing } from "../../styles";
import {
  AppText,
  Badge,
  Button,
  EmptyState,
  ListItem,
  ScreenHeader,
} from "../../ui";
import {
  fetchNotifications,
  markNotificationRead,
} from "../clubs/notification-service";
import type { AppNotification } from "../clubs/membership-types";

function iconForType(
  type: string,
): keyof typeof Ionicons.glyphMap {
  if (type === "content_tag") return "pricetag-outline";
  return "notifications-outline";
}

function shortDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Ora";
  if (diffMins < 60) return `${diffMins}m fa`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h fa`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}g fa`;
  return date.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

export function NotificationCenterScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const profileId = profile?.id ?? "";

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
    }
  }

  if (isLoading) {
    return (
      <Screen>
        <View style={styles.container}>
          <View style={styles.headerWrapper}>
            <Button
              label="Indietro"
              onPress={() => router.back()}
              size="sm"
              variant="link"
            />
            <ScreenHeader title="Notifiche" />
          </View>
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
          <View style={styles.headerWrapper}>
            <Button
              label="Indietro"
              onPress={() => router.back()}
              size="sm"
              variant="link"
            />
            <ScreenHeader title="Notifiche" />
          </View>
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
        <View style={styles.headerWrapper}>
          <Button
            label="Indietro"
            onPress={() => router.back()}
            size="sm"
            variant="link"
          />
          <ScreenHeader title="Notifiche" />
        </View>

        <FlatList
          contentContainerStyle={
            notifications.length === 0
              ? styles.emptyContainer
              : styles.listContent
          }
          data={notifications}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <EmptyState
              icon="notifications-outline"
              title="Nessuna notifica"
              description="Qui troverai gli aggiornamenti, ad esempio quando vieni taggato in un contenuto."
            />
          }
          renderItem={({ item }) => (
            <ListItem
              left={
                <Ionicons
                  color={item.is_read ? colors.textMuted : colors.accent}
                  name={iconForType(item.type)}
                  size={22}
                />
              }
              onPress={() => handlePress(item)}
              right={
                !item.is_read ? (
                  <Badge label="Nuova" variant="accent" />
                ) : (
                  <AppText variant="caption" color="muted">
                    {shortDate(item.created_at)}
                  </AppText>
                )
              }
              subtitle={item.body ?? ""}
              title={item.title}
            />
          )}
        />
      </View>
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
    gap: spacing[8],
  },
  listContent: {
    paddingHorizontal: spacing[12],
  },
  emptyContainer: {
    flex: 1,
    padding: spacing[20],
    justifyContent: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing[20],
  },
});
