/**
 * Regole delle righe e delle sezioni del Centro (DAS-REV-28 §10–§12).
 *
 * Le fixture 32/50 · 8 in attesa sono dati di test (§6), non contatori
 * persistiti: qui si verifica come una riga **legge** i conteggi derivati.
 */
import { describe, expect, it } from "vitest";

import { EVENTS_COPY } from "./events-copy";
import {
  centerBodyState,
  eventContextLine,
  eventRowLines,
  formatCivilDate,
  historyCountsLabel,
  historyStatusLine,
  uniqueRows,
  upcomingCountsLabel,
  type SectionState,
} from "./events-presentation";
import type { SelectionEventRow } from "./events-types";

function row(patch: Partial<SelectionEventRow> = {}): SelectionEventRow {
  return {
    canEdit: true,
    confirmedCount: 32,
    countsAvailable: true,
    eventType: "open_day",
    id: "e1",
    isFull: false,
    maxParticipants: 50,
    pendingRequestsCount: 8,
    startDate: "2026-09-25",
    startTime: "15:00",
    status: "published",
    teamId: "t1",
    teamName: "Under 16",
    timezone: "Europe/Rome",
    title: "Open day 2010–2011",
    updatedAt: "2026-09-20T10:00:00Z",
    ...patch,
  };
}

describe("conteggi (§11)", () => {
  it("QA-021: 32 / 50 confermati · 8 in attesa", () => {
    expect(upcomingCountsLabel(row())).toBe("32 / 50 confermati · 8 in attesa");
  });

  it("QA-022: senza limite, nessun simbolo di infinito", () => {
    expect(upcomingCountsLabel(row({ maxParticipants: null, pendingRequestsCount: 0 }))).toBe(
      "32 confermati",
    );
  });

  it("QA-023: zero richieste in attesa omesse", () => {
    expect(upcomingCountsLabel(row({ confirmedCount: 0, pendingRequestsCount: 0 }))).toBe(
      "0 / 50 confermati",
    );
  });

  it("QA-027: conteggi non disponibili non diventano zero", () => {
    expect(upcomingCountsLabel(row({ confirmedCount: null, countsAvailable: false }))).toBeNull();
  });

  it("QA-018 + DAS-REV-31 screen 15: storico concluso con i confermati finali, annullato senza conteggio", () => {
    expect(historyCountsLabel(row({ confirmedCount: 47, status: "completed" }))).toBe(
      "47 confermati",
    );
    expect(historyCountsLabel(row({ confirmedCount: 1, status: "completed" }))).toBe(
      "1 confermato",
    );
    expect(historyCountsLabel(row({ confirmedCount: 0, status: "cancelled" }))).toBeNull();
  });

  it("DAS-REV-31 screen 15: una riga «Concluso · 32 confermati» / «Annullato»", () => {
    expect(historyStatusLine(row({ confirmedCount: 32, status: "completed" }))).toBe(
      "Concluso · 32 confermati",
    );
    expect(historyStatusLine(row({ status: "cancelled" }))).toBe("Annullato");
    /* §11: count ignoto non diventa «0 confermati». */
    expect(
      historyStatusLine(row({ confirmedCount: null, countsAvailable: false, status: "completed" })),
    ).toBe("Concluso");
    expect(historyStatusLine(row({ status: "published" }))).toBeNull();
  });
});

describe("righe per sezione (§11)", () => {
  it("QA-017/015: bozza senza conteggi, data da completare", () => {
    const lines = eventRowLines(
      row({ confirmedCount: null, startDate: null, startTime: null, status: "draft" }),
      "drafts",
    );

    expect(lines.counts).toBeNull();
    expect(lines.when).toBe(EVENTS_COPY.dateMissing);
  });

  it("QA-016: senza titolo né tipo, nessun valore inventato", () => {
    const lines = eventRowLines(row({ eventType: null, status: "draft", title: null }), "drafts");

    expect(lines.title).toBe("Evento senza titolo");
    expect(lines.context).toBe("Under 16");
  });

  it("QA-014: capienza raggiunta è testo secondario, non uno stato", () => {
    const lines = eventRowLines(row({ confirmedCount: 30, isFull: true, maxParticipants: 30 }), "upcoming");

    expect(lines.full).toBe(true);
    expect(lines.status).toBeNull();
  });

  it("in programma: tipo · squadra e data · ora", () => {
    const lines = eventRowLines(row(), "upcoming", { currentYear: 2026 });

    expect(lines.context).toBe("Open day · Under 16");
    expect(lines.when).toBe("25 settembre · 15:00");
  });

  it("§12: un PUBLISHED legacy senza data non fa crash", () => {
    expect(eventRowLines(row({ startDate: null }), "upcoming").when).toBe(EVENTS_COPY.dateIncomplete);
  });

  it("QA-019: storico con stato testuale e anno", () => {
    const lines = eventRowLines(row({ startDate: "2026-07-10", status: "cancelled" }), "history");

    /* DAS-REV-31 screen 15: lo stato sta nella riga sotto la data. */
    expect(lines.status).toBeNull();
    expect(lines.when).toBe("10 luglio 2026");
    expect(lines.counts).toBe("Annullato");
  });
});

describe("date civili (§15)", () => {
  it("non passa da un istante: nessuno spostamento di giorno", () => {
    expect(formatCivilDate("2026-09-30", { withYear: true })).toBe("30 settembre 2026");
    expect(formatCivilDate("2026-09-30", { currentYear: 2026 })).toBe("30 settembre");
    expect(formatCivilDate("2027-01-01", { currentYear: 2026 })).toBe("1 gennaio 2027");
  });

  it("contesto senza squadra né tipo è vuoto", () => {
    expect(eventContextLine({ eventType: null, teamName: "" })).toBe("");
  });
});

describe("stato del Centro (§10, §24)", () => {
  const page = (rows: SelectionEventRow[]) => [{ hasMore: false, nextCursor: null, rows }];
  const state = (patch: Partial<SectionState>): SectionState => ({
    error: false,
    loaded: true,
    pages: page([]),
    ...patch,
  });
  const order = ["upcoming", "drafts", "history"] as const;

  it("QA-012: sezioni vuote omesse", () => {
    expect(
      centerBodyState(
        { drafts: state({}), history: state({ pages: page([row({ id: "h" })]) }), upcoming: state({ pages: page([row()]) }) },
        order,
      ),
    ).toEqual({ kind: "ready", sections: ["upcoming", "history"] });
  });

  it("QA-003: tutte vuote → empty", () => {
    expect(centerBodyState({ drafts: state({}), history: state({}), upcoming: state({}) }, order)).toEqual({
      kind: "empty",
    });
  });

  it("QA-107: tutte in errore → errore, non Nessun evento", () => {
    const failed = state({ error: true, loaded: false, pages: null });

    expect(centerBodyState({ drafts: failed, history: failed, upcoming: failed }, order)).toEqual({
      kind: "error",
    });
  });

  it("una sezione in errore resta visibile con errore locale", () => {
    expect(
      centerBodyState(
        {
          drafts: state({ error: true, loaded: false, pages: null }),
          history: state({}),
          upcoming: state({ pages: page([row()]) }),
        },
        order,
      ),
    ).toEqual({ kind: "ready", sections: ["upcoming", "drafts"] });
  });

  it("caricamento senza righe → skeleton", () => {
    const loading = state({ loaded: false, pages: null });

    expect(centerBodyState({ drafts: loading, history: loading, upcoming: state({}) }, order)).toEqual({
      kind: "loading",
    });
  });

  it("QA-020/028: nessun duplicato fra pagine", () => {
    expect(uniqueRows([row({ id: "a" }), row({ id: "b" }), row({ id: "a" })]).map((r) => r.id)).toEqual([
      "a",
      "b",
    ]);
  });
});
