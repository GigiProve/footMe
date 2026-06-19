import AsyncStorage from "@react-native-async-storage/async-storage";

import type { TaggableTarget } from "../../content/tag-types";
import type {
  MediaProfilePostDisplayMode,
  MediaProfilePostSourceType,
} from "../media-profile-post-service";

/** Steps that may be resumed from an autosaved draft (never "published"). */
export type ComposerStep =
  | "mode"
  | "linkUrl"
  | "setup"
  | "editor"
  | "displayMode"
  | "preview"
  | "details";

export type PersistedDraft = {
  authorName: string;
  body: string;
  category: string;
  coverType: "image" | "video" | null;
  coverUrl: string;
  displayMode: MediaProfilePostDisplayMode;
  externalUrl: string;
  mode: MediaProfilePostSourceType;
  savedAt: string;
  sourceName: string;
  step: ComposerStep;
  subtitle: string;
  taggedTargets: TaggableTarget[];
  title: string;
};

const PREFIX = "media-post-draft:";

export async function loadDraft(
  mediaProfileId: string,
): Promise<PersistedDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + mediaProfileId);
    return raw ? (JSON.parse(raw) as PersistedDraft) : null;
  } catch {
    return null;
  }
}

export async function saveDraft(
  mediaProfileId: string,
  draft: PersistedDraft,
): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFIX + mediaProfileId, JSON.stringify(draft));
  } catch {
    // Best-effort: autosave must never block editing.
  }
}

export async function clearDraft(mediaProfileId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(PREFIX + mediaProfileId);
  } catch {
    // Best-effort.
  }
}

/** A draft is worth restoring only when it carries real content. */
export function isResumableDraft(draft: PersistedDraft | null): draft is PersistedDraft {
  return (
    !!draft &&
    draft.step !== "mode" &&
    (draft.title.trim().length > 0 ||
      draft.body.trim().length > 0 ||
      draft.externalUrl.trim().length > 0)
  );
}
