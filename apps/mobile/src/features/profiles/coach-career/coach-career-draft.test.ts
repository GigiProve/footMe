import { describe, expect, it } from "vitest";

import type { CoachAssignment } from "./coach-assignment-model";
import {
  COACH_DRAFT_ERROR_MESSAGES,
  createCoachDraft,
  draftFromAssignments,
  draftToAssignments,
  findDuplicateAssignments,
  hasDraftErrors,
  hasOverlappingAssignments,
  resolveSeasonDetail,
  validateSeasonRolesStep,
  validateSeasonsStep,
  validateSingleAssignmentDraft,
  type CoachExperienceDraft,
} from "./coach-career-draft";

function multiSeasonDraft(
  overrides: Partial<CoachExperienceDraft> = {},
): CoachExperienceDraft {
  return {
    ...createCoachDraft("MULTI_SEASON", { defaultRole: "Allenatore" }),
    category: "Prima Squadra",
    groupId: "g-1",
    seasons: ["2024/2025", "2023/2024", "2022/2023"],
    teamName: "Torino FC",
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

describe("draftToAssignments", () => {
  it("crea un'assegnazione distinta per ogni stagione selezionata", () => {
    const assignments = draftToAssignments(multiSeasonDraft());

    expect(assignments).toHaveLength(3);
    expect(assignments.map((item) => item.seasonKey)).toEqual([
      "2024/2025",
      "2023/2024",
      "2022/2023",
    ]);
    // Stesso gruppo, id diversi: modificabili una per una.
    expect(new Set(assignments.map((item) => item.groupId)).size).toBe(1);
    expect(new Set(assignments.map((item) => item.id)).size).toBe(3);
  });

  it("porta ruolo e categoria di ogni stagione, non un valore unico", () => {
    const assignments = draftToAssignments(
      multiSeasonDraft({
        seasonDetails: {
          "2022/2023": { category: "Juniores", role: "Allenatore" },
          "2023/2024": { category: "Prima Squadra", role: "Vice allenatore" },
          "2024/2025": { category: "Prima Squadra", role: "Allenatore" },
        },
      }),
    );

    expect(
      assignments.map((item) => `${item.seasonKey}|${item.role}|${item.category}`),
    ).toEqual([
      "2024/2025|Allenatore|Prima Squadra",
      "2023/2024|Vice allenatore|Prima Squadra",
      "2022/2023|Allenatore|Juniores",
    ]);
  });

  it("riusa gli id già persistiti invece di ricreare le stagioni", () => {
    const assignments = draftToAssignments(
      multiSeasonDraft({
        persistedIdBySeason: { "2023/2024": "saved-2", "2024/2025": "saved-1" },
      }),
    );

    expect(assignments[0].id).toBe("saved-1");
    expect(assignments[1].id).toBe("saved-2");
    expect(assignments[2].id).not.toBe("saved-1");
  });
});

describe("resolveSeasonDetail", () => {
  it("precompila dalla riga precedente senza legare le righe", () => {
    const draft = multiSeasonDraft({
      seasonDetails: {
        "2024/2025": { category: "Prima Squadra", role: "Vice allenatore" },
      },
    });

    // 2023/24 eredita il valore della riga sopra…
    expect(resolveSeasonDetail(draft, "2023/2024", "2024/2025").role).toBe(
      "Vice allenatore",
    );
    // …ma la riga sopra resta quella che è.
    expect(draft.seasonDetails["2024/2025"].role).toBe("Vice allenatore");
  });
});

describe("draftFromAssignments", () => {
  it("riapre un gruppo esistente precompilato", () => {
    const draft = draftFromAssignments([
      assignment({ groupId: "g", id: "1", seasonKey: "2024/2025" }),
      assignment({
        category: "Juniores",
        groupId: "g",
        id: "2",
        role: "Vice allenatore",
        seasonKey: "2023/2024",
      }),
    ]);

    expect(draft?.mode).toBe("MULTI_SEASON");
    expect(draft?.seasons).toEqual(["2024/2025", "2023/2024"]);
    expect(draft?.seasonDetails["2023/2024"]).toEqual({
      category: "Juniores",
      role: "Vice allenatore",
    });
    expect(draft?.persistedIdBySeason).toEqual({
      "2023/2024": "2",
      "2024/2025": "1",
    });
  });
});

describe("duplicati e sovrapposizioni", () => {
  const existing = [
    assignment({ groupId: "altro", id: "x", seasonKey: "2024/2025" }),
  ];

  it("blocca solo il duplicato esatto", () => {
    const duplicate = draftToAssignments(
      multiSeasonDraft({ groupId: "nuovo", seasons: ["2024/2025"] }),
    );

    expect(findDuplicateAssignments(duplicate, existing)).toHaveLength(1);
  });

  it("non considera duplicato lo stesso anno con un ruolo diverso", () => {
    const other = draftToAssignments(
      multiSeasonDraft({
        groupId: "nuovo",
        role: "Vice allenatore",
        seasonDetails: {
          "2024/2025": { category: "Prima Squadra", role: "Vice allenatore" },
        },
        seasons: ["2024/2025"],
      }),
    );

    expect(findDuplicateAssignments(other, existing)).toHaveLength(0);
    // Resta però una sovrapposizione, che avvisa senza bloccare.
    expect(hasOverlappingAssignments(other, existing)).toBe(true);
  });

  it("ignora le assegnazioni del gruppo che si sta modificando", () => {
    const sameGroup = draftToAssignments(
      multiSeasonDraft({ groupId: "altro", seasons: ["2024/2025"] }),
    );

    expect(findDuplicateAssignments(sameGroup, existing)).toHaveLength(0);
    expect(hasOverlappingAssignments(sameGroup, existing)).toBe(false);
  });
});

describe("validazioni", () => {
  it("chiede squadra e almeno una stagione al passo 1 di 2", () => {
    const errors = validateSeasonsStep(
      multiSeasonDraft({ seasons: [], teamName: "" }),
    );

    expect(errors.teamName).toBe(COACH_DRAFT_ERROR_MESSAGES.team);
    expect(errors.seasons).toBe(COACH_DRAFT_ERROR_MESSAGES.season);
  });

  it("segnala la riga interessata al passo 2 di 2", () => {
    const errors = validateSeasonRolesStep(
      multiSeasonDraft({
        category: "",
        role: "",
        seasonDetails: {
          "2022/2023": { category: "Juniores", role: "Allenatore" },
          "2023/2024": { category: "", role: "Allenatore" },
          "2024/2025": { category: "Prima Squadra", role: "Allenatore" },
        },
      }),
    );

    expect(errors.seasonRows).toEqual({
      "2023/2024": COACH_DRAFT_ERROR_MESSAGES.category,
    });
    expect(hasDraftErrors(errors)).toBe(true);
  });

  it("rifiuta una data finale precedente a quella iniziale", () => {
    const errors = validateSingleAssignmentDraft({
      ...createCoachDraft("CUSTOM_PERIOD"),
      category: "Prima Squadra",
      period: {
        endMonth: "Gennaio",
        endYear: "2021",
        startMonth: "Maggio",
        startYear: "2021",
      },
      role: "Allenatore",
      teamName: "Juventus",
    });

    expect(errors.endDate).toBe(COACH_DRAFT_ERROR_MESSAGES.endBeforeStart);
  });

  it("non chiede la data finale di un incarico in corso", () => {
    const errors = validateSingleAssignmentDraft({
      ...createCoachDraft("CUSTOM_PERIOD"),
      category: "Prima Squadra",
      isOngoing: true,
      period: {
        endMonth: "",
        endYear: "",
        startMonth: "Gennaio",
        startYear: "2021",
      },
      role: "Allenatore",
      teamName: "Juventus",
    });

    expect(hasDraftErrors(errors)).toBe(false);
  });
});
