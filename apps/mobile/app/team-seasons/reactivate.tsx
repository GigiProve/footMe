import { Redirect, useLocalSearchParams } from "expo-router";

import { TeamReactivateScreen } from "../../src/features/teams/seasons/TeamReactivateScreen";

/** Configura e riattiva (§29 — screen 10, e il caso A dello stesso flusso). */
export default function TeamReactivateRoute() {
  const { teamId } = useLocalSearchParams<{ teamId?: string | string[] }>();
  const id = Array.isArray(teamId) ? teamId[0] : teamId;

  if (typeof id !== "string" || id.length === 0) {
    return <Redirect href="/(tabs)/dashboard/seasons" />;
  }

  return <TeamReactivateScreen teamId={id} />;
}
