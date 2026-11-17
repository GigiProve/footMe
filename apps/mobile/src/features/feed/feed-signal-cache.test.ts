/**
 * Cache del Feed dopo Segnala e Non seguire: rimozione del contenuto canonico anche dai Simple
 * Repost, ritocco di `isFollowingAuthor`, uscita della fonte da Seguiti, filtro di lettura per
 * le pagine successive (HOM-11 §62–§65, §125, §143, §169, §171–§172, §252, §283–§284, §292–§293).
 */
import type { InfiniteData } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { makeArticleItem, makePositionItem, makePostItem, makeSuggestedProfilesItem } from "./components/feed-test-helpers";
import {
  authorSourceOfItem,
  canonicalTargetOf,
  filterViewerSignals,
  followSourceOfItem,
  forgetDeletedContent,
  isCanonicalTarget,
  patchAuthorFollowing,
  removeCanonicalContent,
  removeSourceItems,
} from "./feed-signal-cache";
import type { FeedItem, FeedPage, FeedPageParam, FeedRepostContext } from "./feed-types";

type FeedData = InfiniteData<FeedPage, FeedPageParam>;

function page(items: FeedItem[], pageIndex = 0): FeedPage {
  return { asOf: "2026-11-15T10:00:00.000Z", isLastPage: false, items, nextCursor: null, pageIndex };
}

function data(...pages: FeedItem[][]): FeedData {
  return {
    pageParams: pages.map((_, index) => ({ cursor: null, pageIndex: index })),
    pages: pages.map((items, index) => page(items, index)),
  };
}

const COMO = { id: "club-1", kind: "club" as const };

function post(id: string, authorId = "club-1", overrides: Partial<FeedItem> = {}): FeedItem {
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
      ...overrides,
    } as never,
    { postId: id },
  );
}

function repostOf(item: FeedItem, reposterId: string, reposterType = "person"): FeedItem {
  const repost: FeedRepostContext = {
    additionalCount: 0,
    reposter: { avatarUrl: null, identityId: reposterId, identityType: reposterType, isVerified: false, name: "Reposter" },
  };
  // HOM-10 §73: l'elemento resta l'originale ma ha `id = repost:<tipo>:<id>`.
  return { ...item, id: `repost:${item.id}`, repost } as FeedItem;
}

const ids = (feed: FeedData | undefined) => feed?.pages.flatMap((entry) => entry.items.map((item) => item.id));

describe("contenuto canonico — D4, §143", () => {
  it("il target di un elemento è tipo + postId del payload, mai item.id", () => {
    const wrapper = repostOf(post("p1"), "p-9");

    expect(canonicalTargetOf(wrapper)).toEqual({ contentId: "p1", contentType: "club_media" });
    expect(isCanonicalTarget(wrapper, "club_media", "p1")).toBe(true);
    expect(isCanonicalTarget(wrapper, "media_profile", "p1")).toBe(false);
  });

  it("moduli discovery e posizioni non hanno un contenuto canonico", () => {
    expect(canonicalTargetOf(makeSuggestedProfilesItem())).toBeNull();
    expect(canonicalTargetOf(makePositionItem())).toBeNull();
  });
});

describe("removeCanonicalContent — §125, §171, §293", () => {
  it("toglie il contenuto segnalato da tutte le pagine", () => {
    const feed = data([post("p1"), post("p2")], [post("p3")]);

    expect(ids(removeCanonicalContent(feed, "club_media", "p2"))).toEqual(["club_media:p1", "club_media:p3"]);
  });

  it("D3: toglie anche i Simple Repost dell'originale segnalato", () => {
    const original = post("p1");
    const feed = data([repostOf(original, "p-9"), post("p2")]);

    expect(ids(removeCanonicalContent(feed, "club_media", "p1"))).toEqual(["club_media:p2"]);
  });

  it("un contenuto che non c'è lascia la stessa identità: nessun render a vuoto", () => {
    const feed = data([post("p1")]);

    expect(removeCanonicalContent(feed, "club_media", "p9")).toBe(feed);
    expect(removeCanonicalContent(undefined, "club_media", "p1")).toBeUndefined();
  });

  it("un Post HOM-10 con reference è un Post autonomo: segnalarlo non toglie l'originale incorporato (§148)", () => {
    const wrapperPost = post("p2");
    const feed = data([wrapperPost, post("orig")]);

    expect(ids(removeCanonicalContent(feed, "club_media", "p2"))).toEqual(["club_media:orig"]);
  });
});

describe("forgetDeletedContent — HOM-15 §118, §182–§183, §341", () => {
  function quoteOf(id: string, contentId: string): FeedItem {
    const item = post(id);
    return item.type === "post"
      ? {
          ...item,
          payload: {
            ...item.payload,
            reference: { available: true, contentId, contentType: "club_media", snapshot: { title: "Originale" } },
          },
        }
      : item;
  }

  it("toglie l'originale eliminato e i suoi Simple Repost da tutte le pagine", () => {
    const original = post("p1");
    const feed = data([original, post("p2")], [repostOf(original, "p-9")]);

    expect(ids(forgetDeletedContent(feed, "club_media", "p1"))).toEqual(["club_media:p2"]);
  });

  it("il Post con testo che lo incorpora resta, con la reference «non disponibile»", () => {
    const feed = data([quoteOf("q1", "p1"), post("p1")]);

    const next = forgetDeletedContent(feed, "club_media", "p1");

    expect(ids(next)).toEqual(["club_media:q1"]);
    const quote = next?.pages[0].items[0];
    expect(quote?.type === "post" ? quote.payload.reference : undefined).toEqual({
      available: false,
      contentId: "p1",
      contentType: "club_media",
      snapshot: null,
    });
  });

  it("nulla da cambiare: stessa identità, anche delle pagine non toccate", () => {
    const feed = data([post("p1")], [quoteOf("q1", "p7")]);

    expect(forgetDeletedContent(feed, "club_media", "p9")).toBe(feed);
    expect(forgetDeletedContent(undefined, "club_media", "p1")).toBeUndefined();

    const next = forgetDeletedContent(feed, "club_media", "p1");
    expect(next?.pages[1]).toBe(feed.pages[1]);
  });
});

describe("fonte di un elemento — §145, §284", () => {
  it("Simple Repost: il reposter, con il tipo di tabella giusto", () => {
    expect(followSourceOfItem(repostOf(post("p1"), "p-9", "person"))).toEqual({
      id: "p-9",
      kind: "profile",
      name: "Reposter",
    });
    expect(followSourceOfItem(repostOf(post("p1"), "club-7", "society"))).toMatchObject({
      id: "club-7",
      kind: "club",
    });
  });

  it("elemento normale: l'autore del contenuto", () => {
    expect(followSourceOfItem(post("p1", "club-1"))).toMatchObject({ id: "club-1", kind: "club" });
  });

  it("l'autore resta l'autore dell'originale anche per un wrapper", () => {
    expect(authorSourceOfItem(repostOf(post("p1", "club-1"), "p-9"))).toMatchObject({ id: "club-1", kind: "club" });
  });

  it("moduli e posizioni non hanno fonte", () => {
    expect(followSourceOfItem(makeSuggestedProfilesItem())).toBeNull();
    expect(followSourceOfItem(makePositionItem())).toBeNull();
  });
});

describe("patchAuthorFollowing — §62, §63, §172", () => {
  it("scrive isFollowingAuthor su ogni elemento di quell'autore e lascia identici gli altri", () => {
    const mine = post("p1", "club-1", { isFollowingAuthor: true });
    const other = post("p2", "p-5", { isFollowingAuthor: true });
    const feed = data([mine, other]);

    const next = patchAuthorFollowing(feed, COMO, false);

    expect(next?.pages[0].items[0].isFollowingAuthor).toBe(false);
    expect(next?.pages[0].items[1]).toBe(other);
  });

  it("Per te mantiene l'elemento (§63): cambia solo il flag", () => {
    const feed = data([post("p1", "club-1", { isFollowingAuthor: true })]);

    expect(ids(patchAuthorFollowing(feed, COMO, false))).toEqual(["club_media:p1"]);
  });

  it("nessun elemento da toccare: stessa identità", () => {
    const feed = data([post("p1", "club-1", { isFollowingAuthor: false })]);

    expect(patchAuthorFollowing(feed, COMO, false)).toBe(feed);
    expect(patchAuthorFollowing(undefined, COMO, false)).toBeUndefined();
  });

  it("lo stesso id in due tabelle non si confonde (club vs profilo)", () => {
    const profile = post("p1", "p-1", { isFollowingAuthor: true });
    const feed = data([profile]);

    expect(patchAuthorFollowing(feed, { id: "p-1", kind: "club" }, false)).toBe(feed);
  });

  it("Annulla rimette il flag", () => {
    const feed = data([post("p1", "club-1", { isFollowingAuthor: false })]);

    expect(patchAuthorFollowing(feed, COMO, true)?.pages[0].items[0].isFollowingAuthor).toBe(true);
  });
});

describe("removeSourceItems — §64, §145, §252", () => {
  it("Seguiti: la fonte lasciata esce dalle pagine in cache", () => {
    const feed = data([post("p1", "club-1"), post("p2", "p-5")], [post("p3", "club-1")]);

    expect(ids(removeSourceItems(feed, COMO))).toEqual(["club_media:p2"]);
  });

  it("un Simple Repost si toglie per il REPOSTER, non per l'autore dell'originale", () => {
    const wrapper = repostOf(post("p1", "club-1"), "p-9");
    const feed = data([wrapper]);

    // Lasciare l'autore dell'originale NON toglie il wrapper di un reposter ancora seguito.
    expect(removeSourceItems(feed, COMO)).toBe(feed);
    // Lasciare il reposter lo toglie.
    expect(ids(removeSourceItems(feed, { id: "p-9", kind: "profile" }))).toEqual([]);
  });

  it("nessun elemento della fonte: stessa identità", () => {
    const feed = data([post("p2", "p-5")]);

    expect(removeSourceItems(feed, COMO)).toBe(feed);
    expect(removeSourceItems(undefined, COMO)).toBeUndefined();
  });

  it("i moduli discovery non si toccano", () => {
    const discovery = makeSuggestedProfilesItem();
    const feed = data([post("p1", "club-1"), discovery]);

    expect(removeSourceItems(feed, COMO)?.pages[0].items).toEqual([discovery]);
  });
});

describe("filterViewerSignals — §65, §125, §169, §171, §292–§293", () => {
  const signals = {
    isReported: (contentType: string, contentId: string) => contentType === "club_media" && contentId === "p-reported",
  };

  it("segnalato in sessione: fuori, anche se la pagina in cache non lo sa", () => {
    const items = [post("p1"), post("p-reported"), post("p2")];

    expect(filterViewerSignals(items, signals).map((item) => item.id)).toEqual(["club_media:p1", "club_media:p2"]);
  });

  it("segnalato nel payload del server (viewer_has_reported): fuori", () => {
    const items = [post("p1", "club-1", { viewerHasReported: true }), post("p2")];

    expect(filterViewerSignals(items, signals).map((item) => item.id)).toEqual(["club_media:p2"]);
  });

  it("D3: i Simple Repost dell'originale segnalato escono", () => {
    const items = [repostOf(post("p-reported"), "p-9"), post("p2")];

    expect(filterViewerSignals(items, signals).map((item) => item.id)).toEqual(["club_media:p2"]);
  });

  it("Seguiti: le pagine successive non reintroducono la fonte lasciata (§65)", () => {
    const items = [post("p1", "club-1"), post("p2", "p-5")];
    const unfollowed = (source: { id: string }) => source.id === "club-1";

    expect(
      filterViewerSignals(items, { ...signals, isUnfollowed: unfollowed }).map((item) => item.id),
    ).toEqual(["club_media:p2"]);
  });

  it("Per te (nessun isUnfollowed): il contenuto resta visibile dopo Non seguire (§63)", () => {
    const items = [post("p1", "club-1")];

    expect(filterViewerSignals(items, signals)).toHaveLength(1);
  });

  it("moduli, posizioni e articoli non segnalati passano intatti", () => {
    const items = [makeSuggestedProfilesItem(), makePositionItem(), makeArticleItem()];

    expect(filterViewerSignals(items, signals)).toHaveLength(3);
  });

  it("nessun elemento viene scartato per altro motivo: nessun segnale, stessa lista", () => {
    const items = [post("p1"), post("p2")];

    expect(filterViewerSignals(items, { isReported: () => false })).toEqual(items);
  });
});
