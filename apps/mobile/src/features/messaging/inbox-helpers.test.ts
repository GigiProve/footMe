import { describe, expect, it } from "vitest";

import type { CommunicationSummary } from "./communications-service";
import {
  buildSearchSections,
  categoryLabel,
  CHAT_FILTERS,
  COMMUNICATION_FILTERS,
  filterCommunications,
  filterConversations,
  matchesCommunicationQuery,
  matchesConversationQuery,
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
