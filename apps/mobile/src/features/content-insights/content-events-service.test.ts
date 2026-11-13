import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  contentSourceOf,
  discardContentEvents,
  drainContentEventsForSignOut,
  emitContentEvent,
  emitContentEventForKey,
  flushContentEvents,
  getContentEventsSessionId,
  pendingContentEventsCount,
  rememberContentSource,
  resetContentEventsForTest,
  setContentEventsSender,
} from "./content-events-service";
import { CONTENT_EVENT_LIMITS, type ContentEvent } from "./content-events-types";

const POST_ID = "3f1d8a4e-5b2c-4d7a-9e11-2c4b6a8d0f13";

function impression(postId = POST_ID) {
  emitContentEvent({
    contentType: "profile_post",
    eventType: "impression",
    postId,
    source: "HOME_FOR_YOU",
  });
}

function uuidN(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

let sent: ContentEvent[][];

beforeEach(() => {
  vi.useFakeTimers();
  resetContentEventsForTest();
  sent = [];
  setContentEventsSender(async (events) => {
    sent.push(events);
  });
});

afterEach(() => {
  resetContentEventsForTest();
  vi.useRealTimers();
});

describe("logout e fine sessione (§149)", () => {
  it("spedisce la coda prima del logout e poi la svuota", async () => {
    impression(uuidN(1));

    await drainContentEventsForSignOut();

    expect(sent).toHaveLength(1);
    expect(pendingContentEventsCount()).toBe(0);
  });

  it("non blocca il logout se la rete non risponde", async () => {
    setContentEventsSender(() => new Promise<void>(() => {}));
    impression(uuidN(1));

    const drained = drainContentEventsForSignOut(1500);
    await vi.advanceTimersByTimeAsync(1500);
    await drained;

    expect(pendingContentEventsCount()).toBe(0);
  });

  it("una sessione chiusa senza logout scarta la coda senza spedirla", async () => {
    impression(uuidN(1));

    discardContentEvents();
    await vi.advanceTimersByTimeAsync(20_000);

    expect(sent).toEqual([]);
    expect(pendingContentEventsCount()).toBe(0);
  });
});

describe("coda degli eventi per contenuto", () => {
  it("non spedisce prima di soglia o timer", () => {
    impression(uuidN(1));
    impression(uuidN(2));

    expect(pendingContentEventsCount()).toBe(2);
    expect(sent).toEqual([]);
  });

  it("spedisce al ventesimo evento", async () => {
    for (let i = 1; i <= CONTENT_EVENT_LIMITS.flushThreshold; i += 1) {
      impression(uuidN(i));
    }
    await vi.advanceTimersByTimeAsync(0);

    expect(sent).toHaveLength(1);
    expect(sent[0]).toHaveLength(20);
    expect(pendingContentEventsCount()).toBe(0);
  });

  it("spedisce dopo 10s dal primo evento in coda", async () => {
    impression(uuidN(1));

    await vi.advanceTimersByTimeAsync(CONTENT_EVENT_LIMITS.flushIntervalMs - 1);
    expect(sent).toEqual([]);

    await vi.advanceTimersByTimeAsync(1);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toHaveLength(1);
  });

  it("il flush esplicito (background) spedisce subito e svuota", async () => {
    impression(uuidN(1));
    impression(uuidN(2));

    await flushContentEvents();

    expect(sent).toHaveLength(1);
    expect(pendingContentEventsCount()).toBe(0);
  });

  it("non spedisce lotti oltre 50 eventi", async () => {
    // Il sender bloccato tiene la coda in attesa mentre se ne accumulano molti.
    let release: () => void = () => undefined;
    setContentEventsSender(
      (events) =>
        new Promise<void>((resolve) => {
          sent.push(events);
          release = resolve;
        }),
    );

    for (let i = 1; i <= 130; i += 1) {
      impression(uuidN(i));
    }
    await vi.advanceTimersByTimeAsync(0);
    release();
    await vi.advanceTimersByTimeAsync(0);
    release();
    await vi.advanceTimersByTimeAsync(0);
    release();
    await vi.advanceTimersByTimeAsync(0);

    expect(sent.length).toBeGreaterThanOrEqual(3);
    for (const batch of sent) {
      expect(batch.length).toBeLessThanOrEqual(CONTENT_EVENT_LIMITS.maxBatch);
    }
    expect(sent.flat()).toHaveLength(130);
  });

  it("ogni evento ha un event_id uuid diverso e lo stesso session_id", async () => {
    impression(uuidN(1));
    impression(uuidN(2));
    await flushContentEvents();

    const [first, second] = sent[0];
    expect(first.event_id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(first.event_id).not.toBe(second.event_id);
    expect(first.session_id).toBe(second.session_id);
    expect(first.session_id).toBe(getContentEventsSessionId());
  });

  it("scarta lato client gli eventi non validi", () => {
    impression("p1");
    emitContentEvent({
      contentType: "profile_post",
      eventType: "video_progress",
      postId: POST_ID,
      source: "OTHER",
    });
    emitContentEvent({
      contentType: "post",
      eventType: "impression",
      postId: POST_ID,
      source: "OTHER",
    });

    expect(pendingContentEventsCount()).toBe(0);
  });

  it("non porta testo del contenuto nelle props", async () => {
    emitContentEvent({
      contentType: "profile_post",
      eventType: "video_watch",
      postId: POST_ID,
      props: { seconds: 8, ...({ body: "corpo del post riservato" } as object) },
      source: "HOME_FOR_YOU",
    });
    await flushContentEvents();

    expect(JSON.stringify(sent)).not.toContain("corpo del post riservato");
    expect(sent[0][0].props).toEqual({ seconds: 8 });
  });

  it("un lotto fallito è scartato in silenzio, senza retry immediato", async () => {
    const failing = vi.fn(async () => {
      throw new Error("rete");
    });
    setContentEventsSender(failing);

    impression(uuidN(1));
    await expect(flushContentEvents()).resolves.toBeUndefined();

    expect(failing).toHaveBeenCalledTimes(1);
    expect(pendingContentEventsCount()).toBe(0);
  });

  it("l'emissione non solleva mai, nemmeno con un sender che solleva in modo sincrono", async () => {
    setContentEventsSender(() => {
      throw new Error("boom");
    });

    expect(() => impression(uuidN(1))).not.toThrow();
    await expect(flushContentEvents()).resolves.toBeUndefined();
  });

  it("la coda in memoria ha un tetto", () => {
    // Un sender che non risolve mai tiene il flush in corso: la coda cresce.
    setContentEventsSender(() => new Promise<void>(() => undefined));

    for (let i = 1; i <= CONTENT_EVENT_LIMITS.maxQueue + 60; i += 1) {
      impression(uuidN(i));
    }

    expect(pendingContentEventsCount()).toBeLessThanOrEqual(CONTENT_EVENT_LIMITS.maxQueue);
  });
});

describe("source per contenuto", () => {
  it("senza source ricordata è OTHER; con essa la usa chi emette per chiave", async () => {
    expect(contentSourceOf("profile_post", POST_ID)).toBe("OTHER");

    rememberContentSource("profile_post", POST_ID, "HOME_FOLLOWING");
    expect(contentSourceOf("profile_post", POST_ID)).toBe("HOME_FOLLOWING");

    emitContentEventForKey(`profile_post:${POST_ID}`, "video_play");
    await flushContentEvents();

    expect(sent[0][0].source).toBe("HOME_FOLLOWING");
    expect(sent[0][0].event_type).toBe("video_play");
  });

  it("una chiave non valida non emette nulla", () => {
    emitContentEventForKey("post:a", "video_play");
    emitContentEventForKey("club_media:non-uuid", "video_play");

    expect(pendingContentEventsCount()).toBe(0);
  });
});
