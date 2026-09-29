/**
 * §N.3 / §AA — validazione dei contatti pubblici.
 *
 * Il caso interessante è il sito web: completare il protocollo davanti a
 * qualsiasi stringa trasformerebbe uno schema non supportato in un URL
 * dall'aspetto valido.
 */
import { describe, expect, it } from "vitest";

import {
  isWebsiteValid,
  normalizeTikTokInput,
  normalizeWebsiteInput,
  normalizeYouTubeInput,
} from "../profile-form-utils";

describe("normalizeWebsiteInput", () => {
  it("completa il protocollo su un dominio", () => {
    expect(normalizeWebsiteInput("salvo.example.com")).toBe(
      "https://salvo.example.com",
    );
  });

  it("lascia intatto un URL già valido", () => {
    expect(normalizeWebsiteInput("http://salvo.example.com")).toBe(
      "http://salvo.example.com",
    );
  });

  it("rifiuta uno schema non supportato invece di mascherarlo", () => {
    for (const value of ["javascript:alert(1)", "ftp://example.com", "data:text/html,x"]) {
      expect(normalizeWebsiteInput(value)).toBe("");
      expect(isWebsiteValid(value)).toBe(false);
    }
  });

  it("considera non valido un dominio incompleto", () => {
    expect(isWebsiteValid("salvo")).toBe(false);
    expect(isWebsiteValid("salvo.example.com")).toBe(true);
  });
});

describe("normalizzazione degli handle social", () => {
  it("evita il doppio @", () => {
    expect(normalizeTikTokInput("@salvo")).toBe("https://www.tiktok.com/@salvo");
    expect(normalizeYouTubeInput("@@salvo")).toBe(
      "https://www.youtube.com/@salvo",
    );
  });

  it("accetta anche l'URL completo", () => {
    expect(normalizeTikTokInput("https://www.tiktok.com/@salvo")).toBe(
      "https://www.tiktok.com/@salvo",
    );
  });

  it("su valore vuoto non produce un link", () => {
    expect(normalizeTikTokInput("   ")).toBe("");
    expect(normalizeYouTubeInput("")).toBe("");
  });
});
