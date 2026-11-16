/**
 * HOM-14 — derivazioni pure del Centro Notifiche (§23–§24, §34–§66, §98–§102,
 * §145, §248–§255). Niente rendering: tutto ciò che si può testare senza
 * montare una schermata sta qui.
 *
 *  • sezioni temporali Oggi / Questa settimana / Precedenti su `displayAt` (§23, §145);
 *  • copy per tipo con attore, aggregato («Marco Bianchi e altre 12 persone…»,
 *    §40, §63, §130) e disambiguazione dell'identità gestita («…il post di AC
 *    Como», §98), con fallback per l'attore non disponibile (§266);
 *  • etichetta di accessibilità: attore, azione, contesto, tempo e «non aperta»
 *    (§248–§249): l'azzurrino non è l'unico segnale.
 *
 * Copy in italiano V1 ma in una sola tabella di frasi, pronta alla
 * localizzazione (§255). Il target di navigazione NON si deduce mai da qui
 * (§147): è del resolver.
 */

import { formatSpokenRelativeTime } from "../../lib/relative-time";
import type { InboxNotification, NotificationPage } from "./notification-types";

/* ------------------------------ sezioni (§23) ------------------------------ */

export type NotificationSectionKey = "today" | "week" | "earlier";

const SECTION_TITLES: Record<NotificationSectionKey, string> = {
  earlier: "Precedenti",
  today: "Oggi",
  week: "Questa settimana",
};

const SECTION_ORDER: readonly NotificationSectionKey[] = ["today", "week", "earlier"];

export type NotificationSection = {
  data: InboxNotification[];
  key: NotificationSectionKey;
  title: string;
};

/**
 * §145: la data visuale è `displayAt` (l'ultimo aggiornamento per gli aggregati).
 * «Questa settimana» = gli ultimi sette giorni di calendario, oggi compreso;
 * una data nel futuro (orologio del device indietro) resta in «Oggi».
 */
export function notificationSectionKey(displayAt: string, now: Date = new Date()): NotificationSectionKey {
  const date = new Date(displayAt);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 6);

  if (Number.isNaN(date.getTime()) || date >= startOfToday) return "today";
  if (date >= startOfWeek) return "week";
  return "earlier";
}

/** Le sezioni non vuote, nell'ordine temporale. L'ordine delle righe è quello del server (§143). */
export function groupNotificationsByTime(
  items: readonly InboxNotification[],
  now: Date = new Date(),
): NotificationSection[] {
  const buckets: Record<NotificationSectionKey, InboxNotification[]> = {
    earlier: [],
    today: [],
    week: [],
  };

  for (const item of items) {
    buckets[notificationSectionKey(item.displayAt, now)].push(item);
  }

  return SECTION_ORDER.filter((key) => buckets[key].length > 0).map((key) => ({
    data: buckets[key],
    key,
    title: SECTION_TITLES[key],
  }));
}

/**
 * §222–§223, §329: le pagine in una lista senza duplicati. Un aggregato che sale
 * in cima mentre si scorre può comparire in due pagine: vale la prima occorrenza,
 * che è la più recente.
 */
export function flattenNotificationPages(pages: readonly NotificationPage[]): InboxNotification[] {
  const seen = new Set<string>();
  const items: InboxNotification[] = [];

  for (const page of pages) {
    for (const item of page.items) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        items.push(item);
      }
    }
  }

  return items;
}

/* ------------------------------ copy (§34–§66) ------------------------------ */

/** I tipi con attore, il cui copy compone il client (§244). Gli altri portano il testo del server. */
const SOCIAL_TYPES: readonly string[] = [
  "new_follower",
  "content_liked",
  "content_commented",
  "comment_replied",
  "identity_mentioned",
  "simple_reposted",
  "post_reposted_with_text",
];

const SCHEDULED_TYPES: readonly string[] = ["scheduled_content_published", "scheduled_content_failed"];

/** Tabella unica delle frasi (§255: pronta alla localizzazione). */
const PHRASES = {
  actorFallback: "Un utente",
  othersMany: (count: number) => `e altre ${count} persone`,
  othersOne: "e un'altra persona",
  scheduledFailed: "Non è stato possibile pubblicare un contenuto programmato",
  scheduledFailedFor: (name: string) => `Non è stato possibile pubblicare un contenuto programmato di ${name}`,
  scheduledPublished: "Il contenuto programmato è stato pubblicato",
  scheduledPublishedFor: (name: string) => `Il contenuto programmato di ${name} è stato pubblicato`,
} as const;

/** Il nome dell'attore, o il ripiego neutro quando l'identità non è più disponibile (§266). */
export function notificationActorName(item: Pick<InboxNotification, "actor">): string {
  const name = item.actor?.available ? item.actor.name?.trim() : null;

  return name ? name : PHRASES.actorFallback;
}

/** «e altre 12 persone» quando la riga aggrega più attori; null per un'azione singola. */
export function notificationActorSuffix(item: Pick<InboxNotification, "eventCount">): string | null {
  if (item.eventCount <= 1) return null;
  if (item.eventCount === 2) return PHRASES.othersOne;
  return PHRASES.othersMany(item.eventCount - 1);
}

/** Vero per i tipi che mostrano l'attore (avatar, nome, check) invece del titolo del server. */
export function isSocialNotification(item: Pick<InboxNotification, "actor" | "type">): boolean {
  return item.actor !== null && SOCIAL_TYPES.includes(item.type);
}

/** Il nome dell'identità destinataria solo se gestita: è ciò che toglie l'ambiguità (§98, §102). */
function managedRecipientName(item: Pick<InboxNotification, "recipient">): string | null {
  const recipient = item.recipient;

  return recipient?.managed ? recipient.name?.trim() || null : null;
}

/** «post» per il Post della persona; «contenuto» per gli altri tipi, il cui genere il target non dice. */
function contentNoun(item: Pick<InboxNotification, "target">): string {
  return item.target?.params.content_type === "profile_post" ? "post" : "contenuto";
}

/**
 * Il complemento di proprietà: «il tuo post» per la persona dell'account, «il
 * post di AC Como» per un'identità gestita (§98). Con `to` l'articolo si
 * contrae («al tuo post», «al post di AC Como»).
 */
function ownedBy(item: Pick<InboxNotification, "recipient">, noun: string, to = false): string {
  const article = to ? "al" : "il";
  const managedName = managedRecipientName(item);

  return managedName ? `${article} ${noun} di ${managedName}` : `${article} tuo ${noun}`;
}

/**
 * La frase dopo il nome dell'attore (§34–§66), concordata al plurale quando la
 * riga aggrega più persone. Null per i tipi senza copy composto dal client.
 */
export function notificationAction(item: InboxNotification): string | null {
  if (!isSocialNotification(item)) return null;

  const plural = item.eventCount > 1;
  const managedName = managedRecipientName(item);

  switch (item.type) {
    case "new_follower": {
      // §34, §99: «ha iniziato a seguirti» / «ha iniziato a seguire AC Como».
      const began = plural ? "hanno iniziato a" : "ha iniziato a";

      return managedName ? `${began} seguire ${managedName}` : `${began} seguirti`;
    }

    case "content_liked":
      // §39–§40: «ha messo Mi piace al tuo post».
      return `${plural ? "hanno messo" : "ha messo"} Mi piace ${ownedBy(item, contentNoun(item), true)}`;

    case "content_commented":
      // §46, §98: «ha commentato il tuo post» / «…il post di AC Como».
      return `${plural ? "hanno commentato" : "ha commentato"} ${ownedBy(item, contentNoun(item))}`;

    case "comment_replied":
      // §50: «ha risposto al tuo commento».
      return `${plural ? "hanno risposto" : "ha risposto"} ${ownedBy(item, "commento", true)}`;

    case "identity_mentioned": {
      // §56: «ti ha menzionato in un commento»; identità gestita: «ha menzionato AC Como in un commento».
      const where = item.target?.type === "comment" ? "in un commento" : `in un ${contentNoun(item)}`;
      const verb = plural ? "hanno menzionato" : "ha menzionato";

      return managedName ? `${verb} ${managedName} ${where}` : `ti ${verb} ${where}`;
    }

    case "simple_reposted":
      // §61, §63: «ha ripostato il tuo post».
      return `${plural ? "hanno ripostato" : "ha ripostato"} ${ownedBy(item, contentNoun(item))}`;

    case "post_reposted_with_text":
      // §66: «…aggiungendo un testo». Il target è il nuovo post, non l'originale (§67).
      return `${plural ? "hanno ripostato" : "ha ripostato"} ${ownedBy(item, "post")} aggiungendo un testo`;

    default:
      return null;
  }
}

/** Frase di un esito di pubblicazione programmata (§86, §88), con il contesto se la Società è gestita. */
function scheduledPhrase(item: InboxNotification): string {
  const managedName = managedRecipientName(item);
  const published = item.type === "scheduled_content_published";

  if (managedName) {
    return published ? PHRASES.scheduledPublishedFor(managedName) : PHRASES.scheduledFailedFor(managedName);
  }

  return published ? PHRASES.scheduledPublished : PHRASES.scheduledFailed;
}

/**
 * La riga principale: il nome dell'attore per i tipi sociali; la frase degli
 * esiti programmati (che non hanno attore); altrimenti il titolo scritto dal
 * server per i tipi operativi.
 */
export function notificationPrimaryText(item: InboxNotification): string {
  if (isSocialNotification(item)) return notificationActorName(item);
  if (SCHEDULED_TYPES.includes(item.type)) return scheduledPhrase(item);
  return item.title;
}

/**
 * Il testo sotto la riga principale: «e altre 12 persone hanno messo Mi piace al
 * tuo post» per i sociali; il corpo scritto dal server per gli altri.
 */
export function notificationSecondaryText(item: InboxNotification): string | null {
  const action = notificationAction(item);

  if (action === null) {
    return item.body?.trim() ? item.body : null;
  }

  const suffix = notificationActorSuffix(item);

  return suffix ? `${suffix} ${action}` : action;
}

/** §262: l'anteprima è già minimizzata dal server; qui solo il controllo del vuoto. */
export function notificationPreview(item: Pick<InboxNotification, "preview">): string | null {
  const preview = item.preview?.trim();

  return preview ? preview : null;
}

/* --------------------------- accessibilità (§248–§249) --------------------------- */

export const NOTIFICATION_UNOPENED_LABEL = "Non aperta";

/**
 * Attore, azione, contesto, tempo e stato (§248). Lo stato non aperta è detto a
 * parole: l'azzurrino non è l'unico segnale (§249).
 */
export function notificationAccessibilityLabel(item: InboxNotification, now: Date = new Date()): string {
  const preview = notificationPreview(item);
  // Riga sociale: «Marco Bianchi» + «ha commentato…» è una sola frase. Riga operativa o
  // programmata: titolo e corpo sono due frasi, e lo screen reader deve fare la pausa.
  const lineSeparator = isSocialNotification(item) ? " " : ". ";
  const parts = [
    [notificationPrimaryText(item), notificationSecondaryText(item)].filter(Boolean).join(lineSeparator),
    preview ? `Anteprima: ${preview}` : null,
    formatSpokenRelativeTime(item.displayAt, now) || null,
    item.isOpened ? null : NOTIFICATION_UNOPENED_LABEL,
  ];

  return parts.filter(Boolean).join(". ");
}
