import { Redirect } from "expo-router";

import { SplashScreen } from "../src/features/auth/components";
import { useSession } from "../src/features/auth/use-session";

export default function IndexScreen() {
  const { isLoading, needsOnboarding, profile, session } = useSession();

  if (isLoading) {
    return <SplashScreen />;
  }

  if (!session) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (profile?.is_admin) {
    return <Redirect href="/(admin)/dashboard" />;
  }

  if (needsOnboarding) {
    return <Redirect href="/(onboarding)/profile" />;
  }

  return <Redirect href="/(tabs)" />;
}
