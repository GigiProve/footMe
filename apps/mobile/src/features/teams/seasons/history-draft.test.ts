/**
 * Le operazioni sulla bozza storica (§19, §21).
 *
 * Le regole provate qui sono quelle che perderebbero dati o cambierebbero
 * l'ordine stabile su cui §20 fonda l'assegnazione delle stagioni nuove: la
 * modifica sostituisce invece di duplicare, la rimozione non tocca altro,
 * l'ordine dei suggerimenti è quello della task.
 */
import { describe, expect, it } from "vitest";

import {
  addPeriod,
  draftScopeKey,
  isRangeValid,
  removePeriod,
  suggestPeriodDefaults,
  toPeriodInputs,
  updatePeriod,
  type HistoryDraftPeriod,
} from "./history-draft";
import type { HistorySeasonOption } from "./seasons-service";

function period(overrides: Partial<HistoryDraftPeriod> = {}): HistoryDraftPeriod {
  return {
    fromLabel: "2018/19",
    fromSeason: "2018/19",
    id: "p1",
    levelId: "regionale",
    levelLabel: "Regionale",
    toLabel: "2021/22",
    toSeason: "2021/22",
    typeId: "u18",
    typeLabel: "Under 18",
    ...overrides,
  };
}

const SEASONS: HistorySeasonOption[] = [
  { alreadyPresent: false, label: "2018/19", seasonId: "2018/19", sortOrder: 2018 },
  { alreadyPresent: false, label: "2019/20", seasonId: "2019/20", sortOrder: 2019 },
  { alreadyPresent: false, label: "2020/21", seasonId: "2020/21", sortOrder: 2020 },
  { alreadyPresent: false, label: "2021/22", seasonId: "2021/22", sortOrder: 2021 },
  { alreadyPresent: false, label: "2022/23", seasonId: "2022/23", sortOrder: 2022 },
  { alreadyPresent: true, label: "2023/24", seasonId: "2023/24", sortOrder: 2023 },
  { alreadyPresent: false, label: "2024/25", seasonId: "2024/25", sortOrder: 2024 },
];

describe("operazioni sulla bozza", () => {
  it("aggiunge in coda, conservando l'ordine di inserimento (§20)", () => {
    const result = addPeriod([period()], period({ id: "p2" }));

    expect(result.map((item) => item.id)).toEqual(["p1", "p2"]);
  });

  it("la modifica sostituisce il periodo e non ne aggiunge una copia (§21)", () => {
    const result = updatePeriod(
      [period(), period({ id: "p2" })],
      period({ id: "p1", toLabel: "2019/20", toSeason: "2019/20" }),
    );

    expect(result).toHaveLength(2);
    expect(result[0].toSeason).toBe("2019/20");
    // La posizione non cambia: l'ordine stabile è la regola di §20.
    expect(result.map((item) => item.id)).toEqual(["p1", "p2"]);
  });

  it("la rimozione riguarda solo il periodo indicato", () => {
    const result = removePeriod([period(), period({ id: "p2" })], "p1");

    expect(result.map((item) => item.id)).toEqual(["p2"]);
  });

  it("verso il server viaggiano gli ID, non le label (§31)", () => {
    expect(toPeriodInputs([period()])).toEqual([
      {
        fromSeason: "2018/19",
        levelId: "regionale",
        toSeason: "2021/22",
        typeId: "u18",
      },
    ]);
  });

  it("l'ambito distingue account, Società e squadra (§21)", () => {
    expect(draftScopeKey("a", "c", "t")).not.toBe(draftScopeKey("a", "c", "t2"));
    expect(draftScopeKey("a", "c", "t")).not.toBe(draftScopeKey("a2", "c", "t"));
  });
});

describe("suggerimenti (§19)", () => {
  const history = [
    {
      levelId: "elite",
      levelLabel: "Élite",
      seasonId: "2024/25",
      typeId: "u18",
      typeLabel: "Under 18",
    },
  ];

  const currentConfig = {
    levelId: "serie-d",
    levelLabel: "Serie D",
    typeId: "prima",
    typeLabel: "Prima squadra",
  };

  it("1. il periodo aggiunto immediatamente prima vince su tutto", () => {
    const result = suggestPeriodDefaults({
      currentConfig,
      history,
      periods: [period()],
      seasons: SEASONS,
    });

    expect(result.typeId).toBe("u18");
    expect(result.levelId).toBe("regionale");
  });

  it("2. senza bozza vale la configurazione storica più vicina", () => {
    const result = suggestPeriodDefaults({
      currentConfig,
      history,
      periods: [],
      seasons: SEASONS,
    });

    expect(result.levelId).toBe("elite");
  });

  it("3. senza storico vale la configurazione corrente", () => {
    const result = suggestPeriodDefaults({
      currentConfig,
      history: [],
      periods: [],
      seasons: SEASONS,
    });

    expect(result.typeId).toBe("prima");
  });

  it("4. nessun valore quando non è determinabile", () => {
    const result = suggestPeriodDefaults({
      currentConfig: null,
      history: [],
      periods: [],
      seasons: SEASONS,
    });

    expect(result.typeId).toBeNull();
    expect(result.levelId).toBeNull();
  });

  it("propone Da dalla prima stagione successiva ancora mancante", () => {
    const result = suggestPeriodDefaults({
      currentConfig,
      history,
      periods: [period()],
      seasons: SEASONS,
    });

    expect(result.fromSeason).toBe("2022/23");
  });

  it("salta le stagioni già presenti nello storico", () => {
    const result = suggestPeriodDefaults({
      currentConfig,
      history,
      periods: [period({ toLabel: "2022/23", toSeason: "2022/23" })],
      seasons: SEASONS,
    });

    // 2023/24 è già persistita: il suggerimento passa a 2024/25.
    expect(result.fromSeason).toBe("2024/25");
  });

  it("non sceglie mai A", () => {
    const result = suggestPeriodDefaults({
      currentConfig,
      history,
      periods: [period()],
      seasons: SEASONS,
    });

    expect(result).not.toHaveProperty("toSeason");
  });
});

describe("validità dell'intervallo (§19)", () => {
  it("accetta Da uguale ad A: una sola stagione", () => {
    expect(isRangeValid("2019/20", "2019/20", SEASONS)).toBe(true);
  });

  it("rifiuta l'intervallo invertito", () => {
    expect(isRangeValid("2021/22", "2018/19", SEASONS)).toBe(false);
  });

  it("rifiuta un estremo fuori catalogo", () => {
    expect(isRangeValid("1999/00", "2019/20", SEASONS)).toBe(false);
    expect(isRangeValid(null, "2019/20", SEASONS)).toBe(false);
  });
});
