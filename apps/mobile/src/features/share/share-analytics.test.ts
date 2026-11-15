import { afterEach, describe, expect, it } from "vitest";

import { setAnalyticsSink, type AnalyticsEvent } from "../../lib/analytics";
import { trackShare, type ShareAnalyticsEvent } from "./share-analytics";

afterEach(() => {
  setAnalyticsSink(null);
});

function collect() {
  const events: AnalyticsEvent[] = [];
  setAnalyticsSink((event) => events.push(event));
  return events;
}

const BATCH = { batchId: "b-1", contentId: "c-1", contentType: "club_media" } as const;
const SURFACE = { contentId: "c-1", contentType: "club_media", origin: "HOME_PER_TE" } as const;

/** Un evento per ciascun nome del §263, in ordine. `external_share_completion` non esiste di proposito. */
const ALL_EVENTS: ShareAnalyticsEvent[] = [
  { name: "share_sheet_open", ...SURFACE },
  { name: "recent_recipient_selected", position: 0, recipientKind: "direct" },
  { name: "share_more_open" },
  { name: "share_recipient_search", queryLength: 4 },
  { name: "share_recipient_selected", recipientKind: "person", selected: true },
  { name: "share_multi_select", count: 3 },
  { name: "share_message_step_open", recipientCount: 3 },
  { name: "internal_share_attempt", deliveryCount: 3, ...BATCH },
  { name: "internal_share_success", deliveryCount: 3, ...BATCH },
  { name: "internal_share_failure", deliveryCount: 3, ...BATCH },
  {
    name: "internal_share_partial_success",
    deliveryCount: 3,
    failedCount: 1,
    successCount: 2,
    ...BATCH,
  },
  { name: "internal_share_retry", retryCount: 1, ...BATCH },
  { name: "copy_link_success", ...SURFACE },
  { name: "external_share_sheet_open", ...SURFACE },
];

describe("trackShare (HOM-09 §263–§264)", () => {
  it("registra esattamente gli eventi del §263", () => {
    const events = collect();

    ALL_EVENTS.forEach(trackShare);

    expect(events.map((event) => event.name)).toEqual([
      "share_sheet_open",
      "recent_recipient_selected",
      "share_more_open",
      "share_recipient_search",
      "share_recipient_selected",
      "share_multi_select",
      "share_message_step_open",
      "internal_share_attempt",
      "internal_share_success",
      "internal_share_failure",
      "internal_share_partial_success",
      "internal_share_retry",
      "copy_link_success",
      "external_share_sheet_open",
    ]);
  });

  it("non esiste un evento di completamento dello share esterno (§203)", () => {
    const events = collect();

    ALL_EVENTS.forEach(trackShare);

    expect(events.some((event) => event.name.includes("completion"))).toBe(false);
  });

  it("un multi-send è un solo batch con N delivery (§143, §195)", () => {
    const events = collect();

    trackShare({ name: "internal_share_partial_success", deliveryCount: 5, failedCount: 2, successCount: 3, ...BATCH });

    expect(events).toHaveLength(1);
    expect(events[0].props).toMatchObject({ batchId: "b-1", deliveryCount: 5, failedCount: 2, successCount: 3 });
  });

  it("nessuna proprietà contiene testo, query, nomi o URL (§264)", () => {
    const events = collect();

    ALL_EVENTS.forEach(trackShare);

    const keys = new Set(events.flatMap((event) => Object.keys(event.props)));
    const values = events.flatMap((event) => Object.values(event.props)).map(String);

    for (const forbidden of ["text", "message", "query", "url", "name", "displayName"]) {
      expect(keys.has(forbidden)).toBe(false);
    }

    expect(values.some((value) => /^https?:\/\//.test(value) || value.startsWith("footme://"))).toBe(false);
    // La ricerca porta solo la lunghezza.
    expect(events[3].props).toEqual({ queryLength: 4 });
  });
});
