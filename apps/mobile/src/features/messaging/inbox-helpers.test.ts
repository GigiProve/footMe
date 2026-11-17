import { describe, expect, it } from "vitest";

import type { CommunicationSummary } from "./communications-service";
import {
  buildConversationPreview,
  buildSearchSections,
  categoryLabel,
  CHAT_FILTERS,
  COMMUNICATION_FILTERS,
  conversationRowA11yLabel,
  conversationStatusLabel,
  emptyConversationsLabel,
  filterCommunications,
  filterConversations,
  inboxUnreadCount,
  isArchivedGroup,
  matchesCommunicationQuery,
  matchesConversationQuery,
  messagesTabA11yLabel,
} from "./inbox-helpers";
import type { InboxConversation } from "./messaging-service";

const directConversation: InboxConversation = {
  conversation_id: "conv-1",
  conversation_type: "direct",
  display_title: "Mario Rossi",
  avatar_url: null,
  other_profile_id: "profile-1",
  participant_count: 2,
  last_message_body: "Ci vediamo domani",
  last_message_kind: "text",
  last_message_sent_at: "2026-07-01T10:00:00.000Z",
  last_message_sender_profile_id: "profile-1",
  last_message_sender_name: "Mario Rossi",
  unread_count: 0,
  archived: false,
  blocked_by_me: false,
  group_avatar_path: null,
};

const groupConversation: InboxConversation = {
  conversation_id: "conv-2",
  conversation_type: "group",
  display_title: "Squadra Under 17",
  avatar_url: null,
  other_profile_id: null,
  participant_count: 20,
  last_message_body: "Allenamento spostato",
  last_message_kind: "text",
  last_message_sent_at: "2026-07-02T10:00:00.000Z",
  last_message_sender_profile_id: "profile-2",
  last_message_sender_name: "Coach Bianchi",
  unread_count: 3,
  archived: false,
  blocked_by_me: false,
  group_avatar_path: null,
};

const conversations: InboxConversation[] = [directConversation, groupConversation];

const societaCommunication: CommunicationSummary = {
  communication_id: "com-1",
  category: "societa",
  title: "Assemblea soci",
  preview: "Convocazione assemblea annuale",
  sender_club_id: "club-1",
  sender_name: "ASD ProLink",
  sender_logo_url: null,
  cta_label: null,
  cta_url: null,
  published_at: "2026-07-01T09:00:00.000Z",
  is_read: true,
};

const eventiCommunication: CommunicationSummary = {
  communication_id: "com-2",
  category: "eventi",
  title: "Torneo estivo",
  preview: "Iscrizioni aperte al torneo",
  sender_club_id: "club-1",
  sender_name: "ASD ProLink",
  sender_logo_url: null,
  cta_label: "Iscriviti",
  cta_url: "https://example.com",
  published_at: "2026-07-05T09:00:00.000Z",
  is_read: false,
};

const communications: CommunicationSummary[] = [
  societaCommunication,
  eventiCommunication,
];

describe("filterConversations", () => {
  it("returns all conversations for 'all'", () => {
    expect(filterConversations(conversations, "all")).toEqual(conversations);
  });

  it("filters direct conversations", () => {
    expect(filterConversations(conversations, "direct")).toEqual([
      directConversation,
    ]);
  });

  it("filters group conversations", () => {
    expect(filterConversations(conversations, "group")).toEqual([
      groupConversation,
    ]);
  });

  it("filters unread conversations", () => {
    expect(filterConversations(conversations, "unread")).toEqual([
      groupConversation,
    ]);
  });
});

describe("buildConversationPreview", () => {
  it("prefixes the sender name on group rows", () => {
    expect(buildConversationPreview(groupConversation, "me")).toBe(
      "Coach Bianchi: Allenamento spostato",
    );
  });

  it("keeps the plain body when the viewer wrote the last group message", () => {
    expect(buildConversationPreview(groupConversation, "profile-2")).toBe(
      "Allenamento spostato",
    );
  });

  it("never prefixes direct rows", () => {
    expect(buildConversationPreview(directConversation, "me")).toBe("Ci vediamo domani");
  });

  it("falls back to the empty prompt when there is no message", () => {
    expect(
      buildConversationPreview({ ...groupConversation, last_message_body: null }, "me"),
    ).toBe("Apri la chat per iniziare.");
  });

  describe("content shares (HOM-09 §288)", () => {
    const sharedRow: InboxConversation = {
      ...directConversation,
      last_message_body: "",
      last_message_kind: "content_reference",
    };

    it("says «Contenuto condiviso» when the share has no text", () => {
      expect(buildConversationPreview(sharedRow, "me")).toBe("Contenuto condiviso");
      expect(buildConversationPreview({ ...sharedRow, last_message_body: null }, "me")).toBe(
        "Contenuto condiviso",
      );
    });

    it("shows the optional text when there is one", () => {
      expect(
        buildConversationPreview({ ...sharedRow, last_message_body: "  Guarda questo  " }, "me"),
      ).toBe("Guarda questo");
    });

    it("keeps the group sender prefix", () => {
      expect(
        buildConversationPreview({ ...groupConversation, last_message_kind: "content_reference", last_message_body: "" }, "me"),
      ).toBe("Coach Bianchi: Contenuto condiviso");
    });
  });

  describe("system events (DAS-REV-33 §24)", () => {
    const eventRow: InboxConversation = {
      ...groupConversation,
      last_message_body: "",
      last_message_kind: "system_event",
      last_message_sender_name: null,
      last_message_sender_profile_id: null,
    };

    it("formats from type and payload, without a sender prefix", () => {
      expect(
        buildConversationPreview(
          {
            ...eventRow,
            last_message_system_event_type: "GROUP_MEMBER_ADDED",
            last_message_system_payload: { name: "Riccardo Riva" },
          },
          "me",
        ),
      ).toBe("Riccardo Riva è stato aggiunto al gruppo.");
    });

    it("falls back to a non-empty body, then to the neutral copy", () => {
      expect(
        buildConversationPreview({ ...eventRow, last_message_body: "Il gruppo è stato archiviato." }, "me"),
      ).toBe("Il gruppo è stato archiviato.");
      expect(buildConversationPreview(eventRow, "me")).toBe("Il gruppo è stato aggiornato.");
      expect(buildConversationPreview({ ...eventRow, last_message_body: null }, "me")).toBe(
        "Il gruppo è stato aggiornato.",
      );
    });

    it("never prefixes a sender even if a name leaks into the row", () => {
      expect(
        buildConversationPreview(
          {
            ...eventRow,
            last_message_sender_name: "Coach Bianchi",
            last_message_system_event_type: "GROUP_ARCHIVED",
          },
          "me",
        ),
      ).toBe("Il gruppo è stato archiviato.");
    });
  });
});

describe("conversationStatusLabel (DAS-REV-33 §21)", () => {
  it("labels only archived groups", () => {
    expect(conversationStatusLabel({ ...groupConversation, group_status: "archived" })).toBe(
      "Archiviato",
    );
    expect(conversationStatusLabel({ ...groupConversation, group_status: "active" })).toBeNull();
    expect(conversationStatusLabel({ ...groupConversation, group_status: null })).toBeNull();
    expect(conversationStatusLabel(groupConversation)).toBeNull();
    expect(
      conversationStatusLabel({ ...directConversation, group_status: "archived" }),
    ).toBeNull();
  });

  it("excludes an archived group from Non letti (DAS-REV-34 §13)", () => {
    const archived = { ...groupConversation, group_status: "archived" as const };

    expect(filterConversations([archived], "unread")).toEqual([]);
    expect(filterConversations([archived], "all")).toEqual([archived]);
  });
});

describe("filterCommunications", () => {
  it("returns all communications for 'all'", () => {
    expect(filterCommunications(communications, "all")).toEqual(communications);
  });

  it("filters by category", () => {
    expect(filterCommunications(communications, "societa")).toEqual([
      societaCommunication,
    ]);
    expect(filterCommunications(communications, "eventi")).toEqual([
      eventiCommunication,
    ]);
    expect(filterCommunications(communications, "squadra")).toEqual([]);
    expect(filterCommunications(communications, "store")).toEqual([]);
  });

  it("filters unread communications", () => {
    expect(filterCommunications(communications, "unread")).toEqual([
      eventiCommunication,
    ]);
  });
});

describe("matchesConversationQuery", () => {
  it("matches on display title case-insensitively", () => {
    expect(matchesConversationQuery(directConversation, "mario")).toBe(true);
    expect(matchesConversationQuery(directConversation, "MARIO")).toBe(true);
  });

  it("matches on last message body", () => {
    expect(matchesConversationQuery(groupConversation, "allenamento")).toBe(
      true,
    );
  });

  it("returns false when nothing matches", () => {
    expect(matchesConversationQuery(directConversation, "xyz")).toBe(false);
  });
});

describe("matchesCommunicationQuery", () => {
  it("matches sender name, title, and preview case-insensitively", () => {
    expect(matchesCommunicationQuery(societaCommunication, "prolink")).toBe(
      true,
    );
    expect(matchesCommunicationQuery(societaCommunication, "ASSEMBLEA")).toBe(
      true,
    );
    expect(matchesCommunicationQuery(eventiCommunication, "iscrizioni")).toBe(
      true,
    );
  });

  it("returns false when nothing matches", () => {
    expect(matchesCommunicationQuery(societaCommunication, "xyz")).toBe(false);
  });
});

describe("buildSearchSections", () => {
  it("returns empty arrays when the query is shorter than two characters", () => {
    expect(buildSearchSections(conversations, communications, "")).toEqual({
      chatResults: [],
      communicationResults: [],
    });
    expect(buildSearchSections(conversations, communications, "m")).toEqual({
      chatResults: [],
      communicationResults: [],
    });
    expect(buildSearchSections(conversations, communications, "  ")).toEqual({
      chatResults: [],
      communicationResults: [],
    });
  });

  it("returns matching chat and communication results for a valid query", () => {
    const result = buildSearchSections(conversations, communications, "prolink");

    expect(result.chatResults).toEqual([]);
    expect(result.communicationResults).toEqual(communications);
  });

  it("trims the query before matching", () => {
    const result = buildSearchSections(conversations, communications, "  mario  ");

    expect(result.chatResults).toEqual([directConversation]);
  });
});

describe("categoryLabel", () => {
  it("maps each category to its Italian label", () => {
    expect(categoryLabel("societa")).toBe("Società");
    expect(categoryLabel("squadra")).toBe("Squadra");
    expect(categoryLabel("store")).toBe("Store");
    expect(categoryLabel("eventi")).toBe("Evento");
  });
});

describe("filter chip definitions", () => {
  it("exposes the expected chat filter chips", () => {
    expect(CHAT_FILTERS).toEqual([
      { label: "Tutti", value: "all" },
      { label: "Diretti", value: "direct" },
      { label: "Gruppi", value: "group" },
      { label: "Non letti", value: "unread" },
    ]);
  });

  it("exposes the expected communication filter chips", () => {
    expect(COMMUNICATION_FILTERS).toEqual([
      { label: "Tutte", value: "all" },
      { label: "Società", value: "societa" },
      { label: "Squadra", value: "squadra" },
      { label: "Store", value: "store" },
      { label: "Eventi", value: "eventi" },
      { label: "Non lette", value: "unread" },
    ]);
  });
});

describe("DAS-REV-34 Inbox: mute, archiviati e Non letti", () => {
  /** Scenario del PNG 03: Staff Primavera 17 (silenziato), Luca Verdi 2, Prima squadra 4. */
  const staff: InboxConversation = {
    ...groupConversation,
    conversation_id: "g-staff",
    display_title: "Staff Primavera",
    is_muted: true,
    unread_count: 17,
  };
  const luca: InboxConversation = { ...directConversation, conversation_id: "d-luca", unread_count: 2 };
  const prima: InboxConversation = { ...groupConversation, conversation_id: "g-prima", unread_count: 4 };
  const archived: InboxConversation = {
    ...groupConversation,
    conversation_id: "g-archived",
    group_status: "archived",
    unread_count: 6,
  };

  it("il mute non nasconde il numero reale dei non letti né sposta la riga (QA-025, QA-026)", () => {
    expect(inboxUnreadCount(staff)).toBe(17);
    expect(filterConversations([staff, luca, prima], "unread").map((item) => item.conversation_id)).toEqual([
      "g-staff",
      "d-luca",
      "g-prima",
    ]);
  });

  it("Non letti esclude i GROUP archiviati; Tutti e Gruppi li mantengono (§13)", () => {
    const list = [staff, luca, archived];

    expect(filterConversations(list, "unread").map((item) => item.conversation_id)).toEqual(["g-staff", "d-luca"]);
    expect(filterConversations(list, "all")).toHaveLength(3);
    expect(filterConversations(list, "group").map((item) => item.conversation_id)).toContain("g-archived");
  });

  it("un GROUP archiviato non porta un counter anche se il payload lo manda", () => {
    expect(isArchivedGroup(archived)).toBe(true);
    expect(inboxUnreadCount(archived)).toBe(0);
    expect(inboxUnreadCount({ ...archived, unread_count: 0 })).toBe(0);
  });

  it("dopo la lettura di Staff Primavera restano solo Luca 2 e Prima squadra 4", () => {
    const read = { ...staff, unread_count: 0 };

    expect(filterConversations([read, luca, prima], "unread").map((item) => item.conversation_id)).toEqual([
      "d-luca",
      "g-prima",
    ]);
  });

  it("l'empty del filtro Non letti dice «Nessun messaggio da leggere» (§25)", () => {
    expect(emptyConversationsLabel("unread")).toBe("Nessun messaggio da leggere");
    expect(emptyConversationsLabel("all")).toBe("Nessuna conversazione trovata");
    expect(emptyConversationsLabel("group")).toBe("Nessuna conversazione trovata");
  });

  it("la label della riga annuncia mute e non letti (§29)", () => {
    expect(conversationRowA11yLabel({ isMuted: true, name: "Staff Primavera", unreadCount: 17 })).toBe(
      "Staff Primavera, notifiche silenziose, 17 messaggi non letti",
    );
    expect(conversationRowA11yLabel({ isMuted: false, name: "Luca Verdi", unreadCount: 1 })).toBe(
      "Luca Verdi, 1 messaggio non letto",
    );
    expect(conversationRowA11yLabel({ isMuted: false, name: "Luca Verdi", unreadCount: 0 })).toBe("Luca Verdi");
    expect(
      conversationRowA11yLabel({ isMuted: false, name: "Staff Primavera", statusLabel: "Archiviato", unreadCount: 0 }),
    ).toBe("Staff Primavera, archiviato");
  });

  it("la label della tab Messaggi conta conversazioni, non messaggi (§10, §29)", () => {
    expect(messagesTabA11yLabel(0)).toBe("Messaggi");
    expect(messagesTabA11yLabel(1)).toBe("Messaggi, 1 conversazione da leggere");
    expect(messagesTabA11yLabel(3)).toBe("Messaggi, 3 conversazioni da leggere");
  });
});
