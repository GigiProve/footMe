import { describe, expect, it } from "vitest";

import {
  formatExperienceCategory,
  formatExperiencePeriod,
  formatExperienceStats,
} from "./career-experience-display";
import type { PlayerCareerEntry } from "./player-career-types";
import {
  formsToPlayerEntries,
  playerEntriesToForms,
  playerPeriodFromDateValue,
  playerPeriodToDateValue,
  sortPlayerEntriesByRecency,
  splitPlayerEntryBySeasonDetails,
} from "./player-career-utils";

function entry(overrides: Partial<PlayerCareerEntry> = {}): PlayerCareerEntry {
  return {
    category: "Serie A",
    clubId: null,
    id: "e1",
    period: null,
    seasonDetails: {},
    seasons: [],
    teamCity: "",
    teamLogoUrl: "",
    teamName: "Fiorentina",
    type: "SINGLE_SEASON",
    ...overrides,
  };
}

function detail(overrides: Partial<PlayerCareerEntry["seasonDetails"][string]> = {}) {
  return {
    appearances: "",
    assists: "",
    awards: "",
    category: "Serie A",
    goals: "",
    minutesPlayed: "",
    ...overrides,
  };
}

describe("periodo personalizzato", () => {
  it("converte il mese fra etichetta, numero e valore del picker", () => {
    expect(playerPeriodToDateValue("Gennaio", "2025")).toBe("2025-01");
    expect(playerPeriodToDateValue("1", "2025")).toBe("2025-01");
    expect(playerPeriodToDateValue("", "2025")).toBe("");
    expect(playerPeriodFromDateValue("2026-02")).toEqual({
      month: "Febbraio",
      year: "2026",
    });
    expect(playerPeriodFromDateValue("")).toEqual({ month: "", year: "" });
  });

  it("persiste il mese come numero, non come stringa localizzata", () => {
    const forms = playerEntriesToForms([
      entry({
        id: "custom",
        period: {
          endMonth: "Maggio",
          endYear: "2025",
          startMonth: "Gennaio",
          startYear: "2025",
        },
        type: "CUSTOM_PERIOD",
      }),
    ]);

    expect(forms.length).toBeGreaterThan(0);
    expect(forms[0].periodStartMonth).toBe("1");
    expect(forms[forms.length - 1].periodEndMonth).toBe("5");
  });

  it("rilegge il periodo tornando alle etichette", () => {
    const original = entry({
      id: "custom",
      period: {
        endMonth: "Maggio",
        endYear: "2025",
        startMonth: "Gennaio",
        startYear: "2025",
      },
      type: "CUSTOM_PERIOD",
    });

    const [roundTripped] = formsToPlayerEntries(playerEntriesToForms([original]));

    expect(roundTripped.type).toBe("CUSTOM_PERIOD");
    expect(roundTripped.period?.startMonth).toBe("Gennaio");
    expect(roundTripped.period?.endMonth).toBe("Maggio");
  });

  it("non spezza un periodo personalizzato in stagioni complete", () => {
    const custom = entry({
      id: "custom",
      period: {
        endMonth: "Maggio",
        endYear: "2026",
        startMonth: "Gennaio",
        startYear: "2025",
      },
      seasonDetails: {
        "2024/2025": detail({ category: "Serie A" }),
        "2025/2026": detail({ category: "Serie B" }),
      },
      type: "CUSTOM_PERIOD",
    });

    const result = splitPlayerEntryBySeasonDetails(custom);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("CUSTOM_PERIOD");
    expect(result[0].period).not.toBeNull();
  });
});

describe("tipo dichiarato dell'esperienza", () => {
  it("una sola stagione resta multi-season se è così che è stata creata", () => {
    const multi = entry({
      id: "multi",
      seasonDetails: { "2023/2024": detail() },
      seasons: ["2023/2024"],
      type: "MULTI_SEASON",
    });

    const [roundTripped] = formsToPlayerEntries(playerEntriesToForms([multi]));

    expect(roundTripped.type).toBe("MULTI_SEASON");
  });

  it("le righe legacy senza tipo lo ricostruiscono dai campi", () => {
    const [legacy] = formsToPlayerEntries([
      {
        appearances: "",
        assists: "",
        awards: "",
        category: "Serie A",
        clubId: null,
        clubName: "AC Milan",
        goals: "",
        minutesPlayed: "",
        periodEndMonth: "",
        periodStartMonth: "",
        seasonLabel: "2023/2024",
        seasonPeriod: "full",
        teamCity: "",
        teamLogoUrl: "",
      },
    ]);

    expect(legacy.type).toBe("SINGLE_SEASON");
  });
});

describe("statistiche per stagione", () => {
  it("non perde i dati quando le stagioni condividono la categoria", () => {
    const multi = entry({
      id: "multi",
      seasonDetails: {
        "2022/2023": detail({ appearances: "20", goals: "5" }),
        "2023/2024": detail({ appearances: "28", goals: "12" }),
      },
      seasons: ["2023/2024", "2022/2023"],
      type: "MULTI_SEASON",
    });

    const [result] = splitPlayerEntryBySeasonDetails(multi);

    expect(result.seasonDetails["2023/2024"].appearances).toBe("28");
    expect(result.seasonDetails["2022/2023"].goals).toBe("5");
  });

  it("separa le categorie diverse tenendo le statistiche di ogni stagione", () => {
    const multi = entry({
      id: "multi",
      seasonDetails: {
        "2021/2022": detail({ appearances: "30", category: "Serie B" }),
        "2022/2023": detail({ appearances: "20", category: "Serie A" }),
      },
      seasons: ["2022/2023", "2021/2022"],
      type: "MULTI_SEASON",
    });

    const result = splitPlayerEntryBySeasonDetails(multi);

    expect(result).toHaveLength(2);
    const serieB = result.find((group) => group.category === "Serie B");
    expect(serieB?.seasonDetails["2021/2022"].appearances).toBe("30");
  });
});

describe("riepilogo carriera", () => {
  it("ordina dalla più recente alla più vecchia mischiando le modalità", () => {
    const single = entry({ id: "single", seasons: ["2026/2027"] });
    const multi = entry({
      id: "multi",
      seasons: ["2022/2023", "2021/2022"],
      type: "MULTI_SEASON",
    });
    const custom = entry({
      id: "custom",
      period: {
        endMonth: "Febbraio",
        endYear: "2025",
        startMonth: "Gennaio",
        startYear: "2024",
      },
      type: "CUSTOM_PERIOD",
    });

    expect(
      sortPlayerEntriesByRecency([multi, custom, single]).map((item) => item.id),
    ).toEqual(["single", "custom", "multi"]);
  });

  it("formatta il periodo secondo la modalità", () => {
    expect(formatExperiencePeriod(entry({ seasons: ["2026/2027"] }))).toBe(
      "2026/27",
    );
    expect(
      formatExperiencePeriod(
        entry({ seasons: ["2023/2024", "2022/2023"], type: "MULTI_SEASON" }),
      ),
    ).toBe("2023/24, 2022/23");
    expect(
      formatExperiencePeriod(
        entry({
          period: {
            endMonth: "Febbraio",
            endYear: "2026",
            startMonth: "Gennaio",
            startYear: "2025",
          },
          type: "CUSTOM_PERIOD",
        }),
      ),
    ).toBe("Da Gennaio 2025 a Febbraio 2026");
  });

  it("non spaccia una categoria per tutte quando differiscono", () => {
    const mixed = entry({
      id: "multi",
      seasonDetails: {
        "2021/2022": detail({ category: "Serie B" }),
        "2022/2023": detail({ category: "Serie A" }),
      },
      seasons: ["2022/2023", "2021/2022"],
      type: "MULTI_SEASON",
    });

    expect(formatExperienceCategory(mixed)).toBe("2 categorie");
    expect(formatExperienceCategory(entry({ seasons: ["2023/2024"] }))).toBe(
      "Serie A",
    );
  });

  it("omette le statistiche quando non ce ne sono", () => {
    expect(
      formatExperienceStats(
        entry({
          seasonDetails: { "2023/2024": detail() },
          seasons: ["2023/2024"],
        }),
      ),
    ).toBeUndefined();

    expect(
      formatExperienceStats(
        entry({
          seasonDetails: {
            "2023/2024": detail({ appearances: "28", assists: "7", goals: "12" }),
          },
          seasons: ["2023/2024"],
        }),
      ),
    ).toBe("28 presenze · 12 gol · 7 assist");
  });
});

describe("regressioni trovate in review", () => {
  it("un periodo personalizzato non sposta gli anni a ogni salvataggio", () => {
    const original = entry({
      id: "custom",
      period: {
        endMonth: "Maggio",
        endYear: "2025",
        startMonth: "Gennaio",
        startYear: "2025",
      },
      type: "CUSTOM_PERIOD",
    });

    // Tre cicli salva/riapri: gli estremi non devono muoversi di un anno.
    let current = original;

    for (let cycle = 0; cycle < 3; cycle += 1) {
      [current] = formsToPlayerEntries(playerEntriesToForms([current]));
    }

    expect(current.period).toEqual(original.period);
    expect(current.type).toBe("CUSTOM_PERIOD");
  });

  it("regge anche un periodo che attraversa più stagioni", () => {
    const original = entry({
      id: "custom",
      period: {
        endMonth: "Dicembre",
        endYear: "2024",
        startMonth: "Marzo",
        startYear: "2023",
      },
      type: "CUSTOM_PERIOD",
    });

    const [roundTripped] = formsToPlayerEntries(
      playerEntriesToForms([original]),
    );

    expect(roundTripped.period).toEqual(original.period);
  });

  it("non spezza in tre un periodo su più stagioni ricaricato dal database", () => {
    const original = entry({
      id: "custom",
      period: {
        endMonth: "Dicembre",
        endYear: "2024",
        startMonth: "Marzo",
        startYear: "2023",
      },
      type: "CUSTOM_PERIOD",
    });

    // Il database non conserva né `careerType` né `groupId`.
    const persisted = playerEntriesToForms([original]).map(
      ({ careerType, groupId, ...row }) => row,
    );

    expect(persisted.length).toBeGreaterThan(1);

    const rebuilt = formsToPlayerEntries(persisted);

    expect(rebuilt).toHaveLength(1);
    expect(rebuilt[0].type).toBe("CUSTOM_PERIOD");
  });

  it("le statistiche restano visibili su un periodo di una sola stagione", () => {
    const single = entry({
      id: "custom",
      period: {
        endMonth: "Maggio",
        endYear: "2025",
        startMonth: "Gennaio",
        startYear: "2025",
      },
      seasonDetails: {
        "2024/2025": detail({ appearances: "12", assists: "2", goals: "3" }),
      },
      type: "CUSTOM_PERIOD",
    });

    expect(formatExperienceStats(single)).toBe(
      "12 presenze · 3 gol · 2 assist",
    );
  });

  it("un gruppo rimasto con una stagione sola torna a essere singolo", () => {
    const multi = entry({
      id: "multi",
      seasonDetails: {
        "2021/2022": detail({ category: "Serie B" }),
        "2022/2023": detail({ category: "Serie A" }),
      },
      seasons: ["2022/2023", "2021/2022"],
      type: "MULTI_SEASON",
    });

    const result = splitPlayerEntryBySeasonDetails(multi);

    expect(result.every((group) => group.type === "SINGLE_SEASON")).toBe(true);
  });
});
