import type {
  CommunicationCategory,
  CommunicationSummary,
} from "./communications-service";
import { formatSystemEvent, GROUP_CHAT_COPY } from "./group-chat-presentation";
import { sharedMessagePreview } from "../share/share-presentation";
import type { InboxConversation } from "./messaging-service";

export type ChatFilter = "all" | "direct" | "group" | "unread";
export type CommunicationFilter = "all" | CommunicationCategory | "unread";

/**
 * DAS-REV-34 §13: un gruppo globalmente ARCHIVED resta nelle liste Tutti/Gruppi
 * (storico consultabile) ma non contribuisce al filtro Non letti né al badge.
 */
export function isArchivedGroup(conversation: InboxConversation): boolean {
  return conversation.conversation_type === "group" && conversation.group_status === "archived";
}

/**
 * Non letti che contano per l'attenzione (DAS-REV-34 §10, §13). Il server manda
 * già 0 per un GROUP archiviato; la regola vale anche qui, perché un payload
 * precedente non deve far comparire un counter su una chat sola lettura. Un mute
 * non cambia il numero: la riga silenziata mostra il conteggio reale (QA-026).
 */
export function inboxUnreadCount(conversation: InboxConversation): number {
  return isArchivedGroup(conversation) ? 0 : conversation.unread_count;
}

export function filterConversations(
  list: InboxConversation[],
  filter: ChatFilter,
): InboxConversation[] {
  switch (filter) {
    case "direct":
      return list.filter((item) => item.conversation_type === "direct");
    case "group":
      return list.filter((item) => item.conversation_type === "group");
    case "unread":
      return list.filter((item) => inboxUnreadCount(item) > 0);
    case "all":
    default:
      return list;
  }
}

/** Empty del filtro: «Nessun messaggio da leggere» in Non letti (§25), altrimenti il testo di sempre. */
export function emptyConversationsLabel(filter: ChatFilter): string {
  return filter === "unread" ? "Nessun messaggio da leggere" : "Nessuna conversazione trovata";
}

/** Label della tab Messaggi (§29): il badge conta conversazioni, non messaggi. */
export function messagesTabA11yLabel(count: number): string {
  if (count <= 0) {
    return "Messaggi";
  }

  return count === 1
    ? "Messaggi, 1 conversazione da leggere"
    : `Messaggi, ${count} conversazioni da leggere`;
}

/**
 * Label accessibile della riga (§29): «Staff Primavera, notifiche silenziose,
 * 17 messaggi non letti». Lo stato si annuncia a parole, non solo con l'icona.
 */
export function conversationRowA11yLabel(input: {
  isMuted: boolean;
  name: string;
  statusLabel?: string | null;
  unreadCount: number;
}): string {
  const parts = [input.name];

  if (input.statusLabel) {
    parts.push(input.statusLabel.toLowerCase());
  }

  if (input.isMuted) {
    parts.push("notifiche silenziose");
  }

  if (input.unreadCount > 0) {
    parts.push(
      input.unreadCount === 1 ? "1 messaggio non letto" : `${input.unreadCount} messaggi non letti`,
    );
  }

  return parts.join(", ");
}

const EMPTY_PREVIEW = "Apri la chat per iniziare.";

/**
 * Tipo e payload, se il server li manda; altrimenti il body se non è vuoto;
 * altrimenti il testo neutro. Mai una riga vuota.
 */
function buildSystemEventPreview(conversation: InboxConversation): string {
  if (conversation.last_message_system_event_type) {
    return formatSystemEvent(
      conversation.last_message_system_event_type,
      conversation.last_message_system_payload,
    );
  }

  return conversation.last_message_body?.trim() || GROUP_CHAT_COPY.eventFallback;
}

/** DAS-REV-33 §21: metadata neutro della riga di un gruppo archiviato, altrimenti null. */
export function conversationStatusLabel(conversation: InboxConversation): string | null {
  return conversation.conversation_type === "group" && conversation.group_status === "archived"
    ? GROUP_CHAT_COPY.archivedLabel
    : null;
}

/**
 * Anteprima della riga Inbox (DAS-REV-32 §12). Nei GROUP il mittente è una
 * PERSON e precede il testo («Mister Bianchi: Domani alle 18:00»); se l'ultimo
 * mittente sono io, o il nome manca, resta il solo testo. Le DIRECT non
 * cambiano e non portano alcuna label tecnica.
 */
export function buildConversationPreview(
  conversation: InboxConversation,
  viewerProfileId: string,
): string {
  // DAS-REV-33 §24: l'evento di sistema non ha autore e non è testo scritto da
  // una persona; l'anteprima lo formatta dal tipo/payload.
  if (conversation.last_message_kind === "system_event") {
    return buildSystemEventPreview(conversation);
  }

  // HOM-09 §288: una condivisione senza testo ha body vuoto; l'anteprima dice
  // «Contenuto condiviso», mai l'URL né un id. Con testo vale il testo.
  const body =
    conversation.last_message_kind === "content_reference"
      ? sharedMessagePreview(conversation.last_message_body)
      : conversation.last_message_body;

  if (!body) {
    return EMPTY_PREVIEW;
  }

  const senderName = conversation.last_message_sender_name?.trim();
  const isOwn = conversation.last_message_sender_profile_id === viewerProfileId;

  if (conversation.conversation_type === "group" && senderName && !isOwn) {
    return `${senderName}: ${body}`;
  }

  return body;
}

export function filterCommunications(
  list: CommunicationSummary[],
  filter: CommunicationFilter,
): CommunicationSummary[] {
  if (filter === "all") {
    return list;
  }

  if (filter === "unread") {
    return list.filter((item) => !item.is_read);
  }

  return list.filter((item) => item.category === filter);
}

export function matchesConversationQuery(
  conversation: InboxConversation,
  query: string,
): boolean {
  const needle = query.toLowerCase();

  return (
    conversation.display_title.toLowerCase().includes(needle) ||
    Boolean(conversation.last_message_body?.toLowerCase().includes(needle))
  );
}

export function matchesCommunicationQuery(
  communication: CommunicationSummary,
  query: string,
): boolean {
  const needle = query.toLowerCase();

  return (
    communication.sender_name.toLowerCase().includes(needle) ||
    communication.title.toLowerCase().includes(needle) ||
    communication.preview.toLowerCase().includes(needle)
  );
}

export function buildSearchSections(
  conversations: InboxConversation[],
  communications: CommunicationSummary[],
  query: string,
): {
  chatResults: InboxConversation[];
  communicationResults: CommunicationSummary[];
} {
  const trimmed = query.trim();

  if (trimmed.length < 2) {
    return { chatResults: [], communicationResults: [] };
  }

  return {
    chatResults: conversations.filter((item) =>
      matchesConversationQuery(item, trimmed),
    ),
    communicationResults: communications.filter((item) =>
      matchesCommunicationQuery(item, trimmed),
    ),
  };
}

const CATEGORY_LABELS: Record<CommunicationCategory, string> = {
  eventi: "Evento",
  societa: "Società",
  squadra: "Squadra",
  store: "Store",
};

export function categoryLabel(category: CommunicationCategory): string {
  return CATEGORY_LABELS[category];
}

export const CHAT_FILTERS: { label: string; value: ChatFilter }[] = [
  { label: "Tutti", value: "all" },
  { label: "Diretti", value: "direct" },
  { label: "Gruppi", value: "group" },
  { label: "Non letti", value: "unread" },
];

export const COMMUNICATION_FILTERS: {
  label: string;
  value: CommunicationFilter;
}[] = [
  { label: "Tutte", value: "all" },
  { label: "Società", value: "societa" },
  { label: "Squadra", value: "squadra" },
  { label: "Store", value: "store" },
  { label: "Eventi", value: "eventi" },
  { label: "Non lette", value: "unread" },
];
