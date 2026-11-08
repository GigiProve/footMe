/**
 * Destinazioni del dominio eventi di selezione (DAS-REV-28 §23).
 *
 * Una definizione per schermata. Il Centro vive nello Stack della tab
 * Dashboard (bottom navigation visibile, Dashboard selezionata, §4); il
 * wizard è un flusso focalizzato fuori dalle tab, senza bottom navigation.
 *
 * Il dettaglio dell'evento **non esiste** in questo pack: §23 vieta di
 * creare «un dettaglio fittizio come soluzione temporanea» e di rilasciare
 * chevron verso 404. Non c'è quindi una funzione `detail` qui; quando la
 * 29–31 lo costruirà, si aggiunge accanto a queste e le righe del Centro si
 * collegano allo stesso ID.
 */

export type SelectionEventsOrigin = "dashboard";

export const SELECTION_EVENTS_HREFS = {
  center: (options: { from?: SelectionEventsOrigin } = {}) =>
    options.from
      ? `/(tabs)/dashboard/events?from=${options.from}`
      : "/(tabs)/dashboard/events",
  /** Nuovo evento: nessun record finché l'utente non salva (§13, QA-031). */
  create: () => "/event-compose",
  /** Riapertura della stessa bozza, con lo stesso ID (§13, §23). */
  draft: (eventId: string) =>
    `/event-compose?eventId=${encodeURIComponent(eventId)}`,
} as const;
