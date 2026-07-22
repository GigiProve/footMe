import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChatMediaUploadError, sendMediaMessage, uploadChatMedia } from "./chat-media-service";

const mocks = vi.hoisted(() => {
  return {
    fromMock: vi.fn(),
    insertMock: vi.fn(),
    storageFromMock: vi.fn(),
    uploadMock: vi.fn(),
  };
});

vi.mock("../../lib/supabase", () => ({
  supabase: {
    from: mocks.fromMock,
    storage: {
      from: mocks.storageFromMock,
    },
  },
}));

// chat-media-service.ts imports normalizeFileName/createUploadSuffix from
// media-upload-service.ts, which itself imports expo-image-picker — stub it
// out so the real (RN-only) module never loads in the vitest/node environment,
// mirroring media-upload-service.test.ts.
vi.mock("expo-image-picker", () => ({}));

describe("uploadChatMedia", () => {
  beforeEach(() => {
    mocks.uploadMock.mockReset();
    mocks.storageFromMock.mockReset();
    mocks.fromMock.mockReset();
    mocks.insertMock.mockReset();

    mocks.uploadMock.mockResolvedValue({ error: null });
    mocks.storageFromMock.mockReturnValue({ upload: mocks.uploadMock });
    mocks.fromMock.mockReturnValue({ insert: mocks.insertMock });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
      }),
    );
  });

  it("uploads to a path prefixed with the conversation id", async () => {
    const path = await uploadChatMedia({
      conversationId: "conversation-1",
      fileName: "photo.jpg",
      mimeType: "image/jpeg",
      uri: "file:///photo.jpg",
    });

    expect(mocks.storageFromMock).toHaveBeenCalledWith("chat-media");
    expect(mocks.uploadMock).toHaveBeenCalledTimes(1);

    const [uploadedPath, , options] = mocks.uploadMock.mock.calls[0];
    expect(uploadedPath.startsWith("conversation-1/")).toBe(true);
    expect(uploadedPath).toContain("photo.jpg");
    expect(options).toEqual({ contentType: "image/jpeg", upsert: false });
    expect(path).toBe(uploadedPath);
  });

  it("infers the content type from the file extension when the picker omits it", async () => {
    await uploadChatMedia({
      conversationId: "conversation-1",
      fileName: "contratto.pdf",
      mimeType: null,
      uri: "file:///contratto.pdf",
    });

    const [, , options] = mocks.uploadMock.mock.calls[0];
    expect(options).toEqual({ contentType: "application/pdf", upsert: false });
  });

  it("never touches the messages table when the upload fails", async () => {
    mocks.uploadMock.mockResolvedValue({ error: new Error("Bucket not found") });

    await expect(
      uploadChatMedia({
        conversationId: "conversation-1",
        fileName: "photo.jpg",
        mimeType: "image/jpeg",
        uri: "file:///photo.jpg",
      }),
    ).rejects.toBeInstanceOf(ChatMediaUploadError);

    expect(mocks.fromMock).not.toHaveBeenCalled();
    expect(mocks.insertMock).not.toHaveBeenCalled();
  });

  it("wraps a failed file read in a ChatMediaUploadError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );

    await expect(
      uploadChatMedia({
        conversationId: "conversation-1",
        fileName: "photo.jpg",
        mimeType: "image/jpeg",
        uri: "file:///photo.jpg",
      }),
    ).rejects.toThrow("Impossibile leggere il file selezionato.");

    expect(mocks.uploadMock).not.toHaveBeenCalled();
  });
});

describe("sendMediaMessage", () => {
  beforeEach(() => {
    mocks.fromMock.mockReset();
    mocks.insertMock.mockReset();
    mocks.insertMock.mockResolvedValue({ error: null });
    mocks.fromMock.mockReturnValue({ insert: mocks.insertMock });
  });

  it("inserts an image message with the Foto fallback body", async () => {
    await sendMediaMessage({
      conversationId: "conversation-1",
      kind: "image",
      mediaPath: "conversation-1/uuid-photo.jpg",
      senderProfileId: "profile-1",
    });

    expect(mocks.fromMock).toHaveBeenCalledWith("messages");
    expect(mocks.insertMock).toHaveBeenCalledWith({
      body: "Foto",
      conversation_id: "conversation-1",
      media_url: "conversation-1/uuid-photo.jpg",
      message_kind: "image",
      sender_profile_id: "profile-1",
    });
  });

  it("inserts a video message with the Video fallback body", async () => {
    await sendMediaMessage({
      conversationId: "conversation-1",
      kind: "video",
      mediaPath: "conversation-1/uuid-clip.mp4",
      senderProfileId: "profile-1",
    });

    expect(mocks.insertMock).toHaveBeenCalledWith({
      body: "Video",
      conversation_id: "conversation-1",
      media_url: "conversation-1/uuid-clip.mp4",
      message_kind: "video",
      sender_profile_id: "profile-1",
    });
  });

  it("inserts a document message with the file name as body", async () => {
    await sendMediaMessage({
      conversationId: "conversation-1",
      fileName: "contratto.pdf",
      kind: "document",
      mediaPath: "conversation-1/uuid-contratto.pdf",
      senderProfileId: "profile-1",
    });

    expect(mocks.insertMock).toHaveBeenCalledWith({
      body: "contratto.pdf",
      conversation_id: "conversation-1",
      media_url: "conversation-1/uuid-contratto.pdf",
      message_kind: "document",
      sender_profile_id: "profile-1",
    });
  });

  it("falls back to a generic label when a document has no file name", async () => {
    await sendMediaMessage({
      conversationId: "conversation-1",
      kind: "document",
      mediaPath: "conversation-1/uuid-file",
      senderProfileId: "profile-1",
    });

    expect(mocks.insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ body: "Documento" }),
    );
  });

  it("throws when the insert fails", async () => {
    mocks.insertMock.mockResolvedValue({ error: new Error("boom") });

    await expect(
      sendMediaMessage({
        conversationId: "conversation-1",
        kind: "image",
        mediaPath: "conversation-1/uuid-photo.jpg",
        senderProfileId: "profile-1",
      }),
    ).rejects.toThrow("boom");
  });
});
