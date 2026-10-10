/**
 * Le regole di presentazione che possono mentire all'utente (§4, §20, §22).
 *
 * Non replicano il markup: verificano i conteggi, il plurale e le frasi che
 * distinguono "già nel database" da "già nel riepilogo" — cioè esattamente
 * ciò che §20 chiede di non confondere.
 */
import { describe, expect, it } from "vitest";

import {
  SEASON_LIFECYCLE_LABEL,
  addSeasonsCta,
  blockerCopy,
  canAddPeriod,
  centerRowMeta,
  classificationLine,
  commitHistoryCta,
  conflictMessage,
  currentSeasonLifecycle,
  emptyPeriodReason,
  existingSeasonsNotice,
  historyTotalLabel,
  nextSeasonLifecycle,
  nextSeasonSummary,
  periodCountLine,
  periodErrorMessage,
  seasonErrorMessage,
} from "./seasons-presentation";

describe("lifecycle", () => {
  it("deriva lo stato della corrente senza persisterlo", () => {
    expect(currentSeasonLifecycle({ hasConfig: true, isArchived: false })).toBe(
      "inProgress",
    );
    // §7: «Da preparare è una proiezione dell'assenza del record.»
    expect(currentSeasonLifecycle({ hasConfig: false, isArchived: false })).toBeNull();
  });

  it("la squadra non attiva non trasforma la corrente in Conclusa (§28)", () => {
    expect(currentSeasonLifecycle({ hasConfig: true, isArchived: true })).toBe(
      "teamInactive",
    );
  });

  it("distingue Preparata da Da preparare", () => {
    expect(nextSeasonLifecycle(true)).toBe("prepared");
    expect(nextSeasonLifecycle(false)).toBe("toPrepare");
  });

  it("usa label testuali neutre (§4)", () => {
    expect(SEASON_LIFECYCLE_LABEL.inProgress).toBe("In corso");
    expect(SEASON_LIFECYCLE_LABEL.concluded).toBe("Conclusa");
    expect(SEASON_LIFECYCLE_LABEL.toPrepare).toBe("Da preparare");
    expect(SEASON_LIFECYCLE_LABEL.teamInactive).toBe("Squadra non attiva");
  });
});

describe("classificazione", () => {
  it("omette il livello mancante senza N/A (§10)", () => {
    expect(classificationLine("Under 18", "Élite")).toBe("Under 18 · Élite");
    expect(classificationLine("Under 18", null)).toBe("Under 18");
    expect(classificationLine(null, null)).toBeNull();
  });

  it("segnala la corrente mancante senza usare lo storico (§10)", () => {
    expect(
      centerRowMeta({ hasSeasonConfig: false, levelLabel: "Élite", typeLabel: "Under 18" }),
    ).toBe("Stagione da configurare");

    expect(
      centerRowMeta({ hasSeasonConfig: true, levelLabel: null, typeLabel: "Primavera" }),
    ).toBe("Primavera");
  });
});

describe("riepilogo della prossima stagione", () => {
  it("riproduce il caso del master: 3 da preparare · 1 preparata", () => {
    expect(nextSeasonSummary({ preparedCount: 1, toPrepareCount: 3 })).toBe(
      "3 da preparare · 1 preparata",
    );
  });

  it("usa il plurale per le preparate", () => {
    expect(nextSeasonSummary({ preparedCount: 2, toPrepareCount: 0 })).toBe(
      "0 da preparare · 2 preparate",
    );
  });

  it("non inventa zero quando il conteggio non è consultabile (§10)", () => {
    expect(nextSeasonSummary({ preparedCount: null, toPrepareCount: null })).toBeNull();
  });
});

describe("conteggi del batch storico", () => {
  it("gestisce il singolare nella CTA del periodo (§18)", () => {
    expect(addSeasonsCta(4)).toBe("Aggiungi 4 stagioni");
    expect(addSeasonsCta(1)).toBe("Aggiungi 1 stagione");
  });

  it("gestisce il singolare nella CTA finale (§22)", () => {
    expect(commitHistoryCta(6)).toBe("Aggiungi 6 stagioni allo storico");
    expect(commitHistoryCta(1)).toBe("Aggiungi 1 stagione allo storico");
  });

  it("riproduce il totale del master", () => {
    expect(historyTotalLabel(6)).toBe("6 stagioni da aggiungere");
    expect(historyTotalLabel(1)).toBe("1 stagione da aggiungere");
  });

  it("riproduce le due righe del master 06", () => {
    expect(
      periodCountLine({ draftCoveredCount: 0, existingCount: 0, newCount: 4 }),
    ).toBe("4 stagioni");

    expect(
      periodCountLine({ draftCoveredCount: 0, existingCount: 2, newCount: 2 }),
    ).toBe("2 nuove · 2 già presenti");
  });

  it("somma esistenti e già in bozza nella stessa riga", () => {
    expect(
      periodCountLine({ draftCoveredCount: 1, existingCount: 1, newCount: 1 }),
    ).toBe("1 nuova · 2 già presenti");
  });

  it("riproduce l'helper del master 06", () => {
    expect(existingSeasonsNotice(2)).toBe(
      "Le 2 stagioni già presenti resteranno invariate.",
    );
    expect(existingSeasonsNotice(1)).toBe(
      "La stagione già presente resterà invariata.",
    );
    expect(existingSeasonsNotice(0)).toBeNull();
  });
});

describe("periodo senza effetto (§20)", () => {
  it("distingue già persistito da già nel riepilogo", () => {
    expect(
      emptyPeriodReason({ draftCoveredCount: 0, existingCount: 3, newCount: 0 }),
    ).toBe("Le stagioni selezionate sono già presenti nello storico.");

    expect(
      emptyPeriodReason({ draftCoveredCount: 3, existingCount: 0, newCount: 0 }),
    ).toBe("Le stagioni selezionate sono già nel riepilogo.");
  });

  it("tace quando il periodo aggiunge qualcosa", () => {
    expect(
      emptyPeriodReason({ draftCoveredCount: 2, existingCount: 1, newCount: 1 }),
    ).toBeNull();
  });

  it("un periodo a zero nuove non è aggiungibile", () => {
    expect(
      canAddPeriod({
        draftCoveredCount: 0,
        errorCode: null,
        existingCount: 2,
        fromSeason: "2024/25",
        index: 0,
        levelId: null,
        newCount: 0,
        toSeason: "2025/26",
        typeId: "u18",
      }),
    ).toBe(false);
  });
});

describe("conflitti e validazione", () => {
  it("nomina le stagioni in conflitto", () => {
    expect(conflictMessage(["2023/24"])).toContain("2023/24");
    expect(conflictMessage([])).toBeNull();
  });

  it("traduce i codici di periodo in italiano, senza dettagli interni", () => {
    expect(periodErrorMessage("PERIOD_RANGE_INVERTED")).toBe(
      "La stagione iniziale deve precedere quella finale.",
    );
    expect(periodErrorMessage(null)).toBeNull();
  });

  it("usa le copy di riferimento di §33", () => {
    expect(seasonErrorMessage("SEASON_CONTEXT_CHANGED", "generico")).toBe(
      "La stagione corrente è cambiata. Controlla i dati prima di salvare.",
    );
    expect(seasonErrorMessage("HISTORY_CONTEXT_CHANGED", "generico")).toBe(
      "Lo storico è stato aggiornato. Controlla il riepilogo prima di confermare.",
    );
    // Un codice sconosciuto non diventa un messaggio tecnico.
    expect(seasonErrorMessage("UNKNOWN", "Riprova.")).toBe("Riprova.");
  });
});

describe("impedimenti alla disattivazione (§26)", () => {
  it("riproduce le due righe del master 07", () => {
    expect(blockerCopy({ canOpen: true, count: 2, kind: "positions" })).toEqual({
      actionLabel: "Vedi posizioni",
      body: "2 posizioni attive",
      title: "Posizioni aperte",
    });

    expect(blockerCopy({ canOpen: true, count: 1, kind: "invites" })).toEqual({
      actionLabel: "Gestisci inviti",
      body: "1 invito ancora accettabile",
      title: "Inviti in attesa",
    });
  });

  it("non espone numero né destinazione a chi non può consultare il dominio", () => {
    const copy = blockerCopy({ canOpen: false, count: null, kind: "positions" });

    expect(copy.actionLabel).toBeNull();
    expect(copy.body).not.toMatch(/\d/);
  });
});
