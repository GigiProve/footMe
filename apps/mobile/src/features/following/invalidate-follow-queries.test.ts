/**
 * La lista unica del Follow (HOM-15 §175, §179): ogni superficie che cambia un Follow
 * invalida le stesse chiavi, il Feed si ritocca senza refetch, Cerca converge.
 */
import { QueryClient, type InfiniteData } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makePostItem } from "../feed/components/feed-test-helpers";
import { FEED_QK } from "../feed/feed-keys";
import type { FeedItem, FeedPage, FeedPageParam } from "../feed/feed-types";
import { LIKES_ROOT_KEY } from "../likes/likes-keys";
import { invalidateFollowQueries } from "./invalidate-follow-queries";
import { createUnfollowedSourcesStore } from "./unfollowed-sources-store";

type FeedData = InfiniteData<FeedPage, FeedPageParam>;

const VIEWER = "viewer-1";
const MARCO = { id: "p-9", kind: "profile" as const };

function post(id: string, authorId: string, isFollowingAuthor: boolean): FeedItem {
  return makePostItem(
    {
      author: { avatarUrl: null, id: authorId, isVerified: false, kind: "profile", name: authorId, sourceKind: null },
      id: `club_media:${id}`,
      isFollowingAuthor,
    } as never,
    { postId: id },
  );
}

function data(items: FeedItem[]): FeedData {
  return {
    pageParams: [{ cursor: null, pageIndex: 0 }],
    pages: [{ asOf: "2026-11-17T10:00:00.000Z", isLastPage: false, items, nextCursor: null, pageIndex: 0 }],
  };
}

let client: QueryClient;

beforeEach(() => {
  client = new QueryClient();
});

describe("invalidateFollowQueries — HOM-15 §179", () => {
  it("invalida contatori, Seguiti, flag Società, stato Feed, suggerimenti, Mi piace e tutte le query search-*", () => {
    const invalidate = vi.spyOn(client, "invalidateQueries");

    invalidateFollowQueries(client, VIEWER);

    const keys = invalidate.mock.calls.map((call) => call[0]?.queryKey);
    expect(keys).toContainEqual(["following-count"]);
    expect(keys).toContainEqual(["followed"]);
    expect(keys).toContainEqual(["followed-club-flags", VIEWER]);
    expect(keys).toContainEqual(FEED_QK.followingState(VIEWER));
    expect(keys).toContainEqual(FEED_QK.suggestedProfiles(VIEWER));
    expect(keys).toContainEqual(FEED_QK.suggestedClubs(VIEWER));
    expect(keys).toContainEqual([LIKES_ROOT_KEY]);

    const predicate = invalidate.mock.calls.find((call) => call[0]?.predicate)?.[0]?.predicate;
    const query = (queryKey: unknown[]) => ({ queryKey }) as never;
    expect(predicate?.(query(["search-media-sources", "x"]))).toBe(true);
    expect(predicate?.(query(["search-clubs", "all"]))).toBe(true);
    expect(predicate?.(query(["saved-items"]))).toBe(false);
  });

  it("il Feed si marca stale senza refetch: niente salto di sessione o di scroll (HOM-13 §227)", () => {
    const invalidate = vi.spyOn(client, "invalidateQueries");

    invalidateFollowQueries(client, VIEWER);

    expect(invalidate).toHaveBeenCalledWith({ queryKey: FEED_QK.feed("per_te", VIEWER), refetchType: "none" });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: FEED_QK.feed("seguiti", VIEWER), refetchType: "none" });
  });

  it("con il cambio confermato ritocca isFollowingAuthor su entrambe le tab, solo per quell'autore", () => {
    client.setQueryData(FEED_QK.feed("per_te", VIEWER), data([post("a", "p-9", false), post("b", "p-5", false)]));
    client.setQueryData(FEED_QK.feed("seguiti", VIEWER), data([post("c", "p-9", false)]));

    invalidateFollowQueries(client, VIEWER, { following: true, source: MARCO }, createUnfollowedSourcesStore());

    const flags = (scope: "per_te" | "seguiti") =>
      client.getQueryData<FeedData>(FEED_QK.feed(scope, VIEWER))?.pages[0].items.map((item) => item.isFollowingAuthor);
    expect(flags("per_te")).toEqual([true, false]);
    expect(flags("seguiti")).toEqual([true]);
  });

  it("un Follow confermato toglie la fonte dall'insieme di sessione di «Non seguire» (§173)", () => {
    const store = createUnfollowedSourcesStore();
    store.add("profile:p-9");
    store.settle("profile:p-9", 1);

    invalidateFollowQueries(client, VIEWER, { following: false, source: MARCO }, store);
    expect(store.has("profile:p-9")).toBe(true);

    invalidateFollowQueries(client, VIEWER, { following: true, source: MARCO }, store);
    expect(store.has("profile:p-9")).toBe(false);
  });
});
