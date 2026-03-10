import { Redirect } from "expo-router";

import { useSession } from "../src/features/auth/use-session";

export default function IndexScreen() {
  const { isLoading, needsOnboarding, session } = useSession();

  if (isLoading) {
    return null;
  }

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <Redirect href={needsOnboarding ? "/(onboarding)/profile" : "/(tabs)"} />
  );
}
