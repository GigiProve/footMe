/**
 * Eventi dell'hub Struttura societaria (§26).
 *
 * «I parametri devono essere minimi: origine, dominio, tipo di scope, stato
 * UI, azione, esito e categoria di errore non sensibile.» Per questo nessuna
 * funzione qui accetta il nome della Società, quello di una squadra o la
 * controparte di una richiesta, e nessun identificativo di persona o di
 * risorsa entra nei parametri.
 *
 * `setAnalyticsSink` non è mai chiamato nel progetto, quindi `trackEvent` è
 * oggi un no-op: gli eventi esistono perché il contratto li richiede e
 * nessuno è stato osservato su un sink reale.
 */
import { trackEvent } from "../../../lib/analytics";

export type StructureEventName =
  | "company_structure_hub_view"
  | "company_structure_teams_open"
  | "company_structure_seasons_open"
  | "company_structure_network_open"
  | "company_structure_admins_open"
  | "company_structure_company_data_open"
  | "company_structure_actionable_open"
  | "company_structure_summary_retry"
  | "company_structure_load_error";

export function trackStructureEvent(
  name: StructureEventName,
  properties: Record<string, string | number | boolean | null> = {},
): void {
  trackEvent(name, properties);
}

/**
 * Evento di apertura della riga, dedotto dall'id della riga stessa (§26).
 *
 * «Non creare due eventi diversi per simulare due centri di collegamento che
 * in realtà sono un unico dominio»: la rete ha un evento solo, qualunque tab
 * il centro scelga di aprire.
 */
const ROW_EVENTS: Record<string, StructureEventName> = {
  admins: "company_structure_admins_open",
  company_edit: "company_structure_company_data_open",
  network: "company_structure_network_open",
  seasons: "company_structure_seasons_open",
  teams: "company_structure_teams_open",
};

export function structureRowEvent(rowId: string): StructureEventName | null {
  return ROW_EVENTS[rowId] ?? null;
}
