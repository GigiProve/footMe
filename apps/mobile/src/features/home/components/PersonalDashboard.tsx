import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";

import { KeyboardAwareForm } from "../../../components/ui/keyboard-aware-form";
import { Screen } from "../../../components/ui/screen";
import { useSession } from "../../auth/use-session";
import { fetchNotifications } from "../../clubs/notification-service";
import { useUnreadNotificationsCount } from "../../notifications/use-unread-notifications-count";
import { formatRelativeTime } from "../../../lib/relative-time";
import { getHomeDashboard } from "../home-dashboard-service";
import { spacing } from "../../../theme/tokens";
import {
  AppText,
  EmptyState,
  HeaderBell,
  ListItem,
  ScreenHeader,
  StatCard,
} from "../../../ui";

type HighlightTone = "accent" | "hero" | "muted";

const toneMap: Record<string, HighlightTone> = {
  accent: "accent",
  hero: "hero",
};

export function PersonalDashboard() {
  const router = useRouter();
  const { profile, session } = useSession();
  const userId = session?.user?.id;
  const profileId = profile?.id ?? "";
  const userEmail = session?.user?.email ?? null;

  // HOM-14 §5: lo stesso badge di ogni superficie (nuove dall'ultima apertura del Centro).
  const unreadCount = useUnreadNotificationsCount();

  const { data: dashboard } = useQuery({
    queryKey: ["home-dashboard", userId, userEmail],
    queryFn: () => getHomeDashboard(userId as string, userEmail),
    enabled: !!userId,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", profileId],
    queryFn: () => fetchNotifications(profileId, 5),
    enabled: !!profileId,
  });

  const highlights = dashboard?.highlights ?? [];

  return (
    <Screen>
      <KeyboardAwareForm contentContainerStyle={styles.scrollContent}>
        <ScreenHeader
          title="Dashboard"
          subtitle="Il tuo riepilogo personale"
          action={
            <HeaderBell
              count={unreadCount}
              onPress={() => router.push("/notifications")}
            />
          }
        />

        {highlights.length > 0 ? (
          <View style={styles.statRow}>
            {highlights.map((highlight) => (
              <StatCard
                key={highlight.label}
                label={highlight.label}
                tone={toneMap[highlight.tone] ?? "muted"}
                value={highlight.value}
              />
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <AppText variant="headingSm">Notifiche recenti</AppText>
          {notifications.length === 0 ? (
            <EmptyState
              icon="notifications-outline"
              title="Nessuna notifica"
              description="Le tue notifiche recenti appariranno qui."
            />
          ) : (
            notifications.map((notification, index) => (
              <ListItem
                key={notification.id}
                title={notification.title}
                subtitle={notification.body ?? formatRelativeTime(notification.created_at)}
                showDivider={index < notifications.length - 1}
              />
            ))
          )}
        </View>
      </KeyboardAwareForm>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    gap: spacing[16],
    paddingBottom: spacing[24],
  },
  statRow: {
    flexDirection: "row",
    gap: spacing[12],
  },
  section: {
    gap: spacing[8],
  },
});
