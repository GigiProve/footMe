import { describe, expect, it } from "vitest";

import { makePostPayload } from "./feed-post-fixtures";
import type { FeedItem, FeedPage } from "./feed-types";
import { createLikeTracker, nextLikeState, patchPostLike } from "./use-feed-post-like";

function post(id: string, likesCount = 3): FeedItem {
  return {
    id,
    type: "post",
    rank: 1,
    version: 1,
    layoutHint: "standard",
    publishedAt: null,
    author: null,
    reasonKey: null,
    reasonLabel: null,
    isSeen: false,
    isSaved: false,
    isFollowingAuthor: false,
    nav: null,
    title: null,
    payload: makePostPayload({ likesCount, postId: id }),
  };
}

function data(items: FeedItem[]) {
  const page: FeedPage = { asOf: "x", isLastPage: true, items, nextCursor: null, pageIndex: 0 };
  return { pageParams: [{ cursor: null, pageIndex: 0 }], pages: [page] };
}

describe("nextLikeState", () => {
  it("aggiunge e toglie un Mi piace senza scendere sotto zero", () => {
    expect(nextLikeState({ isLiked: false, likesCount: 146 })).toEqual({ isLiked: true, likesCount: 147 });
    expect(nextLikeState({ isLiked: true, likesCount: 147 })).toEqual({ isLiked: false, likesCount: 146 });
    expect(nextLikeState({ isLiked: true, likesCount: 0 })).toEqual({ isLiked: false, likesCount: 0 });
  });
});

describe("patchPostLike", () => {
  it("modifica solo il Post indicato e lascia identici gli altri", () => {
    const other = post("b");
    const patched = patchPostLike(data([post("a"), other]), "a", { isLiked: true, likesCount: 4 });
    const [first, second] = patched!.pages[0].items;

    expect(first.type === "post" ? first.payload : null).toMatchObject({ isLiked: true, likesCount: 4 });
    expect(second).toBe(other);
  });

  it("non tocca una cache vuota", () => {
    expect(patchPostLike(undefined, "a", { isLiked: true, likesCount: 1 })).toBeUndefined();
  });
});

describe("createLikeTracker", () => {
  const unliked = { isLiked: false, likesCount: 146 };
  const liked = { isLiked: true, likesCount: 147 };

  it("con una sola richiesta scrive la risposta del server", () => {
    const tracker = createLikeTracker();
    tracker.begin("a", unliked);

    expect(tracker.settle("a", liked)).toEqual(liked);
  });

  it("Mi piace e subito 'togli': la prima risposta non fa rimbalzare la UI", () => {
    const tracker = createLikeTracker();
    tracker.begin("a", unliked);
    tracker.begin("a", liked);

    expect(tracker.settle("a", liked)).toBeNull();
    expect(tracker.settle("a", unliked)).toEqual(unliked);
  });

  it("due tap offline tornano allo stato di prima del primo tap", () => {
    const tracker = createLikeTracker();
    tracker.begin("a", unliked);
    tracker.begin("a", liked);

    expect(tracker.settle("a", null)).toBeNull();
    expect(tracker.settle("a", null)).toEqual(unliked);
  });

  it("se l'ultima fallisce resta l'ultimo stato confermato", () => {
    const tracker = createLikeTracker();
    tracker.begin("a", unliked);
    tracker.begin("a", liked);

    expect(tracker.settle("a", liked)).toBeNull();
    expect(tracker.settle("a", null)).toEqual(liked);
  });

  it("tiene separati Post diversi", () => {
    const tracker = createLikeTracker();
    tracker.begin("a", unliked);
    tracker.begin("b", unliked);

    expect(tracker.settle("a", liked)).toEqual(liked);
    expect(tracker.settle("b", null)).toEqual(unliked);
  });
});
