import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  View,
} from "react-native";

import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { Screen } from "../../../components/ui/screen";
import { KeyboardAwareForm } from "../../../components/ui/keyboard-aware-form";
import { useSession } from "../../auth/use-session";
import { colors, radius, spacing } from "../../../theme/tokens";
import {
  AppText,
  Avatar,
  Badge,
  EmptyState,
  ListItem,
  ModalHeader,
} from "../../../ui";
import {
  fetchNotifications,
  getUnreadCount,
  markNotificationRead,
} from "../notification-service";
import type { AppNotification } from "../membership-types";
import { fetchPublicClubProfile } from "../club-service";

type ClubMenuItem = {
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  subtitle: string;
  title: string;
};

const MENU_ITEMS: ClubMenuItem[] = [
  {
    icon: "people-outline",
    route: "/club-admin/roster",
    subtitle: "Rose, staff e struttura sportiva",
    title: "Organico",
  },
  {
    icon: "mail-open-outline",
    route: "/club-admin/invites",
    subtitle: "Link squadra e collegamenti",
    title: "Inviti e richieste",
  },
  {
    icon: "megaphone-outline",
    route: "/(tabs)/announcements",
    subtitle: "Annunci e candidature",
    title: "Posizioni aperte",
  },
];

const HIGHLIGHTED_MENU_ITEM: ClubMenuItem = {
  icon: "clipboard-outline",
  route: "/shortlist",
  subtitle: "Profili osservati, note interne e valutazioni",
  title: "Shortlist",
};

const MENU_ITEMS_AFTER: ClubMenuItem[] = [
  {
    icon: "key-outline",
    route: "/club-admin/permissions",
    subtitle: "Ruoli e permessi",
    title: "Amministratori",
  },
  {
    icon: "shield-outline",
    route: "/club-admin/teams",
    subtitle: "Gestisci squadre interne e società collegate",
    title: "Squadre e affiliate",
  },
];

export function ClubDashboard() {
  const router = useRouter();
  const { profile, session } = useSession();
  const userId = session?.user?.id;
  const clubId = profile?.club_id ?? null;

  const { data: clubProfile } = useQuery({
    enabled: !!clubId,
    queryFn: () => fetchPublicClubProfile(clubId as string),
    queryKey: ["club-public-profile", clubId],
  });

  // Notifications
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const loadUnreadCount = useCallback(async () => {
    if (!userId) return;
    try {
      const count = await getUnreadCount(userId);
      setUnreadCount(count);
    } catch {
      // Ignore
    }
  }, [userId]);

  useEffect(() => {
    loadUnreadCount();
  }, [loadUnreadCount]);

  async function handleOpenNotifications() {
    if (!userId) return;
    try {
      const data = await fetchNotifications(userId);
      setNotifications(data);
      setNotificationsOpen(true);
    } catch {
      Alert.alert("Errore", "Impossibile caricare le notifiche");
    }
  }

  async function handleMarkRead(notificationId: string) {
    try {
      await markNotificationRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, is_read: true } : n,
        ),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Ignore
    }
  }

  function handleMenuPress(route: string) {
    router.push(route as never);
  }

  const clubName = clubProfile?.name ?? profile?.club_name ?? "La tua società";

  return (
    <Screen>
      <KeyboardAwareForm contentContainerStyle={styles.scrollContent}>
        <View style={styles.topBar}>
          <AppText variant="headingMd">Dashboard società</AppText>
          <Pressable
            accessibilityLabel="Notifiche"
            accessibilityRole="button"
            hitSlop={8}
            onPress={handleOpenNotifications}
            style={({ pressed }) => [
              styles.bellButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Ionicons
              color={colors.textPrimary}
              name={unreadCount > 0 ? "notifications" : "notifications-outline"}
              size={20}
            />
            {unreadCount > 0 ? (
              <View style={styles.bellBadge}>
                <AppText color="inverse" variant="caption">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </AppText>
              </View>
            ) : null}
          </Pressable>
        </View>

        <View style={styles.clubHeader}>
          <Avatar
            name={clubName}
            size="lg"
            square
            uri={clubProfile?.logo_url}
          />
          <View style={styles.clubHeaderText}>
            <AppText variant="titleMd">{clubName}</AppText>
            <AppText color="secondary" variant="bodySm">
              Dashboard società
            </AppText>
            {clubProfile?.description ? (
              <AppText
                color="muted"
                numberOfLines={2}
                style={styles.clubDescription}
                variant="bodySm"
              >
                {clubProfile.description}
              </AppText>
            ) : null}
          </View>
        </View>

        <View style={styles.menu}>
          {MENU_ITEMS.map((item, index) => (
            <ListItem
              key={item.route}
              left={
                <View style={styles.iconCircle}>
                  <Ionicons color={colors.accent} name={item.icon} size={20} />
                </View>
              }
              onPress={() => handleMenuPress(item.route)}
              right={
                <Ionicons
                  color={colors.textMuted}
                  name="chevron-forward"
                  size={20}
                />
              }
              showDivider={index < MENU_ITEMS.length - 1}
              style={styles.menuRow}
              subtitle={item.subtitle}
              title={item.title}
            />
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => handleMenuPress(HIGHLIGHTED_MENU_ITEM.route)}
          style={({ pressed }) => [
            styles.highlightedRow,
            pressed ? styles.pressed : null,
          ]}
        >
          <View style={styles.highlightedIconCircle}>
            <Ionicons
              color={colors.accent}
              name={HIGHLIGHTED_MENU_ITEM.icon}
              size={20}
            />
          </View>
          <View style={styles.highlightedBody}>
            <AppText color="accent" variant="titleSm">
              {HIGHLIGHTED_MENU_ITEM.title}
            </AppText>
            <AppText color="secondary" variant="bodySm">
              {HIGHLIGHTED_MENU_ITEM.subtitle}
            </AppText>
          </View>
          <Ionicons color={colors.accent} name="chevron-forward" size={20} />
        </Pressable>

        <View style={styles.menu}>
          {MENU_ITEMS_AFTER.map((item, index) => (
            <ListItem
              key={item.route}
              left={
                <View style={styles.iconCircle}>
                  <Ionicons color={colors.accent} name={item.icon} size={20} />
                </View>
              }
              onPress={() => handleMenuPress(item.route)}
              right={
                <Ionicons
                  color={colors.textMuted}
                  name="chevron-forward"
                  size={20}
                />
              }
              showDivider={index < MENU_ITEMS_AFTER.length - 1}
              style={styles.menuRow}
              subtitle={item.subtitle}
              title={item.title}
            />
          ))}
          <ListItem
            left={
              <View style={styles.iconCircle}>
                <Ionicons color={colors.accent} name="globe-outline" size={20} />
              </View>
            }
            onPress={() => clubId && handleMenuPress(`/club/${clubId}`)}
            right={
              <Ionicons color={colors.textMuted} name="chevron-forward" size={20} />
            }
            showDivider={false}
            style={styles.menuRow}
            subtitle="Modifica informazioni visibili"
            title="Profilo pubblico"
          />
        </View>
      </KeyboardAwareForm>

      {/* Notifications Modal */}
      <Modal
        animationType="slide"
        onRequestClose={() => setNotificationsOpen(false)}
        visible={isNotificationsOpen}
      >
        <SafeAreaView style={styles.notificationsRoot}>
          <ModalHeader
            onClose={() => setNotificationsOpen(false)}
            title="Notifiche"
          />
          {notifications.length === 0 ? (
            <View style={styles.notificationsEmpty}>
              <EmptyState
                icon="notifications-outline"
                title="Nessuna notifica"
                description="Le notifiche sui membri della tua rosa appariranno qui"
              />
            </View>
          ) : (
            <FlatList
              contentContainerStyle={styles.notificationsList}
              data={notifications}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <ListItem
                  left={
                    <Ionicons
                      color={item.is_read ? colors.textMuted : colors.accent}
                      name={
                        item.is_read ? "notifications-outline" : "notifications"
                      }
                      size={22}
                    />
                  }
                  onPress={() => handleMarkRead(item.id)}
                  right={
                    !item.is_read ? (
                      <Badge label="Nuova" variant="accent" />
                    ) : undefined
                  }
                  subtitle={item.body ?? ""}
                  title={item.title}
                />
              )}
            />
          )}
        </SafeAreaView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bellBadge: {
    alignItems: "center",
    backgroundColor: colors.danger,
    borderRadius: radius.full,
    justifyContent: "center",
    minWidth: 16,
    paddingHorizontal: spacing[4],
    position: "absolute",
    right: -4,
    top: -4,
  },
  bellButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  clubDescription: {
    marginTop: spacing[4],
  },
  clubHeader: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    paddingBottom: spacing[18],
  },
  clubHeaderText: {
    flex: 1,
    gap: spacing[4],
    justifyContent: "center",
  },
  highlightedBody: {
    flex: 1,
    gap: spacing[4],
  },
  highlightedIconCircle: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  highlightedRow: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
    borderRadius: radius[12],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    padding: spacing[12],
  },
  iconCircle: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.full,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  menu: {
    backgroundColor: colors.surface,
    borderRadius: radius[12],
    paddingHorizontal: spacing[12],
  },
  menuRow: {
    paddingHorizontal: 0,
  },
  notificationsEmpty: {
    flex: 1,
    justifyContent: "center",
    padding: spacing[20],
  },
  notificationsList: {
    padding: spacing[12],
  },
  notificationsRoot: {
    backgroundColor: colors.background,
    flex: 1,
  },
  pressed: {
    opacity: 0.82,
  },
  scrollContent: {
    gap: spacing[16],
    paddingBottom: spacing[48],
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
