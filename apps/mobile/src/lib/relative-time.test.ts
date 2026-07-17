import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatRelativeTime } from "./relative-time";

const NOW = new Date("2026-07-17T12:00:00.000Z");

describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'Ora' for timestamps under a minute old", () => {
    const iso = new Date(NOW.getTime() - 30 * 1000).toISOString();
    expect(formatRelativeTime(iso)).toBe("Ora");
  });

  it("returns minutes for timestamps under an hour old", () => {
    const iso = new Date(NOW.getTime() - 15 * 60 * 1000).toISOString();
    expect(formatRelativeTime(iso)).toBe("15 min fa");
  });

  it("returns hours for timestamps under a day old", () => {
    const iso = new Date(NOW.getTime() - 5 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(iso)).toBe("5 h fa");
  });

  it("returns 'Ieri' for timestamps between 24 and 48 hours old", () => {
    const iso = new Date(NOW.getTime() - 30 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(iso)).toBe("Ieri");
  });

  it("returns days for timestamps under a week old", () => {
    const iso = new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(iso)).toBe("3 giorni fa");
  });

  it("returns a localized date for timestamps a week or older", () => {
    const iso = new Date(NOW.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(iso)).toBe(
      new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short" }),
    );
  });
});
