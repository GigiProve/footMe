import { describe, expect, it } from "vitest";

import {
  currentSeasonLabel,
  teamClassificationLine,
  teamCountsLine,
  teamsEmptyState,
  teamsTotalLabel,
} from "./teams-presentation";

describe("teamsTotalLabel", () => {
  it("usa il plurale corretto", () => {
    expect(teamsTotalLabel(8)).toBe("8 squadre");
    expect(teamsTotalLabel(1)).toBe("1 squadra");
    expect(teamsTotalLabel(0)).toBe("0 squadre");
  });

  it("non converte un totale non consultabile in zero (§25)", () => {
    expect(teamsTotalLabel(null)).toBeNull();
  });
});

describe("teamClassificationLine", () => {
  it("unisce tipo e livello", () => {
    expect(
      teamClassificationLine({
        hasSeasonConfig: true,
        levelLabel: "Élite",
        name: "Comashi",
        typeLabel: "Under 18",
      }),
    ).toBe("Under 18 · Élite");
  });

  it("non ripete il tipo quando il nome lo esprime già (§9)", () => {
    expect(
      teamClassificationLine({
        hasSeasonConfig: true,
        levelLabel: "Serie D",
        name: "Prima squadra",
        typeLabel: "Prima squadra",
      }),
    ).toBe("Serie D");
  });

  it("mostra il solo tipo quando il livello manca", () => {
    expect(
      teamClassificationLine({
        hasSeasonConfig: true,
        levelLabel: null,
        name: "Under 17 B",
        typeLabel: "Under 17",
      }),
    ).toBe("Under 17");
  });

  it("distingue la stagione non configurata dal livello assente (§7, §9)", () => {
    expect(
      teamClassificationLine({
        hasSeasonConfig: false,
        levelLabel: "Serie D",
        name: "Prima squadra",
        typeLabel: "Prima squadra",
      }),
    ).toBe("Stagione da configurare");
  });
});

describe("teamCountsLine", () => {
  it("compone conteggi e plurali", () => {
    expect(
      teamCountsLine({ countsAvailable: true, playersCount: 24, staffCount: 6 }),
    ).toBe("24 calciatori · 6 staff");

    expect(
      teamCountsLine({ countsAvailable: true, playersCount: 1, staffCount: 0 }),
    ).toBe("1 calciatore · 0 staff");
  });

  it("omette i conteggi non consultabili invece di mostrare zero (§10)", () => {
    expect(
      teamCountsLine({
        countsAvailable: false,
        playersCount: null,
        staffCount: null,
      }),
    ).toBeNull();
  });

  it("mostra la parte disponibile quando l'altra manca", () => {
    expect(
      teamCountsLine({ countsAvailable: true, playersCount: 20, staffCount: null }),
    ).toBe("20 calciatori");
  });
});

describe("currentSeasonLabel", () => {
  it("rende la stagione come informazione, non come campo", () => {
    expect(currentSeasonLabel("2026/27")).toBe("Stagione corrente · 2026/27");
    expect(currentSeasonLabel(null)).toBeNull();
  });
});

describe("teamsEmptyState", () => {
  it("offre la creazione quando è autorizzata (§11)", () => {
    expect(
      teamsEmptyState({ canCreate: true, hasScopeRestriction: false }),
    ).toEqual({
      action: "Crea la prima squadra",
      body: "Aggiungi la prima squadra per organizzare organico e attività del club.",
      title: "Nessuna squadra configurata",
    });
  });

  it("resta neutro con ambito limitato: l'elenco vuoto non prova nulla (§11)", () => {
    expect(
      teamsEmptyState({ canCreate: true, hasScopeRestriction: true }),
    ).toEqual({
      action: null,
      body: null,
      title: "Nessuna squadra disponibile nel tuo ambito",
    });
  });

  it("non mostra CTA impossibili senza permesso di creazione (§11)", () => {
    expect(
      teamsEmptyState({ canCreate: false, hasScopeRestriction: false }).action,
    ).toBeNull();
  });
});
