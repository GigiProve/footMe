/**
 * §AA — palmarès: titolo derivato, ordinamento e compatibilità legacy.
 */
import { describe, expect, it } from "vitest";

import type { PlayerPalmaresRecord } from "../profile-service";
import { buildAwardTitle, sortAwardsByRecency } from "./player-awards";

function award(
  overrides: Partial<PlayerPalmaresRecord>,
): PlayerPalmaresRecord {
  return {
    club_name: "ASD Romano Prodi",
    competition_name: "Serie B",
    id: "a",
    palmares_type: "trophy",
    player_profile_id: "p",
    season_label: "2023/2024",
    sort_order: 0,
    ...overrides,
  } as PlayerPalmaresRecord;
}

describe("buildAwardTitle", () => {
  it("compone il titolo dai dati strutturati", () => {
    expect(
      buildAwardTitle({
        competition_name: "Serie B",
        palmares_type: "top_scorer",
        season_label: "2023/2024",
      }),
    ).toBe("Capocannoniere Serie B 2023/24");

    expect(
      buildAwardTitle({
        competition_name: "Coppa Italia Dilettanti",
        palmares_type: "trophy",
        season_label: "2022/2023",
      }),
    ).toBe("Vincitore Coppa Italia Dilettanti 2022/23");
  });

  it("regge un record legacy senza stagione senza produrre spazi vuoti", () => {
    expect(
      buildAwardTitle({
        competition_name: "Torneo estivo",
        palmares_type: "medal",
        season_label: "",
      }),
    ).toBe("Medaglia Torneo estivo");
  });
});

describe("sortAwardsByRecency", () => {
  it("mette la stagione più recente per prima e i record senza stagione in fondo", () => {
    const sorted = sortAwardsByRecency([
      award({ id: "vecchio", season_label: "2019/2020" }),
      award({ id: "senza-stagione", season_label: "" }),
      award({ id: "recente", season_label: "2024/2025" }),
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual([
      "recente",
      "vecchio",
      "senza-stagione",
    ]);
  });

  it("non perde i record legacy", () => {
    const input = [award({ id: "a", season_label: "" }), award({ id: "b" })];

    expect(sortAwardsByRecency(input)).toHaveLength(2);
  });
});
