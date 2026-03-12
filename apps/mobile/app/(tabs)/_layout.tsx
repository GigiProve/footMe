import { useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, View } from "react-native";

import Ionicons from "@expo/vector-icons/Ionicons";
import { Redirect, Tabs } from "expo-router";

import { useSession } from "../../src/features/auth/use-session";
import { AppSidebar } from "../../src/ui/sidebar";
import { colors, radius, shadows, sizes, spacing, typography, zIndex } from "../../src/theme/tokens";
import { Icon, type IconName } from "../../src/ui";

export default function TabsLayout() {
  const { isLoading, needsOnboarding, session } = useSession();
  const [isSidebarOpen, setSidebarOpen] = useState(false);

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
          tabBarLabelStyle: {
            fontSize: typography.fontSize[12],
            fontWeight: typography.fontWeight.bold,
            marginBottom: spacing[4],
          },
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            paddingTop: spacing[8],
            paddingBottom: spacing[8],
            height: sizes.tabBarHeight,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={buildTabOptions("Home", "home")}
        />
        <Tabs.Screen
          name="profile"
          options={buildTabOptions("Profilo", "profile")}
        />
        <Tabs.Screen
          name="network"
          options={buildTabOptions("Rete", "network")}
        />
        <Tabs.Screen
          name="messages"
          options={buildTabOptions("Messaggi", "messages")}
        />
        <Tabs.Screen
          name="announcements"
          options={buildTabOptions("Annunci", "announcements")}
        />
      </Tabs>

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

      <AppSidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
    </View>
  );
}

function buildTabOptions(title: string, iconName: IconName) {
  return {
    title,
    tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => (
      <Icon active={focused} color={color} name={iconName} size="lg" />
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
    ...shadows.card,
  },
  menuButtonPressed: {
    backgroundColor: colors.surfaceMuted,
  },
});
