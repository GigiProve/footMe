/**
 * Salvataggio per sezione della Modifica profilo Tifoso (REV-PROF-20).
 *
 * Qui si verifica la cosa che la task ripete più volte: **una patch non deve
 * toccare le colonne di un altro modulo**. I test guardano le colonne
 * effettivamente inviate al database, non il risultato a schermo, perché è
 * l'elenco delle colonne a decidere se salvare gli interessi può azzerare le
 * aree.
 *
 * Verificano anche il conflitto: la UPDATE porta la `updated_at` letta, e se
 * non aggiorna nessuna riga il salvataggio fallisce invece di riprovare senza
 * condizione.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CompleteProfessionalProfile } from "../profile-service";

const mocks = vi.hoisted(() => {
  const updates: { payload: Record<string, unknown>; table: string }[] = [];
  const inserts: { payload: Record<string, unknown>; table: string }[] = [];
  const filters: [string, unknown][] = [];
  const state = { result: { data: { profile_id: "fan-1" }, error: null } as unknown };

  function chain(table: string) {
    const self: Record<string, unknown> = {};

    const api = {
      eq: (column: string, value: unknown) => {
        filters.push([column, value]);
        return api;
      },
      insert: (payload: Record<string, unknown>) => {
        inserts.push({ payload, table });
        return api;
      },
      maybeSingle: () => Promise.resolve(state.result),
      select: () => api,
      then: (resolve: (value: unknown) => unknown, reject?: unknown) =>
        Promise.resolve(state.result).then(resolve, reject as never),
      update: (payload: Record<string, unknown>) => {
        updates.push({ payload, table });
        return api;
      },
    };

    Object.assign(self, api);

    return api;
  }

  return {
    filters,
    from: vi.fn((table: string) => chain(table)),
    inserts,
    state,
    updates,
  };
});

vi.mock("../../../lib/supabase", () => ({ supabase: { from: mocks.from } }));

const { FanProfileConflictError, saveFanProfileSection } = await import(
  "./fan-profile-edit-service"
);

function buildProfile(
  fanProfile: Record<string, unknown> | null = {
    favorite_club_id: "club-1",
    favorite_club_is_public: true,
    favorite_team_name: "ASD Prova",
    football_types: ["amateur"],
    football_types_are_public: true,
    geo_scope: "REGIONS",
    interest_categories: ["Serie B"],
    interest_categories_are_public: false,
    interest_provinces: [],
    interest_regions: ["Sicilia"],
    profile_id: "fan-1",
    updated_at: "2026-10-09T10:00:00.000000+00:00",
  },
): CompleteProfessionalProfile {
  return {
    fanProfile,
    profile: { full_name: "Tifoso Prova", id: "fan-1", role: "fan" },
  } as unknown as CompleteProfessionalProfile;
}

beforeEach(() => {
  mocks.updates.length = 0;
  mocks.inserts.length = 0;
  mocks.filters.length = 0;
  mocks.state.result = { data: { profile_id: "fan-1" }, error: null };
  mocks.from.mockClear();
});

describe("patch parziali", () => {
  it("la squadra del cuore scrive solo le proprie colonne", async () => {
    await saveFanProfileSection("fan-1", buildProfile(), {
      kind: "favoriteClub",
      value: { favorite_club_id: "club-2", favorite_club_is_public: true },
    });

    expect(mocks.updates).toHaveLength(1);
    expect(mocks.updates[0].table).toBe("fan_profiles");
    expect(Object.keys(mocks.updates[0].payload).sort()).toEqual([
      "favorite_club_id",
      "favorite_club_is_public",
    ]);
  });

  it("rimuovendo la squadra azzera anche visibilità e valore legacy", async () => {
    await saveFanProfileSection("fan-1", buildProfile(), {
      kind: "favoriteClub",
      value: {
        favorite_club_id: null,
        favorite_club_is_public: false,
        favorite_team_name: null,
      },
    });

    expect(mocks.updates[0].payload).toEqual({
      favorite_club_id: null,
      favorite_club_is_public: false,
      favorite_team_name: null,
    });
  });

  it("gli interessi non nominano categorie né aree", async () => {
    await saveFanProfileSection("fan-1", buildProfile(), {
      kind: "interests",
      value: {
        football_types: ["amateur", "youth"],
        football_types_are_public: true,
      },
    });

    const payload = mocks.updates[0].payload;

    expect(Object.keys(payload).sort()).toEqual([
      "football_types",
      "football_types_are_public",
    ]);
    expect(payload).not.toHaveProperty("interest_categories");
    expect(payload).not.toHaveProperty("geo_scope");
    expect(payload).not.toHaveProperty("interest_regions");
    expect(payload).not.toHaveProperty("favorite_club_id");
  });

  it("le categorie non nominano interessi né aree", async () => {
    await saveFanProfileSection("fan-1", buildProfile(), {
      kind: "categories",
      value: {
        interest_categories: ["Serie B", "Promozione"],
        interest_categories_are_public: true,
      },
    });

    expect(Object.keys(mocks.updates[0].payload).sort()).toEqual([
      "interest_categories",
      "interest_categories_are_public",
    ]);
  });

  it("le aree scrivono modalità e territori, e nient'altro", async () => {
    await saveFanProfileSection("fan-1", buildProfile(), {
      kind: "areas",
      value: {
        geo_scope: "PROVINCES",
        interest_provinces: ["Palermo"],
        interest_regions: [],
      },
    });

    const payload = mocks.updates[0].payload;

    expect(Object.keys(payload).sort()).toEqual([
      "geo_scope",
      "interest_provinces",
      "interest_regions",
    ]);
    // Le aree non sono la residenza e non sono un dato pubblicabile: nessuna
    // colonna di visibilità entra in questa patch.
    expect(Object.keys(payload).join()).not.toContain("is_public");
    expect(Object.keys(payload).join()).not.toContain("are_public");
    expect(payload).not.toHaveProperty("residence");
  });
});

describe("concorrenza", () => {
  it("manda indietro la versione letta come condizione", async () => {
    await saveFanProfileSection("fan-1", buildProfile(), {
      kind: "interests",
      value: { football_types: ["youth"], football_types_are_public: false },
    });

    expect(mocks.filters).toEqual([
      ["profile_id", "fan-1"],
      ["updated_at", "2026-10-09T10:00:00.000000+00:00"],
    ]);
  });

  it("segnala il conflitto quando nessuna riga viene aggiornata", async () => {
    mocks.state.result = { data: null, error: null };

    await expect(
      saveFanProfileSection("fan-1", buildProfile(), {
        kind: "interests",
        value: { football_types: ["youth"], football_types_are_public: false },
      }),
    ).rejects.toBeInstanceOf(FanProfileConflictError);
  });

  it("propaga un errore del database invece di dichiarare il salvataggio riuscito", async () => {
    mocks.state.result = { data: null, error: new Error("rls") };

    await expect(
      saveFanProfileSection("fan-1", buildProfile(), {
        kind: "categories",
        value: {
          interest_categories: [],
          interest_categories_are_public: false,
        },
      }),
    ).rejects.toThrow("rls");
  });
});

describe("prima scrittura", () => {
  it("inserisce la riga quando le preferenze non esistono ancora", async () => {
    await saveFanProfileSection("fan-1", buildProfile(null), {
      kind: "areas",
      value: {
        geo_scope: "ITALY",
        interest_provinces: [],
        interest_regions: [],
      },
    });

    expect(mocks.updates).toHaveLength(0);
    expect(mocks.inserts).toEqual([
      {
        payload: {
          geo_scope: "ITALY",
          interest_provinces: [],
          interest_regions: [],
          profile_id: "fan-1",
        },
        table: "fan_profiles",
      },
    ]);
  });
});
