import { describe, expect, it } from "vitest";

import {
  buildDirectorPreviousRolesPatch,
  getDirectorGenericRoleOptions,
  getNextDirectorSubFlowStep,
  getPreviousDirectorSubFlowStep,
  readDirectorPreviousRoles,
  toggleDirectorPreviousRole,
} from "./director-previous-roles";
import { getDirectorExperienceRoleOptions } from "./director-taxonomy";

describe("toggleDirectorPreviousRole (§Z)", () => {
  it("accumula e rimuove senza opzioni esclusive", () => {
    expect(toggleDirectorPreviousRole([], "player")).toEqual(["player"]);
    expect(toggleDirectorPreviousRole(["player"], "coach")).toEqual([
      "player",
      "coach",
    ]);
    expect(toggleDirectorPreviousRole(["player", "coach"], "player")).toEqual([
      "coach",
    ]);
  });
});

describe("readDirectorPreviousRoles", () => {
  it("scarta i valori che non appartengono alla tassonomia", () => {
    expect(
      readDirectorPreviousRoles({
        directorPreviousRoles: ["coach", "presidente", "referee"],
      }),
    ).toEqual(["coach", "referee"]);
  });
});

describe("buildDirectorPreviousRolesPatch (§AN)", () => {
  it("svuota i rami che l'utente non dichiara più", () => {
    const patch = buildDirectorPreviousRolesPatch(["coach"]);

    expect(patch.directorPreviousRoles).toEqual(["coach"]);
    expect(patch.directorPlayerCareerEntries).toEqual([]);
    expect(patch.directorStaffCareerEntries).toEqual([]);
    expect(patch.directorOtherCareerEntries).toEqual([]);
    // Il ramo dichiarato non viene toccato.
    expect(patch).not.toHaveProperty("directorCoachCareerEntries");
  });

  it("mantiene allineati i flag legacy", () => {
    expect(buildDirectorPreviousRolesPatch([])).toMatchObject({
      directorHasOtherFootballExperience: false,
      directorHasPlayedFootball: false,
    });
    expect(buildDirectorPreviousRolesPatch(["player"])).toMatchObject({
      directorHasOtherFootballExperience: true,
      directorHasPlayedFootball: true,
    });
  });
});

describe("getNextDirectorSubFlowStep (§AB, §AC–§AH)", () => {
  it("salta tutti i rami con zero selezioni", () => {
    expect(getNextDirectorSubFlowStep([])).toBeNull();
  });

  it("apre i rami nell'ordine previsto", () => {
    const selection = ["coach", "player", "scout"] as const;

    const first = getNextDirectorSubFlowStep([...selection]);
    expect(first).toBe("director_player_career");

    const second = getNextDirectorSubFlowStep([...selection], [first!]);
    expect(second).toBe("director_coach_career");

    // Lo Staff non è dichiarato: si passa direttamente all'editor generico.
    const third = getNextDirectorSubFlowStep([...selection], [first!, second!]);
    expect(third).toBe("director_other_career");

    expect(
      getNextDirectorSubFlowStep([...selection], [first!, second!, third!]),
    ).toBeNull();
  });

  it("raccoglie Scout, Procuratore, Arbitro e Altro in un solo passo (§AG)", () => {
    for (const role of ["scout", "agent", "referee", "other"] as const) {
      expect(getNextDirectorSubFlowStep([role])).toBe("director_other_career");
    }
  });
});

describe("getPreviousDirectorSubFlowStep (§AN)", () => {
  it("rientra nel ramo precedente effettivamente dichiarato", () => {
    expect(
      getPreviousDirectorSubFlowStep(["player", "other"], "director_other_career"),
    ).toBe("director_player_career");
    expect(
      getPreviousDirectorSubFlowStep(["other"], "director_other_career"),
    ).toBeNull();
  });
});

describe("getDirectorGenericRoleOptions (§AG)", () => {
  it("propone solo i ruoli generici dichiarati", () => {
    expect(getDirectorGenericRoleOptions(["scout", "referee", "coach"])).toEqual([
      { label: "Scout", value: "Scout" },
      { label: "Arbitro", value: "Arbitro" },
    ]);
  });
});

describe("getDirectorExperienceRoleOptions (§R, §H)", () => {
  it("usa i ruoli dichiarati e sostituisce Altro con il ruolo libero", () => {
    expect(
      getDirectorExperienceRoleOptions(
        ["Direttore sportivo", "Altro"],
        "Responsabile area tecnica",
      ),
    ).toEqual([
      { label: "Direttore sportivo", value: "Direttore sportivo" },
      {
        label: "Responsabile area tecnica",
        value: "Responsabile area tecnica",
      },
    ]);
  });

  it("non perde un ruolo storico già salvato in un'esperienza", () => {
    const options = getDirectorExperienceRoleOptions(
      ["Direttore generale"],
      "",
      ["Responsabile scouting", "Direttore generale", ""],
    );

    expect(options.map((option) => option.value)).toEqual([
      "Direttore generale",
      "Responsabile scouting",
    ]);
  });

  it("ripiega sull'elenco completo quando non c'è nulla di dichiarato", () => {
    expect(getDirectorExperienceRoleOptions([]).length).toBeGreaterThan(5);
  });
});
