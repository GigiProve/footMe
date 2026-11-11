import { describe, expect, it } from "vitest";

import { formatCount, normalizeCount } from "./format-count";

describe("formatCount", () => {
  it.each([
    [0, "0"],
    [146, "146"],
    [999, "999"],
    [1234, "1.234"],
    [12486, "12.486"],
    [1234567, "1.234.567"],
  ])("formatta %i come %s (mai 1,2K)", (value, expected) => {
    expect(formatCount(value)).toBe(expected);
  });

  it("degrada a 0 su valori non validi e non genera numeri negativi", () => {
    expect(formatCount(null)).toBe("0");
    expect(formatCount(undefined)).toBe("0");
    expect(formatCount(Number.NaN)).toBe("0");
    expect(formatCount(-5)).toBe("0");
  });

  it("tronca i decimali", () => {
    expect(normalizeCount(18.9)).toBe(18);
  });
});
