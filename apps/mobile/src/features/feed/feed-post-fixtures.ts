/**
 * Payload di Post, editoriali e media per i test che non riguardano il Post in
 * sé (cache, arrange, like, processing). Solo test: nessun componente lo
 * importa.
 */

import type {
  FeedEditorialPayload,
  FeedItem,
  FeedMediaItem,
  FeedPostCapabilities,
  FeedPostPayload,
} from "./feed-types";

const CAPABILITIES: FeedPostCapabilities = {
  canLike: true,
  canComment: true,
  canShare: true,
  canSave: true,
  canReport: true,
  canEdit: false,
  canDelete: false,
  canViewInsights: false,
};

const AUTHOR_META = {
  role: null,
  primaryPosition: null,
  clubName: null,
  teamLabel: null,
  clubCategory: null,
  mediaKind: null,
};

export function makePostPayload(overrides: Partial<FeedPostPayload> = {}): FeedPostPayload {
  return {
    contentType: "club_media",
    postId: "post-1",
    kindLabel: null,
    text: null,
    body: null,
    isTruncated: false,
    authorIdentityType: "society",
    authorMeta: { ...AUTHOR_META },
    media: [],
    mentions: [],
    tagged: [],
    linkPreview: null,
    likesCount: 0,
    commentsCount: 0,
    isLiked: false,
    capabilities: { ...CAPABILITIES },
    ...overrides,
  };
}

/** HOM-03: Articolo o video editoriale con il payload completo. */
export function makeEditorialPayload(
  overrides: Partial<FeedEditorialPayload> = {},
): FeedEditorialPayload {
  return {
    contentType: "media_profile",
    postId: "ed-1",
    kindLabel: null,
    intro: null,
    summary: null,
    thumbnailUrl: null,
    durationSeconds: null,
    authorIdentityType: "media",
    authorMeta: { ...AUTHOR_META },
    media: [],
    likesCount: 0,
    commentsCount: 0,
    isLiked: false,
    capabilities: { ...CAPABILITIES },
    ...overrides,
  };
}

export function makeFeedMedia(overrides: Partial<FeedMediaItem> = {}): FeedMediaItem {
  return {
    id: "m-1",
    type: "video",
    position: 0,
    url: "https://x.test/v.mp4",
    thumbnailUrl: "https://x.test/v.jpg",
    width: 1920,
    height: 1080,
    aspectRatio: 1920 / 1080,
    durationSeconds: 48,
    altText: null,
    processingState: "ready",
    availability: "available",
    createdAt: null,
    variants: [],
    captions: [],
    ...overrides,
  };
}

const ENVELOPE = {
  rank: 1,
  version: 1,
  layoutHint: "standard" as const,
  publishedAt: null,
  author: null,
  reasonKey: null,
  reasonLabel: null,
  isSeen: false,
  isSaved: false,
  isFollowingAuthor: false,
  nav: null,
  title: null,
};

export function makePostItem(id: string, payload: Partial<FeedPostPayload> = {}): FeedItem {
  return { ...ENVELOPE, id, type: "post", payload: makePostPayload(payload) };
}

export function makeEditorialItem(
  id: string,
  type: "article" | "video",
  payload: Partial<FeedEditorialPayload> = {},
): FeedItem {
  return { ...ENVELOPE, id, type, payload: makeEditorialPayload(payload) };
}
