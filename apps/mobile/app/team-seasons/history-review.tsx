import { Redirect, useLocalSearchParams } from "expo-router";

import { HistoryReviewScreen } from "../../src/features/teams/seasons/HistoryReviewScreen";

/** Rivedi storico: riepilogo e conferma del batch (§22 — screen 06). */
export default function HistoryReviewRoute() {
  const { teamId } = useLocalSearchParams<{ teamId?: string | string[] }>();
  const id = Array.isArray(teamId) ? teamId[0] : teamId;

  if (typeof id !== "string" || id.length === 0) {
    return <Redirect href="/(tabs)/dashboard/seasons" />;
  }

  return <HistoryReviewScreen teamId={id} />;
}
