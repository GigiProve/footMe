import { describe, expect, it } from "vitest";

import type { FeedScrollState } from "./feed-cache";
import {
  FOLLOWING_HINT_MAX_SHOWS,
  RESUME_BANNER_COOLDOWN_MS,
  RESUME_BANNER_MAX_AGE_MS,
  RESUME_BANNER_MIN_AGE_MS,
  RESUME_BANNER_MIN_OFFSET,
  shouldRestoreOffset,
  shouldShowResumeBanner,
  shouldShowFollowingHint,
} from "./feed-scroll-rules";

const NOW = new Date("2026-07-31T12:00:00.000Z").getTime();

function saved(overrides: Partial<FeedScrollState> = {}): FeedScrollState {
  return {
    itemCount: 10,
    offset: 1200,
    savedAt: new Date(NOW - RESUME_BANNER_MIN_AGE_MS - 1000).toISOString(),
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
    expect(shouldRestoreOffset(saved({ offset: 4 }), 10, true)).toBe(false);
  });

  it("NON ripristina senza uno stato salvato", () => {
    expect(shouldRestoreOffset(null, 10, true)).toBe(false);
  });
});

describe("shouldShowResumeBanner", () => {
  const base = {
    alreadyShownThisSession: false,
    bannerShownAt: null,
    now: NOW,
    restoredOffset: 1200,
    savedAt: new Date(NOW - RESUME_BANNER_MIN_AGE_MS - 1000).toISOString(),
  };

  it("compare quando tutte e quattro le condizioni valgono", () => {
    expect(shouldShowResumeBanner(base)).toBe(true);
  });

  it("non compare due volte nella stessa sessione", () => {
    expect(
      shouldShowResumeBanner({ ...base, alreadyShownThisSession: true }),
    ).toBe(false);
  });

  it("non compare per una posizione poco profonda", () => {
    expect(
      shouldShowResumeBanner({ ...base, restoredOffset: RESUME_BANNER_MIN_OFFSET - 1 }),
    ).toBe(false);
  });

  it("non compare se l'utente non si è mai davvero allontanato", () => {
    expect(
      shouldShowResumeBanner({
        ...base,
        savedAt: new Date(NOW - RESUME_BANNER_MIN_AGE_MS + 1000).toISOString(),
      }),
    ).toBe(false);
  });

  it("non compare se la posizione è stantia", () => {
    expect(
      shouldShowResumeBanner({
        ...base,
        savedAt: new Date(NOW - RESUME_BANNER_MAX_AGE_MS - 1000).toISOString(),
      }),
    ).toBe(false);
  });

  it("rispetta il cooldown persistito tra due comparse", () => {
    expect(
      shouldShowResumeBanner({
        ...base,
        bannerShownAt: new Date(NOW - RESUME_BANNER_COOLDOWN_MS + 1000).toISOString(),
      }),
    ).toBe(false);

    expect(
      shouldShowResumeBanner({
        ...base,
        bannerShownAt: new Date(NOW - RESUME_BANNER_COOLDOWN_MS - 1000).toISOString(),
      }),
    ).toBe(true);
  });

  it("non compare senza un timestamp valido", () => {
    expect(shouldShowResumeBanner({ ...base, savedAt: null })).toBe(false);
    expect(shouldShowResumeBanner({ ...base, savedAt: "non-una-data" })).toBe(false);
  });
});

describe("shouldShowFollowingHint", () => {
  it("mostra l'helper solo nei primi accessi", () => {
    expect(shouldShowFollowingHint(0)).toBe(true);
    expect(shouldShowFollowingHint(FOLLOWING_HINT_MAX_SHOWS - 1)).toBe(true);
    expect(shouldShowFollowingHint(FOLLOWING_HINT_MAX_SHOWS)).toBe(false);
  });
});
