/**
 * Fixture condivise dai test del composer Post (HOM-06.1). Non usate dall'app.
 * Stessa convenzione di `features/feed/feed-post-fixtures.ts`.
 */

import {
  composerReducer,
  createComposerState,
  type ComposerAction,
  type ComposerState,
} from "./composer-reducer";
import type {
  ComposerIdentity,
  ComposerLimits,
  ComposerMediaItem,
  ComposerMention,
  ComposerTaggedIdentity,
} from "./composer-types";

export const LIMITS: ComposerLimits = {
  maxBodyLength: 5000,
  maxMedia: 10,
  maxMentions: 20,
  maxTags: 20,
  maxVideoSeconds: 600,
};

export const PERSON: ComposerIdentity = {
  avatarUrl: null,
  // HOM-06.2: la persona può programmare, la Società di test no (serve a provare §85).
  canSchedule: true,
  contextLabel: "Profilo personale",
  id: "person-1",
  isVerified: true,
  name: "Matteo Rossi",
  type: "person",
};

export const SOCIETY: ComposerIdentity = {
  avatarUrl: null,
  canSchedule: false,
  contextLabel: "Società",
  id: "society-1",
  isVerified: true,
  name: "AC Como",
  type: "society",
};

export const MEDIA_IDENTITY: ComposerIdentity = {
  avatarUrl: null,
  canSchedule: false,
  contextLabel: "Media",
  id: "media-1",
  isVerified: false,
  name: "Como Football News",
  type: "media",
};

export function tag(
  displayName: string,
  identityType: "profile" | "club" = "profile",
  identityId: string = displayName,
): ComposerTaggedIdentity {
  return { avatarUrl: null, displayName, identityId, identityType, isVerified: false, subtitle: null };
}

export function mention(displayName: string, start: number, identityId: string = displayName): ComposerMention {
  return {
    displayName,
    end: start + 1 + displayName.length,
    identityId,
    identityType: "profile",
    start,
  };
}

export function mediaItem(overrides: Partial<ComposerMediaItem> = {}): ComposerMediaItem {
  return {
    altText: null,
    durationSeconds: null,
    errorCode: null,
    height: 800,
    localId: "m1",
    localUri: "file:///tmp/m1.jpg",
    mimeType: "image/jpeg",
    remoteMediaPosition: null,
    remoteUrl: null,
    storagePath: null,
    thumbnailUri: null,
    type: "image",
    uploadProgress: null,
    uploadStatus: "uploaded",
    width: 600,
    ...overrides,
  };
}

/** Un media già caricato con il suo path, pronto per `p_media`. */
export function uploaded(localId: string, overrides: Partial<ComposerMediaItem> = {}): ComposerMediaItem {
  return mediaItem({ localId, storagePath: `u/posts/${localId}`, ...overrides });
}

export function baseState(overrides: Partial<ComposerState> = {}): ComposerState {
  return {
    ...createComposerState({
      identities: [PERSON, SOCIETY],
      identity: PERSON,
      limits: LIMITS,
      operationKey: "op-1",
      origin: "HOME_PER_TE",
    }),
    ...overrides,
  };
}

export function reduce(state: ComposerState, ...actions: ComposerAction[]): ComposerState {
  return actions.reduce(composerReducer, state);
}
