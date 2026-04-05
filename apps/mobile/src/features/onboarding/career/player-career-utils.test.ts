import { describe, expect, it } from "vitest";

import type { PlayerCareerEntry } from "./player-career-types";
import {
  getOccupiedPlayerSeasonLabels,
  getPlayerEndYearOptions,
  getPlayerSeasonSelectOptions,
  getPlayerStartYearOptions,
  sanitizePlayerPeriodSelection,
} from "./player-career-utils";

function createEntry(overrides: Partial<PlayerCareerEntry>): PlayerCareerEntry {
  return {
    clubId: null,
    id: "entry-1",
    teamCity: "",
    teamLogoUrl: "",
    teamName: "ASD Test",
    category: "Prima Squadra",
    type: "SINGLE_SEASON",
    seasons: ["2024/2025"],
    period: null,
    seasonDetails: {},
    ...overrides,
  };
}

describe("player-career-utils", () => {
  it("excludes the current entry when computing occupied seasons", () => {
    const entries: PlayerCareerEntry[] = [
      createEntry({ id: "entry-1", seasons: ["2024/2025"] }),
      createEntry({ id: "entry-2", seasons: ["2023/2024"] }),
    ];

    expect(getOccupiedPlayerSeasonLabels(entries, "entry-1")).toEqual(
      new Set(["2023/2024"]),
    );
  });

  it("disables already occupied seasons in the season selector", () => {
    const options = getPlayerSeasonSelectOptions(new Set(["2024/2025"]));
    const disabledOption = options.find((option) => option.value === "2024/2025");
    const enabledOption = options.find((option) => option.value === "2023/2024");

    expect(disabledOption?.disabled).toBe(true);
    expect(enabledOption?.disabled).not.toBe(true);
  });

  it("disables invalid end years when they are before start year or collide with occupied seasons", () => {
    const options = getPlayerEndYearOptions("2023", "", new Set(["2024/2025"]));

    expect(options.find((option) => option.value === "2022")?.disabled).toBe(true);
    expect(options.find((option) => option.value === "2025")?.disabled).toBe(true);
    expect(options.find((option) => option.value === "2024")?.disabled).not.toBe(true);
  });

  it("disables invalid start years when they are after end year or collide with occupied seasons", () => {
    const options = getPlayerStartYearOptions("2025", "", new Set(["2024/2025"]));

    expect(options.find((option) => option.value === "2026")?.disabled).toBe(true);
    expect(options.find((option) => option.value === "2024")?.disabled).toBe(true);
    expect(options.find((option) => option.value === "2025")?.disabled).not.toBe(true);
  });

  it("clears an already selected end year when a new start year makes it unavailable", () => {
    const sanitized = sanitizePlayerPeriodSelection(
      {
        startMonth: "",
        startYear: "2023",
        endMonth: "",
        endYear: "2025",
      },
      new Set(["2024/2025"]),
    );

    expect(sanitized).toEqual({
      startMonth: "",
      startYear: "2023",
      endMonth: "",
      endYear: "",
    });
  });
});
