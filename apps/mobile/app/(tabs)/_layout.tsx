import { Redirect, Tabs } from "expo-router";

import { useSession } from "../../src/features/auth/use-session";

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
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="profile" options={{ title: "Profilo" }} />
      <Tabs.Screen name="network" options={{ title: "Rete" }} />
      <Tabs.Screen name="messages" options={{ title: "Messaggi" }} />
      <Tabs.Screen name="announcements" options={{ title: "Annunci" }} />
    </Tabs>
  );
}
