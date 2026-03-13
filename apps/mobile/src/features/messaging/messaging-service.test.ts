import { beforeEach, describe, expect, it, vi } from "vitest";

import { sendContactCardMessage, sendMessage } from "./messaging-service";

const { fromMock, insertMock } = vi.hoisted(() => {
  const insertMock = vi.fn();

  return {
    fromMock: vi.fn(() => ({
      insert: insertMock,
    })),
    insertMock,
  };
});

vi.mock("../../lib/supabase", () => ({
  supabase: {
    from: fromMock,
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
