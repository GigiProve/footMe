/**
 * Payload pubblico del Tifoso (REV-PROF-19, §"Preferenze geografiche e
 * privacy").
 *
 * Il test fissa il contratto: ciò che la RPC non proietta non può arrivare al
 * client, e ciò che arriva viene normalizzato prima di diventare una chip.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchPublicFanProfile } from "./fan-public-profile-service";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("../../../lib/supabase", () => ({
  supabase: { rpc: mocks.rpc },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function rpcRow(overrides: Record<string, unknown> = {}) {
  return {
    favorite_club_id: "club-1",
    favorite_club_logo_url: "https://cdn.test/club-1.png",
    favorite_club_name: "ASD Casteltermini",
    favorite_club_subtitle: "Promozione · Sicilia",
    favorite_team_name: null,
    football_types: ["professional", "amateur"],
    interest_categories: ["Serie B", "Juniores"],
    ...overrides,
  };
}

describe("fetchPublicFanProfile", () => {
  it("chiede il payload pubblico alla RPC dedicata, non alla tabella", async () => {
    mocks.rpc.mockResolvedValue({ data: [rpcRow()], error: null });

    await fetchPublicFanProfile("fan-1");

    expect(mocks.rpc).toHaveBeenCalledWith("fetch_public_fan_profile", {
      target_profile_id: "fan-1",
    });
  });

  it("risolve la squadra del cuore sull'entità canonica", async () => {
    mocks.rpc.mockResolvedValue({ data: [rpcRow()], error: null });

    const result = await fetchPublicFanProfile("fan-1");

    expect(result?.favoriteClub).toEqual({
      id: "club-1",
      logoUrl: "https://cdn.test/club-1.png",
      name: "ASD Casteltermini",
      subtitle: "Promozione · Sicilia",
    });
    expect(result?.legacyFavoriteTeamName).toBeNull();
  });

  it("non espone aree geografiche o preferenze di personalizzazione", async () => {
    mocks.rpc.mockResolvedValue({ data: [rpcRow()], error: null });

    const result = await fetchPublicFanProfile("fan-1");

    expect(Object.keys(result ?? {})).toEqual([
      "favoriteClub",
      "followedCategories",
      "footballTypes",
      "legacyFavoriteTeamName",
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /geo_scope|interest_regions|interest_provinces|birth_date|phone|email/,
    );
  });

  it("tiene il valore legacy testuale solo in assenza di società collegata", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        rpcRow({
          favorite_club_id: null,
          favorite_club_logo_url: null,
          favorite_club_name: null,
          favorite_club_subtitle: null,
          favorite_team_name: "Casteltermini",
        }),
      ],
      error: null,
    });

    const result = await fetchPublicFanProfile("fan-1");

    expect(result?.favoriteClub).toBeNull();
    expect(result?.legacyFavoriteTeamName).toBe("Casteltermini");
  });

  it("deduplica e ripulisce interessi e categorie", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        rpcRow({
          football_types: ["amateur", " amateur ", ""],
          interest_categories: ["Serie B", "serie b", " "],
        }),
      ],
      error: null,
    });

    const result = await fetchPublicFanProfile("fan-1");

    expect(result?.footballTypes).toEqual(["amateur"]);
    expect(result?.followedCategories).toEqual(["Serie B"]);
  });

  it("restituisce null quando il profilo non è disponibile", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });

    await expect(fetchPublicFanProfile("fan-1")).resolves.toBeNull();
  });

  it("propaga l'errore invece di spacciarlo per profilo vuoto", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("offline") });

    await expect(fetchPublicFanProfile("fan-1")).rejects.toThrow("offline");
  });
});
