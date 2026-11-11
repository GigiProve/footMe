import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  formatCompactRelativeTime,
  formatRelativeTime,
  formatSpokenRelativeTime,
} from "./relative-time";

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

const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString();

// HOM-02 §10: la variante compatta non ha il "fa" e usa "ieri" minuscolo.
describe("formatCompactRelativeTime", () => {
  it.each([
    [minutesAgo(0.2), "ora"],
    [minutesAgo(5), "5 min"],
    [hoursAgo(1), "1 h"],
    [hoursAgo(6), "6 h"],
    [hoursAgo(30), "ieri"],
    [hoursAgo(24 * 2 + 3), "2 giorni fa"],
  ])("formatta %s come %s", (iso, expected) => {
    expect(formatCompactRelativeTime(iso, NOW)).toBe(expected);
  });

  it("passa a una data compatta dopo una settimana, con l'anno solo se diverso", () => {
    const sameYear = hoursAgo(24 * 10);
    const otherYear = "2025-03-02T10:00:00.000Z";

    expect(formatCompactRelativeTime(sameYear, NOW)).toBe(
      new Date(sameYear).toLocaleDateString("it-IT", { day: "numeric", month: "short" }),
    );
    expect(formatCompactRelativeTime(otherYear, NOW)).toContain("2025");
  });

  it("un valore non valido o nel futuro non produce testo spurio", () => {
    expect(formatCompactRelativeTime("non-una-data", NOW)).toBe("");
    expect(formatCompactRelativeTime(minutesAgo(-30), NOW)).toBe("ora");
  });
});

describe("formatSpokenRelativeTime", () => {
  it.each([
    [minutesAgo(0.2), "adesso"],
    [minutesAgo(1), "1 minuto fa"],
    [minutesAgo(5), "5 minuti fa"],
    [hoursAgo(1), "1 ora fa"],
    [hoursAgo(2), "2 ore fa"],
    [hoursAgo(30), "ieri"],
    [hoursAgo(24 * 3), "3 giorni fa"],
  ])("legge %s come %s", (iso, expected) => {
    expect(formatSpokenRelativeTime(iso, NOW)).toBe(expected);
  });
});
