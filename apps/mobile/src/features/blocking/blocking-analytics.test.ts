/**
 * Eventi di Blocca / Sblocca (HOM-12 §250–§253): i sedici del §250, nessun testo privato,
 * nessun «follow restored».
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { setAnalyticsSink } from "../../lib/analytics";
import { BLOCKING_EVENT_NAMES, trackBlocking } from "./blocking-analytics";

afterEach(() => setAnalyticsSink(null));

describe("blocking analytics", () => {
  it("gli eventi sono esattamente quelli del §250, nell'ordine della specifica", () => {
    expect(BLOCKING_EVENT_NAMES).toEqual([
      "profile_actions_open",
      "block_selected",
      "block_confirmation_cancelled",
      "block_submit",
      "block_success",
      "block_failure",
      "blocked_profile_state_viewed_by_blocker",
      "profile_unavailable_state_viewed",
      "blocked_direct_opened_by_blocker",
      "blocked_direct_opened_by_blocked",
      "unblock_from_profile",
      "unblock_from_chat",
      "blocked_profiles_open",
      "unblock_from_settings",
      "unblock_success",
      "unblock_failure",
    ]);
  });

  it("nessun evento «follow restored» (§253)", () => {
    expect(BLOCKING_EVENT_NAMES.join(" ")).not.toMatch(/restor/);
  });

  it("le props sono solo identity_type/surface/reason, mai nomi, testi o id", () => {
    const sink = vi.fn();
    setAnalyticsSink(sink);

    trackBlocking({ identityType: "society", name: "block_failure", reason: "network", surface: "profile" });
    trackBlocking({ name: "blocked_profiles_open" });

    expect(sink.mock.calls[0][0]).toMatchObject({
      name: "block_failure",
      props: { identityType: "society", reason: "network", surface: "profile" },
    });
    expect(sink.mock.calls[1][0].props).toEqual({});
  });
});
