import { describe, expect, it } from "vitest";

import {
  buildProfileMetaLines,
  formatClubKindLabel,
  formatDeadlineLabel,
  formatResultsCount,
} from "./search-format";
import type { ProfileSearchRow } from "./search-types";

function makeRow(overrides: Partial<ProfileSearchRow>): ProfileSearchRow {
  return {
    profile_id: "p1",
    full_name: "Mario Rossi",
    avatar_url: null,
    role: "player",
    region: null,
    city: null,
    primary_position: null,
    current_club_name: null,
    current_team_name: null,
    age: null,
    is_available: null,
    birth_year: null,
    is_open_to_transfer: null,
    current_category: null,
    coach_primary_role: null,
    coach_top_license: null,
    coach_context: null,
    open_to_new_role: null,
    staff_primary_role: null,
    experience_summary: null,
    open_to_work: null,
    agency_name: null,
    managed_players_count: null,
    agent_operating_areas: null,
    open_to_players: null,
    years_experience: null,
    total_count: 0,
    ...overrides,
  };
}

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

describe("buildProfileMetaLines", () => {
  it("builds player lines with club, classe/category and region", () => {
    const row = makeRow({
      role: "player",
      primary_position: "striker",
      current_club_name: "AC Como",
      birth_year: 2006,
      current_category: "Serie D",
      region: "Lombardia",
      is_open_to_transfer: true,
      is_available: true,
    });

    expect(buildProfileMetaLines(row)).toEqual({
      lines: ["Attaccante • AC Como", "Classe 2006 • Serie D", "Lombardia"],
      note: "Disponibile al trasferimento",
    });
  });

  it("falls back to Svincolato when the player has no current club/team", () => {
    const row = makeRow({ role: "player", primary_position: "striker" });

    expect(buildProfileMetaLines(row).lines[0]).toBe("Attaccante • Svincolato");
  });

  it("prefers transfer availability over generic availability in the note", () => {
    const row = makeRow({ role: "player", is_open_to_transfer: true, is_available: true });
    expect(buildProfileMetaLines(row).note).toBe("Disponibile al trasferimento");

    const availableOnly = makeRow({ role: "player", is_available: true });
    expect(buildProfileMetaLines(availableOnly).note).toBe(
      "Disponibile a valutare opportunità",
    );

    const neither = makeRow({ role: "player" });
    expect(buildProfileMetaLines(neither).note).toBeNull();
  });

  it("skips missing parts and caps at 3 lines for coaches", () => {
    const row = makeRow({
      role: "coach",
      coach_primary_role: "Allenatore",
      coach_top_license: "UEFA B",
      coach_context: "settore_giovanile",
      region: "Lombardia",
      open_to_new_role: true,
    });

    expect(buildProfileMetaLines(row)).toEqual({
      lines: ["Allenatore UEFA B", "Settore giovanile", "Lombardia"],
      note: "Disponibile",
    });
  });

  it("builds staff lines from primary role, experience summary and region", () => {
    const row = makeRow({
      role: "staff",
      staff_primary_role: "Preparatore atletico",
      experience_summary: "8 anni di esperienza",
      region: "Veneto",
      open_to_work: true,
    });

    expect(buildProfileMetaLines(row)).toEqual({
      lines: ["Preparatore atletico", "8 anni di esperienza", "Veneto"],
      note: "Disponibile",
    });
  });

  it("builds agent lines with assisted count, areas and years of experience", () => {
    const row = makeRow({
      role: "agent",
      managed_players_count: "5-15 calciatori",
      agent_operating_areas: ["Lombardia", "Piemonte"],
      years_experience: 6,
      open_to_players: true,
    });

    expect(buildProfileMetaLines(row)).toEqual({
      lines: ["Procuratore", "5-15 assistiti", "Lombardia • Piemonte • Esperienza: 6 anni"],
      note: "Valuta nuovi assistiti",
    });
  });
});

describe("formatResultsCount", () => {
  it("pluralizes per role", () => {
    expect(formatResultsCount(82, "player")).toBe("82 calciatori trovati");
    expect(formatResultsCount(1, "player")).toBe("1 calciatore trovato");
    expect(formatResultsCount(148, null)).toBe("148 profili trovati");
    expect(formatResultsCount(1, null)).toBe("1 profilo trovato");
    expect(formatResultsCount(26, "coach")).toBe("26 allenatori trovati");
    expect(formatResultsCount(18, "staff")).toBe("18 profili staff trovati");
    expect(formatResultsCount(1, "staff")).toBe("1 profilo staff trovato");
    expect(formatResultsCount(12, "agent")).toBe("12 agenti trovati");
  });
});
