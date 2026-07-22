import { useCallback } from "react";
import { useRouter } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";

import {
  TAGGED_CONTENT_PAGE_SIZE,
  fetchTaggedContentForProfile,
  fetchTaggedContentForTarget,
  type TaggedContentItem,
  type TargetType,
} from "./content-tag-service";
import type { MediaContentItem } from "../profiles/career/MediaTabContent";

/**
 * Shared shape returned by the paginated tagged-content hooks: the flattened,
 * grid-ready items plus load-more controls. `loadMore` is a no-op while another
 * page is in flight or when there is nothing more to fetch.
 */
type TaggedContentResult = {
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  loadMore: () => void;
  taggedItems: MediaContentItem[];
};

/**
 * getNextPageParam for offset pagination: when the last page filled the page
 * size there may be more, and the next offset is the total fetched so far.
 */
function nextOffset(lastPage: TaggedContentItem[], allPages: TaggedContentItem[][]) {
  if (lastPage.length < TAGGED_CONTENT_PAGE_SIZE) {
    return undefined;
  }

  return allPages.reduce((total, page) => total + page.length, 0);
}

/** Icon used for the generated cover of an image-less tagged item. */
function coverIconForItem(item: TaggedContentItem): MediaContentItem["coverIcon"] {
  if (item.content_type !== "fan_tribuna") {
    return "pricetag-outline";
  }

  switch (item.kind) {
    case "poll":
      return "stats-chart-outline";
    case "formation":
      return "football-outline";
    case "photo":
      return "videocam-outline";
    case "opinion":
      return "chatbubble-ellipses-outline";
    case "proposal":
      return "bulb-outline";
    default:
      return "pricetag-outline";
  }
}

/**
 * Maps a tagged content item (from the RPC) to a MediaContentItem suitable
 * for rendering in MediaTabContent. Tagged items open the content detail route
 * instead of the local viewer, which is signalled by the `taggedRef` field.
 * Image-less kinds (poll/formation/opinion) carry a `coverIcon` so the grid
 * renders a generated cover with a content-type icon.
 */
export function mapTaggedItemToMediaItem(item: TaggedContentItem): MediaContentItem {
  const coverIcon = coverIconForItem(item);

  return {
    commentCount: 0,
    comments: [],
    coverIcon,
    description: item.title,
    id: `tag:${item.content_type}:${item.post_id}`,
    isFeatured: false,
    isLiked: false,
    isSaved: false,
    likeCount: 0,
    tag: { icon: coverIcon ?? "pricetag-outline", label: "Taggato" },
    taggedRef: { contentType: item.content_type, postId: item.post_id },
    thumbnailUrl: item.thumbnail_url ?? "",
    type: "image",
  };
}

/**
 * Fetch content where `profileId` is tagged (active tags only) and map it to
 * grid items. fan_tribuna content now has a detail route, so it is included.
 * Paginated: the first page loads automatically, `loadMore` fetches the next.
 */
export function useTaggedContent(
  profileId: string | null | undefined,
): TaggedContentResult {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    enabled: !!profileId,
    getNextPageParam: nextOffset,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      fetchTaggedContentForProfile(profileId ?? undefined, {
        limit: TAGGED_CONTENT_PAGE_SIZE,
        offset: pageParam,
      }),
    queryKey: ["tagged-content", profileId],
  });

  const taggedItems: MediaContentItem[] = (data?.pages ?? [])
    .flat()
    .map(mapTaggedItemToMediaItem);

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return {
    hasMore: !!hasNextPage,
    isLoading,
    isLoadingMore: isFetchingNextPage,
    loadMore,
    taggedItems,
  };
}

/**
 * Fetch content tagged to a club or internal team (active tags only) for their
 * public Media tab. These are tagged contributions, not content the club published.
 * Paginated: the first page loads automatically, `loadMore` fetches the next.
 */
export function useTaggedContentForTarget(
  targetType: Extract<TargetType, "club" | "team">,
  targetId: string | null | undefined,
): TaggedContentResult {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    enabled: !!targetId,
    getNextPageParam: nextOffset,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      fetchTaggedContentForTarget(targetType, targetId as string, {
        limit: TAGGED_CONTENT_PAGE_SIZE,
        offset: pageParam,
      }),
    queryKey: ["tagged-content-target", targetType, targetId],
  });

  const taggedItems: MediaContentItem[] = (data?.pages ?? [])
    .flat()
    .map(mapTaggedItemToMediaItem);

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return {
    hasMore: !!hasNextPage,
    isLoading,
    isLoadingMore: isFetchingNextPage,
    loadMore,
    taggedItems,
  };
}

function useOpenTaggedItem() {
  const router = useRouter();

  return useCallback(
    (ref: { contentType: string; postId: string }) => {
      router.push(`/content/${ref.contentType}/${ref.postId}` as never);
    },
    [router],
  );
}

/**
 * Convenience hook for profile Media tabs: returns the tagged items to merge
 * into the grid plus an `onOpenTaggedItem` handler that deep-links to the
 * content detail route, and the load-more controls.
 */
export function useTaggedMediaItems(profileId: string | null | undefined) {
  const { hasMore, isLoading, isLoadingMore, loadMore, taggedItems } =
    useTaggedContent(profileId);
  const onOpenTaggedItem = useOpenTaggedItem();

  return { hasMore, isLoading, isLoadingMore, loadMore, onOpenTaggedItem, taggedItems };
}

/** Convenience hook for club/team Media tabs. */
export function useTaggedMediaItemsForTarget(
  targetType: Extract<TargetType, "club" | "team">,
  targetId: string | null | undefined,
) {
  const { hasMore, isLoading, isLoadingMore, loadMore, taggedItems } =
    useTaggedContentForTarget(targetType, targetId);
  const onOpenTaggedItem = useOpenTaggedItem();

  return { hasMore, isLoading, isLoadingMore, loadMore, onOpenTaggedItem, taggedItems };
}
