import { describe, expect, it } from "vitest";

import {
  introEditHref,
  mapIntroRows,
  parseIntroAreas,
  shouldShowIntro,
} from "./feed-intro-presentation";

describe("parseIntroAreas (HOM-13 §140–§141)", () => {
  it("accetta le aree del profilo senza nuova tassonomia", () => {
    expect(
      parseIntroAreas([
        { kind: "region", label: "Lombardia" },
        { kind: "province", label: "Monza e Brianza" },
        { kind: "city", label: "Monza" },
      ]),
    ).toHaveLength(3);
  });

  it("scarta tipi ignoti, etichette vuote e duplicati senza rompere le altre", () => {
    expect(
      parseIntroAreas([
        { kind: "region", label: "Lombardia" },
        { kind: "region", label: "  lombardia " },
        { kind: "country", label: "Italia" },
        { kind: "city", label: "   " },
        { kind: "city" },
        null,
        "x",
      ]),
    ).toEqual([{ kind: "region", label: "Lombardia" }]);
  });

  it("un valore non array è un elenco vuoto: la sezione non si mostra", () => {
    expect(parseIntroAreas(null)).toEqual([]);
    expect(parseIntroAreas({ kind: "region", label: "x" })).toEqual([]);
  });
});

describe("mapIntroRows", () => {
  it("mostra solo se il server lo chiede", () => {
    expect(mapIntroRows([{ areas: [], intro_state: "pending", should_show: true }]).shouldShow).toBe(true);
    expect(mapIntroRows([{ areas: [], intro_state: "completed", should_show: false }]).shouldShow).toBe(false);
  });

  it("senza riga non c'è nulla da mostrare", () => {
    expect(mapIntroRows([])).toEqual({ areas: [], shouldShow: false });
    expect(mapIntroRows(null)).toEqual({ areas: [], shouldShow: false });
  });
});

describe("shouldShowIntro — una sola volta", () => {
  const pending = { areas: [], shouldShow: true };

  it("si mostra con should_show e non ancora chiuso", () => {
    expect(shouldShowIntro(pending, false)).toBe(true);
  });

  it("dopo «Inizia» o la chiusura sparisce subito, senza attendere la rete", () => {
    expect(shouldShowIntro(pending, true)).toBe(false);
  });

  it("senza dati (errore o caricamento) non blocca né mostra nulla", () => {
    expect(shouldShowIntro(undefined, false)).toBe(false);
  });
});

describe("introEditHref — editor profilo esistente (§142)", () => {
  it.each([
    ["player", "/profile/edit"],
    ["coach", "/profile/coach-edit"],
    ["staff", "/profile/staff-edit"],
    ["agent", "/profile/agent-edit"],
    ["director", "/profile/director-edit"],
    ["fan", "/profile/fan-edit/areas"],
    ["media", "/profile/media-edit/areas"],
    ["club_admin", "/profile/society-edit"],
  ])("%s -> %s", (role, href) => {
    expect(introEditHref(role)).toBe(href);
  });

  it("senza ruolo o per admin non c'è link", () => {
    expect(introEditHref(null)).toBeNull();
    expect(introEditHref("admin")).toBeNull();
  });
});
