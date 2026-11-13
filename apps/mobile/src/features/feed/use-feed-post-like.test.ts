import { createElement } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { FEED_QK } from "./feed-keys";
import { makeEditorialItem, makeEditorialPayload, makePostPayload } from "./feed-post-fixtures";
import type { FeedContentItem, FeedItem, FeedPage } from "./feed-types";
import {
  createLikeTracker,
  nextLikeState,
  patchPostLike,
  useToggleFeedPostLike,
} from "./use-feed-post-like";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const likeMocks = vi.hoisted(() => ({
  setPostLike: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("../../ui", () => ({ useToast: () => ({ showToast: likeMocks.showToast }) }));
vi.mock("./feed-service", () => ({ setPostLike: likeMocks.setPostLike }));

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

describe("patchPostLike — editoriali HOM-03", () => {
  it("scrive lo stato Like anche su Articolo e video editoriale", () => {
    const article = makeEditorialItem("media_profile:a-1", "article", { likesCount: 2 });
    const video = makeEditorialItem("media_profile:v-1", "video", { likesCount: 5 });

    const patched = patchPostLike(data([article, video]), "media_profile:a-1", { isLiked: true, likesCount: 3 });
    const [first, second] = patched!.pages[0].items;

    expect(first.type === "article" ? first.payload : null).toMatchObject({ isLiked: true, likesCount: 3 });
    expect(second).toBe(video);
  });
});

describe("useToggleFeedPostLike — HOM-03 §104", () => {
  function mount(client: QueryClient) {
    let toggle: ((item: FeedContentItem) => void) | null = null;
    function Probe() {
      toggle = useToggleFeedPostLike({ profileId: "me" });
      return null;
    }
    act(() => {
      TestRenderer.create(createElement(QueryClientProvider, { client }, createElement(Probe)));
    });
    return (item: FeedContentItem) => toggle!(item);
  }

  it("un video editoriale passa da set_content_like e aggiorna Feed e dettaglio", async () => {
    likeMocks.setPostLike.mockResolvedValue({ isLiked: true, likesCount: 6 });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const video = makeEditorialItem("media_profile:v-1", "video", {
      likesCount: 5,
      postId: "v-1",
    }) as FeedContentItem;
    client.setQueryData(FEED_QK.feed("per_te", "me"), data([video]));
    client.setQueryData(FEED_QK.interaction("media_profile", "v-1"), {
      canLike: true,
      commentsCount: 0,
      isLiked: false,
      likesCount: 5,
    });

    const toggle = mount(client);
    await act(async () => {
      toggle(video);
    });

    expect(likeMocks.setPostLike).toHaveBeenCalledWith("media_profile", "v-1", true);
    const feed = client.getQueryData<ReturnType<typeof data>>(FEED_QK.feed("per_te", "me"));
    const item = feed?.pages[0].items[0];
    expect(item?.type === "video" ? item.payload : null).toMatchObject({ isLiked: true, likesCount: 6 });
    expect(client.getQueryData(FEED_QK.interaction("media_profile", "v-1"))).toMatchObject({
      isLiked: true,
      likesCount: 6,
    });
  });

  it("senza capability non scrive e mostra il messaggio", async () => {
    likeMocks.setPostLike.mockClear();
    const client = new QueryClient();
    const article = makeEditorialItem("media_tribuna:a-1", "article", {
      capabilities: { ...makeEditorialPayload().capabilities, canLike: false },
      contentType: "media_tribuna",
    }) as FeedContentItem;

    const toggle = mount(client);
    await act(async () => {
      toggle(article);
    });

    expect(likeMocks.setPostLike).not.toHaveBeenCalled();
    expect(likeMocks.showToast).toHaveBeenCalled();
  });
});
