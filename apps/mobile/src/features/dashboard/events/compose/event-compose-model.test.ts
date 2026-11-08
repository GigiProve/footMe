/**
 * Regole del wizard (DAS-REV-28 §13–§17, §19, §20).
 *
 * Tre insiemi distinti — Continua, Salva bozza, Pubblica — e la patch
 * parziale che non cancella ciò che non è stato toccato.
 */
import { describe, expect, it } from "vitest";

import type { EventDraftValues, EventLimits } from "../events-types";
import {
  buildPatch,
  capacityError,
  commandSignature,
  conflictingFields,
  deadlinePassed,
  draftErrors,
  emptyValues,
  errorsFromCodes,
  firstStepWithError,
  isDirty,
  mergeAfterConflict,
  normalizeYears,
  nowInZone,
  publishErrors,
  stepErrors,
  toServerFields,
  yearsError,
  yearsLabel,
} from "./event-compose-model";

const LIMITS: EventLimits = {
  birthYearMax: 2026,
  birthYearMin: 1900,
  description: 2000,
  maxParticipants: 10000,
  requirements: 1000,
  title: 120,
  venueAddress: 200,
  venueName: 120,
};

const NOW = new Date("2026-09-13T10:00:00Z");

/** Fixture E4 della tavola (§6). */
function e4(patch: Partial<EventDraftValues> = {}): EventDraftValues {
  return {
    birthYearFrom: "2008",
    birthYearTo: "2009",
    confirmationMode: "manual",
    deadlineDate: "2026-09-28",
    deadlineTime: "23:59",
    description: "Una giornata per conoscere la nostra Primavera.",
    endTime: "18:00",
    eventType: "open_day",
    maxParticipants: "50",
    participationMode: "open_registration",
    requirements: "Porta abbigliamento e scarpe da calcio.",
    startDate: "2026-09-30",
    startTime: "15:00",
    teamId: "primavera",
    title: "Open day Primavera",
    venueAddress: "Via Roma 22, Como",
    venueName: "Centro Sportivo Comunale",
    ...patch,
  };
}

describe("Continua (§13)", () => {
  it("lo step 1 chiede solo i propri campi", () => {
    const errors = stepErrors(1, emptyValues(), LIMITS);

    expect(Object.keys(errors).sort()).toEqual(
      ["eventType", "startDate", "teamId", "title", "venueAddress", "venueName"].sort(),
    );
  });

  it("lo step 2 non pretende la partecipazione (non applica le regole successive)", () => {
    expect(stepErrors(2, e4({ participationMode: null }), LIMITS)).toEqual({});
  });

  it("QA-041: un titolo di soli spazi non basta", () => {
    expect(stepErrors(1, e4({ title: "   " }), LIMITS).title).toBe("title_missing");
  });

  it("QA-044: ora di fine uguale o precedente", () => {
    expect(stepErrors(1, e4({ endTime: "15:00" }), LIMITS).endTime).toBe("end_before_start");
    expect(stepErrors(1, e4({ endTime: "14:00" }), LIMITS).endTime).toBe("end_before_start");
  });

  it("QA-046: ora di fine assente ammessa", () => {
    expect(stepErrors(1, e4({ endTime: null }), LIMITS)).toEqual({});
  });
});

describe("Salva bozza (§13)", () => {
  it("QA-082: senza squadra non si salva", () => {
    expect(draftErrors(e4({ teamId: null }), LIMITS).teamId).toBe("team_missing");
  });

  it("QA-042/043: dati di pubblicazione mancanti non bloccano la bozza", () => {
    expect(
      draftErrors({ ...emptyValues(), teamId: "primavera", title: "Bozza" }, LIMITS),
    ).toEqual({});
  });

  it("QA-058: un intervallo invertito non è mai salvabile", () => {
    expect(draftErrors(e4({ birthYearFrom: "2009", birthYearTo: "2008" }), LIMITS).years).toBe(
      "years_inverted",
    );
  });
});

describe("Pubblica (§19)", () => {
  it("la fixture E4 è pubblicabile", () => {
    expect(publishErrors(e4(), LIMITS, "Europe/Rome", NOW)).toEqual({});
  });

  it("QA-047: inizio passato nel fuso dell'evento", () => {
    expect(
      publishErrors(e4({ deadlineDate: null, deadlineTime: null, startDate: "2026-09-13", startTime: "11:30" }), LIMITS, "Europe/Rome", NOW)
        .startTime,
    ).toBe("start_past");
    /* 10:00Z sono le 12:00 a Roma: le 12:30 sono ancora future. */
    expect(
      publishErrors(e4({ deadlineDate: null, deadlineTime: null, startDate: "2026-09-13", startTime: "12:30" }), LIMITS, "Europe/Rome", NOW)
        .startTime,
    ).toBeUndefined();
  });

  it("QA-064/065: modalità e conferma obbligatorie", () => {
    expect(publishErrors(e4({ participationMode: null }), LIMITS, "Europe/Rome", NOW).participationMode).toBe(
      "mode_missing",
    );
    expect(publishErrors(e4({ confirmationMode: null }), LIMITS, "Europe/Rome", NOW).confirmationMode).toBe(
      "confirmation_missing",
    );
  });

  it("QA-063: solo su invito non richiede conferma né termine", () => {
    expect(
      publishErrors(
        e4({ confirmationMode: null, deadlineDate: null, deadlineTime: null, participationMode: "invite_only" }),
        LIMITS,
        "Europe/Rome",
        NOW,
      ),
    ).toEqual({});
  });

  it("QA-068: termine successivo all'inizio", () => {
    expect(publishErrors(e4({ deadlineDate: "2026-10-01" }), LIMITS, "Europe/Rome", NOW).deadline).toBe(
      "deadline_after_start",
    );
  });
});

describe("anni e capienza (§16)", () => {
  it("QA-056: un anno singolo si normalizza a entrambi gli estremi", () => {
    expect(normalizeYears("2009", "")).toEqual({ from: "2009", to: "2009" });
    expect(normalizeYears("", "2010")).toEqual({ from: "2010", to: "2010" });
    expect(yearsLabel("2009", "2009")).toBe("2009");
    expect(yearsLabel("2008", "2009")).toBe("2008 - 2009");
  });

  it("QA-058: intervallo invertito → errore, nessuno scambio", () => {
    expect(normalizeYears("2009", "2008")).toEqual({ from: "2009", to: "2008" });
    expect(yearsError("2009", "2008", LIMITS)).toBe("years_inverted");
  });

  it("anni non validi o futuri", () => {
    expect(yearsError("20", "2009", LIMITS)).toBe("years_invalid");
    expect(yearsError("2030", "2031", LIMITS)).toBe("years_invalid");
    expect(yearsError("", "", LIMITS)).toBeNull();
  });

  it("QA-072: zero, negativo, decimale rifiutati senza troncamento", () => {
    expect(capacityError("0", LIMITS)).toBe("capacity_invalid");
    expect(capacityError("-3", LIMITS)).toBe("capacity_invalid");
    expect(capacityError("2.5", LIMITS)).toBe("capacity_invalid");
    expect(capacityError("", LIMITS)).toBeNull();
    expect(capacityError("50", LIMITS)).toBeNull();
  });
});

describe("patch e idempotenza (§20, §21)", () => {
  it("QA-091: patch parziale con i soli campi cambiati", () => {
    const base = e4();

    expect(buildPatch(e4({ title: "Nuovo titolo" }), base)).toEqual({ title: "Nuovo titolo" });
    expect(buildPatch(base, base)).toEqual({});
  });

  it("prima creazione: squadra e campi valorizzati, niente null inventati", () => {
    const patch = buildPatch({ ...emptyValues(), teamId: "primavera", title: "  Bozza " }, null);

    expect(patch).toEqual({ team_id: "primavera", title: "Bozza" });
  });

  it("§17: con Solo su invito conferma e termine vanno a null", () => {
    const fields = toServerFields(e4({ participationMode: "invite_only" }));

    expect([fields.registration_confirmation_mode, fields.registration_deadline_date]).toEqual([null, null]);
  });

  it("dirty solo rispetto all'ultima versione salvata", () => {
    expect(isDirty(emptyValues(), null)).toBe(false);
    expect(isDirty(e4(), e4())).toBe(false);
    expect(isDirty(e4({ venueName: "Altro" }), e4())).toBe(true);
  });

  it("QA-085: stessa richiesta → stessa firma; contenuto o versione diversi → firma diversa", () => {
    const a = commandSignature({ eventId: null, kind: "save", patch: { b: 1, a: 2 }, version: null });
    const b = commandSignature({ eventId: null, kind: "save", patch: { a: 2, b: 1 }, version: null });

    expect(a).toBe(b);
    expect(commandSignature({ eventId: "x", kind: "publish", version: 3 })).not.toBe(
      commandSignature({ eventId: "x", kind: "publish", version: 4 }),
    );
  });
});

describe("errori del server e tempo (§15, §25)", () => {
  it("codici → campi e primo step con errore", () => {
    const errors = errorsFromCodes(["years_inverted", "title_missing", "mode_missing"]);

    expect(errors).toEqual({ participationMode: "mode_missing", title: "title_missing", years: "years_inverted" });
    expect(firstStepWithError(errors)).toBe(1);
    expect(firstStepWithError({ years: "years_inverted" })).toBe(2);
  });

  it("QA-050: codici del cambio d'ora sul campo orario", () => {
    expect(errorsFromCodes(["start_time_nonexistent"])).toEqual({ startTime: "start_time_nonexistent" });
  });

  it("QA-049: «adesso» civile nel fuso dell'evento, non del dispositivo", () => {
    expect(nowInZone("Europe/Rome", NOW)).toEqual({ date: "2026-09-13", time: "12:00" });
    expect(nowInZone("America/New_York", NOW)).toEqual({ date: "2026-09-13", time: "06:00" });
  });

  it("QA-070: termine trascorso → avviso", () => {
    expect(deadlinePassed(e4({ deadlineDate: "2026-09-12" }), "Europe/Rome", NOW)).toBe(true);
    expect(deadlinePassed(e4(), "Europe/Rome", NOW)).toBe(false);
    expect(deadlinePassed(e4({ participationMode: "invite_only" }), "Europe/Rome", NOW)).toBe(false);
  });
});

describe("conflitto di versione (§19, §21)", () => {
  it("il riesame non riporta indietro un campo cambiato altrove e mai toccato qui", () => {
    const startedFrom = e4();
    const local = e4({ title: "Titolo mio" });
    const server = e4({ venueName: "Stadio B" });
    const merged = mergeAfterConflict(local, startedFrom, server);

    expect([merged.title, merged.venueName]).toEqual(["Titolo mio", "Stadio B"]);
    expect(buildPatch(merged, server)).toEqual({ title: "Titolo mio" });
  });

  it("i campi cambiati da entrambe le parti vengono segnalati", () => {
    expect(
      conflictingFields(e4({ title: "A" }), e4(), e4({ title: "B", venueName: "X" })),
    ).toEqual(["title"]);
  });
});
