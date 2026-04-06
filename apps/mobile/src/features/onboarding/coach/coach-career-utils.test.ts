import { describe, expect, it } from "vitest";

import type { CoachCareerEntry, SimplePlayerCareerEntry } from "./coach-career-types";
import {
  getCoachEndYearOptions,
  getCoachPeriodOverlapSeasons,
  getCoachSeasonSelectOptions,
  getCoachStartYearOptions,
  getOccupiedCoachSeasonLabels,
  getSimplePlayerSeasonSelectOptions,
  sanitizeCoachPeriodSelection,
  sortCoachCareerEntriesBySeason,
} from "./coach-career-utils";

function createCoachEntry(overrides: Partial<CoachCareerEntry>): CoachCareerEntry {
  return {
    id: "coach-1",
    teamName: "ASD Test",
    category: "Prima Squadra",
    role: "Allenatore",
    type: "SINGLE_SEASON",
    seasons: ["2024/2025"],
    period: null,
    seasonDetails: {},
    ...overrides,
  };
}

describe("coach-career-utils", () => {
  it("excludes the current coach entry when computing occupied seasons", () => {
    const entries: CoachCareerEntry[] = [
      createCoachEntry({ id: "coach-1", seasons: ["2024/2025"] }),
      createCoachEntry({ id: "coach-2", seasons: ["2023/2024"] }),
    ];

    expect(getOccupiedCoachSeasonLabels(entries, "coach-1")).toEqual(
      new Set(["2023/2024"]),
    );
  });

  it("disables occupied coach seasons", () => {
    const options = getCoachSeasonSelectOptions(new Set(["2024/2025"]));

    expect(options.find((option) => option.value === "2024/2025")?.disabled).toBe(true);
    expect(options.find((option) => option.value === "2023/2024")?.disabled).not.toBe(true);
  });

  it("disables invalid coach end years", () => {
    const options = getCoachEndYearOptions("2023", "", new Set(["2024/2025"]));

    expect(options.find((option) => option.value === "2022")?.disabled).toBe(true);
    expect(options.find((option) => option.value === "2025")?.disabled).toBe(true);
    expect(options.find((option) => option.value === "2024")?.disabled).not.toBe(true);
  });

  it("disables invalid coach start years", () => {
    const options = getCoachStartYearOptions("2025", "", "", new Set(["2024/2025"]));

    expect(options.find((option) => option.value === "2026")?.disabled).toBe(true);
    expect(options.find((option) => option.value === "2024")?.disabled).toBe(true);
    expect(options.find((option) => option.value === "2025")?.disabled).not.toBe(true);
  });

  it("clears an invalid coach end year after a conflicting change", () => {
    const sanitized = sanitizeCoachPeriodSelection(
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

  it("disables occupied seasons in simple player career options", () => {
    const entries: SimplePlayerCareerEntry[] = [
      {
        id: "simple-1",
        teamName: "ASD One",
        season: "2024/2025",
        category: "",
        position: "",
      },
      {
        id: "simple-2",
        teamName: "ASD Two",
        season: "2023/2024",
        category: "",
        position: "",
      },
    ];

    const options = getSimplePlayerSeasonSelectOptions(entries, "simple-2");

    expect(options.find((option) => option.value === "2024/2025")?.disabled).toBe(true);
    expect(options.find((option) => option.value === "2023/2024")?.disabled).not.toBe(true);
  });

  it("sorts coach entries by most recent season first", () => {
    const entries: CoachCareerEntry[] = [
      createCoachEntry({
        id: "coach-1",
        teamName: "Club 2022",
        seasons: ["2022/2023"],
      }),
      createCoachEntry({
        id: "coach-2",
        teamName: "Club 2024",
        seasons: ["2024/2025"],
      }),
      createCoachEntry({
        id: "coach-3",
        teamName: "Club 2023",
        seasons: ["2023/2024"],
      }),
    ];

    expect(sortCoachCareerEntriesBySeason(entries).map((entry) => entry.id)).toEqual([
      "coach-2",
      "coach-3",
      "coach-1",
    ]);
  });

  it("returns the overlapping coach seasons for a custom period", () => {
    expect(
      getCoachPeriodOverlapSeasons(
        {
          startMonth: "Luglio",
          startYear: "2023",
          endMonth: "Giugno",
          endYear: "2025",
        },
        new Set(["2024/2025"]),
      ),
    ).toEqual(["2024/2025"]);
  });

  it("returns no overlapping coach seasons when the custom period is free", () => {
    expect(
      getCoachPeriodOverlapSeasons(
        {
          startMonth: "Luglio",
          startYear: "2023",
          endMonth: "Giugno",
          endYear: "2024",
        },
        new Set(["2024/2025"]),
      ),
    ).toEqual([]);
  });

  it("does not mark January to June of a year as overlap for the following full coach season", () => {
    expect(
      getCoachPeriodOverlapSeasons(
        {
          startMonth: "Gennaio",
          startYear: "2018",
          endMonth: "Giugno",
          endYear: "2018",
        },
        new Set(["2018/2019"]),
      ),
    ).toEqual([]);
  });

  it("keeps the coach start year selectable when months map the period to the previous season", () => {
    const options = getCoachStartYearOptions(
      "2017",
      "Giugno",
      "Gennaio",
      new Set(["2017/2018"]),
    );

    expect(options.find((option) => option.value === "2017")?.disabled).not.toBe(true);
  });
});
