import { Redirect, useLocalSearchParams } from "expo-router";

import { TeamDeactivationScreen } from "../../src/features/teams/seasons/TeamDeactivationScreen";

/** Attività da gestire prima della disattivazione (§26 — screen 07). */
export default function TeamDeactivationRoute() {
  const { teamId } = useLocalSearchParams<{ teamId?: string | string[] }>();
  const id = Array.isArray(teamId) ? teamId[0] : teamId;

  if (typeof id !== "string" || id.length === 0) {
    return <Redirect href="/(tabs)/dashboard/seasons" />;
  }

  return <TeamDeactivationScreen teamId={id} />;
}
