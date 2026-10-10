import { Redirect, useLocalSearchParams } from "expo-router";

import { SeasonConfigScreen } from "../../src/features/teams/seasons/SeasonConfigScreen";

/**
 * Prepara stagione / Configura stagione (§12, §13 — screen 03).
 *
 * `target` dice **quale** stagione, non quale: il server la risolve dal
 * catalogo (§6). Un valore diverso da current/next non apre una terza
 * modalità, rimbalza al Centro.
 */
export default function SeasonConfigRoute() {
  const params = useLocalSearchParams<{
    target?: string | string[];
    teamId?: string | string[];
  }>();

  const teamId = Array.isArray(params.teamId) ? params.teamId[0] : params.teamId;
  const target = Array.isArray(params.target) ? params.target[0] : params.target;

  if (typeof teamId !== "string" || teamId.length === 0) {
    return <Redirect href="/(tabs)/dashboard/seasons" />;
  }

  if (target !== "current" && target !== "next") {
    return <Redirect href="/(tabs)/dashboard/seasons" />;
  }

  return <SeasonConfigScreen target={target} teamId={teamId} />;
}
