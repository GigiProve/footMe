import { Redirect, useLocalSearchParams } from "expo-router";

import { SeasonHistoryEditScreen } from "../../src/features/teams/seasons/SeasonHistoryEditScreen";

/** Dettaglio e correzione di una stagione conclusa (§16 — screen 04). */
export default function SeasonHistoryRoute() {
  const { teamSeasonId } = useLocalSearchParams<{
    teamSeasonId?: string | string[];
  }>();

  const id = Array.isArray(teamSeasonId) ? teamSeasonId[0] : teamSeasonId;

  if (typeof id !== "string" || id.length === 0) {
    return <Redirect href="/(tabs)/dashboard/seasons" />;
  }

  return <SeasonHistoryEditScreen teamSeasonId={id} />;
}
