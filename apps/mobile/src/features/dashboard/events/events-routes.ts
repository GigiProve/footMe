/**
 * Destinazioni del dominio eventi di selezione (DAS-REV-28 §23).
 *
 * Una definizione per schermata. Il Centro vive nello Stack della tab
 * Dashboard (bottom navigation visibile, Dashboard selezionata, §4); il
 * wizard è un flusso focalizzato fuori dalle tab, senza bottom navigation.
 *
 * DAS-REV-29 aggiunge il dettaglio canonico, la richiesta singola, la
 * modifica dell'evento pubblicato e il percorso del link pubblico: le righe
 * del Centro, le notifiche e il link aprono lo stesso ID (§7).
 *
 * DAS-REV-31 §25: le notifiche aprono il dettaglio con il banner
 * «Informazioni aggiornate» e il centro Partecipanti su uno qualunque dei
 * sette filtri della 30.
 */
import type { ParticipantsFilter } from "./participants/participants-types";

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
  /**
   * DAS-REV-29 §7: il dettaglio canonico. Una sola route per Centro,
   * notifica, link e future liste partecipanti; vive nello Stack della tab
   * Dashboard, con Dashboard selezionata (screen 01, 08, 11-15).
   */
  detail: (eventId: string, options: { updated?: boolean } = {}) =>
    options.updated
      ? `/(tabs)/dashboard/events/${encodeURIComponent(eventId)}?updated=1`
      : `/(tabs)/dashboard/events/${encodeURIComponent(eventId)}`,
  /**
   * DAS-REV-29 §8, screen 02: modifica di un evento pubblicato nello stesso
   * wizard a tre passaggi della 28, aperto sul passaggio indicato.
   */
  edit: (eventId: string, step: 1 | 2 | 3 = 2) =>
    `/event-compose?eventId=${encodeURIComponent(eventId)}&mode=edit&step=${step}`,
  /** DAS-REV-29 §17: la richiesta singola, riusabile dalla 30. */
  request: (participationId: string) =>
    `/(tabs)/dashboard/events/request/${encodeURIComponent(participationId)}`,
  /**
   * DAS-REV-29 §12: il percorso del link pubblico dentro l'app. Lo stesso
   * percorso dell'URL HTTPS, così Universal/App Links e schema `footme://`
   * arrivano qui senza traduzioni.
   */
  link: (publicId: string) => `/event/${encodeURIComponent(publicId)}`,
  /**
   * DAS-REV-30 §21: il centro Partecipanti, con il filtro preimpostato dalle
   * tre righe del dettaglio. Stack della tab Dashboard.
   */
  /**
   * DAS-REV-31 §25: `asSociety` arriva dalle notifiche della Società. La
   * destinazione passa a quell'identità solo se l'actor la possiede già;
   * non ne sceglie mai una non autorizzata.
   */
  participants: (
    eventId: string,
    filter: ParticipantsFilter = "confirmed",
    options: { asSociety?: string | null } = {},
  ) =>
    `/(tabs)/dashboard/events/participants/${encodeURIComponent(eventId)}?filter=${filter}` +
    (options.asSociety ? `&asSociety=${encodeURIComponent(options.asSociety)}` : ""),
  /** DAS-REV-30 §13: Invita profili dal dettaglio (flusso focalizzato). */
  invite: (eventId: string) => `/event-invite?eventId=${encodeURIComponent(eventId)}`,
  /** DAS-REV-30 §17: Invita a evento dal profilo (scelta evento, poi conferma). */
  inviteFromProfile: (personId: string) =>
    `/event-invite?personId=${encodeURIComponent(personId)}`,
} as const;
