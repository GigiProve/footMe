import { describe, expect, it } from "vitest";

import {
  buildStaffPreviousExperiencePatch,
  getNextStaffSubFlowStep,
  readStaffPreviousExperiences,
  toggleStaffPreviousExperience,
  type StaffPreviousExperience,
} from "./staff-previous-experiences";
import { getStaffExperienceRoleOptions } from "./staff-options";
import type { CoachCareerEntry } from "../coach/coach-career-types";
import { sortCoachCareerEntriesBySeason } from "../coach/coach-career-utils";

describe("toggleStaffPreviousExperience (§AF, §AG)", () => {
  it("permette di selezionare Allenatore e Calciatore insieme", () => {
    let selection: StaffPreviousExperience[] = [];

    selection = toggleStaffPreviousExperience(selection, "coach");
    selection = toggleStaffPreviousExperience(selection, "player");

    expect(selection).toEqual(["coach", "player"]);
  });

  it("selezionando Nessuna deseleziona Allenatore e Calciatore", () => {
    const selection = toggleStaffPreviousExperience(["coach", "player"], "none");

    expect(selection).toEqual(["none"]);
  });

  it("selezionando Allenatore dopo Nessuna deseleziona Nessuna", () => {
    expect(toggleStaffPreviousExperience(["none"], "coach")).toEqual(["coach"]);
  });

  it("selezionando Calciatore dopo Nessuna deseleziona Nessuna", () => {
    expect(toggleStaffPreviousExperience(["none"], "player")).toEqual(["player"]);
  });

  it("ritoccare una voce attiva la deseleziona", () => {
    expect(toggleStaffPreviousExperience(["coach", "player"], "coach")).toEqual([
      "player",
    ]);
  });
});

describe("lettura e scrittura della selezione", () => {
  it("fa il giro completo form → selezione → form", () => {
    const form = {
      staffHasCoachedFootball: true,
      staffHasNoPreviousExperience: false,
      staffHasPlayedFootball: true,
    };

    const selection = readStaffPreviousExperiences(form);

    expect(selection).toEqual(["coach", "player"]);
    expect(buildStaffPreviousExperiencePatch(selection)).toEqual(form);
  });

  it("Nessuna esperienza prevale sui flag residui", () => {
    expect(
      readStaffPreviousExperiences({
        staffHasCoachedFootball: true,
        staffHasNoPreviousExperience: true,
        staffHasPlayedFootball: true,
      }),
    ).toEqual(["none"]);
  });
});

describe("getNextStaffSubFlowStep (§AJ, §AK)", () => {
  it("con entrambe le scelte apre prima la carriera da allenatore", () => {
    expect(getNextStaffSubFlowStep(["coach", "player"])).toBe(
      "staff_coach_career",
    );
  });

  it("dopo l'allenatore porta al calciatore senza tornare all'inizio", () => {
    expect(getNextStaffSubFlowStep(["coach", "player"], ["coach"])).toBe(
      "staff_player_career",
    );
  });

  it("con il solo calciatore salta il sotto-flusso allenatore", () => {
    expect(getNextStaffSubFlowStep(["player"])).toBe("staff_player_career");
  });

  it("con Nessuna esperienza non apre nessun sotto-flusso", () => {
    expect(getNextStaffSubFlowStep(["none"])).toBeNull();
    expect(getNextStaffSubFlowStep(["coach", "player"], ["coach", "player"])).toBeNull();
  });
});

describe("getStaffExperienceRoleOptions (§R)", () => {
  it("propone i ruoli dichiarati nello Screen 4", () => {
    expect(
      getStaffExperienceRoleOptions(["Match analyst", "Team manager"]),
    ).toEqual([
      { label: "Match analyst", value: "Match analyst" },
      { label: "Team manager", value: "Team manager" },
    ]);
  });

  it("conserva un ruolo storico non più dichiarato", () => {
    const options = getStaffExperienceRoleOptions(
      ["Match analyst"],
      ["Preparatore atletico", "Match analyst", ""],
    );

    expect(options.map((option) => option.value)).toEqual([
      "Match analyst",
      "Preparatore atletico",
    ]);
  });

  it("senza ruoli dichiarati ricade sulla tassonomia completa", () => {
    expect(getStaffExperienceRoleOptions([]).length).toBeGreaterThan(1);
  });
});

describe("ordinamento del riepilogo (§AD, §Z)", () => {
  function periodEntry(
    id: string,
    startYear: string,
    endYear: string,
  ): CoachCareerEntry {
    return {
      category: "Serie A",
      clubId: null,
      description: null,
      id,
      period: { endMonth: endYear ? "Giugno" : "", endYear, startMonth: "Agosto", startYear },
      role: "Preparatore atletico",
      seasonDetails: {},
      seasons: [],
      teamLogoUrl: null,
      teamName: id,
      type: "CUSTOM_PERIOD",
    };
  }

  it("mette l'esperienza in corso davanti a quelle concluse", () => {
    const ordered = sortCoachCareerEntriesBySeason([
      periodEntry("conclusa-2023", "2022", "2023"),
      periodEntry("in-corso", "2024", ""),
      periodEntry("conclusa-2025", "2024", "2025"),
    ]);

    expect(ordered.map((entry) => entry.id)).toEqual([
      "in-corso",
      "conclusa-2025",
      "conclusa-2023",
    ]);
  });
});
