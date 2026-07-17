import type {
  CommunicationCategory,
  CommunicationSummary,
} from "./communications-service";
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
