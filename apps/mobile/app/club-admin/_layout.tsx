import { Redirect, Stack } from "expo-router";

import { useSession } from "../../src/features/auth/use-session";

export default function ClubAdminLayout() {
  const { isLoading, profile, session } = useSession();

  if (isLoading) {
    return null;
  }

  if (!session || profile?.role !== "club_admin") {
    return <Redirect href="/" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="roster" />
      <Stack.Screen name="invites" />
      <Stack.Screen name="teams" />
      <Stack.Screen name="permissions/index" />
      <Stack.Screen name="permissions/[memberId]" />
    </Stack>
  );
}
