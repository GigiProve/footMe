import { QueryClient, type InfiniteData } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FEED_QK } from "./feed-keys";
import {
  applyMediaStates,
  collectProcessingTargets,
  isProcessingState,
  patchPagesMedia,
  PROCESSING_MAX_ATTEMPTS,
  PROCESSING_MAX_TARGETS,
  PROCESSING_POLL_DELAYS_MS,
  processingPollDelay,
  type ProcessingTarget,
} from "./feed-media-processing";
import { makeEditorialItem, makeFeedMedia, makePostItem } from "./feed-post-fixtures";
import type { ContentMediaStates } from "./feed-service";
import type { FeedItem, FeedPage, FeedPageParam, FeedPostItem } from "./feed-types";
import { applyProcessingUpdates, createProcessingPoller } from "./use-feed-media-processing";

vi.mock("../../lib/supabase", () => ({ supabase: { rpc: vi.fn() } }));

const processing = makeFeedMedia({ processingState: "processing" });
const uploaded = makeFeedMedia({ processingState: "uploaded" });
const ready = makeFeedMedia({ processingState: "ready" });

describe("isProcessingState", () => {
  it("§64 uploaded vale come processing", () => {
    expect(isProcessingState("uploaded")).toBe(true);
    expect(isProcessingState("processing")).toBe(true);
    expect(isProcessingState("ready")).toBe(false);
    expect(isProcessingState("failed")).toBe(false);
  });
});

describe("processingPollDelay", () => {
  it("segue il backoff e poi resta a 60 s", () => {
    expect(PROCESSING_POLL_DELAYS_MS).toEqual([5000, 10000, 20000, 40000, 60000]);
    expect([0, 1, 2, 3, 4, 5, 9].map(processingPollDelay)).toEqual([
      5000, 10000, 20000, 40000, 60000, 60000, 60000,
    ]);
  });
});

describe("collectProcessingTargets", () => {
  it("prende solo Post ed editoriali con un video in elaborazione, senza doppioni", () => {
    const items: FeedItem[] = [
      makePostItem("club_media:p-1", { media: [ready, processing], postId: "p-1" }),
      makePostItem("club_media:p-2", { media: [ready], postId: "p-2" }),
      makeEditorialItem("media_profile:v-1", "video", { media: [uploaded], postId: "v-1" }),
      makePostItem("club_media:p-1", { media: [processing], postId: "p-1" }),
      makePostItem("club_media:p-3", {
        media: [makeFeedMedia({ processingState: "processing", type: "image" })],
        postId: "p-3",
      }),
    ];

    expect(collectProcessingTargets(items)).toEqual([
      { contentType: "club_media", itemId: "club_media:p-1", postId: "p-1" },
      { contentType: "media_profile", itemId: "media_profile:v-1", postId: "v-1" },
    ]);
  });

  it("si ferma a 20 target", () => {
    const items = Array.from({ length: 30 }, (_, index) =>
      makePostItem(`club_media:p-${index}`, { media: [processing], postId: `p-${index}` }),
    );

    expect(PROCESSING_MAX_TARGETS).toBe(20);
    expect(collectProcessingTargets(items)).toHaveLength(20);
  });
});

describe("applyMediaStates", () => {
  it("sostituisce solo la media collection", () => {
    const item = makePostItem("club_media:p-1", { likesCount: 7, media: [processing] });

    const patched = applyMediaStates(item, [ready]);

    expect(patched).not.toBe(item);
    expect(patched.type === "post" ? patched.payload : null).toMatchObject({ likesCount: 7, media: [ready] });
  });

  it("restituisce lo stesso oggetto quando non cambia nulla", () => {
    const item = makePostItem("club_media:p-1", { media: [processing] });

    expect(applyMediaStates(item, [makeFeedMedia({ processingState: "processing" })])).toBe(item);
  });

  it("vale anche per gli editoriali", () => {
    const item = makeEditorialItem("media_profile:v-1", "video", { media: [uploaded] });

    const patched = applyMediaStates(item, [ready]);

    expect(patched.type === "video" ? patched.payload.media[0].processingState : null).toBe("ready");
  });
});

describe("patchPagesMedia", () => {
  it("tocca solo le pagine cambiate e null quando nulla cambia", () => {
    const pageA = { items: [makePostItem("club_media:p-1", { media: [processing] })] };
    const pageB = { items: [makePostItem("club_media:p-2", { media: [ready] })] };

    const patched = patchPagesMedia([pageA, pageB], new Map([["club_media:p-1", [ready]]]));

    expect(patched?.[0]).not.toBe(pageA);
    expect(patched?.[1]).toBe(pageB);
    expect(patchPagesMedia([pageB], new Map([["club_media:p-2", [ready]]]))).toBeNull();
  });
});

describe("applyProcessingUpdates", () => {
  it("patcha le due tab e il dettaglio post senza refetch", () => {
    const client = new QueryClient();
    const page = (items: FeedItem[]): FeedPage => ({
      asOf: "x",
      isLastPage: true,
      items,
      nextCursor: null,
      pageIndex: 0,
    });
    const feed = (items: FeedItem[]): InfiniteData<FeedPage, FeedPageParam> => ({
      pageParams: [{ cursor: null, pageIndex: 0 }],
      pages: [page(items)],
    });
    const post = makePostItem("profile_post:pp-1", {
      contentType: "profile_post",
      media: [processing],
      postId: "pp-1",
    }) as FeedPostItem;
    client.setQueryData(FEED_QK.feed("per_te", "me"), feed([post]));
    client.setQueryData(FEED_QK.feed("seguiti", "me"), feed([post]));
    client.setQueryData(FEED_QK.postDetail("pp-1"), post);
    const invalidate = vi.spyOn(client, "invalidateQueries");

    const states: ContentMediaStates[] = [{ contentType: "profile_post", media: [ready], postId: "pp-1" }];
    applyProcessingUpdates(client, "me", new Map([["profile_post:pp-1", [ready]]]), states);

    for (const scope of ["per_te", "seguiti"] as const) {
      const data = client.getQueryData<InfiniteData<FeedPage, FeedPageParam>>(FEED_QK.feed(scope, "me"));
      const item = data?.pages[0].items[0];
      expect(item?.type === "post" ? item.payload.media[0].processingState : null).toBe("ready");
    }
    expect(client.getQueryData<FeedPostItem>(FEED_QK.postDetail("pp-1"))?.payload.media[0].processingState).toBe(
      "ready",
    );
    expect(invalidate).not.toHaveBeenCalled();
  });
});

describe("createProcessingPoller", () => {
  const target = (id: string): ProcessingTarget => ({
    contentType: "club_media",
    itemId: `club_media:${id}`,
    postId: id,
  });
  const stillProcessing = (id: string): ContentMediaStates => ({
    contentType: "club_media",
    media: [processing],
    postId: id,
  });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function setup(respond: (targets: ProcessingTarget[]) => ContentMediaStates[] | Error) {
    const fetchStates = vi.fn(async (targets: ProcessingTarget[]) => {
      const result = respond(targets);
      if (result instanceof Error) {
        throw result;
      }
      return result;
    });
    const apply = vi.fn();
    const poller = createProcessingPoller({ apply, fetchStates });
    return { apply, fetchStates, poller };
  }

  it("non interroga finché non è attivo, e con backoff dopo", async () => {
    const { fetchStates, poller } = setup(() => [stillProcessing("p-1")]);
    poller.setTargets([target("p-1")]);

    await vi.advanceTimersByTimeAsync(60000);
    expect(fetchStates).not.toHaveBeenCalled();

    poller.setActive(true);
    await vi.advanceTimersByTimeAsync(4999);
    expect(fetchStates).toHaveBeenCalledTimes(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchStates).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10000);
    expect(fetchStates).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(20000);
    expect(fetchStates).toHaveBeenCalledTimes(3);
  });

  it("si ferma quando il video è pronto e applica la patch", async () => {
    const { apply, fetchStates, poller } = setup(() => [
      { contentType: "club_media", media: [ready], postId: "p-1" },
    ]);
    poller.setActive(true);
    poller.setTargets([target("p-1")]);

    await vi.advanceTimersByTimeAsync(5000);
    await vi.advanceTimersByTimeAsync(120000);

    expect(fetchStates).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith(new Map([["club_media:p-1", [ready]]]), expect.any(Array));
  });

  it(`si arrende dopo ${PROCESSING_MAX_ATTEMPTS} tentativi`, async () => {
    const { fetchStates, poller } = setup(() => [stillProcessing("p-1")]);
    poller.setActive(true);
    poller.setTargets([target("p-1")]);

    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);

    expect(fetchStates).toHaveBeenCalledTimes(PROCESSING_MAX_ATTEMPTS);
  });

  it("un errore di rete non ferma il poll", async () => {
    let calls = 0;
    const { fetchStates, poller } = setup(() => (++calls === 1 ? new Error("offline") : [stillProcessing("p-1")]));
    poller.setActive(true);
    poller.setTargets([target("p-1")]);

    await vi.advanceTimersByTimeAsync(5000 + 10000);

    expect(fetchStates).toHaveBeenCalledTimes(2);
  });

  it("un nuovo target azzera il backoff; gli stessi target no", async () => {
    const { fetchStates, poller } = setup((targets) => targets.map((entry) => stillProcessing(entry.postId)));
    poller.setActive(true);
    poller.setTargets([target("p-1")]);
    await vi.advanceTimersByTimeAsync(5000 + 10000);
    expect(fetchStates).toHaveBeenCalledTimes(2);

    // Stessi target: il prossimo giro resta a 20 s.
    poller.setTargets([target("p-1")]);
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchStates).toHaveBeenCalledTimes(2);

    // Nuovo target: si riparte da 5 s.
    poller.setTargets([target("p-1"), target("p-2")]);
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchStates).toHaveBeenCalledTimes(3);
    expect(fetchStates.mock.calls[2][0].map((entry: ProcessingTarget) => entry.postId)).toEqual(["p-1", "p-2"]);
  });

  it("senza target visibili o inattivo non interroga", async () => {
    const { fetchStates, poller } = setup(() => [stillProcessing("p-1")]);
    poller.setActive(true);
    poller.setTargets([target("p-1")]);
    poller.setTargets([]);
    await vi.advanceTimersByTimeAsync(60000);
    expect(fetchStates).not.toHaveBeenCalled();

    poller.setTargets([target("p-1")]);
    poller.setActive(false);
    await vi.advanceTimersByTimeAsync(60000);
    expect(fetchStates).not.toHaveBeenCalled();

    poller.setActive(true);
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchStates).toHaveBeenCalledTimes(1);
  });

  it("un contenuto non più leggibile esce dal poll e non rientra", async () => {
    const { fetchStates, poller } = setup(() => []);
    poller.setActive(true);
    poller.setTargets([target("p-1")]);
    await vi.advanceTimersByTimeAsync(5000);

    poller.setTargets([target("p-1")]);
    await vi.advanceTimersByTimeAsync(120000);

    expect(fetchStates).toHaveBeenCalledTimes(1);
  });

  it("dispose ferma il timer ma permette di ripartire (StrictMode)", async () => {
    const { fetchStates, poller } = setup(() => [stillProcessing("p-1")]);
    poller.setActive(true);
    poller.setTargets([target("p-1")]);
    poller.dispose();
    await vi.advanceTimersByTimeAsync(60000);
    expect(fetchStates).not.toHaveBeenCalled();

    poller.setActive(true);
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchStates).toHaveBeenCalledTimes(1);
  });
});
