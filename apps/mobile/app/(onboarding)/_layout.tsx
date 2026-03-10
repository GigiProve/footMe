import { Redirect, Stack } from "expo-router";

import { useSession } from "../../src/features/auth/use-session";

export default function OnboardingLayout() {
  const { isLoading, needsOnboarding, session } = useSession();

  if (isLoading) {
    return null;
  }

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (!needsOnboarding) {
    return <Redirect href="/(tabs)" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
