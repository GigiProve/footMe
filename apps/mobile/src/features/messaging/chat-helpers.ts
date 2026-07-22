import {
  formatPosition,
  formatRole,
} from "../profiles/profile-display-helpers";
import type { ApplicationStatus } from "../recruiting/recruiting-service";
import type { ConversationMessage, DirectConversationMeta } from "./messaging-service";

// Duplicated from recruiting-service: importing its value exports would pull
// the supabase client (react-native-url-polyfill) into these pure helpers.
const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  accepted: "Accettata",
  rejected: "Rifiutata",
  reviewing: "In lettura",
  shortlisted: "Shortlist",
  submitted: "Inviata",
  withdrawn: "Ritirata",
};

export type ChatListItem =
  | { type: "message"; id: string; message: ConversationMessage }
  | { type: "separator"; id: string; label: string };

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateSeparatorLabel(iso: string): string {
  const messageDate = startOfDay(new Date(iso));
  const today = startOfDay(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (messageDate.getTime() === today.getTime()) {
    return "Oggi";
  }

  if (messageDate.getTime() === yesterday.getTime()) {
    return "Ieri";
  }

  return messageDate.toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Builds the item list for an inverted FlatList (most recent first). In the
 * ascending pass each day's separator goes BEFORE that day's first message;
 * after the reverse, the inverted list shows every pill above its own day.
 */
export function buildChatListItems(
  messages: ConversationMessage[],
): ChatListItem[] {
  const ascending = [...messages].sort(
    (a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime(),
  );

  const items: ChatListItem[] = [];
  let previousDayKey: string | null = null;

  ascending.forEach((message) => {
    const dayKey = startOfDay(new Date(message.sent_at)).toISOString();

    if (dayKey !== previousDayKey) {
      items.push({
        id: `separator-${dayKey}`,
        label: dateSeparatorLabel(message.sent_at),
        type: "separator",
      });
    }

    items.push({ id: message.message_id, message, type: "message" });
    previousDayKey = dayKey;
  });

  return items.reverse();
}

export function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function buildChatSubtitle(
  meta: Pick<
    DirectConversationMeta,
    "club_id" | "club_name" | "club_category" | "other_role" | "other_primary_position"
  >,
): string {
  if (meta.club_id) {
    return ["Società", meta.club_category].filter(Boolean).join(" • ");
  }

  if (meta.other_role === "player" && meta.other_primary_position) {
    return formatPosition(meta.other_primary_position);
  }

  return formatRole(meta.other_role);
}

export const REPORT_REASONS = [
  { label: "Spam o contenuto non pertinente", value: "spam" },
  { label: "Messaggio inappropriato", value: "messaggio_inappropriato" },
  { label: "Profilo falso / Sostituzione di persona", value: "profilo_falso" },
  { label: "Molestie o comportamento scorretto", value: "molestie" },
  { label: "Altro", value: "altro" },
] as const;

export function filterMessagesForSearch(
  messages: ConversationMessage[],
  query: string,
): ConversationMessage[] {
  const trimmed = query.trim();

  if (trimmed.length < 2) {
    return [];
  }

  const needle = trimmed.toLowerCase();

  return messages.filter((message) => message.body.toLowerCase().includes(needle));
}

export type ChatBanners = {
  contextCard: {
    title: string;
    subtitle: string;
    applicationId: string;
    adId: string | null;
  } | null;
  relationshipNote: {
    icon: "people-outline" | "briefcase-outline";
    label: string;
  } | null;
  softNotice: {
    title: string;
    body: string;
  } | null;
  showInlineSafetyRow: boolean;
};

export function resolveChatBanners(meta: DirectConversationMeta): ChatBanners {
  const contextCard =
    meta.application_id && meta.ad_title
      ? {
          adId: meta.ad_id,
          applicationId: meta.application_id,
          subtitle: `Candidatura di ${meta.applicant_full_name ?? ""} • ${
            meta.application_status
              ? APPLICATION_STATUS_LABELS[meta.application_status as ApplicationStatus] ??
                meta.application_status
              : ""
          }`,
          title: meta.ad_title,
        }
      : null;

  let relationshipNote: ChatBanners["relationshipNote"] = null;

  if (contextCard) {
    // La card candidatura è l'unico indicatore di contesto: mai due banner.
  } else if (meta.mutual_follow) {
    relationshipNote = { icon: "people-outline", label: "Vi seguite reciprocamente" };
  } else if (meta.representation_active || meta.roster_linked || meta.shortlisted) {
    relationshipNote = {
      icon: "briefcase-outline",
      label: "Collegamento professionale attivo",
    };
  }

  let softNotice: ChatBanners["softNotice"] = null;
  let showInlineSafetyRow = false;

  if (!relationshipNote && !contextCard) {
    if (!meta.i_have_sent && !meta.other_has_sent) {
      softNotice = {
        body: "Scrivi in modo chiaro e rispettoso. Il destinatario potrà decidere se continuare la conversazione.",
        title: "Non vi seguite ancora",
      };
    } else if (meta.i_have_sent && !meta.other_has_sent) {
      softNotice = {
        body: "Non avete ancora interazioni precedenti.",
        title: `Prima conversazione con ${meta.other_full_name}`,
      };
    } else if (meta.other_has_sent && !meta.i_have_sent) {
      softNotice = {
        body: "Non avete interazioni precedenti con questo profilo.",
        title: "Nuova conversazione",
      };
      showInlineSafetyRow = true;
    }
  }

  return { contextCard, relationshipNote, showInlineSafetyRow, softNotice };
}
