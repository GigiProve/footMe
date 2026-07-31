import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it } from "vitest";

import {
  clearFeedCache,
  FEED_CACHE_ITEM_CAP,
  loadFeedCache,
  saveFeedCacheMeta,
  saveFeedCacheScope,
} from "./feed-cache";
import type { FeedItem } from "./feed-types";

const PROFILE = "profile-1";
const KEY = `@footme/feed/v1/${PROFILE}`;

function makePost(id: string): FeedItem {
  return {
    id,
    type: "post",
    rank: 1,
    version: 1,
    layoutHint: "standard",
    publishedAt: "2026-07-31T10:00:00.000Z",
    author: {
      kind: "profile",
      id: "author-1",
      name: "Autore",
      avatarUrl: null,
      sourceKind: null,
      isVerified: false,
    },
    reasonKey: null,
    reasonLabel: null,
    isSeen: false,
    isSaved: false,
    isFollowingAuthor: false,
    nav: null,
    title: "Titolo",
    payload: {
      contentType: "club_media",
      postId: id,
      kindLabel: null,
      text: null,
      isTruncated: false,
      imageUrl: null,
      mediaType: null,
    },
  };
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("loadFeedCache", () => {
  it("restituisce null quando non c'è nulla in cache", async () => {
    expect(await loadFeedCache(PROFILE)).toBeNull();
  });

  it("restituisce null su JSON corrotto invece di sollevare", async () => {
    await AsyncStorage.setItem(KEY, "{non-json");

    expect(await loadFeedCache(PROFILE)).toBeNull();
  });

  it("restituisce null su una versione di record sconosciuta", async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ version: 99 }));

    expect(await loadFeedCache(PROFILE)).toBeNull();
  });

  it("scarta gli elementi con un tipo che questo client non conosce", async () => {
    await saveFeedCacheScope(PROFILE, "per_te", { items: [makePost("a")] });

    const raw = JSON.parse((await AsyncStorage.getItem(KEY)) as string);
    raw.scopes.per_te.items.push({
      id: "futuro",
      type: "tipo_dal_futuro",
      rank: 2,
      payload: {},
    });
    await AsyncStorage.setItem(KEY, JSON.stringify(raw));

    const cache = await loadFeedCache(PROFILE);

    expect(cache?.scopes.per_te.items.map((item) => item.id)).toEqual(["a"]);
  });
});

describe("saveFeedCacheScope", () => {
  it("fa il round-trip degli elementi", async () => {
    await saveFeedCacheScope(PROFILE, "per_te", {
      items: [makePost("a"), makePost("b")],
      pageCount: 2,
      updatedAt: new Date().toISOString(),
    });

    const cache = await loadFeedCache(PROFILE);

    expect(cache?.scopes.per_te.items.map((item) => item.id)).toEqual(["a", "b"]);
    expect(cache?.scopes.per_te.pageCount).toBe(2);
  });

  it("applica il cap agli elementi conservati", async () => {
    const many = Array.from({ length: FEED_CACHE_ITEM_CAP + 15 }, (_, index) =>
      makePost(`item-${index}`),
    );

    await saveFeedCacheScope(PROFILE, "per_te", { items: many });

    const cache = await loadFeedCache(PROFILE);

    expect(cache?.scopes.per_te.items).toHaveLength(FEED_CACHE_ITEM_CAP);
    expect(cache?.scopes.per_te.items[0].id).toBe("item-0");
  });

  it("tiene le due tab isolate", async () => {
    await saveFeedCacheScope(PROFILE, "per_te", { items: [makePost("a")] });
    await saveFeedCacheScope(PROFILE, "seguiti", { items: [makePost("z")] });

    const cache = await loadFeedCache(PROFILE);

    expect(cache?.scopes.per_te.items.map((item) => item.id)).toEqual(["a"]);
    expect(cache?.scopes.seguiti.items.map((item) => item.id)).toEqual(["z"]);
  });

  it("conserva la posizione di scroll per tab", async () => {
    const scroll = { itemCount: 12, offset: 940, savedAt: new Date().toISOString() };

    await saveFeedCacheScope(PROFILE, "seguiti", { scroll });

    const cache = await loadFeedCache(PROFILE);

    expect(cache?.scopes.seguiti.scroll).toEqual(scroll);
    expect(cache?.scopes.per_te.scroll).toBeNull();
  });

  it("dimentica gli id già visti quando la cache è vecchia di oltre 24 ore", async () => {
    const stale = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

    await saveFeedCacheScope(PROFILE, "per_te", {
      seenIds: ["a", "b"],
      updatedAt: stale,
    });

    const cache = await loadFeedCache(PROFILE);

    expect(cache?.scopes.per_te.seenIds).toEqual([]);
  });

  it("conserva gli id già visti quando la cache è recente", async () => {
    await saveFeedCacheScope(PROFILE, "per_te", {
      seenIds: ["a", "b"],
      updatedAt: new Date().toISOString(),
    });

    const cache = await loadFeedCache(PROFILE);

    expect(cache?.scopes.per_te.seenIds).toEqual(["a", "b"]);
  });
});

describe("saveFeedCacheMeta", () => {
  it("conserva la tab attiva", async () => {
    await saveFeedCacheMeta(PROFILE, { activeScope: "seguiti" });

    expect((await loadFeedCache(PROFILE))?.activeScope).toBe("seguiti");
  });

  it("aggiorna firstAccess per chiavi senza azzerare le altre", async () => {
    await saveFeedCacheMeta(PROFILE, {
      firstAccess: { personalizeDismissedAt: "2026-07-30T10:00:00.000Z" },
    });
    await saveFeedCacheMeta(PROFILE, { firstAccess: { followingHintShownCount: 2 } });

    const cache = await loadFeedCache(PROFILE);

    expect(cache?.firstAccess.personalizeDismissedAt).toBe("2026-07-30T10:00:00.000Z");
    expect(cache?.firstAccess.followingHintShownCount).toBe(2);
  });

  it("non tocca gli elementi già in cache", async () => {
    await saveFeedCacheScope(PROFILE, "per_te", { items: [makePost("a")] });
    await saveFeedCacheMeta(PROFILE, { activeScope: "seguiti" });

    const cache = await loadFeedCache(PROFILE);

    expect(cache?.scopes.per_te.items.map((item) => item.id)).toEqual(["a"]);
  });
});

describe("clearFeedCache", () => {
  it("rimuove il record", async () => {
    await saveFeedCacheScope(PROFILE, "per_te", { items: [makePost("a")] });
    await clearFeedCache(PROFILE);

    expect(await loadFeedCache(PROFILE)).toBeNull();
  });
});
