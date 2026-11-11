import { describe, expect, it } from "vitest";

import type { FeedScrollState } from "./feed-cache";
import { MIN_RESTORE_OFFSET, shouldRestoreOffset } from "./feed-scroll-rules";

function saved(overrides: Partial<FeedScrollState> = {}): FeedScrollState {
  return {
    itemCount: 10,
    offset: 1200,
    savedAt: "2026-07-31T11:00:00.000Z",
    ...overrides,
  };
}
describe("shouldRestoreOffset", () => {
  it("ripristina quando la lista viene dalla cache e non si è accorciata", () => {
    expect(shouldRestoreOffset(saved(), 10, true)).toBe(true);
    expect(shouldRestoreOffset(saved(), 20, true)).toBe(true);
  });

  it("NON ripristina quando la lista è stata rifetchata invece che idratata", () => {
    // È il caso che conta: l'offset punterebbe a contenuti che non ci sono più.
    expect(shouldRestoreOffset(saved(), 10, false)).toBe(false);
  });

  it("NON ripristina quando la lista mostrata è più corta di quella salvata", () => {
    expect(shouldRestoreOffset(saved({ itemCount: 30 }), 10, true)).toBe(false);
  });

  it("NON ripristina un offset trascurabile", () => {
    expect(shouldRestoreOffset(saved({ offset: MIN_RESTORE_OFFSET - 4 }), 10, true)).toBe(false);
  });

  it("NON ripristina senza uno stato salvato", () => {
    expect(shouldRestoreOffset(null, 10, true)).toBe(false);
  });
});
