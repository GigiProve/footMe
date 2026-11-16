import { describe, expect, it } from "vitest";

import {
  buildFeedEvent,
  feedEventTab,
  FEED_EVENT_TYPES,
  impressionEventFor,
  openEventFor,
  unitEventInput,
} from "./feed-events-presentation";
import { makePostPayload } from "./feed-post-fixtures";
import type { FeedItem } from "./feed-types";

const EVENT_ID = "33333333-3333-4333-8333-333333333333";
const SESSION = "11111111-1111-4111-8111-111111111111";
const TARGET = "44444444-4444-4444-8444-444444444444";
const META = { eventId: EVENT_ID, occurredAt: "2026-11-16T12:00:00.000Z" };

function base(id: string, rank: number, sessionId?: string) {
  return {
    id,
    rank,
    version: 1,
    layoutHint: "standard" as const,
    publishedAt: null,
    author: null,
    reasonKey: null,
    reasonLabel: null,
    isSeen: false,
    isSaved: false,
    isFollowingAuthor: false,
    nav: null,
    ...(sessionId ? { feedSessionId: sessionId } : {}),
  };
}

const postItem = {
  ...base("profile_post:p1", 4, SESSION),
  type: "post",
  title: null,
  payload: makePostPayload({ contentType: "profile_post", postId: TARGET }),
} as FeedItem;

const positionItem = {
  ...base("recruiting_ad:a1", 6, SESSION),
  type: "suggested_position",
  payload: { adId: TARGET },
} as unknown as FeedItem;

const modulesItem = {
  ...base("module:suggested_profiles:0", 8, SESSION),
  type: "suggested_profiles",
  payload: { identityId: null, identityType: null, moduleIndex: 0, moduleKey: "suggested_profiles", moduleLimit: 3 },
} as FeedItem;

describe("vocabolario eventi Feed (HOM-13 §259)", () => {
  it("contiene esattamente i dodici tipi accettati dal server", () => {
    expect([...FEED_EVENT_TYPES].sort()).toEqual(
      [
        "feed_load_more",
        "feed_refresh",
        "feed_session_start",
        "feed_unit_impression",
        "feed_unit_open",
        "follow_from_feed",
        "new_content_pill_shown",
        "new_content_pill_tap",
        "opportunity_impression",
        "opportunity_open",
        "suggested_profile_open",
        "suggested_profiles_impression",
      ].sort(),
    );
  });

  it("mappa le tab sul vocabolario del server", () => {
    expect(feedEventTab("per_te")).toBe("HOME_FOR_YOU");
    expect(feedEventTab("seguiti")).toBe("HOME_FOLLOWING");
  });
});

describe("buildFeedEvent", () => {
  it("costruisce l'evento con sessione, unit, posizione e bersaglio", () => {
    expect(
      buildFeedEvent(
        {
          eventType: "feed_unit_open",
          feedSessionId: SESSION,
          position: 4,
          tab: "per_te",
          targetId: TARGET,
          targetType: "content",
          unitKey: "profile_post:p1",
          unitType: "CONTENT",
        },
        META,
      ),
    ).toEqual({
      event_id: EVENT_ID,
      event_type: "feed_unit_open",
      feed_session_id: SESSION,
      occurred_at: META.occurredAt,
      position: 4,
      tab: "HOME_FOR_YOU",
      target_id: TARGET,
      target_type: "content",
      unit_key: "profile_post:p1",
      unit_type: "CONTENT",
    });
  });

  it("scarta un tipo fuori whitelist e un event_id non uuid", () => {
    expect(buildFeedEvent({ eventType: "feed_candidate_source" as never, tab: "per_te" }, META)).toBeNull();
    expect(
      buildFeedEvent({ eventType: "feed_refresh", tab: "per_te" }, { ...META, eventId: "x" }),
    ).toBeNull();
  });

  it("in Seguiti non invia feed_session_id", () => {
    const event = buildFeedEvent(
      { eventType: "feed_session_start", feedSessionId: SESSION, tab: "seguiti" },
      META,
    );

    expect(event?.tab).toBe("HOME_FOLLOWING");
    expect(event).not.toHaveProperty("feed_session_id");
  });

  it("omette i campi opzionali non validi senza perdere l'evento", () => {
    const event = buildFeedEvent(
      {
        eventType: "feed_unit_impression",
        feedSessionId: "non-uuid",
        position: 1e9,
        tab: "per_te",
        targetId: "non-uuid",
        targetType: "content",
        unitKey: "k".repeat(300),
      },
      META,
    );

    expect(event).not.toHaveProperty("feed_session_id");
    expect(event).not.toHaveProperty("target_id");
    expect(event?.position).toBe(99_999);
    expect(event?.unit_key).toHaveLength(200);
  });

  it("non porta mai pesi, score o reason (§258)", () => {
    const event = buildFeedEvent(
      { eventType: "feed_unit_impression", feedSessionId: SESSION, tab: "per_te", unitKey: "a" },
      META,
    );

    expect(Object.keys(event ?? {}).sort()).toEqual(
      ["event_id", "event_type", "feed_session_id", "occurred_at", "tab", "unit_key"].sort(),
    );
  });
});

describe("eventi di unit", () => {
  it("Opportunity e suggeriti si registrano a parte (§254–§255)", () => {
    expect(impressionEventFor(positionItem)).toBe("opportunity_impression");
    expect(impressionEventFor(modulesItem)).toBe("suggested_profiles_impression");
    expect(impressionEventFor(postItem)).toBe("feed_unit_impression");
    expect(openEventFor(positionItem)).toBe("opportunity_open");
    expect(openEventFor(postItem)).toBe("feed_unit_open");
  });

  it("l'apertura di una Posizione porta il bersaglio position", () => {
    expect(unitEventInput(positionItem, "per_te", "open")).toMatchObject({
      eventType: "opportunity_open",
      feedSessionId: SESSION,
      position: 6,
      targetId: TARGET,
      targetType: "position",
      unitKey: "recruiting_ad:a1",
      unitType: "OPPORTUNITY",
    });
  });

  it("l'impression non porta un bersaglio e in Seguiti non porta la sessione", () => {
    const input = unitEventInput(postItem, "seguiti", "impression");

    expect(input.feedSessionId).toBeNull();
    expect(input.targetId).toBeUndefined();
    expect(input.unitType).toBe("CONTENT");
  });
});
