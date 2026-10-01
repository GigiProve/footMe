/**
 * Persistenza della carriera Staff tecnico (REV-PROF-07).
 *
 * Il requisito che questi test difendono è uno solo: **una riga per stagione,
 * con ruolo e categoria propri**. Da lì discendono la modificabilità della
 * singola stagione, i ruoli diversi nella stessa società e la continuità fra
 * onboarding e profilo.
 */
import { describe, expect, it } from "vitest";

import {
  recordsToAssignments,
  type CoachAssignment,
} from "../coach-career/coach-assignment-model";
import { coachEntriesToAssignments } from "../coach-career/coach-onboarding-bridge";
import type { CoachCareerEntry } from "../../onboarding/coach/coach-career-types";
import type { StaffCareerEntryRecord } from "../profile-service";
import {
  assignmentsToStaffRecords,
  indexStaffRecords,
} from "./staff-assignment-model";

function assignment(
  overrides: Partial<CoachAssignment> & Pick<CoachAssignment, "id" | "groupId">,
): CoachAssignment {
  return {
    category: "Serie A",
    clubId: null,
    isOngoing: false,
    mode: "MULTI_SEASON",
    period: null,
    role: "Preparatore atletico",
    seasonKey: "2024/2025",
    teamLogoUrl: "",
    teamName: "AC Milan",
    ...overrides,
  };
}

function staffRecord(
  overrides: Partial<StaffCareerEntryRecord> & Pick<StaffCareerEntryRecord, "id">,
): StaffCareerEntryRecord {
  return {
    category: "Serie A",
    club_id: null,
    description: null,
    experience_group_id: "milan",
    experience_type: "SINGLE_SEASON",
    head_coach_name: null,
    period_end_month: null,
    period_end_year: null,
    period_start_month: null,
    period_start_year: null,
    results: [],
    role: "Preparatore atletico",
    season_details: {},
    seasons: ["2024/2025"],
    sort_order: 0,
    staff_profile_id: "staff-1",
    team_logo_url: null,
    team_name: "AC Milan",
    ...overrides,
  };
}

describe("assignmentsToStaffRecords", () => {
  it("scrive una riga per stagione, con il ruolo di quella stagione", () => {
    const records = assignmentsToStaffRecords(
      [
        assignment({ groupId: "milan", id: "a1", seasonKey: "2024/2025" }),
        assignment({
          groupId: "milan",
          id: "a2",
          role: "Match analyst",
          seasonKey: "2023/2024",
        }),
      ],
      "staff-1",
    );

    expect(records).toHaveLength(2);
    expect(records.map((record) => record.seasons)).toEqual([
      ["2024/2025"],
      ["2023/2024"],
    ]);
    expect(records.map((record) => record.role)).toEqual([
      "Preparatore atletico",
      "Match analyst",
    ]);
    // Il gruppo tiene insieme le righe, ma non porta più ruolo né categoria.
    expect(new Set(records.map((record) => record.experience_group_id))).toEqual(
      new Set(["milan"]),
    );
    expect(records.every((record) => Object.keys(record.season_details).length === 0)).toBe(
      true,
    );
    expect(records.every((record) => record.staff_profile_id === "staff-1")).toBe(
      true,
    );
  });

  it("conserva i campi che il modulo carriera non gestisce", () => {
    const previous = indexStaffRecords([
      staffRecord({
        description: "Preparazione atletica prima squadra",
        head_coach_name: "Mister Rossi",
        id: "a1",
        results: [{ label: "Scudetto" }],
      }),
    ]);

    const [kept, fresh] = assignmentsToStaffRecords(
      [
        assignment({ groupId: "milan", id: "a1" }),
        assignment({ groupId: "milan", id: "a2", seasonKey: "2023/2024" }),
      ],
      "staff-1",
      previous,
    );

    expect(kept.description).toBe("Preparazione atletica prima squadra");
    expect(kept.head_coach_name).toBe("Mister Rossi");
    expect(kept.results).toEqual([{ label: "Scudetto" }]);
    // Una riga nuova non eredita niente da un'altra.
    expect(fresh.description).toBeNull();
    expect(fresh.head_coach_name).toBeNull();
  });

  it("azzera la data di fine di un incarico ancora in corso", () => {
    const [record] = assignmentsToStaffRecords(
      [
        assignment({
          groupId: "atalanta",
          id: "p1",
          isOngoing: true,
          mode: "CUSTOM_PERIOD",
          period: {
            endMonth: "Giugno",
            endYear: "2023",
            startMonth: "Agosto",
            startYear: "2022",
          },
          seasonKey: "",
        }),
      ],
      "staff-1",
    );

    expect(record.period_start_year).toBe(2022);
    expect(record.period_end_year).toBeNull();
    expect(record.period_end_month).toBeNull();
  });
});

describe("continuità fra onboarding e profilo", () => {
  it("un'esperienza multi-stagione dell'onboarding diventa righe modificabili", () => {
    const entry: CoachCareerEntry = {
      category: "Serie A",
      id: "onboarding-1",
      period: null,
      role: "Preparatore atletico",
      seasonDetails: {
        "2022/2023": { category: "Serie A", role: "Match analyst" },
      },
      seasons: ["2024/2025", "2023/2024", "2022/2023"],
      teamName: "AC Milan",
      type: "MULTI_SEASON",
    };

    const records = assignmentsToStaffRecords(
      coachEntriesToAssignments([entry]),
      "staff-1",
    );

    expect(records).toHaveLength(3);

    // Riletta dal profilo, la stessa carriera torna un solo gruppo di tre
    // assegnazioni: nessuna riga orfana, nessun duplicato.
    const assignments = recordsToAssignments(records);

    expect(assignments).toHaveLength(3);
    expect(new Set(assignments.map((item) => item.groupId)).size).toBe(1);
    expect(
      assignments.find((item) => item.seasonKey === "2022/2023")?.role,
    ).toBe("Match analyst");
    expect(
      assignments.find((item) => item.seasonKey === "2024/2025")?.role,
    ).toBe("Preparatore atletico");
  });
});
