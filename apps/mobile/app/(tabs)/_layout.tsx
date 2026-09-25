import { useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, View, type ColorValue } from "react-native";

import Ionicons from "@expo/vector-icons/Ionicons";
import { Redirect, Tabs, usePathname } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { useSession } from "../../src/features/auth/use-session";
import { fetchCommunications } from "../../src/features/messaging/communications-service";
import { fetchInboxConversations } from "../../src/features/messaging/messaging-service";
import { AppSidebar } from "../../src/ui/sidebar";
import { colors, radius, sizes, spacing, typography, zIndex } from "../../src/theme/tokens";
import { AppText, Icon, type IconName } from "../../src/ui";

export default function TabsLayout() {
  const { isLoading, needsOnboarding, profile, session } = useSession();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const profileId = profile?.id ?? "";

  // La Home ha un header proprio con "PROLINK" in alto a sinistra e integra il
  // menu come primo elemento della barra: il pulsante flottante si
  // sovrapporrebbe esattamente al nome. Sulle altre tab resta com'era.
  const showFloatingMenu = pathname !== "/";

  const conversationsQuery = useQuery({
    enabled: !!profileId,
    queryFn: () => fetchInboxConversations(),
    queryKey: ["inbox-conversations", profileId],
  });

  const communicationsQuery = useQuery({
    enabled: !!profileId,
    queryFn: () => fetchCommunications(),
    queryKey: ["communications", profileId],
  });

  const unreadThreadsCount = profileId
    ? (conversationsQuery.data ?? []).filter((item) => item.unread_count > 0).length +
      (communicationsQuery.data ?? []).filter((item) => !item.is_read).length
    : 0;

  if (isLoading) {
    return null;
  }

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (needsOnboarding) {
    return <Redirect href="/(onboarding)/profile" />;
  }

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            paddingTop: spacing[10],
            paddingBottom: spacing[6],
            height: sizes.tabBarHeight,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={buildTabOptions("Home", "home")}
        />
        <Tabs.Screen
          name="cerca"
          options={buildTabOptions("Cerca", "search")}
        />
        <Tabs.Screen
          name="dashboard"
          options={buildTabOptions("Dashboard", "dashboard")}
        />
        <Tabs.Screen
          name="messages"
          options={{
            ...buildTabOptions("Messaggi", "messages"),
            tabBarBadge: unreadThreadsCount > 0 ? unreadThreadsCount : undefined,
            tabBarBadgeStyle: styles.messagesBadge,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={buildTabOptions("Profilo", "profile")}
        />
        <Tabs.Screen name="network" options={{ href: null }} />
        <Tabs.Screen name="announcements" options={{ href: null }} />
      </Tabs>

      {showFloatingMenu ? (
        <SafeAreaView pointerEvents="box-none" style={styles.menuArea}>
          <Pressable
            accessibilityLabel="Apri menu laterale"
            accessibilityRole="button"
            onPress={() => setSidebarOpen(true)}
            style={({ pressed }) => [
              styles.menuButton,
              pressed ? styles.menuButtonPressed : null,
            ]}
          >
            <Ionicons color={colors.textPrimary} name="menu-outline" size={22} />
          </Pressable>
        </SafeAreaView>
      ) : null}

      <AppSidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
    </View>
  );
}

/**
 * Bottom nav del design (§1b): icona 23px, etichetta 10,5/700 e — solo sulla
 * tab attiva — un indicatore 16×3 sotto l'etichetta. È lo stesso segno usato
 * dalle tab interne (testo + barra), così la navigazione ha un solo linguaggio.
 */
function buildTabOptions(title: string, iconName: IconName) {
  return {
    title,
    tabBarIcon: ({ color, focused }: { color: ColorValue; focused: boolean }) => (
      <Icon active={focused} color={color} name={iconName} size="nav" />
    ),
    tabBarLabel: ({ color, focused }: { color: ColorValue; focused: boolean }) => (
      <View style={styles.tabLabelBlock}>
        <AppText style={[styles.tabLabel, { color }]} variant="navLabel">
          {title}
        </AppText>
        {focused ? <View style={styles.tabIndicator} /> : null}
      </View>
    ),
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  menuArea: {
    left: 0,
    paddingHorizontal: spacing[20],
    paddingTop: spacing[16],
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: zIndex.sticky,
  },
  menuButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: 1,
    height: sizes.touchTarget,
    justifyContent: "center",
    width: sizes.touchTarget,
  },
  menuButtonPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  messagesBadge: {
    backgroundColor: colors.accent,
    fontSize: typography.fontSize[10.5],
    color: colors.inkInvert,
  },
  tabLabelBlock: {
    alignItems: "center",
    gap: spacing[4],
  },
  tabLabel: {
    textAlign: "center",
  },
  tabIndicator: {
    backgroundColor: colors.accent,
    borderRadius: 2,
    height: sizes.navIndicatorHeight,
    width: sizes.navIndicatorWidth,
  },
});
