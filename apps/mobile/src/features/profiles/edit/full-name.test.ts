/**
 * Nome e Cognome sono una vista su una colonna sola: il round-trip deve essere
 * esatto, altrimenti il dato si degrada a ogni apertura dell'editor.
 */
import { describe, expect, it } from "vitest";

import { joinFullName, splitFullName } from "../profile-form-utils";

describe("splitFullName / joinFullName", () => {
  it("tiene intero un cognome composto", () => {
    expect(splitFullName("Angel Di Maria")).toEqual({
      firstName: "Angel",
      lastName: "Di Maria",
    });
  });

  it("non perde nulla nel giro completo", () => {
    for (const value of [
      "Salvo Salvini",
      "Angel Di Maria",
      "Marco Van Basten",
      "Maria Teresa Rossi",
      "Ronaldinho",
    ]) {
      const { firstName, lastName } = splitFullName(value);

      expect(joinFullName(firstName, lastName)).toBe(value);
    }
  });

  it("normalizza spazi multipli e valori vuoti", () => {
    expect(splitFullName("  Salvo   Salvini ")).toEqual({
      firstName: "Salvo",
      lastName: "Salvini",
    });
    expect(splitFullName(null)).toEqual({ firstName: "", lastName: "" });
    expect(joinFullName("  ", " Salvini ")).toBe("Salvini");
  });
});
