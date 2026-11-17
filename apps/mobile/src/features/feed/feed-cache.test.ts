import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it } from "vitest";

import {
  clearCachedFeedItems,
  clearFeedCache,
  FEED_CACHE_ITEM_CAP,
  forgetDeletedContentInCache,
  loadFeedCache,
  removeContentFromCachedScope,
  saveFeedCacheMeta,
  saveFeedCacheScope,
} from "./feed-cache";
import { makeEditorialItem, makeFeedMedia, makePostPayload } from "./feed-post-fixtures";
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
    payload: makePostPayload({ postId: id }),
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

  it("scarta un Post salvato prima di HOM-02 (senza media né capability)", async () => {
    await saveFeedCacheScope(PROFILE, "per_te", { items: [makePost("a")] });

    const raw = JSON.parse((await AsyncStorage.getItem(KEY)) as string);
    raw.scopes.per_te.items.push({
      id: "vecchio",
      type: "post",
      rank: 2,
      payload: { contentType: "club_media", postId: "x", imageUrl: null, mediaType: null },
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

describe("removeContentFromCachedScope — HOM-11 §169–§170, §292", () => {
  it("toglie il contenuto dalla copia su disco della tab, lasciando intatti gli altri e l'altra tab", async () => {
    await saveFeedCacheScope(PROFILE, "per_te", { items: [makePost("a"), makePost("b"), makePost("c")] });
    await saveFeedCacheScope(PROFILE, "seguiti", { items: [makePost("b")] });

    await removeContentFromCachedScope(PROFILE, "per_te", "club_media", "b");

    const cache = await loadFeedCache(PROFILE);
    expect(cache?.scopes.per_te.items.map((item) => item.id)).toEqual(["a", "c"]);
    // Non mi interessa non vale per Seguiti (§26).
    expect(cache?.scopes.seguiti.items.map((item) => item.id)).toEqual(["b"]);
  });

  it("toglie anche un Simple Repost dell'originale (il target è il contenuto canonico)", async () => {
    const wrapper = { ...makePost("b"), id: "repost:club_media:b" };
    await saveFeedCacheScope(PROFILE, "per_te", { items: [makePost("a"), wrapper] });

    await removeContentFromCachedScope(PROFILE, "per_te", "club_media", "b");

    expect((await loadFeedCache(PROFILE))?.scopes.per_te.items.map((item) => item.id)).toEqual(["a"]);
  });

  it("il tipo conta: lo stesso id con un altro tipo non si tocca", async () => {
    await saveFeedCacheScope(PROFILE, "per_te", { items: [makePost("a")] });

    await removeContentFromCachedScope(PROFILE, "per_te", "media_profile", "a");

    expect((await loadFeedCache(PROFILE))?.scopes.per_te.items.map((item) => item.id)).toEqual(["a"]);
  });

  it("mantiene scroll, id visti e le altre chiavi del record", async () => {
    const scroll = { itemCount: 3, offset: 120, savedAt: new Date().toISOString() };
    await saveFeedCacheScope(PROFILE, "per_te", {
      items: [makePost("a"), makePost("b")],
      scroll,
      seenIds: ["a"],
      updatedAt: new Date().toISOString(),
    });
    await saveFeedCacheMeta(PROFILE, { activeScope: "seguiti" });

    await removeContentFromCachedScope(PROFILE, "per_te", "club_media", "b");

    const cache = await loadFeedCache(PROFILE);
    expect(cache?.scopes.per_te.scroll).toEqual(scroll);
    expect(cache?.scopes.per_te.seenIds).toEqual(["a"]);
    expect(cache?.activeScope).toBe("seguiti");
  });

  it("senza cache o senza il contenuto non scrive nulla e non solleva", async () => {
    await expect(removeContentFromCachedScope(PROFILE, "per_te", "club_media", "x")).resolves.toBeUndefined();
    expect(await AsyncStorage.getItem(KEY)).toBeNull();

    await saveFeedCacheScope(PROFILE, "per_te", { items: [makePost("a")] });
    const before = await AsyncStorage.getItem(KEY);
    await removeContentFromCachedScope(PROFILE, "per_te", "club_media", "zzz");

    expect(await AsyncStorage.getItem(KEY)).toBe(before);
  });
});

describe("forgetDeletedContentInCache — HOM-15 §183, §345", () => {
  it("toglie il contenuto e i suoi Simple Repost da ENTRAMBE le tab in una sola scrittura", async () => {
    const wrapper = { ...makePost("b"), id: "repost:club_media:b" };
    await saveFeedCacheScope(PROFILE, "per_te", { items: [makePost("a"), makePost("b")] });
    await saveFeedCacheScope(PROFILE, "seguiti", { items: [wrapper, makePost("c")] });

    await forgetDeletedContentInCache(PROFILE, "club_media", "b");

    const cache = await loadFeedCache(PROFILE);
    expect(cache?.scopes.per_te.items.map((item) => item.id)).toEqual(["a"]);
    expect(cache?.scopes.seguiti.items.map((item) => item.id)).toEqual(["c"]);
  });

  it("un Post che incorpora il contenuto resta, con la reference «non disponibile»", async () => {
    const quote = {
      ...makePost("q"),
      payload: makePostPayload({
        postId: "q",
        reference: { available: true, contentId: "b", contentType: "club_media", snapshot: { title: "x" } },
      }),
    } as FeedItem;
    await saveFeedCacheScope(PROFILE, "per_te", { items: [quote] });

    await forgetDeletedContentInCache(PROFILE, "club_media", "b");

    const [kept] = (await loadFeedCache(PROFILE))?.scopes.per_te.items ?? [];
    expect(kept?.id).toBe("q");
    expect(kept?.type === "post" ? kept.payload.reference : undefined).toEqual({
      available: false,
      contentId: "b",
      contentType: "club_media",
      snapshot: null,
    });
  });

  it("senza il contenuto non scrive nulla", async () => {
    await saveFeedCacheScope(PROFILE, "per_te", { items: [makePost("a")] });
    const before = await AsyncStorage.getItem(KEY);

    await forgetDeletedContentInCache(PROFILE, "club_media", "zzz");

    expect(await AsyncStorage.getItem(KEY)).toBe(before);
  });
});

describe("clearCachedFeedItems — HOM-15 §180, §345", () => {
  it("scarta elementi e scroll di entrambe le tab, mantiene tab attiva, primo accesso e id visti", async () => {
    const scroll = { itemCount: 2, offset: 80, savedAt: new Date().toISOString() };
    await saveFeedCacheScope(PROFILE, "per_te", {
      items: [makePost("a")],
      pageCount: 2,
      scroll,
      seenIds: ["a"],
      updatedAt: new Date().toISOString(),
    });
    await saveFeedCacheScope(PROFILE, "seguiti", { items: [makePost("b")] });
    await saveFeedCacheMeta(PROFILE, {
      activeScope: "seguiti",
      firstAccess: { personalizeDismissedAt: "2026-11-01T00:00:00.000Z" },
    });

    await clearCachedFeedItems(PROFILE);

    const cache = await loadFeedCache(PROFILE);
    expect(cache?.scopes.per_te.items).toEqual([]);
    expect(cache?.scopes.per_te.pageCount).toBe(0);
    expect(cache?.scopes.per_te.scroll).toBeNull();
    expect(cache?.scopes.per_te.seenIds).toEqual(["a"]);
    expect(cache?.scopes.seguiti.items).toEqual([]);
    expect(cache?.activeScope).toBe("seguiti");
    expect(cache?.firstAccess.personalizeDismissedAt).toBe("2026-11-01T00:00:00.000Z");
  });

  it("senza cache non scrive nulla e non solleva", async () => {
    await expect(clearCachedFeedItems(PROFILE)).resolves.toBeUndefined();
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });
});

describe("loadFeedCache — HOM-03", () => {
  async function pushRaw(item: Record<string, unknown>) {
    await saveFeedCacheScope(PROFILE, "per_te", { items: [makePost("a")] });
    const raw = JSON.parse((await AsyncStorage.getItem(KEY)) as string);
    raw.scopes.per_te.items.push(item);
    await AsyncStorage.setItem(KEY, JSON.stringify(raw));
  }

  it("scarta un Articolo o un video editoriale salvato prima di HOM-03", async () => {
    await pushRaw({
      id: "media_profile:old",
      type: "article",
      rank: 2,
      payload: { contentType: "media_profile", postId: "old", intro: null, thumbnailUrl: null, durationSeconds: null },
    });

    const cache = await loadFeedCache(PROFILE);

    expect(cache?.scopes.per_te.items.map((item) => item.id)).toEqual(["a"]);
  });

  it("conserva un editoriale HOM-03 completo", async () => {
    await saveFeedCacheScope(PROFILE, "per_te", {
      items: [makeEditorialItem("media_profile:v-1", "video", { media: [makeFeedMedia()] })],
    });

    const cache = await loadFeedCache(PROFILE);

    expect(cache?.scopes.per_te.items.map((item) => item.type)).toEqual(["video"]);
  });

  it("completa i media scritti da HOM-02 con i default invece di scartare il Post", async () => {
    const { createdAt: _c, variants: _v, captions: _k, ...hom02Media } = makeFeedMedia();
    await pushRaw({ ...makePost("b"), payload: makePostPayload({ postId: "b", media: [hom02Media as never] }) });

    const cache = await loadFeedCache(PROFILE);
    const post = cache?.scopes.per_te.items[1];

    expect(post?.id).toBe("b");
    expect(post?.type === "post" ? post.payload.media[0] : null).toMatchObject({
      captions: [],
      createdAt: null,
      variants: [],
    });
  });
});
