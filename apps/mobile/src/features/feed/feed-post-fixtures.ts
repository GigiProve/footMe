/**
 * Payload di un Post per i test che non riguardano il Post in sé (cache,
 * arrange). Solo test: nessun componente lo importa.
 */

import type { FeedPostPayload } from "./feed-types";

export function makePostPayload(overrides: Partial<FeedPostPayload> = {}): FeedPostPayload {
  return {
    contentType: "club_media",
    postId: "post-1",
    kindLabel: null,
    text: null,
    body: null,
    isTruncated: false,
    authorIdentityType: "society",
    authorMeta: {
      role: null,
      primaryPosition: null,
      clubName: null,
      teamLabel: null,
      clubCategory: null,
      mediaKind: null,
    },
    media: [],
    mentions: [],
    tagged: [],
    linkPreview: null,
    likesCount: 0,
    commentsCount: 0,
    isLiked: false,
    capabilities: {
      canLike: true,
      canComment: true,
      canShare: true,
      canSave: true,
      canReport: true,
      canEdit: false,
      canDelete: false,
      canViewInsights: false,
    },
    ...overrides,
  };
}
