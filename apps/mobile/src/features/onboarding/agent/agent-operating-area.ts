/**
 * Aree operative del Procuratore (REV-ONB-06 §AA–§AE).
 *
 * Riusa integralmente la logica geografica del Calciatore: tre modalità
 * mutuamente esclusive, nessuna variante Procuratore. L'unica differenza è
 * che qui la modalità parte non scelta — il Calciatore la eredita dal toggle
 * di disponibilità, il Procuratore la deve selezionare (§BN).
 */
import type { AvailabilityType } from "../onboarding-form";
import {
  getAvailabilityErrorMessage,
  isAvailabilityComplete,
  resolveActiveAvailability,
  type GeographicAvailabilityDraft,
} from "../player/geographic-availability";

export type AgentOperatingAreaDraft = {
  mode: AvailabilityType | "";
  provinces: string[];
  regions: string[];
};

/** Selezioni attive per la modalità corrente: mai due zone che si contraddicono. */
export function resolveAgentOperatingArea(draft: AgentOperatingAreaDraft) {
  if (!draft.mode) {
    return { provinces: [], regions: [] };
  }

  return resolveActiveAvailability(draft as GeographicAvailabilityDraft);
}

/** La modalità è scelta e il suo dettaglio è completo. */
export function isAgentOperatingAreaComplete(draft: AgentOperatingAreaDraft) {
  if (!draft.mode) {
    return false;
  }

  return isAvailabilityComplete(draft as GeographicAvailabilityDraft);
}

/** Errore contestuale: prima la modalità mancante, poi il dettaglio mancante. */
export function getAgentOperatingAreaError(draft: AgentOperatingAreaDraft) {
  if (!draft.mode) {
    return "Seleziona almeno un'area operativa.";
  }

  return getAvailabilityErrorMessage(draft as GeographicAvailabilityDraft);
}
