/**
 * Eventi del Centro Notifiche (HOM-14 §256–§257): i nove previsti, distinti per
 * apertura del Centro, vista in lotto e apertura della singola notifica; nessun
 * testo privato (§261).
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { setAnalyticsSink } from "../../lib/analytics";
import { NOTIFICATION_EVENT_NAMES, trackNotification } from "./notification-analytics";

afterEach(() => setAnalyticsSink(null));

describe("notification analytics", () => {
  it("gli eventi sono quelli del §256–§257, nell'ordine dichiarato", () => {
    expect(NOTIFICATION_EVENT_NAMES).toEqual([
      "notification_center_open",
      "notification_center_seen_batch",
      "notification_badge_cleared_on_center_open",
      "notification_impression",
      "notification_open",
      "notification_target_open_success",
      "notification_target_unavailable",
      "notification_load_more",
      "notification_refresh",
    ]);
  });

  it("apertura del Centro, vista in lotto e apertura singola sono eventi distinti", () => {
    const names = new Set(NOTIFICATION_EVENT_NAMES);

    expect(names.has("notification_center_open")).toBe(true);
    expect(names.has("notification_center_seen_batch")).toBe(true);
    expect(names.has("notification_open")).toBe(true);
    expect(names.size).toBe(NOTIFICATION_EVENT_NAMES.length);
  });

  it("le props sono tipo, conteggi e provenienza: mai testo, nomi o id", () => {
    const sink = vi.fn();
    setAnalyticsSink(sink);

    trackNotification({
      name: "notification_open",
      notificationType: "comment_replied",
      origin: "push",
      wasOpened: false,
    });
    trackNotification({ name: "notification_refresh" });

    expect(sink.mock.calls[0][0]).toMatchObject({
      name: "notification_open",
      props: { notificationType: "comment_replied", origin: "push", wasOpened: false },
    });
    expect(sink.mock.calls[1][0].props).toEqual({});
  });
});
