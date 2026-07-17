import { describe, expect, it } from "vitest";

import type { DirectConversationMeta } from "./messaging-service";
import type { ConversationMessage } from "./messaging-service";
import {
  buildChatListItems,
  buildChatSubtitle,
  filterMessagesForSearch,
  formatMessageTime,
  REPORT_REASONS,
  resolveChatBanners,
} from "./chat-helpers";

function baseMeta(overrides: Partial<DirectConversationMeta> = {}): DirectConversationMeta {
  return {
    ad_id: null,
    ad_title: null,
    application_id: null,
    application_status: null,
    applicant_full_name: null,
    archived: false,
    blocked_by_me: false,
    club_category: null,
    club_id: null,
    club_name: null,
    i_have_sent: false,
    mutual_follow: false,
    other_avatar_url: null,
    other_full_name: "Mario Rossi",
    other_has_sent: false,
    other_primary_position: null,
    other_profile_id: "profile-1",
    other_role: "player",
    representation_active: false,
    representation_type: null,
    roster_linked: false,
    shortlisted: false,
    ...overrides,
  };
}

function message(overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  return {
    body: "Ciao",
    media_url: null,
    message_id: "msg-1",
    message_kind: "text",
    read_at: null,
    sender_full_name: "Mario Rossi",
    sender_profile_id: "profile-1",
    sent_at: "2026-07-01T10:00:00.000Z",
    shared_contact_name: null,
    shared_contact_phone: null,
    ...overrides,
  };
}

describe("buildChatListItems", () => {
  it("returns items in inverted (desc) order", () => {
    const messages = [
      message({ message_id: "m1", sent_at: "2026-07-01T10:00:00.000Z" }),
      message({ message_id: "m2", sent_at: "2026-07-01T11:00:00.000Z" }),
    ];

    const items = buildChatListItems(messages);
    const messageItems = items.filter((item) => item.type === "message");

    expect(messageItems.map((item) => item.id)).toEqual(["m2", "m1"]);
  });

  it("inserts a date separator between messages sent on different days", () => {
    const messages = [
      message({ message_id: "m1", sent_at: "2026-07-01T10:00:00.000Z" }),
      message({ message_id: "m2", sent_at: "2026-07-02T10:00:00.000Z" }),
    ];

    const items = buildChatListItems(messages);
    const separators = items.filter((item) => item.type === "separator");

    expect(separators).toHaveLength(2);
  });

  it("places each separator after its day's messages in data order, so the inverted list shows it above them", () => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    const items = buildChatListItems([
      message({ message_id: "m1", sent_at: yesterday.toISOString() }),
      message({ message_id: "m2", sent_at: now.toISOString() }),
    ]);

    expect(
      items.map((item) => (item.type === "separator" ? item.label : item.id)),
    ).toEqual(["m2", "Oggi", "m1", "Ieri"]);
  });

  it("labels today's and yesterday's separators using Oggi/Ieri", () => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    const messages = [
      message({ message_id: "m1", sent_at: yesterday.toISOString() }),
      message({ message_id: "m2", sent_at: now.toISOString() }),
    ];

    const items = buildChatListItems(messages);
    const labels = items
      .filter((item): item is Extract<typeof item, { type: "separator" }> => item.type === "separator")
      .map((item) => item.label);

    expect(labels).toContain("Oggi");
    expect(labels).toContain("Ieri");
  });
});

describe("formatMessageTime", () => {
  it("formats an ISO timestamp as HH:mm", () => {
    expect(formatMessageTime("2026-07-01T14:32:00.000Z")).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe("buildChatSubtitle", () => {
  it("returns the club label when a club is attached", () => {
    expect(
      buildChatSubtitle({
        club_category: "Serie D",
        club_id: "club-1",
        club_name: "AC Como",
        other_primary_position: null,
        other_role: "club_admin",
      }),
    ).toBe("Società • Serie D");
  });

  it("returns the formatted position for a player", () => {
    expect(
      buildChatSubtitle({
        club_category: null,
        club_id: null,
        club_name: null,
        other_primary_position: "forward",
        other_role: "player",
      }),
    ).not.toBe("");
  });

  it("returns the formatted role for an agent", () => {
    expect(
      buildChatSubtitle({
        club_category: null,
        club_id: null,
        club_name: null,
        other_primary_position: null,
        other_role: "agent",
      }),
    ).toBe("Procuratore");
  });
});

describe("REPORT_REASONS", () => {
  it("maps the DB reason values to the mockup labels", () => {
    expect(REPORT_REASONS).toEqual([
      { label: "Spam o contenuto non pertinente", value: "spam" },
      { label: "Messaggio inappropriato", value: "messaggio_inappropriato" },
      { label: "Profilo falso / Sostituzione di persona", value: "profilo_falso" },
      { label: "Molestie o comportamento scorretto", value: "molestie" },
      { label: "Altro", value: "altro" },
    ]);
  });
});

describe("filterMessagesForSearch", () => {
  const messages = [
    message({ body: "Ci vediamo domani", message_id: "m1" }),
    message({ body: "Allenamento spostato", message_id: "m2" }),
  ];

  it("returns an empty array for queries shorter than 2 characters", () => {
    expect(filterMessagesForSearch(messages, "")).toEqual([]);
    expect(filterMessagesForSearch(messages, "a")).toEqual([]);
  });

  it("filters case-insensitively on the message body", () => {
    expect(filterMessagesForSearch(messages, "DOMANI")).toEqual([messages[0]]);
  });
});

describe("resolveChatBanners", () => {
  it("prioritizes the application context card above everything else", () => {
    const meta = baseMeta({
      ad_id: "ad-1",
      ad_title: "Cerchiamo attaccante",
      applicant_full_name: "Luca Bianchi",
      application_id: "app-1",
      application_status: "submitted",
      mutual_follow: true,
    });

    const banners = resolveChatBanners(meta);

    expect(banners.contextCard).toEqual({
      adId: "ad-1",
      applicationId: "app-1",
      subtitle: "Candidatura di Luca Bianchi • Inviata",
      title: "Cerchiamo attaccante",
    });
    expect(banners.relationshipNote).toBeNull();
    expect(banners.softNotice).toBeNull();
  });

  it("shows the mutual follow note when there is no application context", () => {
    const banners = resolveChatBanners(baseMeta({ mutual_follow: true }));

    expect(banners.contextCard).toBeNull();
    expect(banners.relationshipNote).toEqual({
      icon: "people-outline",
      label: "Vi seguite reciprocamente",
    });
    expect(banners.softNotice).toBeNull();
  });

  it("shows the professional link note for representation/roster/shortlist", () => {
    expect(resolveChatBanners(baseMeta({ representation_active: true })).relationshipNote).toEqual({
      icon: "briefcase-outline",
      label: "Collegamento professionale attivo",
    });
    expect(resolveChatBanners(baseMeta({ roster_linked: true })).relationshipNote).toEqual({
      icon: "briefcase-outline",
      label: "Collegamento professionale attivo",
    });
    expect(resolveChatBanners(baseMeta({ shortlisted: true })).relationshipNote).toEqual({
      icon: "briefcase-outline",
      label: "Collegamento professionale attivo",
    });
  });

  it("prefers mutual_follow over professional link when both are true", () => {
    const banners = resolveChatBanners(
      baseMeta({ mutual_follow: true, representation_active: true }),
    );

    expect(banners.relationshipNote?.label).toBe("Vi seguite reciprocamente");
  });

  it("shows the neutral yellow notice when nobody has written yet", () => {
    const banners = resolveChatBanners(baseMeta());

    expect(banners.softNotice).toEqual({
      body: "Scrivi in modo chiaro e rispettoso. Il destinatario potrà decidere se continuare la conversazione.",
      title: "Non vi seguite ancora",
    });
    expect(banners.showInlineSafetyRow).toBe(false);
  });

  it("shows the initiator yellow notice when only I have sent messages", () => {
    const banners = resolveChatBanners(baseMeta({ i_have_sent: true }));

    expect(banners.softNotice).toEqual({
      body: "Non avete ancora interazioni precedenti.",
      title: "Prima conversazione con Mario Rossi",
    });
    expect(banners.showInlineSafetyRow).toBe(false);
  });

  it("shows the recipient yellow notice with the inline safety row when only the other side has sent messages", () => {
    const banners = resolveChatBanners(baseMeta({ other_has_sent: true }));

    expect(banners.softNotice).toEqual({
      body: "Non avete interazioni precedenti con questo profilo.",
      title: "Nuova conversazione",
    });
    expect(banners.showInlineSafetyRow).toBe(true);
  });

  it("shows no banner once both sides have written and there is no relationship", () => {
    const banners = resolveChatBanners(
      baseMeta({ i_have_sent: true, other_has_sent: true }),
    );

    expect(banners.softNotice).toBeNull();
    expect(banners.showInlineSafetyRow).toBe(false);
  });
});
