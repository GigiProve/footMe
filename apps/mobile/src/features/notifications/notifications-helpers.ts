import { SELECTION_EVENTS_HREFS } from "../dashboard/events/events-routes";
import type { ParticipantsFilter } from "../dashboard/events/participants/participants-types";
import { contentDetailHref } from "../feed/content-routes";
import type { FeedContentType } from "../feed/feed-types";
import { draftsHref } from "../publishing/publishing-routes";

/**
 * HOM-14 §14: dopo la timeline unica restano qui solo le regole dei tipi
 * operativi (eventi di selezione, contenuti programmati) e l'icona di ripiego
 * per le righe senza attore. Filtri, «solo non lette», «Ieri» e il
 * raggruppamento client dei follower non esistono più: il raggruppamento è del
 * backend (§128–§130), le sezioni temporali di `notification-presentation`.
 */

/** Quel che serve a classificare una riga: tipo e payload storico. */
type NotificationLike = {
  data?: Record<string, unknown> | null;
  type: string;
};

/**
 * HOM-06.2 §199–§202: gli esiti di un contenuto programmato arrivano nel Centro
 * Notifiche, mai nei Messaggi. Il copy lo compone `notification-presentation`;
 * qui solo la destinazione dei payload storici.
 */
export const SCHEDULED_CONTENT_FAILED = "scheduled_content_failed";
export const SCHEDULED_CONTENT_PUBLISHED = "scheduled_content_published";

export function isScheduledContentNotification(item: Pick<NotificationLike, "type">): boolean {
  return item.type === SCHEDULED_CONTENT_FAILED || item.type === SCHEDULED_CONTENT_PUBLISHED;
}

/**
 * §200–§201: il fallimento apre «Bozze e programmati» sulla tab Programmati, dove
 * l'elemento fallito ha Riprova · Modifica · Sposta nelle bozze (§195); la
 * pubblicazione riuscita apre il contenuto. Null quando manca l'id: la riga si
 * apre e basta, senza una destinazione inventata. La destinazione rivalida
 * accesso e stato (§259).
 */
export function scheduledContentNotificationHref(item: NotificationLike): string | null {
  if (item.type === SCHEDULED_CONTENT_FAILED) {
    return draftsHref("scheduled");
  }

  if (item.type !== SCHEDULED_CONTENT_PUBLISHED) {
    return null;
  }

  const contentType = dataText(item, "content_type");
  const contentId = dataText(item, "content_id");

  // HOM-15 §57: il dettaglio sa di essere stato aperto da una notifica.
  return contentType && contentId
    ? contentDetailHref(contentType as FeedContentType, contentId, { origin: "NOTIFICATION" })
    : null;
}

/**
 * DAS-REV-31 §21, §25: risposte della persona che la Società riceve
 * aggregate, ciascuna con il filtro del centro Partecipanti che apre.
 * «Il filtro mostra lo stato attuale della lista, non una lista artificiale
 * delle sole persone del gruppo.»
 */
export const SELECTION_EVENT_RESPONSE_FILTERS: Readonly<Record<string, ParticipantsFilter>> = {
  selection_event_invitation_accepted: "confirmed",
  selection_event_invitation_declined: "declined",
  selection_event_participation_withdrawn: "withdrawn",
};

/** Tipi che aprono il dettaglio evento corrente (29, 30, 31). */
const SELECTION_EVENT_DETAIL_TYPES: readonly string[] = [
  "selection_event_participation_confirmed",
  "selection_event_participation_rejected",
  "selection_event_invitation_received",
  "selection_event_invitation_revoked",
  "selection_event_participation_removed",
  /* DAS-REV-31 §25: annullato → dettaglio corrente CANCELLED. */
  "selection_event_cancelled",
  /* DAS-REV-31 §20: aggiornato → dettaglio attuale con il banner. */
  "selection_event_updated",
];

export function isSelectionEventNotification(item: Pick<NotificationLike, "type">): boolean {
  return (
    SELECTION_EVENT_DETAIL_TYPES.includes(item.type) ||
    item.type in SELECTION_EVENT_RESPONSE_FILTERS
  );
}

function dataText(item: Pick<NotificationLike, "data">, key: string): string | null {
  const value = item.data?.[key];

  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

/**
 * DAS-REV-31 §25: la destinazione del tap. Null quando manca l'evento: la
 * riga si apre e basta, senza aprire un fallback inventato. La
 * destinazione rivalida accesso e stato (§25: «Rivalida sessione,
 * Società/actor context, scope e risorsa al tap»).
 */
export function selectionEventNotificationHref(item: NotificationLike): string | null {
  const eventId = dataText(item, "event_id");

  if (!eventId) {
    return null;
  }

  const filter = SELECTION_EVENT_RESPONSE_FILTERS[item.type];

  if (filter) {
    return SELECTION_EVENTS_HREFS.participants(eventId, filter, { asSociety: dataText(item, "club_id") });
  }

  if (item.type === "selection_event_updated") {
    return SELECTION_EVENTS_HREFS.detail(eventId, { updated: true });
  }

  return SELECTION_EVENT_DETAIL_TYPES.includes(item.type) ? SELECTION_EVENTS_HREFS.detail(eventId) : null;
}

export type NotificationCategory =
  | "richieste"
  | "candidature"
  | "attivita"
  | "store"
  | "sistema";

/**
 * Best-effort category resolution: prefer the explicit `category` column,
 * fall back to a type-based guess so older rows without the column still
 * land in a sensible bucket. Serve solo all'icona di ripiego delle righe senza
 * attore: la timeline è unica, la categoria non filtra più nulla (§21).
 */
export function resolveNotificationCategory(
  item: NotificationLike & { category?: string | null },
): NotificationCategory {
  if (item.category) {
    return item.category as NotificationCategory;
  }

  if (item.type === "new_follower") return "attivita";
  if (
    item.type === "agent_representation_request" ||
    item.type === "agent_representation_responded" ||
    item.type === "agent_representation_visibility_proposed" ||
    item.type === "agent_representation_removed" ||
    item.type === "agent_invite_reconciled" ||
    item.type === "society_invitation_created" ||
    /* DAS-REV-21 §41: gli eventi del rapporto sportivo stanno in Richieste.
       «Il badge Messaggi non aumenta per questi eventi.» */
    item.type.startsWith("role_request_") ||
    item.type.startsWith("role_assignment_") ||
    item.type.startsWith("role_link_")
  ) {
    return "richieste";
  }
  if (
    item.type === "application_received" ||
    item.type === "application_status" ||
    /* DAS-REV-29 §22: stessa scala del trigger notifications_before_insert. */
    item.type === "selection_event_participation_confirmed" ||
    item.type === "selection_event_participation_rejected" ||
    /* DAS-REV-30: stessa scala del trigger per invito, revoca e rimozione. */
    item.type === "selection_event_invitation_received" ||
    item.type === "selection_event_invitation_revoked" ||
    item.type === "selection_event_participation_removed" ||
    /* DAS-REV-31 §21: annullamento, aggiornamento e risposte aggregate. */
    isSelectionEventNotification(item)
  ) {
    return "candidature";
  }
  if (item.type === "content_tag") return "attivita";
  // HOM-06.2: i due esiti dei programmati sono di sistema (nessun toggle di preferenza): è il ripiego.
  if (item.type === "store_order") return "store";

  return "sistema";
}

export function iconNameForCategory(
  category: NotificationCategory,
): string {
  if (category === "richieste") return "person-add-outline";
  if (category === "candidature") return "briefcase-outline";
  if (category === "attivita") return "pricetag-outline";
  if (category === "store") return "bag-outline";
  return "shield-checkmark-outline";
}

/**
 * HOM-14 §90, §210: il fallimento di un programmato è HIGH e non deve confondersi con
 * il successo; i due esiti hanno icone proprie, gli altri tipi restano sull'icona di categoria.
 */
export function iconNameForNotificationType(type: string, category: NotificationCategory): string {
  if (type === "scheduled_content_failed") return "alert-circle-outline";
  if (type === "scheduled_content_published") return "calendar-outline";
  return iconNameForCategory(category);
}
