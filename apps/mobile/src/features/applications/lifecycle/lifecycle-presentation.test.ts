import { describe, expect, it } from "vitest";

import {
  LIFECYCLE_COPY,
  formatLongDate,
  isUncertainOutcome,
  lifecycleErrorMessage,
  personalLifecycleStatus,
  societyLifecycleStatus,
} from "./lifecycle-presentation";

/**
 * Il blocco di stato è l'unico punto in cui le quattro dimensioni di §4 —
 * partecipazione, lifecycle della Position, ricezione, esito — finiscono in
 * una frase sola. Questi test fissano le combinazioni che la tavola mostra e
 * quelle che §30 vieta di scrivere a vanvera.
 */

describe("formatLongDate", () => {
  it("scrive la data per esteso, come nel mockup", () => {
    expect(formatLongDate("2026-09-13T10:00:00Z")).toBe("13 settembre 2026");
  });

  it("omette una data che il dominio non conosce", () => {
    expect(formatLongDate(null)).toBeNull();
    expect(formatLongDate("non-una-data")).toBeNull();
  });
});

describe("personalLifecycleStatus", () => {
  it("screen 01: candidatura inviata, data reale e profilo consultabile", () => {
    const status = personalLifecycleStatus({
      canApply: false,
      latestSubmittedAt: "2026-09-13T10:00:00Z",
      receivingOpen: true,
      state: "active",
      withdrawnAt: null,
    });

    expect(status.title).toBe("Candidatura inviata");
    expect(status.lines).toEqual([
      "Inviata il 13 settembre 2026",
      "La società può consultare il tuo profilo aggiornato.",
    ]);
  });

  it("una candidatura attiva su ricezione chiusa resta valutabile, non scaduta", () => {
    // §15: «Le candidature ricevute restano valutabili.» La chiusura è un
    // fatto della Position e non riscrive lo stato della partecipazione.
    const status = personalLifecycleStatus({
      canApply: false,
      latestSubmittedAt: "2026-09-13T10:00:00Z",
      receivingOpen: false,
      state: "active",
      withdrawnAt: null,
    });

    expect(status.title).toBe("Candidatura inviata");
    expect(status.lines[1]).toBe("Le candidature ricevute restano valutabili.");
  });

  it("screen 03: ritirata, con la data del ritiro e la promessa vera", () => {
    const status = personalLifecycleStatus({
      canApply: true,
      latestSubmittedAt: "2026-09-13T10:00:00Z",
      receivingOpen: true,
      state: "withdrawn",
      withdrawnAt: "2026-09-14T08:05:00Z",
    });

    expect(status.title).toBe("Candidatura ritirata");
    expect(status.lines).toEqual([
      "Ritirata il 14 settembre 2026",
      "Puoi candidarti di nuovo finché la posizione accetta candidature.",
    ]);
  });

  it("non promette la ricandidatura quando il server la nega", () => {
    // §30: «L'helper che promette la possibilità di ricandidarsi è mostrato
    // solo quando la condizione è vera.»
    const status = personalLifecycleStatus({
      canApply: false,
      latestSubmittedAt: "2026-09-13T10:00:00Z",
      receivingOpen: false,
      state: "withdrawn",
      withdrawnAt: "2026-09-14T08:05:00Z",
    });

    expect(status.lines).not.toContain(LIFECYCLE_COPY.canReapply);
    expect(status.lines[1]).toBe(
      "Questa posizione non accetta più nuove candidature.",
    );
  });

  it("resta leggibile quando la data del ritiro non è nota", () => {
    // §32: un ritiro storico senza testimonianza non ne inventa una.
    const status = personalLifecycleStatus({
      canApply: true,
      latestSubmittedAt: null,
      receivingOpen: true,
      state: "withdrawn",
      withdrawnAt: null,
    });

    expect(status.title).toBe("Candidatura ritirata");
    expect(status.lines).toEqual([LIFECYCLE_COPY.canReapply]);
  });
});

describe("societyLifecycleStatus", () => {
  it("non dice niente su una candidatura attiva e una ricerca aperta", () => {
    expect(
      societyLifecycleStatus({
        adStatus: "published",
        receivingClosed: false,
        state: "active",
        withdrawnAt: null,
      }),
    ).toBeNull();
  });

  it("screen 06/07: candidatura ritirata, con la sua data", () => {
    const status = societyLifecycleStatus({
      adStatus: "published",
      receivingClosed: false,
      state: "withdrawn",
      withdrawnAt: "2026-09-14T08:05:00Z",
    });

    expect(status).toEqual({
      lines: ["Ritirata il 14 settembre 2026"],
      title: "Candidatura ritirata",
    });
  });

  it("screen 08: termine scaduto, e le candidature restano valutabili", () => {
    expect(
      societyLifecycleStatus({
        adStatus: "published",
        receivingClosed: true,
        state: "active",
        withdrawnAt: null,
      }),
    ).toEqual({
      lines: ["Le candidature ricevute restano valutabili."],
      title: "Termine candidature scaduto",
    });
  });

  it("screen 09: posizione chiusa, distinta dal termine scaduto", () => {
    expect(
      societyLifecycleStatus({
        adStatus: "closed",
        receivingClosed: true,
        state: "active",
        withdrawnAt: null,
      }),
    ).toEqual({
      lines: ["Le candidature ricevute restano valutabili."],
      title: "Posizione chiusa",
    });
  });

  it("ritiro e chiusura coesistono: §17 chiede di conservarli entrambi", () => {
    const status = societyLifecycleStatus({
      adStatus: "closed",
      receivingClosed: true,
      state: "withdrawn",
      withdrawnAt: "2026-09-14T08:05:00Z",
    });

    expect(status?.title).toBe("Candidatura ritirata");
    expect(status?.lines).toEqual([
      "Ritirata il 14 settembre 2026",
      "Posizione chiusa",
    ]);
  });
});

describe("lifecycleErrorMessage", () => {
  it("distingue il termine scaduto dalla posizione chiusa", () => {
    expect(
      lifecycleErrorMessage(new Error("POSITION_DEADLINE_PASSED"), "fallback"),
    ).toBe("Il termine per candidarsi è scaduto.");
    expect(lifecycleErrorMessage(new Error("POSITION_CLOSED"), "fallback")).toBe(
      "Questa posizione non accetta più candidature.",
    );
  });

  it("tratta una revisione superata come un cambiamento, non un errore", () => {
    expect(
      lifecycleErrorMessage(new Error("APPLICATION_REVISION_STALE"), "x"),
    ).toBe("La candidatura è cambiata. Controlla lo stato aggiornato.");
  });

  it("non lascia trapelare codici tecnici", () => {
    const message = lifecycleErrorMessage(
      new Error('insert or update violates "recruiting_applications_pkey"'),
      LIFECYCLE_COPY.withdrawFailed,
    );

    expect(message).toBe(LIFECYCLE_COPY.withdrawFailed);
  });
});

describe("isUncertainOutcome", () => {
  it("riconosce la rete caduta dopo il tap", () => {
    expect(isUncertainOutcome(new Error("Network request failed"))).toBe(true);
  });

  it("non confonde un diniego di dominio con un esito incerto", () => {
    expect(isUncertainOutcome(new Error("POSITION_CLOSED"))).toBe(false);
  });
});
