/**
 * Test delle regole di presentazione del collegamento Persona–Società.
 *
 * §53: «Evita test che si limitano a ripetere il codice o snapshot fragili
 * di ogni riga di copy.» Qui ci sono soltanto i comportamenti che possono
 * davvero sbagliare: un conteggio che mente, una frase che promette ruoli
 * inesistenti, uno stato sconosciuto che diventa azionabile.
 */
import { describe, expect, it } from "vitest";

import {
  ROLE_LINK_COPY,
  firstName,
  removeRoleSheetBody,
  requestStateLabel,
  societyContextLines,
  societySummary,
} from "./role-link-presentation";

describe("riepilogo di una società (§26)", () => {
  it("con un solo incarico mostra il ruolo, non un conteggio", () => {
    expect(
      societySummary({
        activeCount: 1,
        roleLines: ["Calciatore · Prima squadra"],
      }),
    ).toBe("Calciatore · Prima squadra");
  });

  it("con più incarichi mostra il numero **reale**, non una label fissa", () => {
    expect(
      societySummary({
        activeCount: 3,
        roleLines: ["a", "b", "c"],
      }),
    ).toBe("3 ruoli attivi");
  });

  it("le righe di contesto compaiono solo con più incarichi, al massimo due", () => {
    expect(societyContextLines(["a"], 1)).toEqual([]);
    expect(societyContextLines(["a", "b", "c"], 3)).toEqual(["a", "b"]);
  });
});

describe("conferma di rimozione di un ruolo (§35)", () => {
  const base = {
    clubName: "AC Como",
    contextLabel: "Primavera",
    roleLabel: "Match analyst",
  };

  it("lato persona nomina il ruolo e la squadra", () => {
    const sheet = removeRoleSheetBody({
      ...base,
      actorSide: "person",
      otherActiveCount: 2,
    });

    expect(sheet.body).toBe(
      "Non risulterai più come Match analyst della Primavera di AC Como.",
    );
    expect(sheet.note).toBe("Gli altri 2 ruoli resteranno attivi.");
  });

  it("lato società nomina la persona, non la professione (§33)", () => {
    const sheet = removeRoleSheetBody({
      ...base,
      actorSide: "society",
      otherActiveCount: 1,
      personFirstName: "Mario",
    });

    expect(sheet.body.startsWith("Mario non risulterà più come")).toBe(true);
    expect(sheet.note).toBe("L'altro ruolo resterà attivo.");
  });

  it("senza altri ruoli avvisa invece di prometterne di inesistenti", () => {
    const sheet = removeRoleSheetBody({
      ...base,
      actorSide: "person",
      otherActiveCount: 0,
    });

    expect(sheet.note).toBe("Non ti resteranno ruoli attivi con AC Como.");
  });

  it("un incarico societario non viene descritto come squadra (§9)", () => {
    const sheet = removeRoleSheetBody({
      ...base,
      actorSide: "person",
      contextLabel: "Intera società",
      otherActiveCount: 0,
      roleLabel: "Responsabile settore giovanile",
    });

    expect(sheet.body).toContain("per l'intera società di AC Como");
    expect(sheet.body).not.toContain("della Intera società");
  });
});

describe("stato della richiesta (§17, §24)", () => {
  it("l'esito neutro non è un'approvazione", () => {
    expect(requestStateLabel("superseded")).toBe(
      ROLE_LINK_COPY.supersededState,
    );
    expect(requestStateLabel("superseded")).not.toBe(
      ROLE_LINK_COPY.approvedState,
    );
  });

  it("ogni stato terminale ha la propria frase", () => {
    const labels = (["approved", "declined", "cancelled", "superseded"] as const).map(
      requestStateLabel,
    );

    expect(new Set(labels).size).toBe(4);
  });
});

describe("nome proprio nell'helper (§33)", () => {
  it("usa il nome, non il cognome", () => {
    expect(firstName("Mario Rossi")).toBe("Mario");
  });

  it("un nome di una parola sola resta intero", () => {
    expect(firstName("Ronaldinho")).toBe("Ronaldinho");
  });
});
