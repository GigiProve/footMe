import { describe, expect, it } from "vitest";

import { mergeFeedPages } from "./feed-arrange";
import { makePostPayload } from "./feed-post-fixtures";
import type { FeedItem, FeedPage } from "./feed-types";

/**
 * HOM-13 §83, §94, §220: il client non riordina. Resta solo l'appiattimento con
 * dedup; l'invariante qui è che l'ordine ricevuto dal server si conserva byte per byte.
 */

let counter = 0;

function makePost(id: string, authorId = `author-${id}`): FeedItem {
  counter += 1;
  return {
    id,
    rank: counter,
    version: 1,
    layoutHint: "standard",
    publishedAt: "2026-07-31T10:00:00.000Z",
    reasonKey: null,
    reasonLabel: null,
    isSeen: false,
    isSaved: false,
    isFollowingAuthor: false,
    nav: null,
    type: "post",
    author: {
      kind: "profile",
      id: authorId,
      name: `Autore ${authorId}`,
      avatarUrl: null,
      sourceKind: null,
      isVerified: false,
    },
    title: `Post ${id}`,
    payload: makePostPayload({ postId: id, text: "Testo" }),
  };
}

function ids(items: readonly FeedItem[]): string[] {
  return items.map((item) => item.id);
}

function page(items: FeedItem[], pageIndex = 0): FeedPage {
  return {
    items,
    pageIndex,
    asOf: "2026-07-31T12:00:00.000Z",
    nextCursor: null,
    isLastPage: true,
  };
}

describe("mergeFeedPages", () => {
  it("appiattisce le pagine mantenendo l'ordine ricevuto", () => {
    const merged = mergeFeedPages([
      page([makePost("a"), makePost("b")], 0),
      page([makePost("c")], 1),
    ]);

    expect(ids(merged)).toEqual(["a", "b", "c"]);
  });

  it("non riordina nemmeno quando lo stesso autore compare di seguito (§220)", () => {
    const merged = mergeFeedPages([
      page([makePost("a1", "one"), makePost("a2", "one"), makePost("a3", "one")], 0),
      page([makePost("b1", "one"), makePost("c1", "two")], 1),
    ]);

    expect(ids(merged)).toEqual(["a1", "a2", "a3", "b1", "c1"]);
  });

  it("scarta gli id ripetuti tra pagine e vince la prima occorrenza (§98–§99)", () => {
    const first = makePost("dup");
    const second = makePost("dup");

    const merged = mergeFeedPages([page([first, makePost("a")], 0), page([second], 1)]);

    expect(ids(merged)).toEqual(["dup", "a"]);
    expect(merged[0]).toBe(first);
  });

  it("gestisce l'assenza di pagine", () => {
    expect(mergeFeedPages([])).toEqual([]);
  });
});
