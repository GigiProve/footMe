/**
 * Il cablaggio REALE della cache dopo «Non seguire», con un QueryClient vero e le due tab in
 * cache: Per te mantiene il contenuto (§63), Seguiti perde la fonte (§64), Annulla riporta le
 * cose com'erano (§61), la lista Mi piace si invalida (§62). HOM-11 §62–§65, §172, §251–§252.
 */
import { QueryClient, type InfiniteData } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FEED_QK } from "../feed/feed-keys";
import { makePostItem } from "../feed/components/feed-test-helpers";
import type { FeedItem, FeedPage, FeedPageParam } from "../feed/feed-types";
import { LIKES_QK } from "../likes/likes-keys";
import { createFollowFeedCache } from "./use-unfollow-from-content";

vi.mock("../../lib/supabase", () => ({ supabase: { rpc: vi.fn() } }));
vi.mock("../../ui", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("../auth/use-session", () => ({ useSession: () => ({ profile: { id: "viewer-1" } }) }));

type FeedData = InfiniteData<FeedPage, FeedPageParam>;

const VIEWER = "viewer-1";
const COMO = { id: "club-1", kind: "club" as const, name: "Como 1907" };

function post(id: string, authorId: string): FeedItem {
  return makePostItem(
    {
      author: {
        avatarUrl: null,
        id: authorId,
        isVerified: false,
        kind: authorId.startsWith("club") ? "club" : "profile",
        name: authorId,
        sourceKind: null,
      },
      id: `club_media:${id}`,
      isFollowingAuthor: true,
    } as never,
    { postId: id },
  );
}

function data(...pages: FeedItem[][]): FeedData {
  return {
    pageParams: pages.map((_, index) => ({ cursor: null, pageIndex: index })),
    pages: pages.map((items, index) => ({
      asOf: "2026-11-15T10:00:00.000Z",
      isLastPage: false,
      items,
      nextCursor: null,
      pageIndex: index,
    })),
  };
}

const ids = (feed: FeedData | undefined) => feed?.pages.flatMap((page) => page.items.map((item) => item.id));

let client: QueryClient;

beforeEach(() => {
  client = new QueryClient();
  // Lo stesso contenuto di Como e uno di un altro autore, in ENTRAMBE le tab.
  client.setQueryData(FEED_QK.feed("per_te", VIEWER), data([post("p1", "club-1"), post("p2", "p-5")]));
  client.setQueryData(FEED_QK.feed("seguiti", VIEWER), data([post("s1", "club-1"), post("s2", "p-5")]));
});

describe("applyUnfollow — regola per tab", () => {
  it("Per te: il contenuto della fonte RESTA, cambia solo isFollowingAuthor (§63, §251)", () => {
    createFollowFeedCache(client, VIEWER).applyUnfollow(COMO);

    const perTe = client.getQueryData<FeedData>(FEED_QK.feed("per_te", VIEWER));
    expect(ids(perTe)).toEqual(["club_media:p1", "club_media:p2"]);
    expect(perTe?.pages[0].items[0].isFollowingAuthor).toBe(false);
    // L'altro autore non cambia.
    expect(perTe?.pages[0].items[1].isFollowingAuthor).toBe(true);
  });

  it("Seguiti: gli elementi della fonte escono dalle pagine in cache (§64, §252)", () => {
    createFollowFeedCache(client, VIEWER).applyUnfollow(COMO);

    expect(ids(client.getQueryData<FeedData>(FEED_QK.feed("seguiti", VIEWER)))).toEqual(["club_media:s2"]);
  });

  it("ritorna le due pagine com'erano, per il rollback e per Annulla", () => {
    const before = {
      per_te: client.getQueryData<FeedData>(FEED_QK.feed("per_te", VIEWER)),
      seguiti: client.getQueryData<FeedData>(FEED_QK.feed("seguiti", VIEWER)),
    };

    const snapshots = createFollowFeedCache(client, VIEWER).applyUnfollow(COMO);

    expect(snapshots).toEqual(before);
  });

  it("senza una tab in cache non solleva e non ne crea una", () => {
    const empty = new QueryClient();

    expect(() => createFollowFeedCache(empty, VIEWER).applyUnfollow(COMO)).not.toThrow();
    expect(empty.getQueryData(FEED_QK.feed("per_te", VIEWER))).toBeUndefined();
  });
});

describe("restoreFollow — Annulla (§61, §250)", () => {
  it("Seguiti: senza pagine nuove torna la cache com'era, elementi della fonte compresi", () => {
    const cache = createFollowFeedCache(client, VIEWER);
    const snapshots = cache.applyUnfollow(COMO);

    cache.restoreFollow(COMO, snapshots);

    expect(ids(client.getQueryData<FeedData>(FEED_QK.feed("seguiti", VIEWER)))).toEqual([
      "club_media:s1",
      "club_media:s2",
    ]);
    const perTe = client.getQueryData<FeedData>(FEED_QK.feed("per_te", VIEWER));
    expect(perTe?.pages[0].items[0].isFollowingAuthor).toBe(true);
  });

  it("Seguiti con pagine nuove nel frattempo: non si sovrascrive; la lista si marca da rileggere", () => {
    const cache = createFollowFeedCache(client, VIEWER);
    const snapshots = cache.applyUnfollow(COMO);
    const seguitiKey = FEED_QK.feed("seguiti", VIEWER);
    const loaded = client.getQueryData<FeedData>(seguitiKey) as FeedData;
    client.setQueryData(seguitiKey, data(loaded.pages[0].items, [post("s9", "p-7")]));
    const invalidate = vi.spyOn(client, "invalidateQueries");

    cache.restoreFollow(COMO, snapshots);

    // La pagina nuova resta; gli elementi della fonte tornano al prossimo refresh.
    expect(ids(client.getQueryData<FeedData>(seguitiKey))).toEqual(["club_media:s2", "club_media:s9"]);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: seguitiKey, refetchType: "none" });
  });

  it("Per te non viene mai sostituita da uno snapshot: nessun elemento era uscito", () => {
    const cache = createFollowFeedCache(client, VIEWER);
    const snapshots = cache.applyUnfollow(COMO);
    const perTeKey = FEED_QK.feed("per_te", VIEWER);
    const loaded = client.getQueryData<FeedData>(perTeKey) as FeedData;
    // Una pagina nuova di Per te arrivata nel frattempo sopravvive all'Annulla.
    client.setQueryData(perTeKey, data(loaded.pages[0].items, [post("p9", "p-7")]));

    cache.restoreFollow(COMO, snapshots);

    expect(ids(client.getQueryData<FeedData>(perTeKey))).toEqual(["club_media:p1", "club_media:p2", "club_media:p9"]);
  });
});

describe("invalidateFollowQueries — §62, §172, §294", () => {
  it("contatori, Seguiti, flag Società, suggerimenti e lista Mi piace", () => {
    const invalidate = vi.spyOn(client, "invalidateQueries");

    createFollowFeedCache(client, VIEWER).invalidateFollowQueries({ following: false, source: COMO });

    const keys = invalidate.mock.calls.map((call) => call[0]?.queryKey);
    expect(keys).toContainEqual(["following-count"]);
    expect(keys).toContainEqual(["followed"]);
    expect(keys).toContainEqual(["followed-club-flags", VIEWER]);
    expect(keys).toContainEqual(FEED_QK.followingState(VIEWER));
    // Una qualunque lista Mi piace rientra nel prefisso invalidato.
    const likes = LIKES_QK.list("profile_post", "p1", VIEWER);
    expect(keys.some((key) => key && key[0] === likes[0])).toBe(true);
  });
});
