import { Redirect, useLocalSearchParams } from "expo-router";

import { TeamFormScreen } from "../../src/features/teams/TeamFormScreen";

export default function EditClubTeamRoute() {
  const { teamId } = useLocalSearchParams<{ teamId?: string }>();

  if (typeof teamId !== "string" || teamId.length === 0) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  return <TeamFormScreen mode="edit" teamId={teamId} />;
}
