import { describe, expect, it } from "vitest";

import {
  getClubEndYearOptions,
  getClubSeasonRange,
  getClubStartYearOptions,
  sanitizeClubSeasonSelection,
  type ClubSeasonForm,
} from "./club-season-section";

function createSeason(overrides: Partial<ClubSeasonForm>): ClubSeasonForm {
  return {
    category: "Eccellenza",
    endYear: "2024",
    league: "",
    notes: "",
    startYear: "2023",
    ...overrides,
  };
}

describe("club-season-section", () => {
  it("builds a numeric range from a club season form", () => {
    expect(getClubSeasonRange(createSeason({ startYear: "2022", endYear: "2024" }))).toEqual({
      start: 2022,
      end: 2024,
    });
  });

  it("disables end years before start year or overlapping occupied ranges", () => {
    const options = getClubEndYearOptions("2023", [{ start: 2025, end: 2026 }]);

    expect(options.find((option) => option.value === "2022")?.disabled).toBe(true);
    expect(options.find((option) => option.value === "2025")?.disabled).toBe(true);
    expect(options.find((option) => option.value === "2024")?.disabled).not.toBe(true);
  });

  it("disables start years after end year or overlapping occupied ranges", () => {
    const options = getClubStartYearOptions("2026", [{ start: 2023, end: 2024 }]);

    expect(options.find((option) => option.value === "2026")?.disabled).not.toBe(true);
    expect(options.find((option) => option.value === "2024")?.disabled).toBe(true);
    expect(options.find((option) => option.value === "2025")?.disabled).not.toBe(true);
  });

  it("clears an invalid end year when a new start year creates an overlap", () => {
    const result = sanitizeClubSeasonSelection(
      createSeason({ startYear: "2023", endYear: "2026" }),
      [{ start: 2025, end: 2026 }],
    );

    expect(result).toEqual(
      createSeason({ startYear: "", endYear: "" }),
    );
  });
});
