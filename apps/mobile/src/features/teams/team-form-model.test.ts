import { describe, expect, it } from "vitest";

import {
  buildTeamPatch,
  canSubmitCreate,
  canSubmitUpdate,
  isTeamDraftDirty,
  isTeamNameValid,
  normalizeTeamName,
  type TeamDraft,
} from "./team-form-model";

function draft(overrides: Partial<TeamDraft> = {}): TeamDraft {
  return {
    city: "Como",
    cityMode: "inherited",
    crestMode: "inherited",
    crestUrl: "https://example.test/club.png",
    levelId: "elite",
    levelLabel: "Élite",
    name: "Comashi",
    region: "Lombardia",
    typeId: "under_18",
    typeLabel: "Under 18",
    ...overrides,
  };
}

describe("normalizeTeamName", () => {
  it("collassa gli spazi e conserva i caratteri legittimi (§14)", () => {
    expect(normalizeTeamName("  Under  17   A ")).toBe("Under 17 A");
    expect(normalizeTeamName("Città di Cantù")).toBe("Città di Cantù");
  });

  it("accetta i nomi previsti dal dominio", () => {
    for (const name of ["Prima squadra", "Under 17 A", "Under 17 B", "Comashi"]) {
      expect(isTeamNameValid(name)).toBe(true);
    }
  });

  it("rifiuta vuoto e soli spazi", () => {
    expect(isTeamNameValid("   ")).toBe(false);
    expect(isTeamNameValid("A")).toBe(false);
  });
});

describe("isTeamDraftDirty", () => {
  it("non considera modifica la sola apertura del form (§23)", () => {
    const initial = draft();

    expect(isTeamDraftDirty(initial, { ...initial })).toBe(false);
  });

  it("considera modifica il cambio di modalità a parità di valore (§23)", () => {
    const initial = draft();

    expect(
      isTeamDraftDirty(initial, { ...initial, cityMode: "custom" }),
    ).toBe(true);
  });

  it("ignora un url personalizzato mentre la modalità è ereditata", () => {
    const initial = draft();

    expect(
      isTeamDraftDirty(initial, { ...initial, crestUrl: "https://other.test/x.png" }),
    ).toBe(false);
  });
});

describe("canSubmitCreate", () => {
  it("richiede tipo, nome e stagione (§13)", () => {
    const base = {
      hasSeason: true,
      isAuthorized: true,
      isUploading: false,
    };

    expect(
      canSubmitCreate({ ...base, draft: draft({ levelId: null, levelLabel: null }) }),
    ).toBe(true);

    expect(
      canSubmitCreate({ ...base, draft: draft({ typeId: null, typeLabel: null }) }),
    ).toBe(false);

    expect(canSubmitCreate({ ...base, draft: draft({ name: " " }) })).toBe(false);
    expect(canSubmitCreate({ ...base, draft: draft(), hasSeason: false })).toBe(
      false,
    );
  });

  it("blocca il submit mentre lo stemma scelto non è pronto (§17)", () => {
    expect(
      canSubmitCreate({
        draft: draft({ crestMode: "custom", crestUrl: null }),
        hasSeason: true,
        isAuthorized: true,
        isUploading: false,
      }),
    ).toBe(false);

    expect(
      canSubmitCreate({
        draft: draft(),
        hasSeason: true,
        isAuthorized: true,
        isUploading: true,
      }),
    ).toBe(false);
  });

  it("non abilita la CTA senza autorizzazione", () => {
    expect(
      canSubmitCreate({
        draft: draft(),
        hasSeason: true,
        isAuthorized: false,
        isUploading: false,
      }),
    ).toBe(false);
  });
});

describe("canSubmitUpdate", () => {
  it("resta disabilitata senza modifiche effettive (§13)", () => {
    const initial = draft();

    expect(
      canSubmitUpdate({
        draft: { ...initial },
        initial,
        isAuthorized: true,
        isUploading: false,
      }),
    ).toBe(false);
  });

  it("non consente di inviare valori vuoti dal caricamento iniziale (§13)", () => {
    const initial = draft();

    expect(
      canSubmitUpdate({
        draft: { ...initial, name: "" },
        initial,
        isAuthorized: true,
        isUploading: false,
      }),
    ).toBe(false);
  });

  it("si abilita su una modifica valida", () => {
    const initial = draft();

    expect(
      canSubmitUpdate({
        draft: { ...initial, name: "Comashi B" },
        initial,
        isAuthorized: true,
        isUploading: false,
      }),
    ).toBe(true);
  });
});

describe("buildTeamPatch", () => {
  it("omette i campi non modificati (§22)", () => {
    const initial = draft();

    expect(
      buildTeamPatch({
        draft: { ...initial, name: "Comashi B" },
        hasSeasonConfig: true,
        initial,
      }),
    ).toEqual({ name: "Comashi B" });
  });

  it("distingue rimozione del livello da campo non toccato (§16, §22)", () => {
    const initial = draft();

    expect(
      buildTeamPatch({
        draft: { ...initial, levelId: null, levelLabel: null },
        hasSeasonConfig: true,
        initial,
      }),
    ).toEqual({ level_id: null });
  });

  it("non tocca tipo e livello senza configurazione corrente (§13)", () => {
    const initial = draft({ levelId: null, levelLabel: null, typeId: null });

    expect(
      buildTeamPatch({
        draft: { ...initial, name: "Nuovo nome", typeId: "under_17" },
        hasSeasonConfig: false,
        initial,
      }),
    ).toEqual({ name: "Nuovo nome" });
  });

  it("porta l'asset quando si passa a stemma personalizzato (§17)", () => {
    const initial = draft();

    expect(
      buildTeamPatch({
        draft: {
          ...initial,
          crestMode: "custom",
          crestUrl: "https://example.test/team.png",
        },
        hasSeasonConfig: true,
        initial,
      }),
    ).toEqual({
      crest_mode: "custom",
      crest_url: "https://example.test/team.png",
    });
  });

  it("ripristina l'ereditarietà senza inviare un url (§17)", () => {
    const initial = draft({
      crestMode: "custom",
      crestUrl: "https://example.test/team.png",
    });

    expect(
      buildTeamPatch({
        draft: { ...initial, crestMode: "inherited" },
        hasSeasonConfig: true,
        initial,
      }),
    ).toEqual({ crest_mode: "inherited" });
  });

  it("invia città e regione insieme quando la località cambia (§18)", () => {
    const initial = draft({ city: "Como", cityMode: "custom", region: "Lombardia" });

    expect(
      buildTeamPatch({
        draft: { ...initial, city: "Cantù" },
        hasSeasonConfig: true,
        initial,
      }),
    ).toEqual({ city: "Cantù", region: "Lombardia" });
  });
});
