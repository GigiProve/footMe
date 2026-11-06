/**
 * Le regole di DAS-REV-18 che non si vedono a schermo.
 *
 * Tre famiglie di rischio, tutte verificabili senza montare niente:
 *
 *   * la **data civile**. §8 ha reso il cutoff esclusivo, quindi ogni
 *     formattazione che partisse dall'istante mostrerebbe il giorno
 *     successivo. Qui si verifica che il giorno venga dal server e che
 *     l'adapter dei formatter esistenti regga entrambe le rappresentazioni;
 *   * il **motivo di chiusura**. §21 vieta «Non specificato» e vieta che il
 *     motivo esca dal perimetro gestionale: un motivo assente deve sparire,
 *     non diventare una label;
 *   * la **Cronologia**. §28 la limita a tre voci e vieta di inventare un
 *     timestamp mancante — il backfill di DAS-REV-15 ha lasciato chiusure
 *     senza data, e «oggi» non è la risposta.
 */
import { describe, expect, it } from "vitest";

import {
  formatDeadlineDetailLabel,
  formatDeadlineRowLabel,
} from "../personal/personal-presentation";
import {
  CLOSE_REASON_LABELS,
  CLOSE_REASON_ORDER,
  CLOSE_REASON_TEXT_MAX,
  closeReasonLabel,
  formatCivilDateLabel,
  formatDeadlinePassedLabel,
  listErrorCopy,
} from "./positions-presentation";
import { EMPTY_CLOSE_DRAFT, withReason } from "./manage/close-draft";
import { historyRows } from "./manage/manage-presentation";

describe("giorno civile della scadenza", () => {
  it("formatta il giorno che arriva dal server, senza costruire date", () => {
    expect(formatCivilDateLabel("2026-09-30")).toBe("30 settembre 2026");
    expect(formatCivilDateLabel("2026-10-01")).toBe("1 ottobre 2026");
  });

  it("omette una stringa che non è un giorno civile", () => {
    /* §28: un valore sconosciuto si omette, non si mostra come `2026-9-30`
       né come un ISO completo. */
    expect(formatCivilDateLabel(null)).toBeNull();
    expect(formatCivilDateLabel("2026-09-30T00:00:00Z")).toBeNull();
    expect(formatCivilDateLabel("domani")).toBeNull();
  });

  it("elide l'articolo davanti a otto e undici", () => {
    expect(formatDeadlinePassedLabel("2026-09-23")).toBe(
      "Scadenza superata il 23 settembre 2026",
    );
    expect(formatDeadlinePassedLabel("2026-09-08")).toBe(
      "Scadenza superata l'8 settembre 2026",
    );
    expect(formatDeadlinePassedLabel("2026-09-11")).toBe(
      "Scadenza superata l'11 settembre 2026",
    );
  });
});

describe("adapter del cutoff esclusivo nei formatter esistenti", () => {
  /* Il rischio concreto: `application_deadline_at` ora è la mezzanotte del
     giorno **successivo** a quello scelto. Un formatter che lo stampasse
     direttamente direbbe «Candidature entro il 1 ottobre» per una scadenza
     del 30 settembre. */
  const CUTOFF_ESCLUSIVO = "2026-09-30T22:00:00.000Z"; // 1 ott 00:00 a Roma
  const CUTOFF_INCLUSIVO_LEGACY = "2026-09-30T21:59:59.999Z"; // 30 set 23:59:59.999

  it("riporta il giorno scelto, non quello del cutoff", () => {
    expect(
      formatDeadlineRowLabel(CUTOFF_ESCLUSIVO, { timeZone: "Europe/Rome" }),
    ).toBe("Candidature entro il 30 settembre");
  });

  it("non stampa un'ora per un confine di giornata", () => {
    /* La vecchia forma «, ore 23:59» non aggiungeva informazione: il giorno
       scelto è incluso per intero, e §8 chiede proprio di non esprimere il
       termine come un orario. */
    expect(
      formatDeadlineDetailLabel(CUTOFF_ESCLUSIVO, { timeZone: "Europe/Rome" }),
    ).toBe("Candidature entro il 30 settembre 2026");
  });

  it("legge allo stesso modo una riga non ancora normalizzata", () => {
    /* La migrazione normalizza le righe esistenti, ma l'adapter non deve
       dipendere da quella: §8 vuole «esattamente la stessa semantica». */
    expect(
      formatDeadlineRowLabel(CUTOFF_INCLUSIVO_LEGACY, {
        timeZone: "Europe/Rome",
      }),
    ).toBe("Candidature entro il 30 settembre");
  });

  it("conserva l'ora di un cutoff che non è un confine di giornata", () => {
    expect(
      formatDeadlineDetailLabel("2026-09-30T16:00:00.000Z", {
        timeZone: "Europe/Rome",
      }),
    ).toBe("Candidature entro il 30 settembre 2026, ore 18:00 (Europe/Rome)");
  });
});

describe("motivo di chiusura", () => {
  it("ha esattamente i quattro valori canonici, nell'ordine del master", () => {
    expect(CLOSE_REASON_ORDER).toEqual([
      "filled",
      "no_longer_needed",
      "cancelled",
      "other",
    ]);
    expect(Object.keys(CLOSE_REASON_LABELS).sort()).toEqual([
      "cancelled",
      "filled",
      "no_longer_needed",
      "other",
    ]);
  });

  it("omette il motivo assente invece di scrivere «Non specificato»", () => {
    expect(closeReasonLabel(null)).toBeNull();
    expect(closeReasonLabel("filled")).toBe("Profilo trovato");
  });

  it("condivide il limite del testo con il backend", () => {
    /* Il gemello SQL è il CHECK `recruiting_ad_closures_text_length` e
       `position_close_reason_max_length()`. Se questo numero cambia senza
       che cambi quello, l'UI accetta un testo che il server rifiuta. */
    expect(CLOSE_REASON_TEXT_MAX).toBe(300);
  });

  it("scarta il testo di «Altro» passando a un motivo standard", () => {
    /* §20: «Passando da Altro a un motivo standard, rimuovi dal buffer
       l'eventuale testo Altro incompatibile; non conservarlo in un payload
       nascosto.» */
    const conAltro = { reason: "other" as const, reasonText: "Fusione squadre" };

    expect(withReason(conAltro, "filled")).toEqual({
      reason: "filled",
      reasonText: null,
    });
  });

  it("cancella il dettaglio quando si rimuove il motivo", () => {
    const conAltro = { reason: "other" as const, reasonText: "Fusione squadre" };

    expect(withReason(conAltro, null)).toEqual(EMPTY_CLOSE_DRAFT);
  });

  it("conserva il testo restando su «Altro»", () => {
    const conAltro = { reason: "other" as const, reasonText: "Fusione squadre" };

    expect(withReason(conAltro, "other")).toEqual(conAltro);
  });
});

describe("Cronologia dello storico", () => {
  const CHIUSA = {
    closeReason: "filled" as const,
    closeReasonText: null,
    closedAt: "2026-09-24T10:00:00Z",
    lifecycle: "closed" as const,
    publishedAt: "2026-09-01T08:00:00Z",
  };

  it("mostra solo pubblicazione, chiusura e motivo", () => {
    const rows = historyRows(CHIUSA);

    expect(rows.map((row) => row.key)).toEqual([
      "published",
      "closed",
      "reason",
    ]);
    expect(rows[0].value).toBe("1 settembre 2026");
    expect(rows[1].value).toBe("24 settembre 2026");
    expect(rows[2].value).toBe("Profilo trovato");
    expect(rows[2].helper).toBe("Visibile solo alla società");
  });

  it("non esiste su una posizione non chiusa", () => {
    /* §28 la vuole solo nello storico: una Attiva non ha una cronologia da
       mostrare, e una bozza non ha nemmeno una pubblicazione. */
    expect(historyRows({ ...CHIUSA, lifecycle: "published" })).toEqual([]);
    expect(historyRows({ ...CHIUSA, lifecycle: "draft" })).toEqual([]);
  });

  it("omette la riga del motivo quando non c'è", () => {
    const rows = historyRows({ ...CHIUSA, closeReason: null });

    expect(rows.map((row) => row.key)).toEqual(["published", "closed"]);
  });

  it("omette una data sconosciuta invece di inventarla", () => {
    /* Il backfill di DAS-REV-15 ha lasciato chiusure senza `closed_at`.
       §28: «Se manca un timestamp legacy, ometti il valore sconosciuto …
       non ricavarlo arbitrariamente da altri eventi.» */
    const rows = historyRows({ ...CHIUSA, closedAt: null });

    expect(rows.map((row) => row.key)).toEqual(["published", "reason"]);
    expect(JSON.stringify(rows)).not.toContain(String(new Date().getFullYear() + 1));
  });

  it("porta il dettaglio di «Altro» nel dettaglio, accanto al motivo", () => {
    const rows = historyRows({
      ...CHIUSA,
      closeReason: "other",
      closeReasonText: "Fusione con la squadra B",
    });

    expect(rows[2].value).toBe("Altro · Fusione con la squadra B");
  });
});

describe("copy della lista", () => {
  it("nomina le Chiuse quando è la tab Chiuse a non caricare", () => {
    expect(listErrorCopy("closed")).toBe(
      "Non siamo riusciti a caricare le posizioni chiuse.",
    );
    expect(listErrorCopy("active")).toBe(
      "Non è stato possibile caricare le posizioni.",
    );
  });
});
