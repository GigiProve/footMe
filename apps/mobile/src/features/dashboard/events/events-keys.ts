/**
 * Query key degli eventi di selezione (DAS-REV-28 §22).
 *
 * «Scope cache: account/actor, società, revisione accesso, sezione/cursore
 * e evento quando pertinente. Nessuna cache indistinta fra amministratori
 * Prima squadra e Primavera o fra account diversi.»
 *
 * L'actor entra in ogni chiave: due amministratori della stessa Società con
 * perimetri diversi non condividono mai una lista. Il cursore non è nella
 * chiave perché le pagine di una sezione stanno nella stessa infinite query;
 * il server rifiuta un cursore di un altro actor o perimetro (§12).
 */
import type { EventSection } from "./events-types";

export const SELECTION_EVENTS_QK = {
  center: (actorId: string, clubId: string) =>
    ["selection-events-center", actorId, clubId] as const,
  section: (actorId: string, clubId: string, section: EventSection) =>
    ["selection-events-section", actorId, clubId, section] as const,
  teams: (actorId: string, clubId: string) =>
    ["selection-events-teams", actorId, clubId] as const,
  editor: (actorId: string, eventId: string) =>
    ["selection-event-editor", actorId, eventId] as const,
} as const;

/**
 * Prefissi da invalidare dopo un comando confermato (§22: «Salva bozza
 * aggiorna Bozze; publish sposta lo stesso record in In programma»).
 * Elencati, non dedotti: un rename non deve rompere l'invalidazione in
 * silenzio.
 */
export const SELECTION_EVENTS_QK_PREFIXES = [
  "selection-events-center",
  "selection-events-section",
  "selection-events-teams",
  "selection-event-editor",
] as const;
