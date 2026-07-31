import { describe, expect, it } from "vitest";

import {
  arrangeFeedItems,
  DEFAULT_ARRANGE_RULES,
  mergeFeedPages,
  prependNewItems,
} from "./feed-arrange";
import { isDiscoveryItem, type FeedItem, type FeedPage } from "./feed-types";

/**
 * Le regole del §8 sono l'unico posto del Feed dove un errore silenzioso
 * costerebbe caro: un elemento perso o duplicato non si nota guardando la
 * schermata. L'invariante più importante qui è la prima — l'output è una
 * permutazione dell'input — perché è quella che nessuna ispezione manuale
 * coglierebbe.
 */

let counter = 0;

function envelope(id: string) {
  counter += 1;
  return {
    id,
    rank: counter,
    version: 1,
    layoutHint: "standard" as const,
    publishedAt: "2026-07-31T10:00:00.000Z",
    reasonKey: null,
    reasonLabel: null,
    isSeen: false,
    isSaved: false,
    isFollowingAuthor: false,
    nav: null,
  };
}

function author(id: string) {
  return {
    kind: "profile" as const,
    id,
    name: `Autore ${id}`,
    avatarUrl: null,
    sourceKind: null,
    isVerified: false,
  };
}

function makePost(id: string, authorId = `author-${id}`): FeedItem {
  return {
    ...envelope(id),
    type: "post",
    author: author(authorId),
    title: `Post ${id}`,
    payload: {
      contentType: "club_media",
      postId: id,
      kindLabel: null,
      text: "Testo",
      isTruncated: false,
      imageUrl: null,
      mediaType: null,
    },
  };
}

function makePosition(id: string, clubId = `club-${id}`): FeedItem {
  return {
    ...envelope(id),
    type: "suggested_position",
    author: author(clubId),
    payload: {
      adId: id,
      clubId,
      clubName: "Club",
      clubLogoUrl: null,
      teamName: null,
      teamType: null,
      roleRequired: null,
      category: null,
      city: null,
      province: null,
      region: null,
      targetRole: "player",
      isSecondaryMatch: false,
    },
  };
}

function makeDiscovery(id: string): FeedItem {
  return {
    ...envelope(id),
    type: "suggested_profiles",
    author: null,
    payload: { moduleKey: "suggested_profiles", moduleLimit: 6 },
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

describe("arrangeFeedItems", () => {
  it("restituisce una permutazione dell'input: niente perso, niente duplicato", () => {
    const input = [
      makePost("a", "one"),
      makePost("b", "one"),
      makePost("c", "one"),
      makePosition("d"),
      makePosition("e"),
      makePosition("f"),
      makeDiscovery("g"),
      makeDiscovery("h"),
      makePost("i", "two"),
      makePost("j", "three"),
    ];

    const output = arrangeFeedItems(input);

    expect(output).toHaveLength(input.length);
    expect([...ids(output)].sort()).toEqual([...ids(input)].sort());
    expect(new Set(ids(output)).size).toBe(input.length);
  });

  it("non lascia mai tre posizioni consecutive quando ci sono alternative", () => {
    const input = [
      makePosition("p1"),
      makePosition("p2"),
      makePosition("p3"),
      makePosition("p4"),
      makePost("c1", "one"),
      makePost("c2", "two"),
      makePost("c3", "three"),
      makePost("c4", "four"),
    ];

    const output = arrangeFeedItems(input);

    let run = 0;
    for (const item of output) {
      run = item.type === "suggested_position" ? run + 1 : 0;
      expect(run).toBeLessThanOrEqual(DEFAULT_ARRANGE_RULES.maxConsecutivePositions);
    }
  });

  it("tiene i moduli discovery distanti almeno minGapBetweenDiscoveryModules", () => {
    const input = [
      makeDiscovery("d1"),
      makeDiscovery("d2"),
      makePost("c1", "one"),
      makePost("c2", "two"),
      makePost("c3", "three"),
      makePost("c4", "four"),
      makePost("c5", "five"),
      makePost("c6", "six"),
    ];

    const output = arrangeFeedItems(input);
    const positions = output
      .map((item, index) => (isDiscoveryItem(item) ? index : -1))
      .filter((index) => index >= 0);

    expect(positions).toHaveLength(2);
    expect(positions[1] - positions[0]).toBeGreaterThan(
      DEFAULT_ARRANGE_RULES.minGapBetweenDiscoveryModules,
    );
  });

  it("non lascia lo stesso autore più di due volte in una finestra di cinque", () => {
    const input = [
      makePost("a1", "dominante"),
      makePost("a2", "dominante"),
      makePost("a3", "dominante"),
      makePost("a4", "dominante"),
      makePost("b1", "altro-1"),
      makePost("b2", "altro-2"),
      makePost("b3", "altro-3"),
      makePost("b4", "altro-4"),
      makePost("b5", "altro-5"),
      makePost("b6", "altro-6"),
    ];

    const output = arrangeFeedItems(input);
    const window = DEFAULT_ARRANGE_RULES.authorWindow;

    for (let start = 0; start + window <= output.length; start += 1) {
      const slice = output.slice(start, start + window);
      const dominante = slice.filter((item) => item.author?.id === "dominante").length;
      expect(dominante).toBeLessThanOrEqual(
        DEFAULT_ARRANGE_RULES.maxItemsPerAuthorInWindow,
      );
    }
  });

  it("è idempotente: riordinare un output già ordinato non lo cambia", () => {
    const input = [
      makePost("a", "one"),
      makePost("b", "one"),
      makePost("c", "one"),
      makePosition("d"),
      makePosition("e"),
      makeDiscovery("f"),
      makePost("g", "two"),
      makeDiscovery("h"),
      makePost("i", "three"),
    ];

    const once = arrangeFeedItems(input);
    const twice = arrangeFeedItems(once);

    expect(ids(twice)).toEqual(ids(once));
  });

  it("con frozenCount conserva il prefisso già a schermo byte per byte", () => {
    const first = [makePost("p1", "one"), makePost("p2", "one"), makePosition("p3")];
    const second = [makePost("p4", "one"), makePosition("p5"), makeDiscovery("p6")];

    const arrangedFirst = arrangeFeedItems(first);
    const arrangedBoth = arrangeFeedItems([...arrangedFirst, ...second], {
      frozenCount: arrangedFirst.length,
    });

    expect(ids(arrangedBoth).slice(0, arrangedFirst.length)).toEqual(ids(arrangedFirst));
    expect(arrangedBoth).toHaveLength(first.length + second.length);
  });

  it("è deterministico a parità di input", () => {
    const build = () => [
      makePost("x1", "one"),
      makePosition("x2"),
      makeDiscovery("x3"),
      makePost("x4", "one"),
      makePost("x5", "one"),
    ];

    // Gli id sono gli stessi, cambia solo `rank` (assegnato dal contatore):
    // l'ordinamento non deve dipendere da quello.
    expect(ids(arrangeFeedItems(build()))).toEqual(ids(arrangeFeedItems(build())));
  });

  it("non scarta nulla nemmeno quando nessuna regola è soddisfacibile", () => {
    // Quattro posizioni dello stesso club e nient'altro: qualunque ordine viola
    // sia il limite di posizioni consecutive sia quello per autore.
    const input = [
      makePosition("s1", "solo"),
      makePosition("s2", "solo"),
      makePosition("s3", "solo"),
      makePosition("s4", "solo"),
    ];

    const output = arrangeFeedItems(input);

    expect([...ids(output)].sort()).toEqual([...ids(input)].sort());
  });
});

describe("mergeFeedPages", () => {
  it("appiattisce le pagine mantenendo l'ordine ricevuto", () => {
    const merged = mergeFeedPages([
      page([makePost("a"), makePost("b")], 0),
      page([makePost("c")], 1),
    ]);

    expect(ids(merged)).toEqual(["a", "b", "c"]);
  });

  it("scarta gli id ripetuti tra pagine e vince la prima occorrenza", () => {
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

describe("prependNewItems", () => {
  it("mette in testa i nuovi elementi senza duplicare i presenti", () => {
    const current = [makePost("a"), makePost("b")];
    const incoming = [makePost("z"), makePost("a")];

    const next = prependNewItems(current, incoming);

    expect(ids(next)).toEqual(["z", "a", "b"]);
    expect(new Set(ids(next)).size).toBe(3);
  });

  it("deduplica anche all'interno degli elementi in arrivo", () => {
    const next = prependNewItems([], [makePost("z"), makePost("z")]);

    expect(ids(next)).toEqual(["z"]);
  });
});
