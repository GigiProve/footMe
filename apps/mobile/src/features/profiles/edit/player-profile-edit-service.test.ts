/**
 * §AA — persistenza per sezione.
 *
 * Qui si difendono le due trappole del salvataggio parziale:
 *
 *  - `save_player_profile_details` CANCELLA le esperienze che non trova nel
 *    payload, quindi una sezione che non c'entra con la carriera deve comunque
 *    riscriverla identica;
 *  - `buildFullUpdatePayload` lascia `birth_date` a `null` aspettando che sia
 *    il chiamante a reimpostarla.
 *
 * Più il bug per cui ogni salvataggio azzerava TikTok, YouTube e sito web.
 */
import { describe, expect, it } from "vitest";

import type { CompleteProfessionalProfile } from "../profile-service";
import { buildPlayerSectionPayload } from "./player-profile-edit-service";

function buildProfile(
  overrides: Partial<CompleteProfessionalProfile> = {},
): CompleteProfessionalProfile {
  return {
    clubSeasonEntries: [],
    coachCareerEntries: [],
    coachDirectorCareerEntries: [],
    coachPlayerCareerEntries: [],
    playerCareerEntries: [
      {
        appearances: 12,
        assists: null,
        awards: "",
        career_type: "MULTI_SEASON",
        club_id: null,
        club_name: "ASD Romano Prodi",
        competition_name: "Serie A",
        experience_group_id: "exp-a",
        goals: 4,
        id: "row-1",
        minutes_played: null,
        period_end_month: null,
        period_start_month: null,
        season_label: "2024/2025",
        season_period: "full",
        sort_order: 0,
        team_logo_url: null,
      },
    ],
    playerPalmares: [],
    playerProfile: {
      availability_type: "REGIONS",
      contract_expiry: null,
      contract_status: "tesserato",
      current_condition: null,
      height_cm: 186,
      highlight_video_url: null,
      media_items: [],
      media_urls: [],
      open_to_trials: false,
      player_objectives: [],
      preferred_categories: [],
      preferred_foot: "right",
      primary_position: "striker",
      profile_id: "profile-1",
      secondary_positions: ["right_winger"],
      show_regions_badge: false,
      show_transfer_badge: false,
      transfer_provinces: [],
      transfer_regions: ["Lazio"],
      weight_kg: 80,
      willing_to_change_club: true,
    },
    profile: {
      avatar_url: "https://example.com/a.jpg",
      birth_date: "1999-04-12",
      city: "Roma",
      cover_url: "https://example.com/cover.jpg",
      full_name: "Salvo Salvini",
      id: "profile-1",
      is_open_to_transfer: true,
      languages: [],
      nationality: "IT",
      region: "Lazio",
      residence: "Roma",
      role: "player",
    },
    userContacts: {
      email: "salvo@example.com",
      facebook: "",
      instagram: "salvosalvini_9",
      phone: "+39 345 678 9012",
      showEmail: true,
      showFacebook: false,
      showInstagram: true,
      showTikTok: true,
      showWebsite: true,
      showYouTube: false,
      tiktok: "https://www.tiktok.com/@salvo",
      website: "https://salvo.example.com",
      youtube: "https://www.youtube.com/@salvo",
    },
    ...overrides,
  } as unknown as CompleteProfessionalProfile;
}

describe("buildPlayerSectionPayload", () => {
  it("non cancella la carriera quando si salva un'altra sezione", () => {
    const data = buildProfile();

    const payload = buildPlayerSectionPayload(data, {
      contractStatus: "svincolato",
    });

    expect(payload.playerCareerEntries).toHaveLength(1);
    expect(payload.playerCareerEntries[0]?.club_name).toBe("ASD Romano Prodi");
    expect(payload.playerProfile?.contract_status).toBe("svincolato");
  });

  it("non azzera la data di nascita", () => {
    const payload = buildPlayerSectionPayload(buildProfile(), {
      preferredFoot: "left",
    });

    expect(payload.profile.birth_date).toBe("1999-04-12");
  });

  it("lascia intatte le sezioni che non sono nel patch", () => {
    const payload = buildPlayerSectionPayload(buildProfile(), {
      primaryPosition: "goalkeeper",
    });

    expect(payload.playerProfile?.primary_position).toBe("goalkeeper");
    // Disponibilità, contatti e misure restano quelli di partenza.
    expect(payload.playerProfile?.transfer_regions).toEqual(["Lazio"]);
    expect(payload.playerProfile?.height_cm).toBe(186);
    expect(payload.userContacts.email).toBe("salvo@example.com");
  });

  it("conserva TikTok, YouTube e sito web, che prima venivano azzerati", () => {
    const payload = buildPlayerSectionPayload(buildProfile(), {
      fullName: "Salvo Salvini",
    });

    expect(payload.userContacts.tiktok).toBe("https://www.tiktok.com/@salvo");
    expect(payload.userContacts.youtube).toBe("https://www.youtube.com/@salvo");
    expect(payload.userContacts.website).toBe("https://salvo.example.com");
    expect(payload.userContacts.showTikTok).toBe(true);
    expect(payload.userContacts.showWebsite).toBe(true);
    expect(payload.userContacts.showYouTube).toBe(false);
  });

  it("scrive la copertina, che prima era di sola lettura", () => {
    const payload = buildPlayerSectionPayload(buildProfile(), {
      coverUrl: "https://example.com/nuova-cover.jpg",
    });

    expect(payload.profile.cover_url).toBe(
      "https://example.com/nuova-cover.jpg",
    );
  });

  it("tocca il palmarès solo quando il patch lo contiene", () => {
    expect(
      buildPlayerSectionPayload(buildProfile(), { contractStatus: "" })
        .playerPalmares,
    ).toBeUndefined();

    expect(
      buildPlayerSectionPayload(buildProfile(), {
        playerPalmares: [
          {
            club_name: "ASD Romano Prodi",
            competition_name: "Coppa Italia Dilettanti",
            id: "",
            palmares_type: "trophy",
            season_label: "2022/2023",
            sort_order: 0,
          },
        ],
      }).playerPalmares,
    ).toHaveLength(1);
  });
});
