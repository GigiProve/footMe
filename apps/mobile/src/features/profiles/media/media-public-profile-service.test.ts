/**
 * Payload pubblico del Master Profile Media/Creator (REV-PROF-21,
 * §"Contratto pubblico del profilo" e §"Test privacy").
 *
 * Il test fissa il contratto: owner e visitor passano dalla stessa porta, le
 * capabilities arrivano dal backend, e i dati personali del proprietario non
 * hanno un campo dove finire — nemmeno se la RPC li mandasse per errore.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchPublicMediaProfile } from "./media-public-profile-service";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("../../../lib/supabase", () => ({
  supabase: { rpc: mocks.rpc },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function payload(overrides: Record<string, unknown> = {}) {
  return {
    entity: {
      affiliation_type: null,
      channels: [
        { channel_type: "website", label: null, url: "tuttodilettanti.it" },
        { channel_type: "instagram", label: null, url: "instagram.com/td" },
      ],
      content_types: ["Notizie", "Interviste"],
      cover_url: "https://cdn.test/cover.jpg",
      covered_competitions: ["Serie D"],
      covered_teams: [],
      covered_territories: ["Lombardia", "Piemonte"],
      covered_topics: [],
      creator_type: "news_outlet",
      creator_type_other: null,
      editorial_type: null,
      entity_name: "TuttoDilettanti",
      focus_areas: ["Calcio dilettantistico"],
      logo_url: "https://cdn.test/logo.png",
      profile_id: "media-1",
      short_description: "Notizie e storie del calcio dilettantistico.",
      verification_status: "verified",
      website_url: "https://tuttodilettanti.it",
    },
    viewer: {
      can_add_media: false,
      can_block: true,
      can_create_tribuna_content: false,
      can_edit_profile: false,
      can_follow: true,
      can_manage_tribuna_content: false,
      can_message: true,
      can_publish_article: false,
      can_report: true,
      can_share: true,
      can_view_website: true,
      is_following: false,
      mode: "visitor",
    },
    ...overrides,
  };
}

describe("fetchPublicMediaProfile", () => {
  it("chiede il payload alla RPC dedicata, non alle tabelle", async () => {
    mocks.rpc.mockResolvedValue({ data: payload(), error: null });

    await fetchPublicMediaProfile("media-1");

    expect(mocks.rpc).toHaveBeenCalledWith("fetch_public_media_profile", {
      p_profile_id: "media-1",
    });
  });

  it("normalizza l'identità editoriale pubblica", async () => {
    mocks.rpc.mockResolvedValue({ data: payload(), error: null });

    const result = await fetchPublicMediaProfile("media-1");

    expect(result?.entity.entityName).toBe("TuttoDilettanti");
    expect(result?.entity.creatorType).toBe("news_outlet");
    expect(result?.entity.focusAreas).toEqual(["Calcio dilettantistico"]);
    expect(result?.entity.contentTypes).toEqual(["Notizie", "Interviste"]);
    expect(result?.entity.coveredTerritories).toEqual([
      "Lombardia",
      "Piemonte",
    ]);
    expect(result?.entity.isVerified).toBe(true);
  });

  it("espone le capabilities calcolate dal backend", async () => {
    mocks.rpc.mockResolvedValue({ data: payload(), error: null });

    const result = await fetchPublicMediaProfile("media-1");

    expect(result?.mode).toBe("visitor");
    expect(result?.capabilities.canFollow).toBe(true);
    expect(result?.capabilities.canMessage).toBe(true);
    expect(result?.capabilities.canEditProfile).toBe(false);
    expect(result?.capabilities.canPublishArticle).toBe(false);
  });

  it("riconosce l'Owner dalla modalità restituita, non dalla route", async () => {
    mocks.rpc.mockResolvedValue({
      data: payload({
        viewer: {
          can_add_media: true,
          can_create_tribuna_content: true,
          can_edit_profile: true,
          can_publish_article: true,
          can_share: true,
          can_view_website: true,
          mode: "owner",
        },
      }),
      error: null,
    });

    const result = await fetchPublicMediaProfile("media-1");

    expect(result?.mode).toBe("owner");
    expect(result?.capabilities.canEditProfile).toBe(true);
    expect(result?.capabilities.canFollow).toBe(false);
  });

  it("il payload non contiene dati personali del proprietario", async () => {
    mocks.rpc.mockResolvedValue({
      data: payload({
        entity: {
          ...payload().entity,
          // Anche se il backend li mandasse, non esiste un campo dove
          // possano arrivare: il mapping è una proiezione esplicita.
          birth_date: "1990-01-01",
          email: "owner@example.com",
          full_name: "Luigi Provenzano",
          nationality: "IT",
          phone: "+39 333 1234567",
          region: "Lombardia",
          residence_city: "Milano",
        },
      }),
      error: null,
    });

    const result = await fetchPublicMediaProfile("media-1");
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("Luigi Provenzano");
    expect(serialized).not.toContain("owner@example.com");
    expect(serialized).not.toContain("1990-01-01");
    expect(serialized).not.toContain("333 1234567");
    expect(serialized).not.toContain("Milano");
    expect(Object.keys(result?.entity ?? {}).sort()).toEqual([
      "affiliationType",
      "channels",
      "contentTypes",
      /*
        REV-PROF-22: modalità e zone della copertura editoriale. Sono
        dichiarazioni della realtà, non dati di chi la amministra: la
        residenza del proprietario resta fuori da questo elenco.
      */
      "coverUrl",
      "coverageScope",
      "coveredCompetitions",
      "coveredProvinces",
      "coveredTeams",
      "coveredTerritories",
      "coveredTopics",
      "creatorType",
      "creatorTypeOther",
      "editorialType",
      "entityName",
      "focusAreas",
      "isVerified",
      "logoUrl",
      "profileId",
      "shortDescription",
      "websiteUrl",
    ]);
  });

  it("non inventa un nome editoriale da una stringa vuota", async () => {
    mocks.rpc.mockResolvedValue({
      data: payload({
        entity: { ...payload().entity, entity_name: "   ", logo_url: null },
      }),
      error: null,
    });

    const result = await fetchPublicMediaProfile("media-1");

    expect(result?.entity.entityName).toBeNull();
    expect(result?.entity.logoUrl).toBeNull();
  });

  it("scarta i canali senza tipo o senza URL", async () => {
    mocks.rpc.mockResolvedValue({
      data: payload({
        entity: {
          ...payload().entity,
          channels: [
            { channel_type: "website", label: null, url: "tuttodilettanti.it" },
            { channel_type: null, label: null, url: "x.com/td" },
            { channel_type: "tiktok", label: null, url: null },
          ],
        },
      }),
      error: null,
    });

    const result = await fetchPublicMediaProfile("media-1");

    expect(result?.entity.channels).toEqual([
      { channelType: "website", label: null, url: "tuttodilettanti.it" },
    ]);
  });

  it("restituisce null quando il profilo non è disponibile", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });

    await expect(fetchPublicMediaProfile("media-1")).resolves.toBeNull();
  });

  it("propaga l'errore invece di mostrare un profilo vuoto", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("boom") });

    await expect(fetchPublicMediaProfile("media-1")).rejects.toThrow("boom");
  });
});
