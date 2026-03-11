import { Redirect, Tabs } from "expo-router";

import { useSession } from "../../src/features/auth/use-session";
import { Icon, type IconName } from "../../src/ui";
import { colors, sizes, spacing, typography } from "../../src/theme/tokens";

export default function TabsLayout() {
  const { isLoading, needsOnboarding, session } = useSession();

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
  );
}

function buildTabOptions(title: string, iconName: IconName) {
  return {
    title,
    tabBarIcon: ({ color }: { color: string }) => (
      <Icon color={color} name={iconName} size="lg" />
    ),
  };
}
