import * as ImagePicker from "expo-image-picker";

import { supabase } from "../../lib/supabase";

export const PROFILE_MEDIA_BUCKET = "profile-media";

export type ProfileMediaUploadErrorCode =
  | "bucket_not_found"
  | "file_read_failed"
  | "permission_denied"
  | "public_url_failed"
  | "upload_failed";

export class ProfileMediaUploadError extends Error {
  code: ProfileMediaUploadErrorCode;
  cause?: unknown;

  constructor(code: ProfileMediaUploadErrorCode, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "ProfileMediaUploadError";
    this.code = code;
    this.cause = options?.cause;
  }
}

export type UploadedMediaItem = {
  fileName: string;
  type: "image" | "video" | "unknown";
  url: string;
};

type PickAndUploadMediaInput = {
  allowsMultipleSelection?: boolean;
  folder: string;
  mediaTypes: ImagePicker.MediaType[] | ImagePicker.MediaTypeOptions;
  userId: string;
};

function mapUploadError(error: unknown) {
  if (error instanceof ProfileMediaUploadError) {
    return error;
  }

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Upload del media non riuscito.";

  if (/bucket not found/i.test(message)) {
    return new ProfileMediaUploadError(
      "bucket_not_found",
      `Archivio media profilo non disponibile (${PROFILE_MEDIA_BUCKET}).`,
      { cause: error },
    );
  }

  return new ProfileMediaUploadError("upload_failed", message, { cause: error });
}

function normalizeFileName(fileName: string | null | undefined, fallback: string) {
  return (fileName ?? fallback).replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function createUploadSuffix() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  const fallbackTime = globalThis.performance?.now?.() ?? 0;
  const fallbackEntropy =
    fallbackTime > 0 ? Math.trunc(fallbackTime * 1000) : Math.trunc(Math.random() * 1_000_000);
  return `${Date.now()}-${fallbackEntropy}`;
}

function inferAssetType(asset: ImagePicker.ImagePickerAsset): UploadedMediaItem["type"] {
  if (asset.type === "image" || asset.type === "video") {
    return asset.type;
  }

  return "unknown";
}

async function uploadAsset(
  asset: ImagePicker.ImagePickerAsset,
  input: PickAndUploadMediaInput,
  index: number,
) {
  let arrayBuffer: ArrayBuffer;

  try {
    const response = await fetch(asset.uri);
    arrayBuffer = await response.arrayBuffer();
  } catch (error) {
    throw new ProfileMediaUploadError(
      "file_read_failed",
      `Impossibile leggere il file selezionato ${asset.fileName ?? asset.uri}.`,
      { cause: error },
    );
  }

  const uploadSuffix = createUploadSuffix();
  const fileName = normalizeFileName(
    asset.fileName,
    `${inferAssetType(asset)}-${uploadSuffix}-${index}`,
  );
  const path = `${input.userId}/${input.folder}/${fileName}-${uploadSuffix}`;

  const { error } = await supabase.storage
    .from(PROFILE_MEDIA_BUCKET)
    .upload(path, arrayBuffer, {
      contentType: asset.mimeType ?? undefined,
      upsert: false,
    });

  if (error) {
    throw mapUploadError(error);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(PROFILE_MEDIA_BUCKET).getPublicUrl(path);

  if (!publicUrl) {
    throw new ProfileMediaUploadError(
      "public_url_failed",
      "Impossibile generare l'anteprima pubblica del media caricato.",
    );
  }

  return {
    fileName,
    type: inferAssetType(asset),
    url: publicUrl,
  } satisfies UploadedMediaItem;
}

export async function pickAndUploadMedia(input: PickAndUploadMediaInput) {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new ProfileMediaUploadError(
      "permission_denied",
      "Consenti l'accesso alla libreria foto per caricare i media.",
    );
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: !input.allowsMultipleSelection,
    allowsMultipleSelection: input.allowsMultipleSelection ?? false,
    mediaTypes: input.mediaTypes,
    quality: 1,
    selectionLimit: input.allowsMultipleSelection ? 10 : 1,
  });

  if (result.canceled) {
    return [];
  }

  try {
    return await Promise.all(
      result.assets.map((asset, index) => uploadAsset(asset, input, index)),
    );
  } catch (error) {
    throw mapUploadError(error);
  }
}
