/**
 * Analytics di Segnala: gli otto eventi del §188 uno a uno, mai il testo libero (HOM-11
 * §188–§191, §297–§298).
 */
import { afterEach, describe, expect, it } from "vitest";

import { setAnalyticsSink, type AnalyticsEvent } from "../../lib/analytics";
import { REPORT_ANALYTICS_EVENT_NAMES, trackReport } from "./moderation-analytics";

afterEach(() => setAnalyticsSink(null));

function capture() {
  const events: AnalyticsEvent[] = [];
  setAnalyticsSink((event) => events.push(event));
  return events;
}

describe("moderation-analytics — HOM-11 §188", () => {
  it("gli otto eventi del §188, né più né meno, nell'ordine della specifica", () => {
    expect([...REPORT_ANALYTICS_EVENT_NAMES]).toEqual([
      "report_flow_open",
      "report_category_selected",
      "report_subcategory_selected",
      "report_submit_attempt",
      "report_submit_success",
      "report_submit_failure",
      "report_duplicate_detected",
      "report_comment_open",
    ]);
    expect(new Set(REPORT_ANALYTICS_EVENT_NAMES).size).toBe(8);
  });

  it("separa il nome dalle proprietà; l'id della categoria è interno e non sensibile (§190)", () => {
    const events = capture();

    trackReport({
      categoryId: "spam",
      contentType: "club_media",
      name: "report_category_selected",
      origin: "HOME_PER_TE",
      targetType: "CONTENT",
    });

    expect(events[0]).toMatchObject({
      name: "report_category_selected",
      props: { categoryId: "spam", contentType: "club_media", origin: "HOME_PER_TE", targetType: "CONTENT" },
    });
  });

  it("§189, §298: il tentativo dice SE ci sono dettagli, non quali; nessun testo libero", () => {
    const events = capture();

    trackReport({
      categoryId: "other",
      contentType: "profile_post",
      hasDetails: true,
      isRetry: false,
      name: "report_submit_attempt",
      origin: null,
      subcategoryId: null,
      targetType: "COMMENT",
    });

    const keys = Object.keys(events[0].props);
    expect(events[0].props.hasDetails).toBe(true);
    for (const forbidden of ["details", "text", "body", "message", "freeText"]) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it("§191: nessun evento lega il reporter all'autore", () => {
    const events = capture();

    trackReport({
      contentType: "club_media",
      name: "report_flow_open",
      origin: "HOME_PER_TE",
      targetType: "CONTENT",
    });

    const keys = Object.keys(events[0].props);
    for (const forbidden of ["reporterId", "viewerId", "profileId", "authorId", "authorIdentityId"]) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it("§297: i nomi non coincidono con Follow né «Non mi interessa»", () => {
    for (const name of REPORT_ANALYTICS_EVENT_NAMES) {
      expect(name.startsWith("report_")).toBe(true);
    }
  });
});
