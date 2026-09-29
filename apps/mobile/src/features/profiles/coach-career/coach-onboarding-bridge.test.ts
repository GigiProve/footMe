/**
 * Dati canonici: quello che l'onboarding Allenatore salva deve essere
 * esattamente quello che Gestisci carriera riapre (REV-PROF-04).
 */
import { describe, expect, it } from "vitest";

import type { CoachCareerEntry } from "../../onboarding/coach/coach-career-types";
import {
  assignmentsToRecords,
  buildCoachExperienceGroups,
  recordsToAssignments,
} from "./coach-assignment-model";
import { draftFromAssignments } from "./coach-career-draft";
import { coachEntriesToAssignments } from "./coach-onboarding-bridge";

const NOW = new Date("2025-03-01T00:00:00.000Z");

function onboardingEntry(
  overrides: Partial<CoachCareerEntry> & Pick<CoachCareerEntry, "id">,
): CoachCareerEntry {
  return {
    category: "Serie B",
    clubId: null,
    description: null,
    period: null,
    role: "Allenatore",
    seasonDetails: {},
    seasons: [],
    teamLogoUrl: null,
    teamName: "Torino FC",
    type: "MULTI_SEASON",
    ...overrides,
  };
}

describe("coachEntriesToAssignments", () => {
  it("espande un'esperienza multi-stagione in una riga per stagione", () => {
    const assignments = coachEntriesToAssignments([
      onboardingEntry({
        id: "exp-1",
        seasonDetails: {
          "2022/2023": { category: "Primavera", role: "Allenatore" },
          "2023/2024": { category: "Serie B", role: "Vice allenatore" },
        },
        seasons: ["2022/2023", "2023/2024"],
      }),
    ]);

    expect(assignments).toHaveLength(2);
    expect(assignments.map((item) => item.seasonKey)).toEqual([
      "2023/2024",
      "2022/2023",
    ]);
    expect(assignments[0].role).toBe("Vice allenatore");
    expect(assignments[1].category).toBe("Primavera");
    expect(new Set(assignments.map((item) => item.groupId))).toEqual(
      new Set(["exp-1"]),
    );
  });

  it("marca come in corso un periodo senza data di fine", () => {
    const [entry] = coachEntriesToAssignments([
      onboardingEntry({
        id: "exp-2",
        period: {
          endMonth: "",
          endYear: "",
          startMonth: "Gennaio",
          startYear: "2024",
        },
        type: "CUSTOM_PERIOD",
      }),
    ]);

    expect(entry.isOngoing).toBe(true);
  });

  it("produce righe che Gestisci carriera riapre come un solo gruppo", () => {
    const records = assignmentsToRecords(
      coachEntriesToAssignments([
        onboardingEntry({
          id: "exp-3",
          seasonDetails: {
            "2023/2024": { category: "Serie B", role: "Vice allenatore" },
          },
          seasons: ["2022/2023", "2023/2024"],
        }),
      ]),
      "coach-1",
    );
    const assignments = recordsToAssignments(records);
    const groups = buildCoachExperienceGroups(assignments, { now: NOW });
    const draft = draftFromAssignments(assignments);

    expect(groups).toHaveLength(1);
    expect(groups[0].countLabel).toBe("2 stagioni");
    expect(groups[0].roleCountLabel).toBe("2 ruoli");
    expect(draft?.mode).toBe("MULTI_SEASON");
    expect(draft?.seasons.sort()).toEqual(["2022/2023", "2023/2024"]);
    expect(draft?.seasonDetails["2023/2024"].role).toBe("Vice allenatore");
  });

  it("non moltiplica le righe se il salvataggio viene rilanciato", () => {
    const entry = onboardingEntry({
      id: "exp-4",
      seasons: ["2022/2023", "2023/2024"],
    });
    const first = coachEntriesToAssignments([entry]);
    const second = coachEntriesToAssignments([entry]);

    expect(second.map((item) => item.id)).toEqual(first.map((item) => item.id));
  });
});
