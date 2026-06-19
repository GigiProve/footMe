import { useCallback } from "react";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import {
  fetchTaggedContentForProfile,
  type TaggedContentItem,
} from "./content-tag-service";
import type { MediaContentItem } from "../profiles/career/MediaTabContent";

/**
 * Maps a tagged content item (from the RPC) to a MediaContentItem suitable
 * for rendering in MediaTabContent. Tagged items open the content detail route
 * instead of the local viewer, which is signalled by the `taggedRef` field.
 */
export function mapTaggedItemToMediaItem(item: TaggedContentItem): MediaContentItem {
  return {
    commentCount: 0,
    comments: [],
    description: item.title,
    id: `tag:${item.content_type}:${item.post_id}`,
    isFeatured: false,
    isLiked: false,
    isSaved: false,
    likeCount: 0,
    tag: { icon: "pricetag-outline", label: "Taggato" },
    taggedRef: { contentType: item.content_type, postId: item.post_id },
    thumbnailUrl: item.thumbnail_url ?? "",
    type: "image",
  };
}

/**
 * Fetch content where `profileId` is tagged (active tags only).
 * Returns an empty array while loading or if profileId is falsy.
 */
export function useTaggedContent(profileId: string | null | undefined) {
  const { data, isLoading } = useQuery({
    enabled: !!profileId,
    queryFn: () => fetchTaggedContentForProfile(profileId ?? undefined),
    queryKey: ["tagged-content", profileId],
  });

  // Only surface content types the detail route (app/content/[type]/[id].tsx)
  // can render. fan_tribuna has no detail fetcher yet, so its tagged items are
  // omitted to avoid a dead "Contenuto non disponibile" deep link.
  const taggedItems: MediaContentItem[] = (data ?? [])
    .filter((item) => item.content_type !== "fan_tribuna")
    .map(mapTaggedItemToMediaItem);

  return { isLoading, taggedItems };
}

/**
 * Convenience hook for profile Media tabs: returns the tagged items to merge
 * into the grid plus an `onOpenTaggedItem` handler that deep-links to the
 * content detail route.
 */
export function useTaggedMediaItems(profileId: string | null | undefined) {
  const router = useRouter();
  const { isLoading, taggedItems } = useTaggedContent(profileId);

  const onOpenTaggedItem = useCallback(
    (ref: { contentType: string; postId: string }) => {
      router.push(`/content/${ref.contentType}/${ref.postId}` as never);
    },
    [router],
  );

  return { isLoading, onOpenTaggedItem, taggedItems };
}
