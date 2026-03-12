import * as ImagePicker from "expo-image-picker";

import { supabase } from "../../lib/supabase";

const PROFILE_MEDIA_BUCKET = "profile-media";

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

function normalizeFileName(fileName: string | null | undefined, fallback: string) {
  return (fileName ?? fallback).replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function createUploadSuffix() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-upload`;
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
  } catch {
    throw new Error(
      `Impossibile leggere il file selezionato ${asset.fileName ?? asset.uri}.`,
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
    throw error;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(PROFILE_MEDIA_BUCKET).getPublicUrl(path);

  return {
    fileName,
    type: inferAssetType(asset),
    url: publicUrl,
  } satisfies UploadedMediaItem;
}

export async function pickAndUploadMedia(input: PickAndUploadMediaInput) {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error("Consenti l'accesso alla libreria foto per caricare i media.");
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

  return Promise.all(
    result.assets.map((asset, index) => uploadAsset(asset, input, index)),
  );
}
