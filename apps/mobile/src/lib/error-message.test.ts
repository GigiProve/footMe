import { describe, expect, it } from "vitest";

import { readErrorMessage } from "./error-message";

describe("readErrorMessage", () => {
  it("legge il messaggio di un Error", () => {
    expect(readErrorMessage(new Error("Profilo non trovato"))).toBe(
      "Profilo non trovato",
    );
  });

  it("legge l'errore di Supabase, che non è un Error", () => {
    const postgrestError = {
      code: "22P02",
      details: null,
      hint: null,
      message: 'invalid input syntax for type uuid: "coach-1"',
    };

    expect(readErrorMessage(postgrestError)).toBe(
      'invalid input syntax for type uuid: "coach-1" [22P02]',
    );
  });

  it("unisce details e hint senza ripetere il messaggio", () => {
    expect(
      readErrorMessage({
        code: "",
        details: "Key (profile_id) is not present",
        hint: "Controlla il profilo",
        message: "insert or update violates foreign key constraint",
      }),
    ).toBe(
      "insert or update violates foreign key constraint · Key (profile_id) is not present · Controlla il profilo",
    );
  });

  it("restituisce null quando non c'è nulla di leggibile", () => {
    expect(readErrorMessage({})).toBeNull();
    expect(readErrorMessage(null)).toBeNull();
    expect(readErrorMessage(undefined)).toBeNull();
  });
});
