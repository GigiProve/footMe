import { Redirect, useLocalSearchParams } from "expo-router";

import { HistoryPeriodScreen } from "../../src/features/teams/seasons/HistoryPeriodScreen";

/** Aggiungi storico stagioni, in creazione o modifica (§18 — screen 05). */
export default function HistoryPeriodRoute() {
  const { teamId } = useLocalSearchParams<{ teamId?: string | string[] }>();
  const id = Array.isArray(teamId) ? teamId[0] : teamId;

  if (typeof id !== "string" || id.length === 0) {
    return <Redirect href="/(tabs)/dashboard/seasons" />;
  }

  return <HistoryPeriodScreen teamId={id} />;
}
