import { describe, expect, it } from "vitest";

import { computeCoachExperienceYears } from "./profile-display-helpers";
import type { CoachCareerEntryRecord } from "./profile-service";

function makeEntry(
  overrides: Partial<CoachCareerEntryRecord>,
): CoachCareerEntryRecord {
  return {
    id: overrides.id ?? "entry",
    coach_profile_id: "coach-1",
    team_name: overrides.team_name ?? "Team",
    team_logo_url: null,
    club_id: null,
    category: null,
    role: "Allenatore",
    experience_type: "CUSTOM_PERIOD",
    seasons: [],
    period_start_month: null,
    period_start_year: null,
    period_end_month: null,
    period_end_year: null,
    season_details: {},
    results: [],
    description: null,
    sort_order: 0,
    ...overrides,
  };
}

describe("computeCoachExperienceYears", () => {
  it("returns null when there are no entries", () => {
    expect(computeCoachExperienceYears([])).toBeNull();
  });

  it("returns null when entries have neither reliable periods nor seasons", () => {
    const entries = [makeEntry({ seasons: [] })];
    expect(computeCoachExperienceYears(entries)).toBeNull();
  });

  it("computes years for a single closed period", () => {
    const entries = [
      makeEntry({
        period_start_year: 2018,
        period_start_month: "1",
        period_end_year: 2021,
        period_end_month: "12",
      }),
    ];

    expect(computeCoachExperienceYears(entries)).toBe(4);
  });

  it("merges overlapping periods without double counting", () => {
    const entries = [
      makeEntry({
        id: "a",
        period_start_year: 2018,
        period_start_month: "1",
        period_end_year: 2020,
        period_end_month: "12",
      }),
      makeEntry({
        id: "b",
        period_start_year: 2019,
        period_start_month: "6",
        period_end_year: 2021,
        period_end_month: "12",
      }),
    ];

    // Merged span: 2018-01 .. 2021-12 = 4 years, not 3 + 2.5 years.
    expect(computeCoachExperienceYears(entries)).toBe(4);
  });

  it("merges contiguous (back-to-back) periods into a single span", () => {
    const entries = [
      makeEntry({
        id: "a",
        period_start_year: 2015,
        period_start_month: "1",
        period_end_year: 2016,
        period_end_month: "12",
      }),
      makeEntry({
        id: "b",
        period_start_year: 2017,
        period_start_month: "1",
        period_end_year: 2018,
        period_end_month: "12",
      }),
    ];

    expect(computeCoachExperienceYears(entries)).toBe(4);
  });

  it("treats an open-ended period (no end date) as ongoing until now", () => {
    const now = new Date(2024, 0, 1); // Jan 2024
    const entries = [
      makeEntry({
        period_start_year: 2022,
        period_start_month: "1",
        period_end_year: null,
        period_end_month: null,
      }),
    ];

    expect(computeCoachExperienceYears(entries, now)).toBe(2);
  });

  it("falls back to season labels when period data is missing", () => {
    const entries = [
      makeEntry({
        seasons: ["2019/2020", "2020/2021"],
      }),
    ];

    // July 2019 -> June 2021 = 24 months = 2 years.
    expect(computeCoachExperienceYears(entries)).toBe(2);
  });

  it("does not bridge non-consecutive seasons within the same entry", () => {
    const entries = [
      makeEntry({
        seasons: ["2018/2019", "2021/2022"],
      }),
    ];

    // Two separate 12-month seasons = 2 years, not the 4-year 2018-2022 span.
    expect(computeCoachExperienceYears(entries)).toBe(2);
  });

  it("ignores entries with unreliable data while keeping valid ones", () => {
    const entries = [
      makeEntry({ id: "invalid", seasons: [] }),
      makeEntry({
        id: "valid",
        period_start_year: 2020,
        period_start_month: "1",
        period_end_year: 2023,
        period_end_month: "12",
      }),
    ];

    expect(computeCoachExperienceYears(entries)).toBe(4);
  });

  it("returns null when the merged total rounds down to 0 years", () => {
    const entries = [
      makeEntry({
        period_start_year: 2023,
        period_start_month: "1",
        period_end_year: 2023,
        period_end_month: "6",
      }),
    ];

    expect(computeCoachExperienceYears(entries)).toBeNull();
  });
});
