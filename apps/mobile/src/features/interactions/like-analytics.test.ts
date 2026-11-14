import { afterEach, describe, expect, it } from "vitest";

import { setAnalyticsSink, type AnalyticsEvent } from "../../lib/analytics";
import {
  LIKE_ANALYTICS_EVENT_NAMES,
  classifyLikeFailure,
  trackLike,
} from "./like-analytics";

afterEach(() => setAnalyticsSink(null));

function capture() {
  const events: AnalyticsEvent[] = [];
  setAnalyticsSink((event) => events.push(event));
  return events;
}

describe("like-analytics — HOM-07 §189", () => {
  it("gli otto eventi del Like del §189, né più né meno", () => {
    expect([...LIKE_ANALYTICS_EVENT_NAMES]).toEqual([
      "like_add_attempt",
      "like_add_success",
      "like_remove_attempt",
      "like_remove_success",
      "like_failure",
      "likes_list_open",
      "identity_open_from_likes",
      "follow_from_likes",
    ]);
  });

  it("separa il nome dalle proprietà", () => {
    const events = capture();

    trackLike({
      contentId: "post-1",
      contentType: "club_media",
      identityType: "society",
      name: "like_add_attempt",
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      name: "like_add_attempt",
      props: { contentId: "post-1", contentType: "club_media", identityType: "society" },
    });
  });

  it("§190: nessun testo del contenuto né nome dell'identità nelle proprietà", () => {
    const events = capture();

    trackLike({
      actorType: "person",
      contentId: "post-1",
      contentType: "profile_post",
      following: true,
      name: "follow_from_likes",
    });
    trackLike({ contentId: "post-1", contentType: "club_media", likesCount: 146, name: "likes_list_open" });

    for (const event of events) {
      expect(Object.keys(event.props).sort()).not.toContain("name");
      expect(Object.keys(event.props).sort()).not.toContain("text");
      expect(Object.keys(event.props).sort()).not.toContain("body");
    }
  });
});

describe("classifyLikeFailure", () => {
  it("riconosce identità non autorizzata e contenuto non disponibile", () => {
    expect(classifyLikeFailure(new Error("like_identity_forbidden"))).toBe("forbidden");
    expect(classifyLikeFailure({ message: "content_unavailable" })).toBe("unavailable");
  });

  it("tutto il resto è un guasto temporaneo, mai il messaggio grezzo", () => {
    expect(classifyLikeFailure(new Error("Network request failed"))).toBe("network");
    expect(classifyLikeFailure(null)).toBe("network");
  });
});
