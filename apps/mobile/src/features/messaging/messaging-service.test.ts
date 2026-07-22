import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  blockUser,
  fetchDirectConversationMeta,
  fetchInboxConversations,
  getChatMediaSignedUrl,
  markInboxAllRead,
  openDirectConversation,
  reportConversation,
  sendContactCardMessage,
  sendMessage,
  setConversationArchived,
  unblockUser,
} from "./messaging-service";

const { createSignedUrlMock, fromMock, insertMock, rpcMock, storageFromMock } = vi.hoisted(() => {
  const insertMock = vi.fn();
  const createSignedUrlMock = vi.fn();

  return {
    createSignedUrlMock,
    fromMock: vi.fn(() => ({
      insert: insertMock,
    })),
    insertMock,
    rpcMock: vi.fn(),
    storageFromMock: vi.fn(() => ({
      createSignedUrl: createSignedUrlMock,
    })),
  };
});

vi.mock("../../lib/supabase", () => ({
  supabase: {
    from: fromMock,
    rpc: rpcMock,
    storage: {
      from: storageFromMock,
    },
  },
}));

describe("sendMessage", () => {
  beforeEach(() => {
    fromMock.mockClear();
    insertMock.mockReset();
    insertMock.mockResolvedValue({ error: null });
  });

  it("rejects messages that are blank after trimming", async () => {
    await expect(
      sendMessage({
        body: "   ",
        conversationId: "conversation-1",
        senderProfileId: "profile-1",
      }),
    ).rejects.toThrow("Scrivi un messaggio prima di inviare.");

    expect(fromMock).not.toHaveBeenCalled();
  });

  it("inserts a trimmed message body", async () => {
    await sendMessage({
      body: "  Ciao mister!  ",
      conversationId: "conversation-9",
      senderProfileId: "profile-7",
    });

    expect(fromMock).toHaveBeenCalledWith("messages");
    expect(insertMock).toHaveBeenCalledWith({
      body: "Ciao mister!",
      conversation_id: "conversation-9",
      message_kind: "text",
      sender_profile_id: "profile-7",
    });
  });

  it("sends a dedicated contact card message", async () => {
    await sendContactCardMessage({
      contactName: "Mario Rossi",
      conversationId: "conversation-5",
      phone: "+393331234567",
      senderProfileId: "profile-7",
    });

    expect(insertMock).toHaveBeenCalledWith({
      body: "Numero di telefono condiviso",
      conversation_id: "conversation-5",
      message_kind: "contact_card",
      sender_profile_id: "profile-7",
      shared_contact_name: "Mario Rossi",
      shared_contact_phone: "+393331234567",
    });
  });
});

describe("fetchInboxConversations", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("forwards pagination and returns the conversation list", async () => {
    rpcMock.mockResolvedValue({ data: [{ conversation_id: "c1" }], error: null });

    const result = await fetchInboxConversations(20, 10);

    expect(rpcMock).toHaveBeenCalledWith("fetch_inbox_conversations", {
      p_include_archived: false,
      p_limit: 20,
      p_offset: 10,
    });
    expect(result).toEqual([{ conversation_id: "c1" }]);
  });

  it("defaults to an empty array when data is null", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    const result = await fetchInboxConversations();

    expect(rpcMock).toHaveBeenCalledWith("fetch_inbox_conversations", {
      p_include_archived: false,
      p_limit: 50,
      p_offset: 0,
    });
    expect(result).toEqual([]);
  });

  it("forwards includeArchived when set to true", async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });

    await fetchInboxConversations(50, 0, true);

    expect(rpcMock).toHaveBeenCalledWith("fetch_inbox_conversations", {
      p_include_archived: true,
      p_limit: 50,
      p_offset: 0,
    });
  });

  it("throws when the rpc errors", async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error("boom") });

    await expect(fetchInboxConversations()).rejects.toThrow("boom");
  });
});

describe("openDirectConversation", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("passes a null application id when none is provided", async () => {
    rpcMock.mockResolvedValue({ data: "conversation-1", error: null });

    const result = await openDirectConversation("profile-2");

    expect(rpcMock).toHaveBeenCalledWith("open_direct_conversation", {
      target_profile_id: "profile-2",
      p_application_id: null,
    });
    expect(result).toBe("conversation-1");
  });

  it("forwards the application id when provided", async () => {
    rpcMock.mockResolvedValue({ data: "conversation-9", error: null });

    const result = await openDirectConversation("profile-2", "application-5");

    expect(rpcMock).toHaveBeenCalledWith("open_direct_conversation", {
      target_profile_id: "profile-2",
      p_application_id: "application-5",
    });
    expect(result).toBe("conversation-9");
  });

  it("throws when the rpc errors", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: new Error("Non puoi avviare una conversazione con te stesso"),
    });

    await expect(openDirectConversation("profile-1")).rejects.toThrow(
      "Non puoi avviare una conversazione con te stesso",
    );
  });
});

describe("fetchDirectConversationMeta", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("returns the first row of the rpc result", async () => {
    const row = { other_profile_id: "profile-2", i_have_sent: true };
    rpcMock.mockResolvedValue({ data: [row], error: null });

    const result = await fetchDirectConversationMeta("conversation-1");

    expect(rpcMock).toHaveBeenCalledWith("fetch_direct_conversation_meta", {
      target_conversation_id: "conversation-1",
    });
    expect(result).toEqual(row);
  });

  it("returns null when data is empty", async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });

    const result = await fetchDirectConversationMeta("conversation-1");

    expect(result).toBeNull();
  });

  it("returns null when data is null", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    const result = await fetchDirectConversationMeta("conversation-1");

    expect(result).toBeNull();
  });

  it("throws when the rpc errors", async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error("Conversazione non trovata") });

    await expect(fetchDirectConversationMeta("conversation-1")).rejects.toThrow(
      "Conversazione non trovata",
    );
  });
});

describe("blockUser / unblockUser", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("calls block_user with the target profile id", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    await blockUser("profile-2");

    expect(rpcMock).toHaveBeenCalledWith("block_user", {
      target_profile_id: "profile-2",
    });
  });

  it("throws when block_user errors", async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error("Non puoi bloccare te stesso") });

    await expect(blockUser("profile-1")).rejects.toThrow("Non puoi bloccare te stesso");
  });

  it("calls unblock_user with the target profile id", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    await unblockUser("profile-2");

    expect(rpcMock).toHaveBeenCalledWith("unblock_user", {
      target_profile_id: "profile-2",
    });
  });

  it("throws when unblock_user errors", async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error("boom") });

    await expect(unblockUser("profile-2")).rejects.toThrow("boom");
  });
});

describe("reportConversation", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("passes null details when none are provided", async () => {
    rpcMock.mockResolvedValue({ data: "report-1", error: null });

    const result = await reportConversation({
      conversationId: "conversation-1",
      reason: "spam",
    });

    expect(rpcMock).toHaveBeenCalledWith("report_conversation", {
      target_conversation_id: "conversation-1",
      p_reason: "spam",
      p_details: null,
    });
    expect(result).toBe("report-1");
  });

  it("forwards details when provided", async () => {
    rpcMock.mockResolvedValue({ data: "report-2", error: null });

    await reportConversation({
      conversationId: "conversation-1",
      reason: "molestie",
      details: "Messaggi ripetuti indesiderati",
    });

    expect(rpcMock).toHaveBeenCalledWith("report_conversation", {
      target_conversation_id: "conversation-1",
      p_reason: "molestie",
      p_details: "Messaggi ripetuti indesiderati",
    });
  });

  it("throws when the reason is invalid", async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error("Motivazione non valida") });

    await expect(
      reportConversation({ conversationId: "conversation-1", reason: "spam" }),
    ).rejects.toThrow("Motivazione non valida");
  });
});

describe("setConversationArchived", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("archives a conversation", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    await setConversationArchived("conversation-1", true);

    expect(rpcMock).toHaveBeenCalledWith("set_conversation_archived", {
      target_conversation_id: "conversation-1",
      p_archived: true,
    });
  });

  it("unarchives a conversation", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    await setConversationArchived("conversation-1", false);

    expect(rpcMock).toHaveBeenCalledWith("set_conversation_archived", {
      target_conversation_id: "conversation-1",
      p_archived: false,
    });
  });

  it("throws when the rpc errors", async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error("Conversazione non trovata") });

    await expect(setConversationArchived("conversation-1", true)).rejects.toThrow(
      "Conversazione non trovata",
    );
  });
});

describe("getChatMediaSignedUrl", () => {
  beforeEach(() => {
    storageFromMock.mockClear();
    createSignedUrlMock.mockReset();
  });

  it("requests a signed url from the chat-media bucket with the default expiry", async () => {
    createSignedUrlMock.mockResolvedValue({
      data: { signedUrl: "https://example.com/signed.jpg" },
      error: null,
    });

    const result = await getChatMediaSignedUrl("conversation-1/photo.jpg");

    expect(storageFromMock).toHaveBeenCalledWith("chat-media");
    expect(createSignedUrlMock).toHaveBeenCalledWith("conversation-1/photo.jpg", 3600);
    expect(result).toBe("https://example.com/signed.jpg");
  });

  it("forwards a custom expiry", async () => {
    createSignedUrlMock.mockResolvedValue({
      data: { signedUrl: "https://example.com/signed.jpg" },
      error: null,
    });

    await getChatMediaSignedUrl("conversation-1/photo.jpg", 60);

    expect(createSignedUrlMock).toHaveBeenCalledWith("conversation-1/photo.jpg", 60);
  });

  it("throws when the storage call errors", async () => {
    createSignedUrlMock.mockResolvedValue({ data: null, error: new Error("boom") });

    await expect(getChatMediaSignedUrl("conversation-1/photo.jpg")).rejects.toThrow("boom");
  });
});

describe("markInboxAllRead", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("returns the number of conversations marked as read", async () => {
    rpcMock.mockResolvedValue({ data: 3, error: null });

    const result = await markInboxAllRead();

    expect(rpcMock).toHaveBeenCalledWith("mark_inbox_all_read");
    expect(result).toBe(3);
  });

  it("defaults to zero when data is null", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    const result = await markInboxAllRead();

    expect(result).toBe(0);
  });

  it("throws when the rpc errors", async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error("boom") });

    await expect(markInboxAllRead()).rejects.toThrow("boom");
  });
});
