import { describe, expect, it } from "vitest";

import type { CoachCareerEntryRecord } from "../profile-service";
import {
  assignmentSeasonKeys,
  assignmentsToRecords,
  buildCoachExperienceGroups,
  countCoachSeasons,
  formatPeriodLabel,
  recordsToAssignments,
  type CoachAssignment,
} from "./coach-assignment-model";

// Marzo 2025: la stagione sportiva in corso è la 2024/2025.
const NOW = new Date("2025-03-01T00:00:00.000Z");

function record(
  overrides: Partial<CoachCareerEntryRecord> &
    Pick<CoachCareerEntryRecord, "id">,
): CoachCareerEntryRecord {
  return {
    category: "Prima Squadra",
    club_id: null,
    coach_profile_id: "coach-1",
    description: null,
    experience_group_id: null,
    experience_type: "SINGLE_SEASON",
    period_end_month: null,
    period_end_year: null,
    period_start_month: null,
    period_start_year: null,
    results: [],
    role: "Allenatore",
    season_details: {},
    seasons: [],
    sort_order: 0,
    team_logo_url: null,
    team_name: "Torino FC",
    ...overrides,
  };
}

function assignment(
  overrides: Partial<CoachAssignment> & Pick<CoachAssignment, "id" | "groupId">,
): CoachAssignment {
  return {
    category: "Prima Squadra",
    clubId: null,
    isOngoing: false,
    mode: "SINGLE_SEASON",
    period: null,
    role: "Allenatore",
    seasonKey: "2024/2025",
    teamLogoUrl: "",
    teamName: "Torino FC",
    ...overrides,
  };
}

describe("recordsToAssignments", () => {
  it("legge ruolo e categoria dalla riga, non da un campo del gruppo", () => {
    const [first] = recordsToAssignments([
      record({
        category: "Juniores",
        experience_group_id: "g-1",
        id: "a",
        role: "Vice allenatore",
        seasons: ["2023/2024"],
      }),
    ]);

    expect(first.role).toBe("Vice allenatore");
    expect(first.category).toBe("Juniores");
    expect(first.groupId).toBe("g-1");
  });

  it("espande una riga legacy multi-stagione in un'assegnazione per stagione", () => {
    // Compatibilità in lettura durante il rilascio: una riga non ancora
    // migrata porta ancora l'array di stagioni e `season_details`.
    const assignments = recordsToAssignments([
      record({
        experience_type: "MULTI_SEASON",
        id: "legacy",
        season_details: {
          "2022/2023": { category: "Juniores", role: "Allenatore" },
          "2023/2024": { category: "Prima Squadra", role: "Vice allenatore" },
        },
        seasons: ["2022/2023", "2023/2024"],
      }),
    ]);

    expect(assignments).toHaveLength(2);
    expect(assignments.map((item) => item.role)).toEqual([
      "Allenatore",
      "Vice allenatore",
    ]);
    // Senza gruppo salvato le due righe restano comunque la stessa esperienza.
    expect(new Set(assignments.map((item) => item.groupId)).size).toBe(1);
  });

  it("tiene separati due passaggi distinti nella stessa società", () => {
    const assignments = recordsToAssignments([
      record({ experience_group_id: "g-1", id: "a", seasons: ["2016/2017"] }),
      record({ experience_group_id: "g-2", id: "b", seasons: ["2024/2025"] }),
    ]);

    expect(buildCoachExperienceGroups(assignments, { now: NOW })).toHaveLength(2);
  });

  it("riconosce come in corso un periodo senza data di fine", () => {
    const [entry] = recordsToAssignments([
      record({
        experience_type: "CUSTOM_PERIOD",
        id: "p",
        period_start_month: "Gennaio",
        period_start_year: 2021,
      }),
    ]);

    expect(entry.isOngoing).toBe(true);
    expect(formatPeriodLabel(entry.period, entry.isOngoing)).toBe(
      "Gennaio 2021 — Presente",
    );
  });
});

describe("assignmentsToRecords", () => {
  it("scrive una riga per assegnazione, senza season_details", () => {
    const records = assignmentsToRecords(
      [
        assignment({ groupId: "g", id: "1", seasonKey: "2024/2025" }),
        assignment({
          groupId: "g",
          id: "2",
          role: "Vice allenatore",
          seasonKey: "2023/2024",
        }),
      ],
      "coach-1",
    );

    expect(records).toHaveLength(2);
    expect(records.map((item) => item.seasons)).toEqual([
      ["2024/2025"],
      ["2023/2024"],
    ]);
    expect(records.every((item) => Object.keys(item.season_details).length === 0)).toBe(
      true,
    );
    expect(records[1].role).toBe("Vice allenatore");
  });

  it("non scrive la data di fine di un incarico in corso", () => {
    const [record_] = assignmentsToRecords(
      [
        assignment({
          groupId: "g",
          id: "1",
          isOngoing: true,
          mode: "CUSTOM_PERIOD",
          period: {
            endMonth: "Maggio",
            endYear: "2021",
            startMonth: "Gennaio",
            startYear: "2021",
          },
          seasonKey: "",
        }),
      ],
      "coach-1",
    );

    expect(record_.period_start_year).toBe(2021);
    expect(record_.period_end_year).toBeNull();
    expect(record_.period_end_month).toBeNull();
  });

  it("sopravvive al giro completo record → assegnazioni → record", () => {
    const original = [
      record({
        category: "Juniores",
        experience_group_id: "g-1",
        id: "11111111-1111-4111-8111-111111111111",
        role: "Allenatore",
        seasons: ["2022/2023"],
      }),
    ];
    const [roundTripped] = assignmentsToRecords(
      recordsToAssignments(original),
      "coach-1",
    );

    expect(roundTripped.id).toBe(original[0].id);
    expect(roundTripped.experience_group_id).toBe("g-1");
    expect(roundTripped.category).toBe("Juniores");
    expect(roundTripped.seasons).toEqual(["2022/2023"]);
  });
});

describe("buildCoachExperienceGroups", () => {
  const assignments = [
    assignment({
      category: "Juniores",
      groupId: "torino",
      id: "t3",
      seasonKey: "2022/2023",
    }),
    assignment({
      groupId: "torino",
      id: "t2",
      role: "Vice allenatore",
      seasonKey: "2023/2024",
    }),
    assignment({ groupId: "torino", id: "t1", seasonKey: "2024/2025" }),
    assignment({
      groupId: "fiorentina",
      id: "f1",
      seasonKey: "2019/2020",
      teamName: "Fiorentina",
    }),
  ];

  it("conta le stagioni e i ruoli distinti del gruppo", () => {
    const [torino] = buildCoachExperienceGroups(assignments, { now: NOW });

    expect(torino.teamName).toBe("Torino FC");
    expect(torino.countLabel).toBe("3 stagioni");
    // Allenatore e Vice allenatore: due valori distinti, non tre righe.
    expect(torino.roleCountLabel).toBe("2 ruoli");
    expect(torino.periodLabel).toBe("2022 — Presente");
  });

  it("mette per primo il gruppo in corso", () => {
    const groups = buildCoachExperienceGroups(assignments, { now: NOW });

    expect(groups.map((group) => group.groupId)).toEqual([
      "torino",
      "fiorentina",
    ]);
    expect(groups[0].isOngoing).toBe(true);
  });

  it("ordina le stagioni dentro il gruppo dalla più recente", () => {
    const [torino] = buildCoachExperienceGroups(assignments, { now: NOW });

    expect(torino.rows.map((row) => row.label)).toEqual([
      "2024/25",
      "2023/24",
      "2022/23",
    ]);
    expect(torino.rows[1].role).toBe("Vice allenatore");
    expect(torino.rows[2].category).toBe("Juniores");
  });

  it("non inserisce le stagioni intermedie fra due stagioni non consecutive", () => {
    const [group] = buildCoachExperienceGroups(
      [
        assignment({ groupId: "g", id: "1", seasonKey: "2024/2025" }),
        assignment({ groupId: "g", id: "2", seasonKey: "2022/2023" }),
        assignment({ groupId: "g", id: "3", seasonKey: "2019/2020" }),
      ],
      { now: NOW },
    );

    expect(group.rows.map((row) => row.label)).toEqual([
      "2024/25",
      "2022/23",
      "2019/20",
    ]);
  });

  it("chiama incarichi i gruppi di soli periodi e esperienze quelli misti", () => {
    const period = assignment({
      groupId: "p",
      id: "p1",
      mode: "CUSTOM_PERIOD",
      period: {
        endMonth: "Maggio",
        endYear: "2021",
        startMonth: "Gennaio",
        startYear: "2021",
      },
      seasonKey: "",
    });
    const [onlyPeriods] = buildCoachExperienceGroups([period], { now: NOW });
    const [mixed] = buildCoachExperienceGroups(
      [period, assignment({ groupId: "p", id: "p2", seasonKey: "2023/2024" })],
      { now: NOW },
    );

    expect(onlyPeriods.countLabel).toBe("1 incarico");
    expect(mixed.countLabel).toBe("2 esperienze");
  });
});

describe("countCoachSeasons", () => {
  it("non conta due volte una stagione con incarichi simultanei", () => {
    expect(
      countCoachSeasons([
        assignment({ groupId: "a", id: "1", seasonKey: "2024/2025" }),
        assignment({
          groupId: "b",
          id: "2",
          seasonKey: "2024/2025",
          teamName: "Altra società",
        }),
      ]),
    ).toBe(1);
  });
});

describe("assignmentSeasonKeys", () => {
  it("copre tutte le stagioni sportive toccate da un periodo", () => {
    expect(
      assignmentSeasonKeys(
        assignment({
          groupId: "g",
          id: "1",
          mode: "CUSTOM_PERIOD",
          period: {
            endMonth: "Maggio",
            endYear: "2023",
            startMonth: "Settembre",
            startYear: "2021",
          },
          seasonKey: "",
        }),
      ),
    ).toEqual(["2021/2022", "2022/2023"]);
  });
});
