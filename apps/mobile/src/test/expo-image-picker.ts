// Test stub for expo-image-picker. The real module loads expo-modules-core,
// which requires the native `expo` runtime global that does not exist under
// Vitest/Node. Components that transitively import the media-upload service
// only need these named exports to resolve at import time; individual tests
// that exercise the picker override them with `vi.mock`.

export enum MediaTypeOptions {
  All = "All",
  Images = "Images",
  Videos = "Videos",
}

export type MediaType = "images" | "videos" | "livePhotos";

export type ImagePickerAsset = {
  uri: string;
  type?: string;
  fileName?: string | null;
  mimeType?: string;
};

export async function requestMediaLibraryPermissionsAsync() {
  return { granted: false, canAskAgain: true, status: "undetermined" as const };
}

export async function requestCameraPermissionsAsync() {
  return { granted: false, canAskAgain: true, status: "undetermined" as const };
}

export async function launchImageLibraryAsync() {
  return { canceled: true as const, assets: null };
}

export async function launchCameraAsync() {
  return { canceled: true as const, assets: null };
}
