/**
 * Analytics di «Non mi interessa»: i sei eventi del §186 uno a uno, distinti da Follow e
 * Segnala (HOM-11 §186, §190, §191, §297).
 */
import { afterEach, describe, expect, it } from "vitest";

import { setAnalyticsSink, type AnalyticsEvent } from "../../lib/analytics";
import { FEED_FEEDBACK_EVENT_NAMES, trackFeedFeedback } from "./feed-feedback-analytics";

afterEach(() => setAnalyticsSink(null));

function capture() {
  const events: AnalyticsEvent[] = [];
  setAnalyticsSink((event) => events.push(event));
  return events;
}

describe("feed-feedback-analytics — HOM-11 §186", () => {
  it("i sei eventi del §186, né più né meno, nell'ordine della specifica", () => {
    expect([...FEED_FEEDBACK_EVENT_NAMES]).toEqual([
      "not_interested_selected",
      "not_interested_success",
      "not_interested_failure",
      "not_interested_undo",
      "not_interested_reason_open",
      "not_interested_reason_selected",
    ]);
    expect(new Set(FEED_FEEDBACK_EVENT_NAMES).size).toBe(6);
  });

  it("separa il nome dalle proprietà", () => {
    const events = capture();

    trackFeedFeedback({
      contentId: "p1",
      contentType: "club_media",
      name: "not_interested_reason_selected",
      origin: "HOME_PER_TE",
      reasonId: "other",
      simpleRepost: false,
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      name: "not_interested_reason_selected",
      props: {
        contentId: "p1",
        contentType: "club_media",
        origin: "HOME_PER_TE",
        reasonId: "other",
        simpleRepost: false,
      },
    });
  });

  it("§191: nessun testo del contenuto, né identità del viewer o dell'autore", () => {
    const events = capture();

    trackFeedFeedback({
      contentId: "p1",
      contentType: "club_media",
      name: "not_interested_selected",
      origin: "HOME_PER_TE",
      simpleRepost: true,
    });

    const keys = Object.keys(events[0].props);
    for (const forbidden of ["body", "text", "title", "authorId", "viewerId", "profileId", "name"]) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it("§297: nessun nome di evento coincide con Follow o Segnala", () => {
    for (const name of FEED_FEEDBACK_EVENT_NAMES) {
      expect(name.startsWith("not_interested_")).toBe(true);
      expect(name).not.toMatch(/^(follow|report)_/);
    }
  });
});
