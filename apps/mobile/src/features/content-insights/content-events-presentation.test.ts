import { describe, expect, it } from "vitest";

import {
  authorOpenEventType,
  buildContentEvent,
  createActiveTimeTracker,
  identityOpenEvent,
  isClubMediaArticle,
  parseContentKey,
  sanitizeEventProps,
  sourceForOrigin,
  sourceForScope,
} from "./content-events-presentation";
import {
  CONTENT_EVENT_SOURCES,
  type ContentEventInput,
} from "./content-events-types";
import { CONTENT_ORIGINS } from "../feed/content-routes";

const POST_ID = "3f1d8a4e-5b2c-4d7a-9e11-2c4b6a8d0f13";
const EVENT_ID = "8c2e6b1a-4d3f-4a9b-8e21-7d5c3b9a1e04";
const META = { eventId: EVENT_ID, occurredAt: "2026-11-13T10:00:00.000Z", sessionId: "session-1" };

function input(overrides: Partial<ContentEventInput> = {}): ContentEventInput {
  return {
    contentType: "profile_post",
    eventType: "impression",
    postId: POST_ID,
    source: "HOME_FOR_YOU",
    ...overrides,
  };
}

describe("sourceForOrigin (§146)", () => {
  it("segue il mapping del contratto", () => {
    expect(sourceForOrigin("HOME_PER_TE")).toBe("HOME_FOR_YOU");
    expect(sourceForOrigin("HOME_SEGUITI")).toBe("HOME_FOLLOWING");
    expect(sourceForOrigin("PROFILE")).toBe("PROFILE");
    expect(sourceForOrigin("SEARCH")).toBe("SEARCH");
    expect(sourceForOrigin("MESSAGE")).toBe("MESSAGE");
    expect(sourceForOrigin("SAVED")).toBe("OTHER");
    expect(sourceForOrigin("DEEP_LINK")).toBe("OTHER");
    expect(sourceForOrigin(null)).toBe("OTHER");
    expect(sourceForOrigin(undefined)).toBe("OTHER");
  });

  it("ogni origine produce una source della whitelist", () => {
    for (const origin of CONTENT_ORIGINS) {
      expect(CONTENT_EVENT_SOURCES).toContain(sourceForOrigin(origin));
    }
  });

  it("la tab del Feed: Per te e Seguiti", () => {
    expect(sourceForScope("per_te")).toBe("HOME_FOR_YOU");
    expect(sourceForScope("seguiti")).toBe("HOME_FOLLOWING");
  });
});

describe("isClubMediaArticle (§101, stessa regola di feed_content_index)", () => {
  it("testo lungo senza video è Articolo", () => {
    expect(isClubMediaArticle("image", "a".repeat(400))).toBe(true);
    expect(isClubMediaArticle(null, "a".repeat(400))).toBe(true);
  });

  it("testo corto o assente non è Articolo", () => {
    expect(isClubMediaArticle("image", "a".repeat(399))).toBe(false);
    expect(isClubMediaArticle("image", null)).toBe(false);
  });

  it("il video vince sul testo lungo", () => {
    expect(isClubMediaArticle("video", "a".repeat(1000))).toBe(false);
  });

  it("conta i caratteri, non le unità UTF-16 (come length() in SQL)", () => {
    expect(isClubMediaArticle("image", "⚽".repeat(399))).toBe(false);
  });

  it("HOM-06.1: il kind post resta Post anche con testo lungo", () => {
    expect(isClubMediaArticle("image", "a".repeat(1000), "post")).toBe(false);
    expect(isClubMediaArticle(null, "a".repeat(400), "interview")).toBe(true);
  });
});

describe("parseContentKey", () => {
  it("legge la chiave <content_type>:<uuid>", () => {
    expect(parseContentKey(`club_media:${POST_ID}`)).toEqual({
      contentType: "club_media",
      postId: POST_ID,
    });
  });

  it("scarta tipi sconosciuti, id non uuid e chiavi vuote", () => {
    expect(parseContentKey(`post:${POST_ID}`)).toBeNull();
    expect(parseContentKey("club_media:p1")).toBeNull();
    expect(parseContentKey("nessunseparatore")).toBeNull();
    expect(parseContentKey("")).toBeNull();
    expect(parseContentKey(null)).toBeNull();
  });
});

describe("azioni professionali (§55–56)", () => {
  it("l'autore Società è society_open, il profilo è author_profile_open", () => {
    expect(authorOpenEventType("club")).toBe("society_open");
    expect(authorOpenEventType("profile")).toBe("author_profile_open");
    expect(authorOpenEventType(null)).toBe("author_profile_open");
  });

  it("un solo evento per tap su mention e tag", () => {
    expect(identityOpenEvent("club")).toEqual({ eventType: "society_open" });
    expect(identityOpenEvent("profile")).toEqual({
      eventType: "tagged_open",
      props: { targetType: "profile" },
    });
    expect(identityOpenEvent("team")).toEqual({
      eventType: "tagged_open",
      props: { targetType: "team" },
    });
  });
});

describe("buildContentEvent", () => {
  it("costruisce l'elemento di p_events con i metadata (§149)", () => {
    expect(buildContentEvent(input(), META)).toEqual({
      content_type: "profile_post",
      event_id: EVENT_ID,
      event_type: "impression",
      occurred_at: META.occurredAt,
      post_id: POST_ID,
      props: {},
      session_id: "session-1",
      source: "HOME_FOR_YOU",
    });
  });

  it("scarta gli eventi non validi lato client", () => {
    expect(buildContentEvent(input({ contentType: "post" }), META)).toBeNull();
    expect(buildContentEvent(input({ postId: "p1" }), META)).toBeNull();
    expect(
      buildContentEvent(input({ eventType: "like" as never }), META),
    ).toBeNull();
    expect(
      buildContentEvent(input({ source: "FACEBOOK" as never }), META),
    ).toBeNull();
    expect(buildContentEvent(input(), { ...META, eventId: "non-uuid" })).toBeNull();
    expect(buildContentEvent(input(), { ...META, sessionId: "" })).toBeNull();
    expect(buildContentEvent(input(), { ...META, occurredAt: "ieri" })).toBeNull();
  });

  it("video_progress e video_watch richiedono la loro proprietà", () => {
    expect(buildContentEvent(input({ eventType: "video_progress" }), META)).toBeNull();
    expect(buildContentEvent(input({ eventType: "video_watch" }), META)).toBeNull();
    expect(buildContentEvent(input({ eventType: "article_read" }), META)).toBeNull();
  });

  it("§150 niente testo: le props sono ricostruite, mai copiate", () => {
    const event = buildContentEvent(
      input({
        eventType: "video_watch",
        props: {
          mediaId: POST_ID,
          seconds: 12.34,
          // Chiavi estranee, come un titolo o un corpo, non devono passare.
          ...({ title: "Titolo", body: "Testo del post" } as object),
        },
      }),
      META,
    );

    expect(event?.props).toEqual({ media_id: POST_ID, seconds: 12.3 });
    expect(JSON.stringify(event)).not.toContain("Testo del post");
    expect(JSON.stringify(event)).not.toContain("Titolo");
  });

  it("le props non pertinenti al tipo si omettono", () => {
    const event = buildContentEvent(
      input({ eventType: "author_profile_open", props: { seconds: 9, percent: 50 } }),
      META,
    );
    expect(event?.props).toEqual({});
  });
});

describe("sanitizeEventProps", () => {
  it("percent è un intero 0–100", () => {
    expect(sanitizeEventProps("video_progress", { percent: 24.6 })).toEqual({ percent: 25 });
    expect(sanitizeEventProps("video_progress", { percent: 100 })).toEqual({ percent: 100 });
    expect(sanitizeEventProps("video_progress", { percent: 101 })).toBeNull();
    expect(sanitizeEventProps("video_progress", { percent: -1 })).toBeNull();
    expect(sanitizeEventProps("video_progress", { percent: Number.NaN })).toBeNull();
  });

  it("seconds è positivo, finito e limitato", () => {
    expect(sanitizeEventProps("article_read", { seconds: 0 })).toBeNull();
    expect(sanitizeEventProps("article_read", { seconds: -3 })).toBeNull();
    expect(sanitizeEventProps("article_read", { seconds: Number.POSITIVE_INFINITY })).toBeNull();
    expect(sanitizeEventProps("article_read", { seconds: 999_999 })).toEqual({ seconds: 86_400 });
  });

  it("media_id non uuid si omette senza invalidare l'evento", () => {
    expect(sanitizeEventProps("video_progress", { mediaId: "m-1", percent: 50 })).toEqual({
      percent: 50,
    });
  });

  it("tagged_open ammette solo un target_type noto", () => {
    expect(sanitizeEventProps("tagged_open", { targetType: "team" })).toEqual({
      target_type: "team",
    });
    expect(sanitizeEventProps("tagged_open", { targetType: "boh" as never })).toEqual({});
  });
});

describe("createActiveTimeTracker (§107)", () => {
  it("conta solo il tempo tra start e pause", () => {
    let now = 0;
    const tracker = createActiveTimeTracker(() => now);

    tracker.start();
    now = 10_000;
    tracker.pause();
    now = 60_000; // fuori fuoco: non conta
    tracker.start();
    now = 65_000;
    tracker.pause();

    expect(tracker.take()).toBe(15);
    expect(tracker.take()).toBe(0);
  });

  it("take lascia il contatore in corsa se era attivo", () => {
    let now = 0;
    const tracker = createActiveTimeTracker(() => now);

    tracker.start();
    now = 4_000;
    expect(tracker.take()).toBe(4);
    now = 9_000;
    expect(tracker.take()).toBe(5);
  });

  it("start doppio non azzera il tempo già trascorso", () => {
    let now = 0;
    const tracker = createActiveTimeTracker(() => now);

    tracker.start();
    now = 3_000;
    tracker.start();
    now = 5_000;
    tracker.pause();

    expect(tracker.take()).toBe(5);
  });
});
