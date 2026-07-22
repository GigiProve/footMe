import { describe, expect, it } from "vitest";

import {
  formatAddedDate,
  formatEntrySubtitle,
  formatListSubtitle,
  getPriorityBadgeVariant,
  getStatusBadgeVariant,
} from "./shortlist-display-helpers";
import type {
  ShortlistEvaluationStatus,
  ShortlistPriority,
} from "./shortlist-service";

describe("getPriorityBadgeVariant", () => {
  it("maps every priority to its badge variant", () => {
    const expected: Record<ShortlistPriority, string> = {
      alta: "error",
      bassa: "accent",
      media: "warning",
    };

    for (const [priority, variant] of Object.entries(expected)) {
      expect(getPriorityBadgeVariant(priority as ShortlistPriority)).toBe(variant);
    }
  });
});

describe("getStatusBadgeVariant", () => {
  it("marks contattato as success and every other status as default", () => {
    const statuses: ShortlistEvaluationStatus[] = [
      "da_valutare",
      "interessante",
      "da_contattare",
      "contattato",
      "non_prioritario",
      "scartato",
    ];

    for (const status of statuses) {
      expect(getStatusBadgeVariant(status)).toBe(
        status === "contattato" ? "success" : "default",
      );
    }
  });
});

describe("formatEntrySubtitle", () => {
  it("shows the position for players, the team, and the birth year", () => {
    expect(
      formatEntrySubtitle({
        birth_year: 2006,
        current_team: "AC Como",
        primary_position: "forward",
        role: "player",
      }),
    ).toBe("Attaccante • AC Como • Classe 2006");
  });

  it("falls back to Svincolato when the player has no current team", () => {
    expect(
      formatEntrySubtitle({
        birth_year: 2006,
        current_team: null,
        primary_position: "forward",
        role: "player",
      }),
    ).toBe("Attaccante • Svincolato • Classe 2006");
  });

  it("omits the birth year segment when unknown", () => {
    expect(
      formatEntrySubtitle({
        birth_year: null,
        current_team: "AC Como",
        primary_position: "forward",
        role: "player",
      }),
    ).toBe("Attaccante • AC Como");
  });

  it("uses formatRole instead of the position for non-player profiles", () => {
    expect(
      formatEntrySubtitle({
        birth_year: 1985,
        current_team: "AC Como",
        primary_position: null,
        role: "coach",
      }),
    ).toBe("Allenatore • AC Como • Classe 1985");
  });
});

describe("formatAddedDate", () => {
  it("formats an ISO date with Italian month names", () => {
    expect(formatAddedDate("2026-06-12T10:00:00Z")).toBe("12 giugno 2026");
  });

  it("covers every Italian month", () => {
    const expectedMonths = [
      "gennaio",
      "febbraio",
      "marzo",
      "aprile",
      "maggio",
      "giugno",
      "luglio",
      "agosto",
      "settembre",
      "ottobre",
      "novembre",
      "dicembre",
    ];

    expectedMonths.forEach((month, index) => {
      const isoMonth = String(index + 1).padStart(2, "0");
      expect(formatAddedDate(`2026-${isoMonth}-05T00:00:00Z`)).toBe(`5 ${month} 2026`);
    });
  });
});

describe("formatListSubtitle", () => {
  it("omits the priority segment when there are zero high-priority entries", () => {
    expect(
      formatListSubtitle({ entry_count: 12, high_priority_count: 0 }),
    ).toBe("12 profili");
  });

  it("includes the priority segment when there is at least one high-priority entry", () => {
    expect(
      formatListSubtitle({ entry_count: 12, high_priority_count: 3 }),
    ).toBe("12 profili • 3 priorità alta");
  });

  it("uses the singular form for exactly one profile", () => {
    expect(
      formatListSubtitle({ entry_count: 1, high_priority_count: 0 }),
    ).toBe("1 profilo");
  });

  it("uses the singular profile form alongside a priority segment", () => {
    expect(
      formatListSubtitle({ entry_count: 1, high_priority_count: 1 }),
    ).toBe("1 profilo • 1 priorità alta");
  });
});
