import { Redirect, useLocalSearchParams } from "expo-router";

import { TeamSeasonsScreen } from "../../../../src/features/teams/seasons/TeamSeasonsScreen";

/**
 * Stagioni della squadra (§11, screen 02).
 *
 * Indirizzata dal **Team ID stabile** (§5): mai dal nome visualizzato, mai
 * da un identificativo della stagione.
 */
export default function TeamSeasonsRoute() {
  const { teamId } = useLocalSearchParams<{ teamId?: string | string[] }>();
  const id = Array.isArray(teamId) ? teamId[0] : teamId;

  if (typeof id !== "string" || id.length === 0) {
    return <Redirect href="/(tabs)/dashboard/seasons" />;
  }

  return <TeamSeasonsScreen teamId={id} />;
}
