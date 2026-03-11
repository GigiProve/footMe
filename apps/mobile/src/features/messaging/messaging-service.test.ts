import { beforeEach, describe, expect, it, vi } from "vitest";

import { sendMessage } from "./messaging-service";

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
      sender_profile_id: "profile-7",
    });
  });
});
