import { describe, expect, it } from "vitest";

import {
  applicationOutcomeLabel,
  applicationStatusLabel,
  formatConcludedDate,
  formatOutcomeLine,
  MAX_APPLICATION_PREVIEWS,
  SELECTION_COMPLETED_LABEL,
} from "./application-presentation";

/**
 * Regole di presentazione del dominio Candidature (DAS-REV-04 §7, §14, §27).
 *
 * Il punto di questi test non è il testo: è che la presentazione non inventi
 * un esito che il dominio non conosce, e non ne sovrascriva uno che conosce.
 */

describe("applicationOutcomeLabel", () => {
  /**
   * §7: «Se non esiste un esito finale più specifico, utilizzare Selezione
   * conclusa. Non inventare Rifiutata, Scartata o Non selezionato.»
   *
   * È il caso dello screen 03: la selezione finisce mentre la candidatura è
   * ancora "In valutazione", e nessuno ha mai deciso nulla su di lei.
   */
  it("uses the generic outcome when the domain knows no specific one", () => {
    expect(applicationOutcomeLabel("reviewing", "selection_completed")).toBe(
      SELECTION_COMPLETED_LABEL,
    );
    expect(applicationOutcomeLabel("submitted", "selection_completed")).toBe(
      SELECTION_COMPLETED_LABEL,
    );
  });

  /**
   * §14: «Se il dominio conosce un esito finale più specifico, usare il suo
   * testo localizzato. Lo stato Selezione conclusa non deve sovrascrivere gli
   * esiti canonici conosciuti.»
   */
  it("keeps a canonical terminal outcome", () => {
    expect(applicationOutcomeLabel("rejected", "status")).toBe("Rifiutata");
    expect(applicationOutcomeLabel("accepted", "status")).toBe("Accettata");
    expect(applicationOutcomeLabel("withdrawn", "status")).toBe("Ritirata");
  });

  /** Uno stato non interpretabile non diventa un esito inventato (§6). */
  it("falls back to the raw value for an unknown status", () => {
    expect(applicationOutcomeLabel("some_new_status", "status")).toBe(
      "some_new_status",
    );
  });
});

describe("applicationStatusLabel", () => {
  it("localizes the current status, which a conclusion never rewrites", () => {
    expect(applicationStatusLabel("reviewing")).toBe("In lettura");
    expect(applicationStatusLabel("submitted")).toBe("Inviata");
  });
});

describe("formatConcludedDate", () => {
  it("formats a real conclusion date", () => {
    expect(formatConcludedDate("2026-09-10T12:00:00Z")).toBe("10 set 2026");
  });

  /**
   * §14: «Se tale data manca: non ricavarla dalla chiusura dell'annuncio;
   * ometterla oppure mostrare un'altra data reale con label esplicita.»
   */
  it("omits a date the domain does not know", () => {
    expect(formatConcludedDate(null)).toBeNull();
    expect(formatConcludedDate("non-una-data")).toBeNull();
  });
});

describe("formatOutcomeLine", () => {
  it("joins outcome and real date", () => {
    expect(
      formatOutcomeLine({
        concludedAt: "2026-09-10T12:00:00Z",
        outcome: "selection_completed",
        status: "reviewing",
      }),
    ).toBe("Selezione conclusa · 10 set 2026");
  });

  it("stays readable without a date", () => {
    expect(
      formatOutcomeLine({
        concludedAt: null,
        outcome: "status",
        status: "rejected",
      }),
    ).toBe("Rifiutata");
  });
});

describe("MAX_APPLICATION_PREVIEWS", () => {
  /** §8: «normalmente si mostrano due preview, anche con sette attive». */
  it("is two", () => {
    expect(MAX_APPLICATION_PREVIEWS).toBe(2);
  });
});
