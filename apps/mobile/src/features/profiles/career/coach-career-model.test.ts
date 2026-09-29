/**
 * Modello di carriera dell'Allenatore (REV-PROF-03).
 *
 * Copre i vincoli che la task dichiara non negoziabili: ruolo e categoria per
 * singola stagione, ordinamento ricalcolato invece che ereditato dall'API,
 * incarichi multipli e non consecutivi nella stessa società, e la carriera da
 * ex calciatore consegnata al modello del Calciatore senza riscriverlo.
 */
import { describe, expect, it } from "vitest";

import type {
  CoachCareerEntryRecord,
  CoachPlayerCareerEntryRecord,
} from "../profile-service";
import {
  buildCoachCareerView,
  buildCoachPlayerCareerForms,
  getCurrentCoachExperience,
} from "./coach-career-model";
import { buildPlayerCareerView } from "./player-career-model";

// Marzo 2025: la stagione sportiva in corso è la 2024/2025.
const NOW = new Date("2025-03-01T00:00:00.000Z");

function entry(
  overrides: Partial<CoachCareerEntryRecord> & Pick<CoachCareerEntryRecord, "id">,
): CoachCareerEntryRecord {
  return {
    category: "Prima Squadra",
    club_id: null,
    coach_profile_id: "coach-1",
    description: null,
    experience_group_id: null,
    experience_type: "MULTI_SEASON",
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

describe("buildCoachCareerView", () => {
  it("prende ruolo e categoria dalla singola stagione, non dall'incarico", () => {
    const view = buildCoachCareerView(
      [
        entry({
          id: "exp-a",
          season_details: {
            "2022/2023": { category: "Juniores", role: "Allenatore" },
            "2023/2024": { category: "Prima Squadra", role: "Vice allenatore" },
            "2024/2025": { category: "Prima Squadra", role: "Allenatore" },
          },
          seasons: ["2022/2023", "2023/2024", "2024/2025"],
        }),
      ],
      { now: NOW },
    );

    const seasons = view.experiences[0]?.seasons ?? [];

    expect(seasons.map((season) => season.label)).toEqual([
      "2024/25",
      "2023/24",
      "2022/23",
    ]);
    expect(seasons.map((season) => season.role)).toEqual([
      "Allenatore",
      "Vice allenatore",
      "Allenatore",
    ]);
    expect(seasons.map((season) => season.category)).toEqual([
      "Prima Squadra",
      "Prima Squadra",
      "Juniores",
    ]);
  });

  it("ricade sul ruolo dell'incarico solo per le stagioni che non lo portano", () => {
    const view = buildCoachCareerView(
      [
        entry({
          category: "Allievi",
          id: "exp-a",
          role: "Vice allenatore",
          season_details: { "2023/2024": { role: "Allenatore" } },
          seasons: ["2023/2024", "2022/2023"],
        }),
      ],
      { now: NOW },
    );

    const seasons = view.experiences[0]?.seasons ?? [];

    expect(seasons[0]).toMatchObject({ category: "Allievi", role: "Allenatore" });
    expect(seasons[1]).toMatchObject({
      category: "Allievi",
      role: "Vice allenatore",
    });
  });

  it("mette in cima l'incarico in corso, poi ordina per fine decrescente", () => {
    const view = buildCoachCareerView(
      [
        // L'ordine di arrivo è volutamente sbagliato: non deve contare.
        entry({ id: "vecchio", seasons: ["2018/2019"], team_name: "Fiorentina" }),
        entry({ id: "recente", seasons: ["2021/2022"], team_name: "Como" }),
        entry({ id: "in-corso", seasons: ["2024/2025"], team_name: "Torino FC" }),
      ],
      { now: NOW },
    );

    expect(view.experiences.map((experience) => experience.id)).toEqual([
      "in-corso",
      "recente",
      "vecchio",
    ]);
    expect(view.experiences[0]?.isCurrent).toBe(true);
    expect(view.experiences[1]?.isCurrent).toBe(false);
  });

  it("tiene distinti due incarichi non consecutivi nella stessa società", () => {
    const view = buildCoachCareerView(
      [
        entry({ id: "primo", seasons: ["2016/2017"] }),
        entry({ id: "secondo", seasons: ["2023/2024"] }),
      ],
      { now: NOW },
    );

    expect(view.experiences).toHaveLength(2);
    expect(view.experiences.map((experience) => experience.clubName)).toEqual([
      "Torino FC",
      "Torino FC",
    ]);
  });

  it("conta una sola volta una stagione condivisa da due incarichi simultanei", () => {
    const view = buildCoachCareerView(
      [
        entry({ id: "prima-squadra", seasons: ["2024/2025"] }),
        entry({
          category: "Juniores",
          id: "juniores",
          seasons: ["2024/2025"],
          team_name: "Torino FC Juniores",
        }),
      ],
      { now: NOW },
    );

    expect(view.experiences).toHaveLength(2);
    expect(view.seasonCount).toBe(1);
  });

  it("riconosce come in corso un periodo personalizzato non ancora scaduto", () => {
    const view = buildCoachCareerView(
      [
        entry({
          experience_type: "CUSTOM_PERIOD",
          id: "custom",
          period_end_month: "Giugno",
          period_end_year: 2026,
          period_start_month: "Gennaio",
          period_start_year: 2024,
        }),
      ],
      { now: NOW },
    );

    expect(view.experiences[0]?.isCurrent).toBe(true);
    expect(view.experiences[0]?.periodLabel).toBe("Gennaio 2024 — Presente");
  });

  it("etichetta un incarico chiuso con il suo periodo reale", () => {
    const view = buildCoachCareerView(
      [entry({ id: "chiuso", seasons: ["2021/2022", "2022/2023"] })],
      { now: NOW },
    );

    expect(view.experiences[0]?.periodLabel).toBe("2021 — 2023 · 2 stagioni");
  });

  it("dice 'Presente' quando l'incarico copre la stagione in corso", () => {
    const view = buildCoachCareerView(
      [entry({ id: "attuale", seasons: ["2022/2023", "2023/2024", "2024/2025"] })],
      { now: NOW },
    );

    expect(view.experiences[0]?.periodLabel).toBe("2022 — Presente · 3 stagioni");
  });
});

describe("getCurrentCoachExperience", () => {
  it("non promuove l'ultimo incarico salvato a situazione attuale", () => {
    const view = buildCoachCareerView(
      [entry({ id: "chiuso", seasons: ["2021/2022"] })],
      { now: NOW },
    );

    expect(getCurrentCoachExperience(view)).toBeNull();
  });

  it("con più incarichi attivi sceglie quello iniziato più di recente", () => {
    const view = buildCoachCareerView(
      [
        entry({
          id: "storico",
          seasons: ["2020/2021", "2021/2022", "2022/2023", "2023/2024", "2024/2025"],
        }),
        entry({
          category: "Juniores",
          id: "nuovo",
          seasons: ["2024/2025"],
          team_name: "Como",
        }),
      ],
      { now: NOW },
    );

    expect(getCurrentCoachExperience(view)?.id).toBe("nuovo");
    // Gli altri incarichi restano comunque in carriera.
    expect(view.experiences).toHaveLength(2);
  });
});

describe("assegnazioni per stagione (REV-PROF-04)", () => {
  it("riunisce le righe dello stesso gruppo in un unico incarico", () => {
    // Dopo la migrazione il backend salva una riga per stagione: il Master
    // Profile deve continuare a mostrare un incarico con tre stagioni, non tre
    // incarichi nella stessa società.
    const view = buildCoachCareerView(
      [
        entry({
          category: "Serie B",
          experience_group_id: "g-torino",
          id: "row-1",
          role: "Allenatore",
          seasons: ["2024/2025"],
        }),
        entry({
          category: "Serie B",
          experience_group_id: "g-torino",
          id: "row-2",
          role: "Vice allenatore",
          seasons: ["2023/2024"],
        }),
        entry({
          category: "Primavera",
          experience_group_id: "g-torino",
          id: "row-3",
          role: "Allenatore",
          seasons: ["2022/2023"],
        }),
      ],
      { now: NOW },
    );

    expect(view.experiences).toHaveLength(1);
    expect(view.experiences[0].id).toBe("g-torino");
    expect(view.experiences[0].periodLabel).toBe("2022 — Presente · 3 stagioni");
    expect(view.experiences[0].seasons.map((season) => season.role)).toEqual([
      "Allenatore",
      "Vice allenatore",
      "Allenatore",
    ]);
    expect(view.experiences[0].seasons.map((season) => season.category)).toEqual([
      "Serie B",
      "Serie B",
      "Primavera",
    ]);
    expect(view.seasonCount).toBe(3);
  });

  it("tiene distinti due gruppi nella stessa società", () => {
    const view = buildCoachCareerView(
      [
        entry({
          experience_group_id: "g-primo",
          id: "row-1",
          seasons: ["2016/2017"],
        }),
        entry({
          experience_group_id: "g-secondo",
          id: "row-2",
          seasons: ["2024/2025"],
        }),
      ],
      { now: NOW },
    );

    // Un gruppo di una riga sola resta il record che è: l'id che porta è il
    // suo, non quello del gruppo. Quello che conta è che non si fondano.
    expect(view.experiences).toHaveLength(2);
    expect(view.experiences.map((experience) => experience.id)).toEqual([
      "row-2",
      "row-1",
    ]);
    expect(view.experiences[0].isCurrent).toBe(true);
  });
});

describe("buildCoachPlayerCareerForms", () => {
  function playerEntry(
    overrides: Partial<CoachPlayerCareerEntryRecord> &
      Pick<CoachPlayerCareerEntryRecord, "id" | "season">,
  ): CoachPlayerCareerEntryRecord {
    return {
      appearances: null,
      assists: null,
      awards: null,
      career_type: null,
      category: "Serie C",
      coach_profile_id: "coach-1",
      experience_group_id: null,
      goals: null,
      minutes_played: null,
      period_end_month: null,
      period_start_month: null,
      position: null,
      season_period: "full",
      sort_order: 0,
      team_logo_url: null,
      team_name: "Como",
      ...overrides,
    };
  }

  it("riunisce le stagioni dello stesso gruppo in un'unica esperienza", () => {
    const view = buildPlayerCareerView(
      buildCoachPlayerCareerForms([
        playerEntry({
          appearances: 30,
          experience_group_id: "g-como",
          id: "p1",
          season: "2010/2011",
        }),
        playerEntry({
          appearances: 28,
          experience_group_id: "g-como",
          id: "p2",
          season: "2011/2012",
        }),
        playerEntry({
          experience_group_id: "g-pisa",
          id: "p3",
          season: "2012/2013",
          team_name: "Pisa",
        }),
      ]),
    );

    expect(view.experiences).toHaveLength(2);
    expect(view.totals.appearances).toBe(58);
  });

  it("tiene separati due passaggi distinti nella stessa società", () => {
    // REV-PROF-04: senza gruppo la riga ricade sul proprio id. Accorparle per
    // somiglianza di nome fonderebbe due esperienze realmente distinte.
    const view = buildPlayerCareerView(
      buildCoachPlayerCareerForms([
        playerEntry({ id: "p1", season: "2010/2011" }),
        playerEntry({ id: "p2", season: "2019/2020" }),
      ]),
    );

    expect(view.experiences).toHaveLength(2);
  });

  it("non trasforma uno zero non inserito in uno zero dichiarato", () => {
    const view = buildPlayerCareerView(
      buildCoachPlayerCareerForms([playerEntry({ id: "p1", season: "2010/2011" })]),
    );

    expect(view.totals.goals).toBeNull();
  });
});
