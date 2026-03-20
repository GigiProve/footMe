import { Redirect } from "expo-router";

import { useSession } from "../src/features/auth/use-session";

export default function IndexScreen() {
  const { isLoading, needsOnboarding, profile, session } = useSession();

  if (isLoading) {
    return null;
  }

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (profile?.is_admin) {
    return <Redirect href="/(admin)/dashboard" />;
  }

  if (needsOnboarding) {
    return <Redirect href="/(onboarding)/profile" />;
  }

  return <Redirect href="/(tabs)" />;
}
