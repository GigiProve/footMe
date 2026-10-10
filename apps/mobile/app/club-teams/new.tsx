import { Redirect, useLocalSearchParams } from "expo-router";

import { TeamFormScreen } from "../../src/features/teams/TeamFormScreen";

export default function NewClubTeamRoute() {
  const { clubId } = useLocalSearchParams<{ clubId?: string }>();

  // §12: un deep link senza parent non è un form vuoto da compilare, è un
  // link non valido. Il backend rivalida comunque Società e capability.
  if (typeof clubId !== "string" || clubId.length === 0) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  return <TeamFormScreen clubId={clubId} mode="create" />;
}
