/** Log tecnico del Feed: solo id e tipo, una volta per unit e motivo (HOM-15 §356–§357). */
import { afterEach, describe, expect, it } from "vitest";

import { setAnalyticsSink, type AnalyticsEvent } from "../../lib/analytics";
import { logFeedAnomaly, resetFeedAnomalyLog } from "./feed-diagnostics";
import { mapFeedRow } from "./feed-service";

afterEach(() => {
  setAnalyticsSink(null);
  resetFeedAnomalyLog();
});

function collect() {
  const events: AnalyticsEvent[] = [];
  setAnalyticsSink((event) => events.push(event));
  return events;
}

describe("logFeedAnomaly", () => {
  it("manda al sink solo motivo, id e tipo; un id non stringa diventa null", () => {
    const events = collect();

    logFeedAnomaly("missing_renderer", { id: "x:1", type: "poll" });
    logFeedAnomaly("malformed_unit", { id: 42, type: undefined });

    expect(events.map((event) => event.props)).toEqual([
      { itemId: "x:1", itemType: "poll", reason: "missing_renderer" },
      { itemId: null, itemType: null, reason: "malformed_unit" },
    ]);
    expect(events[0].name).toBe("feed_technical_issue");
  });

  it("una volta per unit e motivo: il default del renderer non inonda il log", () => {
    const events = collect();

    logFeedAnomaly("missing_renderer", { id: "x:1", type: "poll" });
    logFeedAnomaly("missing_renderer", { id: "x:1", type: "poll" });

    expect(events).toHaveLength(1);
  });

  it("mapFeedRow: una riga scartata lascia il log, senza payload", () => {
    const events = collect();

    const item = mapFeedRow({
      data: { body: "testo privato", content_type: "club_media" },
      item_type: "post",
      item_uid: "club_media:u1",
    } as never);

    expect(item).toBeNull();
    expect(events).toHaveLength(1);
    expect(events[0].props).toEqual({ itemId: "club_media:u1", itemType: "post", reason: "malformed_unit" });
  });
});
