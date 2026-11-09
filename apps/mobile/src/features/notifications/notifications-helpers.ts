import type { AppNotification } from "../clubs/membership-types";
import { SELECTION_EVENTS_HREFS } from "../dashboard/events/events-routes";
import type { ParticipantsFilter } from "../dashboard/events/participants/participants-types";

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

export function isSelectionEventNotification(item: Pick<AppNotification, "type">): boolean {
  return (
    SELECTION_EVENT_DETAIL_TYPES.includes(item.type) ||
    item.type in SELECTION_EVENT_RESPONSE_FILTERS
  );
}

function dataValue(item: Pick<AppNotification, "data">, key: string): unknown {
  return (item.data as Record<string, unknown> | null | undefined)?.[key];
}

function dataText(item: Pick<AppNotification, "data">, key: string): string | null {
  const value = dataValue(item, key);

  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

/**
 * DAS-REV-31 §25: la destinazione del tap. Null quando manca l'evento: la
 * riga si marca letta e basta, senza aprire un fallback inventato. La
 * destinazione rivalida accesso e stato (§25: «Rivalida sessione,
 * Società/actor context, scope e risorsa al tap»).
 */
export function selectionEventNotificationHref(
  item: Pick<AppNotification, "data" | "type">,
): string | null {
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

/**
 * DAS-REV-31 screen 16: una riga aggregata mostra il titolo (già scritto
 * dal server: «12 profili hanno accettato l’invito a …»), il titolo
 * dell'evento e l'anteprima dei nomi («Mario Rossi, Luca Bianchi e altri
 * 10», che il server mette nel body solo per i gruppi). Null per le altre
 * notifiche.
 */
export function selectionEventResponseLines(
  item: Pick<AppNotification, "body" | "data" | "type">,
): { eventTitle: string | null; names: string | null } | null {
  if (!(item.type in SELECTION_EVENT_RESPONSE_FILTERS)) {
    return null;
  }

  return {
    eventTitle: dataText(item, "event_title"),
    names: item.body?.trim() ? item.body : null,
  };
}

/** DAS-REV-31 §23: l'istante che ordina e data la riga è l'ultimo aggiornamento. */
export function notificationTimestamp(item: Pick<AppNotification, "created_at" | "updated_at">): string {
  return item.updated_at || item.created_at;
}

/**
 * DAS-REV-31 §24: l'ultimo aggiornamento mostrato dal Centro, per
 * «Segna tutte come lette». Null con la lista vuota (nessun limite).
 */
export function latestUpdatedAt(
  items: Pick<AppNotification, "created_at" | "updated_at">[],
): string | null {
  let latest: string | null = null;

  for (const item of items) {
    const at = notificationTimestamp(item);

    if (!latest || Date.parse(at) > Date.parse(latest)) {
      latest = at;
    }
  }

  return latest;
}

export type NotificationCategory =
  | "richieste"
  | "candidature"
  | "attivita"
  | "store"
  | "sistema";

export type NotificationCategoryFilter = NotificationCategory | "tutte";

type NotificationFilterChip = {
  label: string;
  value: NotificationCategoryFilter;
};

export const NOTIFICATION_FILTERS: readonly NotificationFilterChip[] = [
  { label: "Tutte", value: "tutte" },
  { label: "Richieste", value: "richieste" },
  { label: "Candidature", value: "candidature" },
  { label: "Attività", value: "attivita" },
  { label: "Store", value: "store" },
  { label: "Sistema", value: "sistema" },
];

/**
 * Best-effort category resolution: prefer the explicit `category` column,
 * fall back to a type-based guess so older rows without the column still
 * land in a sensible bucket.
 */
export function resolveNotificationCategory(
  item: AppNotification,
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
  if (item.type === "store_order") return "store";

  return "sistema";
}

export function filterNotificationsByCategory(
  notifications: AppNotification[],
  filter: NotificationCategoryFilter,
): AppNotification[] {
  if (filter === "tutte") return notifications;
  return notifications.filter(
    (item) => resolveNotificationCategory(item) === filter,
  );
}

export function filterUnread(notifications: AppNotification[]): AppNotification[] {
  return notifications.filter((item) => !item.is_read);
}

export type TimeBucket = "oggi" | "ieri" | "precedenti";

export function timeBucketFor(isoDate: string, now: Date = new Date()): TimeBucket {
  const date = new Date(isoDate);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  if (date >= startOfToday) return "oggi";
  if (date >= startOfYesterday) return "ieri";
  return "precedenti";
}

const TIME_BUCKET_LABELS: Record<TimeBucket, string> = {
  oggi: "Oggi",
  ieri: "Ieri",
  precedenti: "Precedenti",
};

export type NotificationSection = {
  data: AppNotification[];
  title: string;
};

export function groupNotificationsByTime(
  notifications: AppNotification[],
  now: Date = new Date(),
): NotificationSection[] {
  const buckets: Record<TimeBucket, AppNotification[]> = {
    oggi: [],
    ieri: [],
    precedenti: [],
  };

  notifications.forEach((item) => {
    buckets[timeBucketFor(notificationTimestamp(item), now)].push(item);
  });

  return (["oggi", "ieri", "precedenti"] as TimeBucket[])
    .filter((bucket) => buckets[bucket].length > 0)
    .map((bucket) => ({
      data: buckets[bucket],
      title: TIME_BUCKET_LABELS[bucket],
    }));
}

/**
 * Collapses multiple unread `new_follower` notifications into a single
 * summary row (e.g. "Mario e altri 3"), keeping every other notification
 * unchanged. Pure and order-preserving (uses the most recent item's
 * timestamp/id as the anchor for the collapsed row).
 */
export function groupNotifications(
  notifications: AppNotification[],
): AppNotification[] {
  const followerItems = notifications.filter(
    (item) => item.type === "new_follower" && !item.is_read,
  );

  if (followerItems.length <= 1) {
    return notifications;
  }

  const [mostRecent, ...rest] = followerItems;
  const othersCount = rest.length;
  const firstName =
    mostRecent.data?.follower_name ?? mostRecent.title ?? "Qualcuno";

  const collapsed: AppNotification = {
    ...mostRecent,
    title: `${firstName} e altri ${othersCount}`,
    body: "Hanno iniziato a seguirti.",
  };

  const followerIds = new Set(followerItems.map((item) => item.id));

  const result: AppNotification[] = [];
  let inserted = false;

  notifications.forEach((item) => {
    if (!followerIds.has(item.id)) {
      result.push(item);
      return;
    }
    if (!inserted) {
      result.push(collapsed);
      inserted = true;
    }
  });

  return result;
}

export function ctaLabelFor(item: AppNotification): string {
  const category = resolveNotificationCategory(item);

  if (item.type === "society_invitation_created") return "Vedi invito";
  /*
   * §41: «Le notifiche di richiesta aprono il dettaglio canonico della
   * richiesta, con azioni correnti. Le modifiche già attive aprono il
   * rapporto/incarico gestionale, senza Approva/Rifiuta.» La CTA lo dice.
   */
  if (item.type === "role_request_created") return "Vedi richiesta";
  if (item.type.startsWith("role_request_")) return "Vedi esito";
  if (item.type.startsWith("role_assignment_")) return "Vedi ruolo";
  if (item.type.startsWith("role_link_")) return "Vedi rapporto";
  if (item.type === "new_follower") return "Vedi profilo";
  if (item.type === "content_tag") return "Apri contenuto";
  /* DAS-REV-31 §25: le risposte aprono i Partecipanti, annullamento e
     aggiornamento il dettaglio evento. */
  if (item.type in SELECTION_EVENT_RESPONSE_FILTERS) return "Vedi partecipanti";
  if (item.type === "selection_event_cancelled" || item.type === "selection_event_updated") {
    return "Vedi evento";
  }
  if (category === "richieste") return "Gestisci richiesta";
  if (category === "candidature") return "Vedi candidatura";
  if (category === "store") return "Vedi ordine";

  return "Apri";
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
