import { describe, expect, it } from "vitest";

import type { PlayerExperienceForm } from "../player-sports";
import {
  buildCareerChartSeries,
  buildPlayerCareerView,
  formatCareerStat,
} from "./player-career-model";

/** "Adesso" congelato: le stagioni "in corso" non devono dipendere dal giorno. */
const NOW = new Date("2025-03-01T00:00:00.000Z");

function season(
  overrides: Partial<PlayerExperienceForm> &
    Pick<PlayerExperienceForm, "seasonLabel">,
): PlayerExperienceForm {
  return {
    appearances: "",
    assists: "",
    awards: "",
    category: "Serie A",
    clubId: null,
    clubName: "ASD Romano Prodi",
    goals: "",
    minutesPlayed: "",
    periodEndMonth: "",
    periodStartMonth: "",
    seasonPeriod: "full",
    teamCity: "",
    teamLogoUrl: "",
    ...overrides,
  };
}

describe("player-career-model", () => {
  describe("raggruppamento delle esperienze (§12, §13)", () => {
    it("tiene separate due esperienze distinte nello stesso club", () => {
      const view = buildPlayerCareerView(
        [
          season({
            careerType: "MULTI_SEASON",
            clubId: "club-1",
            groupId: "exp-recente",
            seasonLabel: "2024/2025",
          }),
          season({
            careerType: "MULTI_SEASON",
            clubId: "club-1",
            groupId: "exp-recente",
            seasonLabel: "2023/2024",
          }),
          season({
            careerType: "SINGLE_SEASON",
            clubId: "club-1",
            groupId: "exp-vecchia",
            seasonLabel: "2018/2019",
          }),
        ],
        { now: NOW },
      );

      expect(view.experiences).toHaveLength(2);
      expect(view.experiences.map((experience) => experience.id)).toEqual([
        "exp-recente",
        "exp-vecchia",
      ]);
      // Il logo appartiene all'esperienza: due esperienze, due loghi.
      expect(
        view.experiences.every((experience) => experience.clubName === "ASD Romano Prodi"),
      ).toBe(true);
    });

    it("raccoglie tutte le stagioni di un'esperienza sotto un solo header", () => {
      const view = buildPlayerCareerView(
        [
          season({ groupId: "exp", seasonLabel: "2022/2023" }),
          season({ groupId: "exp", seasonLabel: "2024/2025" }),
          season({ groupId: "exp", seasonLabel: "2023/2024" }),
        ],
        { now: NOW },
      );

      expect(view.experiences).toHaveLength(1);
      // Tutte visibili e dalla più recente alla più vecchia (§15, §16).
      expect(view.experiences[0]?.seasons.map((s) => s.label)).toEqual([
        "2024/25",
        "2023/24",
        "2022/23",
      ]);
    });

    it("mantiene la categoria sulla singola stagione (§12)", () => {
      const view = buildPlayerCareerView(
        [
          season({
            category: "Serie A",
            groupId: "exp",
            seasonLabel: "2024/2025",
          }),
          season({
            category: "Serie B",
            groupId: "exp",
            seasonLabel: "2023/2024",
          }),
        ],
        { now: NOW },
      );

      expect(view.experiences[0]?.seasons.map((s) => s.category)).toEqual([
        "Serie A",
        "Serie B",
      ]);
    });
  });

  describe("ordinamento e tipologie (§17, §18)", () => {
    it("ordina dalla più recente alla più vecchia mischiando le tre tipologie", () => {
      const view = buildPlayerCareerView(
        [
          season({
            careerType: "SINGLE_SEASON",
            clubName: "Vecchio Club",
            groupId: "single-vecchio",
            seasonLabel: "2019/2020",
          }),
          season({
            careerType: "CUSTOM_PERIOD",
            clubName: "Prestito",
            groupId: "custom",
            periodEndMonth: "5",
            periodStartMonth: "1",
            seasonLabel: "2022/2023",
            seasonPeriod: "partial",
          }),
          season({
            careerType: "MULTI_SEASON",
            clubName: "Club Attuale",
            groupId: "multi",
            seasonLabel: "2024/2025",
          }),
        ],
        { now: NOW },
      );

      expect(view.experiences.map((experience) => experience.clubName)).toEqual([
        "Club Attuale",
        "Prestito",
        "Vecchio Club",
      ]);
    });

    it("mostra il periodo reale di un CUSTOM_PERIOD invece di una stagione piena", () => {
      const view = buildPlayerCareerView(
        [
          season({
            careerType: "CUSTOM_PERIOD",
            groupId: "custom",
            periodEndMonth: "5",
            periodStartMonth: "1",
            seasonLabel: "2021/2022",
            seasonPeriod: "partial",
          }),
        ],
        { now: NOW },
      );

      expect(view.experiences[0]?.careerType).toBe("CUSTOM_PERIOD");
      expect(view.experiences[0]?.periodLabel).toBe("Gennaio 2022 — Maggio 2022");
      // Un periodo chiuso non è l'esperienza attuale, e la sua etichetta non
      // diventa mai "Presente".
      expect(view.experiences[0]?.isCurrent).toBe(false);
    });

    it("segna come in corso l'esperienza che copre la stagione sportiva attuale", () => {
      const view = buildPlayerCareerView(
        [
          season({ groupId: "exp", seasonLabel: "2024/2025" }),
          season({ groupId: "exp", seasonLabel: "2023/2024" }),
          season({ groupId: "exp", seasonLabel: "2022/2023" }),
        ],
        { now: NOW },
      );

      expect(view.experiences[0]?.isCurrent).toBe(true);
      expect(view.experiences[0]?.periodLabel).toBe("2022 — Presente · 3 stagioni");
    });
  });

  describe("statistiche mancanti (§19)", () => {
    it("distingue lo zero dichiarato dal dato sconosciuto", () => {
      const view = buildPlayerCareerView(
        [
          season({
            appearances: "31",
            assists: "",
            goals: "0",
            groupId: "exp",
            seasonLabel: "2024/2025",
          }),
        ],
        { now: NOW },
      );

      const [firstSeason] = view.experiences[0]?.seasons ?? [];

      expect(firstSeason?.appearances).toBe(31);
      expect(firstSeason?.goals).toBe(0);
      expect(firstSeason?.assists).toBeNull();
      expect(formatCareerStat(firstSeason?.goals ?? null)).toBe("0");
      expect(formatCareerStat(firstSeason?.assists ?? null)).toBe("—");
    });

    it("lascia sconosciuto un totale che nessuna stagione valorizza", () => {
      const view = buildPlayerCareerView(
        [season({ appearances: "10", groupId: "exp", seasonLabel: "2024/2025" })],
        { now: NOW },
      );

      expect(view.totals.appearances).toBe(10);
      expect(view.totals.goals).toBeNull();
    });
  });

  describe("totali carriera (§20)", () => {
    it("somma le statistiche per stagione senza double counting", () => {
      const view = buildPlayerCareerView(
        [
          season({
            appearances: "31",
            assists: "8",
            goals: "9",
            groupId: "exp-a",
            seasonLabel: "2024/2025",
          }),
          season({
            appearances: "28",
            assists: "6",
            goals: "11",
            groupId: "exp-a",
            seasonLabel: "2023/2024",
          }),
          season({
            appearances: "30",
            assists: "4",
            goals: "8",
            clubName: "FC Trastevere",
            groupId: "exp-b",
            seasonLabel: "2021/2022",
          }),
        ],
        { now: NOW },
      );

      expect(view.totals).toEqual({ appearances: 89, assists: 18, goals: 28 });
    });
  });

  describe("serie del grafico (§22)", () => {
    it("aggrega nello stesso anno sportivo due club della stessa stagione", () => {
      const view = buildPlayerCareerView(
        [
          season({
            clubName: "Club A",
            goals: "4",
            groupId: "exp-a",
            seasonLabel: "2024/2025",
          }),
          season({
            clubName: "Club B",
            goals: "5",
            groupId: "exp-b",
            seasonLabel: "2024/2025",
          }),
        ],
        { now: NOW },
      );

      const series = buildCareerChartSeries(view, "goals");

      // Un solo bucket con la somma, e nessuna delle due esperienze sparisce.
      expect(series).toHaveLength(1);
      expect(series[0]?.value).toBe(9);
      expect(view.experiences).toHaveLength(2);
    });

    it("tiene la stagione nella serie anche quando la metrica è sconosciuta", () => {
      const view = buildPlayerCareerView(
        [
          season({ goals: "6", groupId: "exp", seasonLabel: "2023/2024" }),
          season({ groupId: "exp", seasonLabel: "2024/2025" }),
        ],
        { now: NOW },
      );

      const series = buildCareerChartSeries(view, "goals");

      expect(series.map((point) => point.label)).toEqual(["2023/24", "2024/25"]);
      expect(series[1]?.value).toBeNull();
    });

    it("ordina la serie dalla stagione più vecchia alla più recente", () => {
      const view = buildPlayerCareerView(
        [
          season({ goals: "3", groupId: "exp", seasonLabel: "2024/2025" }),
          season({ goals: "1", groupId: "exp", seasonLabel: "2018/2019" }),
          season({ goals: "2", groupId: "exp", seasonLabel: "2021/2022" }),
        ],
        { now: NOW },
      );

      expect(buildCareerChartSeries(view, "goals").map((point) => point.value)).toEqual([
        1, 2, 3,
      ]);
    });
  });

  describe("casi limite dei dati", () => {
    it("non conta due volte una stagione ripetuta nella stessa esperienza", () => {
      const view = buildPlayerCareerView(
        [
          season({ goals: "9", groupId: "exp", seasonLabel: "2024/2025" }),
          season({ goals: "9", groupId: "exp", seasonLabel: "2024/2025" }),
        ],
        { now: NOW },
      );

      expect(view.experiences[0]?.seasons).toHaveLength(1);
      expect(view.totals.goals).toBe(9);
      expect(buildCareerChartSeries(view, "goals")[0]?.value).toBe(9);
    });

    it("tiene in Carriera un'esperienza con stagione illeggibile", () => {
      const view = buildPlayerCareerView(
        [season({ clubName: "Club Senza Stagione", groupId: "exp", seasonLabel: "" })],
        { now: NOW },
      );

      expect(view.experiences).toHaveLength(1);
      expect(view.experiences[0]?.clubName).toBe("Club Senza Stagione");
    });

    it("riconosce come in corso un periodo personalizzato ancora aperto", () => {
      const view = buildPlayerCareerView(
        [
          season({
            careerType: "CUSTOM_PERIOD",
            groupId: "custom",
            periodEndMonth: "6",
            periodStartMonth: "1",
            seasonLabel: "2024/2025",
            seasonPeriod: "partial",
          }),
        ],
        { now: NOW },
      );

      // Fine giugno 2025, "adesso" è marzo 2025: l'esperienza è in corso…
      expect(view.experiences[0]?.isCurrent).toBe(true);
      // …ma l'etichetta resta il periodo reale, non "Presente" (§17).
      expect(view.experiences[0]?.periodLabel).toBe("Gennaio 2025 — Giugno 2025");
    });
  });

  describe("compatibilità legacy (§38)", () => {
    it("raggruppa le righe senza groupId senza far fallire la vista", () => {
      const view = buildPlayerCareerView(
        [
          season({ appearances: "20", seasonLabel: "2024/2025" }),
          season({ appearances: "22", seasonLabel: "2023/2024" }),
        ],
        { now: NOW },
      );

      expect(view.experiences).toHaveLength(1);
      expect(view.experiences[0]?.seasons).toHaveLength(2);
      expect(view.totals.appearances).toBe(42);
    });
  });
});
