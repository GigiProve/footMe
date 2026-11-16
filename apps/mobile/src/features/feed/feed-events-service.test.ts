import { afterEach, describe, expect, it, vi } from "vitest";

import {
  discardFeedEvents,
  emitFeedEvent,
  flushFeedEvents,
  getSeguitiLocalSessionId,
  pendingFeedEventsCount,
  resetFeedEventsForTest,
  setFeedEventsSender,
} from "./feed-events-service";
import type { FeedEvent } from "./feed-events-presentation";

vi.mock("../../lib/supabase", () => ({
  hasSupabaseEnv: false,
  supabase: { rpc: vi.fn() },
}));

afterEach(() => {
  resetFeedEventsForTest();
});

describe("coda eventi Feed (HOM-13 §259)", () => {
  it("accoda e spedisce un lotto con event_id uuid", async () => {
    const sent: FeedEvent[][] = [];
    setFeedEventsSender(async (events) => {
      sent.push(events);
    });

    emitFeedEvent({ eventType: "feed_refresh", tab: "per_te" });
    emitFeedEvent({ eventType: "feed_load_more", tab: "per_te" });
    expect(pendingFeedEventsCount()).toBe(2);

    await flushFeedEvents();

    expect(pendingFeedEventsCount()).toBe(0);
    expect(sent).toHaveLength(1);
    expect(sent[0].map((event) => event.event_type)).toEqual(["feed_refresh", "feed_load_more"]);
    expect(sent[0][0].event_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("spedisce subito a 20 eventi", () => {
    const sender = vi.fn(async () => undefined);
    setFeedEventsSender(sender);

    for (let index = 0; index < 20; index += 1) {
      emitFeedEvent({ eventType: "feed_unit_impression", tab: "per_te" });
    }

    expect(sender).toHaveBeenCalledTimes(1);
  });

  it("non solleva mai se l'invio fallisce: il lotto è scartato", async () => {
    setFeedEventsSender(async () => {
      throw new Error("rete");
    });

    emitFeedEvent({ eventType: "feed_refresh", tab: "seguiti" });

    await expect(flushFeedEvents()).resolves.toBeUndefined();
    expect(pendingFeedEventsCount()).toBe(0);
  });

  it("scarta in silenzio un evento non valido", () => {
    emitFeedEvent({ eventType: "feed_candidate_source" as never, tab: "per_te" });

    expect(pendingFeedEventsCount()).toBe(0);
  });

  it("al logout la coda dell'utente che esce si scarta", () => {
    emitFeedEvent({ eventType: "feed_refresh", tab: "per_te" });

    discardFeedEvents();

    expect(pendingFeedEventsCount()).toBe(0);
  });

  it("la sessione locale di Seguiti è stabile fino allo scarto (§256)", () => {
    const first = getSeguitiLocalSessionId();

    expect(getSeguitiLocalSessionId()).toBe(first);
    discardFeedEvents();
    expect(getSeguitiLocalSessionId()).not.toBe(first);
  });
});
