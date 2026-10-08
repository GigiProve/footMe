/**
 * Riepiloghi dell'hub Modifica profilo Tifoso (REV-PROF-20, schermata 1).
 *
 * Verificano le regole che non possono dipendere dal rendering: la
 * pluralizzazione, il fatto che la squadra si riassuma con la denominazione
 * canonica e non con un valore legacy, e che la riga delle aree porti sempre
 * "Visibile solo a te" senza mai annunciare un toggle pubblico.
 */
import { describe, expect, it } from "vitest";

import type { CompleteProfessionalProfile } from "../profile-service";
import {
  buildFanAreasSummary,
  buildFanCategoriesSummary,
  buildFanFavoriteClubSummary,
  buildFanInterestsSummary,
  buildFanMediaSummary,
  buildFanSectionSummary,
} from "./fan-hub-summaries";

function buildProfile(
  fanProfile: Record<string, unknown> | null,
): CompleteProfessionalProfile {
  return {
    profile: { full_name: "Tifoso Prova", id: "fan-1", role: "fan" },
    ...(fanProfile ? { fanProfile } : { fanProfile: null }),
  } as unknown as CompleteProfessionalProfile;
}

describe("squadra del cuore", () => {
  it("usa la denominazione canonica", () => {
    expect(buildFanFavoriteClubSummary("ASD Prova")).toBe("ASD Prova");
  });

  it("dice Non impostata quando la relazione canonica manca", () => {
    expect(buildFanFavoriteClubSummary(null)).toBe("Non impostata");
    expect(buildFanFavoriteClubSummary("   ")).toBe("Non impostata");
  });

  it("non mostra il valore legacy testuale al posto del nome", () => {
    const summary = buildFanSectionSummary("favoriteClub", {
      favoriteClubName: null,
      mediaCount: 0,
      profile: buildProfile({
        favorite_club_id: null,
        favorite_team_name: "Squadra scritta a mano",
        football_types: [],
        geo_scope: "ITALY",
        interest_categories: [],
        interest_provinces: [],
        interest_regions: [],
      }),
    });

    expect(summary).toBe("Non impostata");
    expect(summary).not.toContain("Squadra scritta a mano");
  });
});

describe("pluralizzazione", () => {
  it("accorda gli interessi al maschile", () => {
    expect(buildFanInterestsSummary(0)).toBe("Nessuno selezionato");
    expect(buildFanInterestsSummary(1)).toBe("1 selezionato");
    expect(buildFanInterestsSummary(3)).toBe("3 selezionati");
  });

  it("accorda le categorie al femminile", () => {
    expect(buildFanCategoriesSummary(0)).toBe("Nessuna selezionata");
    expect(buildFanCategoriesSummary(1)).toBe("1 selezionata");
    expect(buildFanCategoriesSummary(4)).toBe("4 selezionate");
  });

  it("conta i contenuti Media", () => {
    expect(buildFanMediaSummary(0)).toBe("0 contenuti");
    expect(buildFanMediaSummary(1)).toBe("1 contenuto");
    expect(buildFanMediaSummary(9)).toBe("9 contenuti");
  });
});

describe("aree di interesse", () => {
  it("riassume la modalità reale e resta sempre privata", () => {
    expect(
      buildFanAreasSummary({ geoScope: "ITALY", provinceCount: 0, regionCount: 0 }),
    ).toBe("Tutta Italia · Visibile solo a te");

    expect(
      buildFanAreasSummary({ geoScope: "REGIONS", provinceCount: 0, regionCount: 3 }),
    ).toBe("3 regioni · Visibile solo a te");

    expect(
      buildFanAreasSummary({ geoScope: "REGIONS", provinceCount: 0, regionCount: 1 }),
    ).toBe("1 regione · Visibile solo a te");

    expect(
      buildFanAreasSummary({ geoScope: "PROVINCES", provinceCount: 5, regionCount: 0 }),
    ).toBe("5 zone · Visibile solo a te");
  });

  it("non elenca i territori scelti nell'hub", () => {
    const summary = buildFanSectionSummary("areas", {
      favoriteClubName: null,
      mediaCount: null,
      profile: buildProfile({
        favorite_club_id: null,
        football_types: [],
        geo_scope: "REGIONS",
        interest_categories: [],
        interest_provinces: [],
        interest_regions: ["Campania", "Emilia-Romagna", "Sicilia"],
      }),
    });

    expect(summary).toBe("3 regioni · Visibile solo a te");
    expect(summary).not.toContain("Sicilia");
  });
});

describe("riepilogo per sezione", () => {
  it("legge i conteggi dal profilo reale", () => {
    const profile = buildProfile({
      favorite_club_id: "club-1",
      football_types: ["professional", "amateur"],
      geo_scope: "ITALY",
      interest_categories: ["Serie B", "Promozione", "Juniores"],
      interest_provinces: [],
      interest_regions: [],
    });

    expect(
      buildFanSectionSummary("interests", {
        favoriteClubName: "ASD Prova",
        mediaCount: 2,
        profile,
      }),
    ).toBe("2 selezionati");

    expect(
      buildFanSectionSummary("categories", {
        favoriteClubName: "ASD Prova",
        mediaCount: 2,
        profile,
      }),
    ).toBe("3 selezionate");

    expect(
      buildFanSectionSummary("media", {
        favoriteClubName: "ASD Prova",
        mediaCount: 2,
        profile,
      }),
    ).toBe("2 contenuti");
  });

  it("lascia la riga Media senza riepilogo finché il conteggio non arriva", () => {
    expect(
      buildFanSectionSummary("media", {
        favoriteClubName: null,
        mediaCount: null,
        profile: buildProfile(null),
      }),
    ).toBeUndefined();
  });

  it("non inventa valori quando le preferenze non esistono ancora", () => {
    const profile = buildProfile(null);

    expect(
      buildFanSectionSummary("interests", {
        favoriteClubName: null,
        mediaCount: 0,
        profile,
      }),
    ).toBe("Nessuno selezionato");

    expect(
      buildFanSectionSummary("areas", {
        favoriteClubName: null,
        mediaCount: 0,
        profile,
      }),
    ).toBe("Tutta Italia · Visibile solo a te");
  });

  it("lascia il sottotitolo fisso alle voci che non hanno un conteggio", () => {
    expect(
      buildFanSectionSummary("personal", {
        favoriteClubName: null,
        mediaCount: 0,
        profile: buildProfile(null),
      }),
    ).toBeUndefined();
  });
});
