import { Redirect, Stack } from "expo-router";

import { useSession } from "../../src/features/auth/use-session";

export default function AdminLayout() {
  const { isLoading, profile, session } = useSession();

  if (isLoading) {
    return null;
  }

  if (!session || !profile?.is_admin) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
