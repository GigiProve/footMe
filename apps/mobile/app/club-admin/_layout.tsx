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
      {/* `invites` è stata rimossa: il Centro Inviti e richieste canonico di
          DAS-REV-19 vive in `app/(tabs)/dashboard/invites/`, gated sulle
          capability invece che sul ruolo `club_admin`. */}
      <Stack.Screen name="teams" />
      <Stack.Screen name="affiliates" />
      <Stack.Screen name="permissions/index" />
      <Stack.Screen name="permissions/[memberId]" />
    </Stack>
  );
}
