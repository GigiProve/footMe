import { Redirect, useLocalSearchParams } from "expo-router";

import { TeamDetailScreen } from "../../../../src/features/teams/detail/TeamDetailScreen";

/**
 * Dettaglio operativo Squadra (DAS-REV-09 §6).
 *
 * Figlio dello Stack della tab Dashboard: la bottom navigation resta
 * visibile **con Dashboard selezionata** in tutti e sei gli stati. I form
 * aperti da qui vivono invece fuori dalle tab, in `app/club-teams/`, con la
 * loro shell focalizzata.
 *
 * La route è indirizzata dal **Team ID stabile** (§7): mai dal nome
 * visualizzato.
 */
export default function TeamDetailRoute() {
  const { teamId } = useLocalSearchParams<{ teamId?: string | string[] }>();
  const id = Array.isArray(teamId) ? teamId[0] : teamId;

  if (typeof id !== "string" || id.length === 0) {
    return <Redirect href="/(tabs)/dashboard/teams" />;
  }

  return <TeamDetailScreen teamId={id} />;
}
