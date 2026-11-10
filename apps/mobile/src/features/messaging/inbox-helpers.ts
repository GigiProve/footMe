import type {
  CommunicationCategory,
  CommunicationSummary,
} from "./communications-service";
import { formatSystemEvent, GROUP_CHAT_COPY } from "./group-chat-presentation";
import type { InboxConversation } from "./messaging-service";

export type ChatFilter = "all" | "direct" | "group" | "unread";
export type CommunicationFilter = "all" | CommunicationCategory | "unread";

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
      return list.filter((item) => item.unread_count > 0);
    case "all":
    default:
      return list;
  }
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

  const body = conversation.last_message_body;

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
