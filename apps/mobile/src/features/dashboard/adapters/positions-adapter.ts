/**
 * Provider indipendente del modulo "Posizioni aperte" (§16, §26).
 *
 * Vive fuori dal riepilogo perché il master 04 richiede che il suo
 * fallimento resti **locale**: riepilogo, azioni rapide e candidature
 * restano utilizzabili, e il "Riprova" ricarica questo provider e basta.
 *
 * Il **conteggio** delle Posizioni non è qui: arriva dal riepilogo, che è una
 * fonte indipendente. È la ragione per cui lo screen 04 può mostrare "3
 * Posizioni aperte" nel riepilogo mentre la lista è in errore — e per cui,
 * se fallisse anche il riepilogo, quel 3 non comparirebbe.
 */

import { supabase } from "../../../lib/supabase";
import { DashboardTimeoutError } from "../state/error-classification";
import { MODULE_TIMEOUT_MS, withTimeout } from "../state/retry-policy";

export type SocietyPositionPreview = {
  category: string | null;
  id: string;
  role: string;
  teamName: string | null;
};

type PositionRow = {
  category: string | null;
  id: string;
  role: string | null;
  team_name: string | null;
};

export async function fetchSocietyPositions(
  clubId: string,
): Promise<SocietyPositionPreview[]> {
  const { data, error } = await withTimeout(
    supabase.rpc("fetch_dashboard_society_positions", { p_club_id: clubId }),
    MODULE_TIMEOUT_MS,
    () => new DashboardTimeoutError("fetch_dashboard_society_positions"),
  );

  if (error) {
    throw error;
  }

  return ((data ?? []) as PositionRow[]).map((row) => ({
    category: row.category,
    id: row.id,
    role: row.role ?? "",
    teamName: row.team_name,
  }));
}
