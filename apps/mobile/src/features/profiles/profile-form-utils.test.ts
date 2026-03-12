import { describe, expect, it } from "vitest";

import {
  composeBirthDate,
  createBirthDayOptions,
  formatBirthDateValue,
  formatBirthDate,
  getBirthDateParts,
  isSeasonLabelValid,
  normalizeSeasonLabelInput,
  parseBirthDate,
} from "./profile-form-utils";

describe("profile-form-utils", () => {
  it("normalizes season labels to the xx/xx pattern", () => {
    expect(normalizeSeasonLabelInput("2425")).toBe("24/25");
    expect(normalizeSeasonLabelInput("2024/25")).toBe("24/25");
    expect(normalizeSeasonLabelInput(" 98 / 99 ")).toBe("98/99");
    expect(normalizeSeasonLabelInput("12024/25")).toBe("12024");
  });

  it("validates season labels with the xx/xx pattern", () => {
    expect(isSeasonLabelValid("24/25")).toBe(true);
    expect(isSeasonLabelValid("2024/25")).toBe(false);
    expect(isSeasonLabelValid("24-25")).toBe(false);
  });

  it("builds and formats birth dates from picker parts", () => {
    expect(composeBirthDate({ day: "11", month: "03", year: "2001" })).toBe(
      "2001-03-11",
    );
    expect(getBirthDateParts("2001-03-11")).toEqual({
      day: "11",
      month: "03",
      year: "2001",
    });
    expect(formatBirthDate("2001-03-11")).toBe("11/03/2001");
    expect(parseBirthDate("2001-03-11")).toEqual(new Date(2001, 2, 11));
    expect(formatBirthDateValue(new Date(2001, 2, 11))).toBe("2001-03-11");
  });

  it("adjusts available days based on month and leap years", () => {
    expect(createBirthDayOptions("2000", "02")).toHaveLength(29);
    expect(createBirthDayOptions("2001", "02")).toHaveLength(28);
    expect(createBirthDayOptions("2001", "04")).toHaveLength(30);
  });
});
