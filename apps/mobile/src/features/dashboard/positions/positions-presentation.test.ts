/**
 * Regole di presentazione del Centro Posizioni (DAS-REV-15).
 *
 * Qui non si verifica che un componente stampi una prop: si verificano le
 * decisioni che §10, §12, §13, §14 e §27 prendono **prima** della UI — un
 * null che non è uno zero, una data sconosciuta che non diventa oggi, una
 * copy filtrata che non parla di tutta la Società.
 */
import { describe, expect, it } from "vitest";

import {
  POSITIONS_COPY,
  applicationsLabel,
  emptyCopy,
  filterIsAuthorized,
  formatClosedLabel,
  formatDraftUpdatedLabel,
  positionContextLine,
  positionTitle,
  rowAccessibilityLabel,
} from "./positions-presentation";
import type { PositionRow } from "./positions-types";

/** Istante di confronto di §32: 12 settembre 2026, Europe/Rome. */
const AS_OF = new Date("2026-09-12T12:00:00+02:00");

function row(overrides: Partial<PositionRow> = {}): PositionRow {
  return {
    applicationsNew: null,
    applicationsTotal: null,
    closedAt: null,
    contextLabel: null,
    countsAvailable: false,
    id: "pos-1",
    publishedAt: null,
    receivingClosed: false,
    roleRequired: null,
    scope: "team",
    seasonLabel: null,
    sortKey: "",
    status: "published",
    targetRole: null,
    teamId: "team-1",
    teamIsInactive: false,
    teamName: "Prima squadra",
    title: "Centrocampista centrale",
    updatedAt: null,
    ...overrides,
  };
}

describe("conteggi candidature (§10)", () => {
  it("distingue non autorizzato, errore, zero confermato e totale noto", () => {
    // Non autorizzato: la riga omette l'intero riepilogo (screen 05).
    expect(
      applicationsLabel({
        available: false,
        group: "active",
        newCount: 3,
        total: 12,
      }),
    ).toBeNull();

    // Errore: feedback locale, non un azzeramento.
    expect(
      applicationsLabel({
        available: true,
        failed: true,
        group: "active",
        newCount: null,
        total: null,
      }),
    ).toBe(POSITIONS_COPY.countsUnavailable);

    // Totale non ancora noto: niente, non "0 candidature".
    expect(
      applicationsLabel({
        available: true,
        group: "active",
        newCount: null,
        total: null,
      }),
    ).toBeNull();

    expect(
      applicationsLabel({
        available: true,
        group: "active",
        newCount: 0,
        total: 0,
      }),
    ).toBe(POSITIONS_COPY.noApplications);
  });

  it("riproduce i conteggi della fixture, con i singolari corretti", () => {
    const label = (total: number, newCount: number) =>
      applicationsLabel({
        available: true,
        group: "active",
        newCount,
        total,
      });

    expect(label(12, 3)).toBe("12 candidature · 3 nuove");
    expect(label(8, 2)).toBe("8 candidature · 2 nuove");
    expect(label(5, 1)).toBe("5 candidature · 1 nuova");
    // Nuove uguale a zero non produce alcun suffisso (QA-13).
    expect(label(7, 0)).toBe("7 candidature");
    expect(label(1, 1)).toBe("1 candidatura · 1 nuova");
  });

  it("non mostra conteggi sulle Bozze, nemmeno zero (§12)", () => {
    expect(
      applicationsLabel({
        available: true,
        group: "drafts",
        newCount: 0,
        total: 0,
      }),
    ).toBeNull();
  });
});

describe("titolo e contesto della riga (§11, §12)", () => {
  it("usa «Posizione senza titolo» senza inventare un id tecnico", () => {
    expect(positionTitle(row({ title: null, roleRequired: null }))).toBe(
      POSITIONS_COPY.untitled,
    );
  });

  it("ricade sul ruolo cercato, che è un dato reale dell'oggetto", () => {
    expect(
      positionTitle(
        row({ roleRequired: "goalkeeper", targetRole: "player", title: null }),
      ),
    ).toBe("Portiere");
  });

  it("mostra «Intera società» per un incarico SOCIETY, senza categoria", () => {
    expect(
      positionContextLine(
        row({
          contextLabel: "Serie D",
          scope: "society",
          teamId: null,
          teamName: null,
        }),
      ),
    ).toBe(POSITIONS_COPY.societyScope);
  });

  it("omette i metadati mancanti senza separatori pendenti", () => {
    expect(
      positionContextLine(row({ contextLabel: null, seasonLabel: null })),
    ).toBe("Prima squadra");
  });

  it("compone squadra, contesto e stagione dello storico", () => {
    expect(
      positionContextLine(
        row({ contextLabel: "Serie D", seasonLabel: "2025/26" }),
      ),
    ).toBe("Prima squadra · Serie D · 2025/26");
  });

  it("distingue una bozza TEAM senza squadra da un incarico SOCIETY", () => {
    expect(positionContextLine(row({ teamId: null, teamName: null }))).toBe(
      POSITIONS_COPY.teamToBeDefined,
    );
  });
});

describe("date (§12, §13)", () => {
  it("elide l'articolo davanti a undici, come il master", () => {
    expect(
      formatDraftUpdatedLabel("2026-09-12T10:00:00+02:00", AS_OF),
    ).toBe("Modificata il 12 settembre");
    expect(
      formatDraftUpdatedLabel("2026-09-11T10:00:00+02:00", AS_OF),
    ).toBe("Modificata l'11 settembre");
    expect(
      formatDraftUpdatedLabel("2026-09-10T10:00:00+02:00", AS_OF),
    ).toBe("Modificata il 10 settembre");
  });

  it("aggiunge l'anno solo quando evita un'ambiguità", () => {
    expect(
      formatDraftUpdatedLabel("2025-09-10T10:00:00+02:00", AS_OF),
    ).toBe("Modificata il 10 settembre 2025");
  });

  it("una data di chiusura sconosciuta non diventa oggi", () => {
    expect(formatClosedLabel(null)).toBe(POSITIONS_COPY.closedUnknown);
    expect(formatClosedLabel("non-una-data")).toBe(
      POSITIONS_COPY.closedUnknown,
    );
  });

  it("lo storico porta sempre l'anno", () => {
    expect(formatClosedLabel("2026-06-30T12:00:00+02:00")).toBe(
      "Chiusa il 30 giugno 2026",
    );
    expect(formatClosedLabel("2026-06-15T12:00:00+02:00")).toBe(
      "Chiusa il 15 giugno 2026",
    );
  });
});

describe("stati vuoti (§27)", () => {
  it("non afferma l'assenza di posizioni nell'intera Società quando è filtrato", () => {
    const filtered = emptyCopy({
      canCreate: true,
      filter: {
        isInactive: false,
        kind: "team",
        label: "Primavera",
        teamId: "t",
      },
      group: "active",
    });

    expect(filtered.title).toBe("Nessuna posizione aperta per questa squadra");
  });

  it("propone di pubblicare solo a chi può creare", () => {
    const creator = emptyCopy({
      canCreate: true,
      filter: { kind: "all" },
      group: "active",
    });
    const viewer = emptyCopy({
      canCreate: false,
      filter: { kind: "all" },
      group: "active",
    });

    expect(creator.body).toBe(
      "Pubblica un'opportunità per iniziare a ricevere candidature.",
    );
    expect(viewer.body).toBe("Le posizioni disponibili compariranno qui.");
    expect(viewer.title).toBe("Nessuna posizione aperta");
  });

  it("il filtro SOCIETY non parla delle squadre", () => {
    expect(
      emptyCopy({
        canCreate: true,
        filter: { kind: "society" },
        group: "active",
      }).title,
    ).toBe("Nessuna posizione aperta per l'intera società");
  });
});

describe("validità del filtro (§15)", () => {
  const options = [
    { kind: "all" as const },
    { kind: "society" as const },
    {
      isInactive: false,
      kind: "team" as const,
      label: "Primavera",
      teamId: "team-primavera",
    },
  ];

  it("riconosce un Team ancora autorizzato", () => {
    expect(
      filterIsAuthorized(
        {
          isInactive: false,
          kind: "team",
          label: "Primavera",
          teamId: "team-primavera",
        },
        options,
      ),
    ).toBe(true);
  });

  it("invalida un Team uscito dal perimetro", () => {
    expect(
      filterIsAuthorized(
        { isInactive: false, kind: "team", label: "", teamId: "altro" },
        options,
      ),
    ).toBe(false);
  });

  it("invalida SOCIETY quando quell'ambito non è più consultabile", () => {
    expect(filterIsAuthorized({ kind: "society" }, [options[2]])).toBe(false);
  });
});

describe("etichetta accessibile (§30)", () => {
  it("annuncia la riga come un'unità coerente", () => {
    const target = row({
      applicationsNew: 3,
      applicationsTotal: 12,
      contextLabel: "Serie D",
      countsAvailable: true,
    });

    expect(
      rowAccessibilityLabel({
        counts: "12 candidature · 3 nuove",
        group: "active",
        meta: null,
        row: target,
        title: "Centrocampista centrale",
      }),
    ).toBe(
      "Centrocampista centrale, Prima squadra, Serie D, 12 candidature · 3 nuove, pubblicata. Apri posizione.",
    );
  });

  it("non annuncia i valori omessi visivamente (screen 05)", () => {
    const target = row({
      contextLabel: "Settore giovanile",
      countsAvailable: false,
      teamName: "Primavera",
      title: "Preparatore atletico",
    });

    const label = rowAccessibilityLabel({
      counts: null,
      group: "active",
      meta: null,
      row: target,
      title: "Preparatore atletico",
    });

    expect(label).toBe(
      "Preparatore atletico, Primavera, Settore giovanile, pubblicata. Apri posizione.",
    );
    expect(label).not.toContain("candidatur");
  });

  it("rende leggibile «Squadra non attiva» nello storico", () => {
    const target = row({
      closedAt: "2026-06-15T12:00:00+02:00",
      seasonLabel: "2025/26",
      contextLabel: "Under 17",
      teamIsInactive: true,
      teamName: "Comashi",
      title: "Allenatore",
    });

    expect(
      rowAccessibilityLabel({
        counts: "10 candidature",
        group: "closed",
        meta: "Chiusa il 15 giugno 2026",
        row: target,
        title: "Allenatore",
      }),
    ).toContain(POSITIONS_COPY.inactiveTeam);
  });
});
