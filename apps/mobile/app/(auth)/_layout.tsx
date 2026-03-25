import { Redirect, Stack } from "expo-router";

import { useSession } from "../../src/features/auth/use-session";

export default function AuthLayout() {
  const { isLoading, needsOnboarding, session } = useSession();

  if (isLoading) {
    return null;
  }

  if (session) {
    return (
      <Redirect href={needsOnboarding ? "/(onboarding)/profile" : "/(tabs)"} />
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" options={{ gestureEnabled: false }} />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
