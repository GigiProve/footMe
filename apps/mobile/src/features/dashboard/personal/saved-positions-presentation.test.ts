import { describe, expect, it } from "vitest";

import type {
  PersonalSavedPosition,
  PersonalSavedUpdate,
} from "../adapters/personal-adapter";
import {
  aggregatedUpdateLabel,
  buildSavedUpdateRows,
  formatSavedAtLabel,
  formatUnavailableLabel,
  MAX_SAVED_PREVIEWS,
  SAVED_AVAILABLE_HREF,
  SAVED_UNAVAILABLE_HREF,
  selectSavedPreviews,
  UNAVAILABLE_LABEL,
} from "./saved-positions-presentation";

function savedPosition(
  adId: string,
  overrides: Partial<PersonalSavedPosition> = {},
): PersonalSavedPosition {
  return {
    adId,
    category: null,
    clubId: "club",
    clubLogoUrl: null,
    clubName: "AC Como",
    hasApplied: false,
    isNavigable: true,
    location: "Como · Lombardia",
    role: "forward",
    savedAt: "2026-09-01T10:00:00Z",
    teamName: "Prima squadra",
    ...overrides,
  };
}

function savedUpdate(
  eventId: string,
  overrides: Partial<PersonalSavedUpdate> = {},
): PersonalSavedUpdate {
  return {
    adId: `ad-${eventId}`,
    category: null,
    clubLogoUrl: null,
    clubName: "AC Como",
    eventId,
    occurredAt: "2026-09-11T08:00:00Z",
    reason: "closed",
    role: "forward",
    teamName: "Prima squadra",
    ...overrides,
  };
}

describe("selectSavedPreviews", () => {
  it("shows two previews even when the source sends three", () => {
    const outcome = selectSavedPreviews(
      [savedPosition("a"), savedPosition("b"), savedPosition("c")],
      new Set(),
    );

    expect(outcome.items).toHaveLength(MAX_SAVED_PREVIEWS);
    expect(outcome.collapsed).toBe(false);
  });

  /**
   * §11: «Evitare di duplicare la stessa row Saved fra segnale di scadenza
   * promosso e preview ordinaria.» La terza riga della fonte esiste proprio
   * per prendere il posto di quella tolta.
   */
  it("replaces a promoted row with the next eligible one", () => {
    const outcome = selectSavedPreviews(
      [savedPosition("a"), savedPosition("b"), savedPosition("c")],
      new Set(["a"]),
    );

    expect(outcome.items.map((item) => item.adId)).toEqual(["b", "c"]);
  });

  /**
   * §11: «Se tutte le preview sono promosse altrove, mantenere l'accesso alla
   * lista senza mostrare un falso empty.»
   */
  it("collapses to the list access when every row is already shown above", () => {
    const outcome = selectSavedPreviews(
      [savedPosition("a"), savedPosition("b")],
      new Set(["a", "b"]),
    );

    expect(outcome.items).toHaveLength(0);
    expect(outcome.collapsed).toBe(true);
  });

  /** Nessuna preview non è "collassata": è un empty vero da valutare altrove. */
  it("does not call an empty source collapsed", () => {
    expect(selectSavedPreviews([], new Set()).collapsed).toBe(false);
  });
});

describe("formatUnavailableLabel", () => {
  it("prefers the reliable closing date", () => {
    expect(formatUnavailableLabel("2026-09-11T08:00:00Z")).toBe(
      "Non più disponibile · 11 set 2026",
    );
  });

  /** §17: senza data affidabile non se ne inventa una. */
  it("omits the date when the domain does not have one", () => {
    expect(formatUnavailableLabel(null)).toBe(UNAVAILABLE_LABEL);
    expect(formatUnavailableLabel("non-una-data")).toBe(UNAVAILABLE_LABEL);
  });

  /**
   * §17: «Non presentare la data di salvataggio come data di chiusura.» La
   * data reale alternativa esiste, ma con la propria label esplicita.
   */
  it("labels the saved date for what it is", () => {
    expect(formatSavedAtLabel("2026-09-05T10:00:00Z")).toBe(
      "Salvata il 5 settembre",
    );
    expect(formatSavedAtLabel(null)).toBeNull();
  });
});

describe("buildSavedUpdateRows", () => {
  it("keeps a single transition as a compact row", () => {
    const rows = buildSavedUpdateRows([savedUpdate("ev1")], 2);

    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("single");
  });

  /** §14: lo stesso evento consegnato due volte resta un aggiornamento solo. */
  it("deduplicates the same event delivered twice", () => {
    const rows = buildSavedUpdateRows(
      [savedUpdate("ev1"), savedUpdate("ev1")],
      2,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("single");
  });

  /** §13: più indisponibilità si aggregano, non si moltiplicano gli alert. */
  it("aggregates several transitions into one row", () => {
    const rows = buildSavedUpdateRows(
      [savedUpdate("ev1"), savedUpdate("ev2"), savedUpdate("ev3")],
      2,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ count: 3, kind: "aggregated" });
    expect(aggregatedUpdateLabel(3)).toBe(
      "3 posizioni salvate non sono più disponibili",
    );
  });

  /**
   * §13: «Le azioni reali hanno precedenza.» Senza posti residui nel budget
   * della Foundation l'aggiornamento informativo non compare — lo storico e
   * il bookmark restano comunque intatti.
   */
  it("shows nothing when the shared budget is exhausted", () => {
    expect(buildSavedUpdateRows([savedUpdate("ev1")], 0)).toEqual([]);
    expect(buildSavedUpdateRows([savedUpdate("ev1")], -1)).toEqual([]);
  });

  it("has nothing to say without events", () => {
    expect(buildSavedUpdateRows([], 2)).toEqual([]);
  });
});

describe("destinazioni canoniche", () => {
  /**
   * §15, §23: la lista resta dentro Cerca, sulla tab Salvate. Nessuna pagina
   * Dashboard parallela e nessuna voce aggiunta alla bottom navigation.
   */
  it("points at the CER list with the right internal filter", () => {
    expect(SAVED_AVAILABLE_HREF).toBe(
      "/search/positions?tab=salvate&group=available",
    );
    expect(SAVED_UNAVAILABLE_HREF).toBe(
      "/search/positions?tab=salvate&group=unavailable",
    );
  });
});
