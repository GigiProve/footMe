import { describe, expect, it } from "vitest";

import {
  buildBirthDate,
  isValidSeasonLabel,
  normalizeSeasonLabelInput,
  splitBirthDate,
} from "./profile-form-utils";

describe("profile-form-utils", () => {
  it("normalizes season labels to the xx/xx pattern while typing", () => {
    expect(normalizeSeasonLabelInput("24")).toBe("24");
    expect(normalizeSeasonLabelInput("2425")).toBe("24/25");
    expect(normalizeSeasonLabelInput("24a/2599")).toBe("24/25");
  });

  it("validates the expected season pattern", () => {
    expect(isValidSeasonLabel("24/25")).toBe(true);
    expect(isValidSeasonLabel("2024/25")).toBe(false);
    expect(isValidSeasonLabel("24-25")).toBe(false);
  });

  it("splits and rebuilds the birth date in ISO format", () => {
    expect(splitBirthDate("1998-02-18")).toEqual({
      day: "18",
      month: "02",
      year: "1998",
    });
    expect(buildBirthDate({ day: "18", month: "02", year: "1998" })).toBe(
      "1998-02-18",
    );
  });

  it("returns empty date parts when the value is incomplete", () => {
    expect(splitBirthDate("")).toEqual({
      day: "",
      month: "",
      year: "",
    });
    expect(buildBirthDate({ day: "", month: "02", year: "1998" })).toBe("");
  });
});
