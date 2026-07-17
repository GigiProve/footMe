import { supabase } from "../../lib/supabase";
import { createUploadSuffix, normalizeFileName } from "../profiles/media-upload-service";
import type { MessageKind } from "./messaging-service";

export const CHAT_MEDIA_BUCKET = "chat-media";

export type ChatMediaKind = Extract<MessageKind, "image" | "video" | "document">;

export class ChatMediaUploadError extends Error {
  cause?: unknown;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "ChatMediaUploadError";
    this.cause = options?.cause;
  }
}

// Pickers don't always report a mimeType; without one supabase-js uploads as
// text/plain, which the bucket's allowed_mime_types whitelist rejects.
const EXTENSION_MIME_TYPES: Record<string, string> = {
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  heic: "image/heic",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  mov: "video/quicktime",
  mp4: "video/mp4",
  pdf: "application/pdf",
  png: "image/png",
  webp: "image/webp",
};

function inferMimeType(fileName: string | null | undefined, uri: string) {
  const source = fileName || uri;
  const extension = source.split(".").pop()?.toLowerCase() ?? "";

  return EXTENSION_MIME_TYPES[extension];
}

function defaultBodyForKind(kind: ChatMediaKind, fileName?: string | null) {
  if (kind === "image") {
    return "Foto";
  }

  if (kind === "video") {
    return "Video";
  }

  return fileName ?? "Documento";
}

/**
 * Uploads a chat attachment to the private `chat-media` bucket and returns
 * its storage path (never a public/signed URL — messages.media_url stores
 * the path, the client mints a signed URL at render time via
 * getChatMediaSignedUrl from messaging-service.ts).
 */
export async function uploadChatMedia(input: {
  conversationId: string;
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
}): Promise<string> {
  let arrayBuffer: ArrayBuffer;

  try {
    const response = await fetch(input.uri);
    arrayBuffer = await response.arrayBuffer();
  } catch (error) {
    throw new ChatMediaUploadError(
      "Impossibile leggere il file selezionato.",
      { cause: error },
    );
  }

  const uploadSuffix = createUploadSuffix();
  const safeName = normalizeFileName(input.fileName, `file-${uploadSuffix}`);
  const path = `${input.conversationId}/${uploadSuffix}-${safeName}`;

  const { error } = await supabase.storage
    .from(CHAT_MEDIA_BUCKET)
    .upload(path, arrayBuffer, {
      contentType: input.mimeType ?? inferMimeType(input.fileName, input.uri),
      upsert: false,
    });

  if (error) {
    throw new ChatMediaUploadError(
      "Caricamento del file non riuscito.",
      { cause: error },
    );
  }

  return path;
}

/**
 * Inserts the messages row for an already-uploaded attachment. Callers must
 * upload first (uploadChatMedia) and only call this on success: a failed
 * upload must never result in a message being sent.
 */
export async function sendMediaMessage(input: {
  conversationId: string;
  senderProfileId: string;
  kind: ChatMediaKind;
  mediaPath: string;
  fileName?: string | null;
}) {
  const { error } = await supabase.from("messages").insert({
    body: defaultBodyForKind(input.kind, input.fileName),
    conversation_id: input.conversationId,
    media_url: input.mediaPath,
    message_kind: input.kind,
    sender_profile_id: input.senderProfileId,
  });

  if (error) {
    throw error;
  }
}
