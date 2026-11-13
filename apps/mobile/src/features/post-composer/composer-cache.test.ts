import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { INSIGHTS_ROOT_KEY } from "../content-insights/insights-keys";
import { FEED_QK } from "../feed/feed-keys";
import { makeEditorialItem, makePostItem } from "../feed/feed-post-fixtures";
import type { FeedItem, FeedPostItem } from "../feed/feed-types";
import {
  applyEditToCaches,
  applyPublishToCaches,
  editPatchFromState,
  patchPostAfterEdit,
  POST_CHANGE_INVALIDATIONS,
} from "./composer-cache";
import { baseState, mediaItem, mention, tag } from "./composer-fixtures";

function feedData(items: FeedItem[]) {
  return {
    pageParams: [{ cursor: null, pageIndex: 0 }],
    pages: [{ asOf: "x", isLastPage: true, items, nextCursor: null, pageIndex: 0 }],
  };
}

const post = (id: string, body = "vecchio") =>
  makePostItem(`profile_post:${id}`, { body, contentType: "profile_post", postId: id }) as FeedPostItem;

const bodies = (data: { pages: { items: FeedItem[] }[] } | undefined) =>
  data?.pages[0].items.map((item) => (item.type === "post" ? item.payload.body : null));

describe("editPatchFromState (§155, §162)", () => {
  it("porta testo, mention, tag e versione; senza preview pronta il link non resta", () => {
    const patch = editPatchFromState(
      baseState({ body: "Ciao @Marco", mentions: [mention("Marco", 5)], tagged: [tag("Anna")] }),
      "v2",
    );

    expect(patch.body).toBe("Ciao @Marco");
    expect(patch.mentions).toEqual([
      { displayName: "Marco", end: 11, identityId: "Marco", identityType: "profile", start: 5 },
    ]);
    expect(patch.tagged).toEqual([
      { avatarUrl: null, displayName: "Anna", identityId: "Anna", identityType: "profile" },
    ]);
    expect(patch.linkPreview).toBeNull();
    expect(patch.version).toBe("v2");
  });

  it("la preview pronta sull'URL del testo passa al Feed; dismissed no (§93)", () => {
    const link = {
      description: "d",
      domain: "a.com",
      finalUrl: "https://a.com/x",
      imageUrl: "https://a.com/i.jpg",
      snapshotId: "snap",
      status: "ready" as const,
      title: "T",
      url: "https://a.com/x",
    };

    expect(editPatchFromState(baseState({ body: "https://a.com/x", link }), "v2").linkPreview).toEqual({
      description: "d",
      domain: "a.com",
      thumbnailUrl: "https://a.com/i.jpg",
      title: "T",
      url: "https://a.com/x",
    });
    expect(
      editPatchFromState(baseState({ body: "https://a.com/x", dismissedUrls: ["https://a.com/x"], link }), "v2")
        .linkPreview,
    ).toBeNull();
  });

  it("con media nel Post il server non conserva l'anteprima: il Feed non ne riceve una (§95)", () => {
    const link = {
      description: null,
      domain: "a.com",
      finalUrl: "https://a.com/x",
      imageUrl: null,
      snapshotId: "snap",
      status: "ready" as const,
      title: "T",
      url: "https://a.com/x",
    };

    expect(
      editPatchFromState(baseState({ body: "https://a.com/x", link, media: [mediaItem()] }), "v2").linkPreview,
    ).toBeNull();
  });
});

describe("patchPostAfterEdit", () => {
  it("modifica solo il Post indicato, in tutte le pagine, e lascia identici gli altri", () => {
    const a = post("a");
    const b = post("b");
    const article = makeEditorialItem("media_profile:x", "article", { postId: "x" });
    const patch = editPatchFromState(baseState({ body: "nuovo" }), "v3");

    const next = patchPostAfterEdit(feedData([a, b, article]), "profile_post:a", patch);

    expect(bodies(next)).toEqual(["nuovo", "vecchio", null]);
    expect(next?.pages[0].items[1]).toBe(b);
    expect(next?.pages[0].items[2]).toBe(article);
    expect((next?.pages[0].items[0] as FeedPostItem).payload.version).toBe("v3");
  });

  it("stessa identità se il Post non è in cache", () => {
    const data = feedData([post("a")]);

    expect(patchPostAfterEdit(data, "profile_post:zzz", editPatchFromState(baseState(), "v"))).toBe(data);
    expect(patchPostAfterEdit(undefined, "profile_post:a", editPatchFromState(baseState(), "v"))).toBeUndefined();
  });
});

describe("applyEditToCaches", () => {
  it("patcha entrambe le tab e il dettaglio, senza invalidare le statistiche (§165)", () => {
    const client = new QueryClient();
    const a = post("a");
    client.setQueryData(FEED_QK.feed("per_te", "me"), feedData([a]));
    client.setQueryData(FEED_QK.feed("seguiti", "me"), feedData([a]));
    client.setQueryData(FEED_QK.postDetail("a"), a);
    const invalidate = vi.spyOn(client, "invalidateQueries");

    applyEditToCaches(client, {
      contentId: "a",
      itemId: "profile_post:a",
      patch: editPatchFromState(baseState({ body: "nuovo" }), "v2"),
      profileId: "me",
    });

    for (const scope of ["per_te", "seguiti"] as const) {
      expect(bodies(client.getQueryData(FEED_QK.feed(scope, "me")))).toEqual(["nuovo"]);
    }
    expect(client.getQueryData<FeedPostItem>(FEED_QK.postDetail("a"))?.payload.body).toBe("nuovo");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["tagged-content"] });
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: [INSIGHTS_ROOT_KEY] });
  });

  it("un dettaglio «non disponibile» (null) resta null", () => {
    const client = new QueryClient();
    client.setQueryData(FEED_QK.postDetail("a"), null);

    applyEditToCaches(client, {
      contentId: "a",
      itemId: "profile_post:a",
      patch: editPatchFromState(baseState(), "v2"),
      profileId: "me",
    });

    expect(client.getQueryData(FEED_QK.postDetail("a"))).toBeNull();
  });
});

describe("applyPublishToCaches (§131–133)", () => {
  it("marca stale le due tab senza refetch e senza righe ottimistiche", () => {
    const client = new QueryClient();
    const existing = post("a");
    client.setQueryData(FEED_QK.feed("per_te", "me"), feedData([existing]));
    const invalidate = vi.spyOn(client, "invalidateQueries");

    applyPublishToCaches(client, { profileId: "me" });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: FEED_QK.feed("per_te", "me"), refetchType: "none" });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: FEED_QK.feed("seguiti", "me"), refetchType: "none" });
    expect(client.getQueryData(FEED_QK.feed("per_te", "me"))).toEqual(feedData([existing]));
  });

  it("invalida Salvati, taggati e Cerca ma non le statistiche", () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");

    applyPublishToCaches(client, { profileId: "me" });

    expect(POST_CHANGE_INVALIDATIONS).toContainEqual(["saved-items"]);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["saved-items"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["tagged-content"] });
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: [INSIGHTS_ROOT_KEY] });
  });
});
