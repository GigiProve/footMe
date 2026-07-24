import { describe, expect, it } from "vitest";

import { formatClubKindLabel, formatDeadlineLabel } from "./search-format";

describe("formatDeadlineLabel", () => {
  it("formats a date-only string with the Italian month name", () => {
    expect(formatDeadlineLabel("2026-07-15")).toBe("Scadenza 15 luglio");
    expect(formatDeadlineLabel("2026-01-01")).toBe("Scadenza 1 gennaio");
    expect(formatDeadlineLabel("2026-12-31")).toBe("Scadenza 31 dicembre");
  });

  it("ignores any time suffix without timezone drift", () => {
    expect(formatDeadlineLabel("2026-08-15T00:00:00Z")).toBe(
      "Scadenza 15 agosto",
    );
  });

  it("returns an empty string for invalid input", () => {
    expect(formatDeadlineLabel("not-a-date")).toBe("");
    expect(formatDeadlineLabel("")).toBe("");
    expect(formatDeadlineLabel("2026-13-01")).toBe("");
    expect(formatDeadlineLabel("2026-07-99")).toBe("");
  });
});

describe("formatClubKindLabel", () => {
  it("labels affiliated clubs as Affiliata", () => {
    expect(formatClubKindLabel(true)).toBe("Affiliata");
    expect(formatClubKindLabel(false)).toBe("Società");
  });
});
