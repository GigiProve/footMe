import { beforeEach, describe, expect, it, vi } from "vitest";

import { updateCompleteProfessionalProfile } from "./profile-service";

const mocks = vi.hoisted(() => {
  const profileUpdateEqMock = vi.fn();
  const profileUpdateMaybeSingleMock = vi.fn();
  const profileContactsUpsertMock = vi.fn();
  const privateContactsUpsertMock = vi.fn();
  const rpcMock = vi.fn();
  const agentProfilesUpsertMock = vi.fn();
  const directorProfilesUpsertMock = vi.fn();
  const fanProfilesUpsertMock = vi.fn();
  const mediaProfilesUpsertMock = vi.fn();
  const staffProfilesUpsertMock = vi.fn();

  return {
    agentProfilesUpsertMock,
    directorProfilesUpsertMock,
    fanProfilesUpsertMock,
    mediaProfilesUpsertMock,
    privateContactsUpsertMock,
    profileContactsUpsertMock,
    profileUpdateEqMock,
    profileUpdateMaybeSingleMock,
    rpcMock,
    staffProfilesUpsertMock,
    fromMock: vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          update: vi.fn(() => ({
            eq: vi.fn((...args: unknown[]) => {
              profileUpdateEqMock(...args);

              return {
                select: vi.fn(() => ({
                  maybeSingle: profileUpdateMaybeSingleMock,
                })),
              };
            }),
          })),
        };
      }

      if (table === "profile_contacts") {
        return {
          upsert: profileContactsUpsertMock,
        };
      }

      if (table === "profile_private_contacts") {
        return {
          upsert: privateContactsUpsertMock,
        };
      }

      if (table === "staff_profiles") {
        return {
          upsert: staffProfilesUpsertMock,
        };
      }

      if (table === "agent_profiles") {
        return {
          upsert: agentProfilesUpsertMock,
        };
      }

      if (table === "director_profiles") {
        return {
          upsert: directorProfilesUpsertMock,
        };
      }

      if (table === "fan_profiles") {
        return {
          upsert: fanProfilesUpsertMock,
        };
      }

      if (table === "media_profiles") {
        return {
          upsert: mediaProfilesUpsertMock,
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };
});

vi.mock("../../lib/supabase", () => ({
  supabase: {
    from: mocks.fromMock,
    rpc: mocks.rpcMock,
  },
}));

function buildUpdateInput() {
  return {
    club: null,
    clubSeasonEntries: [],
    coachProfile: null,
    playerCareerEntries: [],
    playerProfile: {
      height_cm: 180,
      highlight_video_url: null,
      media_items: [],
      media_urls: [],
      preferred_categories: ["Promozione"],
      preferred_foot: "right" as const,
      primary_position: "striker" as const,
      secondary_positions: [],
      availability_type: "REGIONS",
      transfer_provinces: [],
      transfer_regions: ["Umbria"],
      weight_kg: 75,
      willing_to_change_club: true,
    },
    profile: {
      avatar_url: null,
      bio: "Attaccante rapido",
      birth_date: "2000-01-01",
      city: "Perugia",
      full_name: "Marco Rossi",
      is_open_to_transfer: true,
      languages: [],
      nationality: "IT",
      region: "Umbria",
    },
    profileId: "profile-1",
    role: "player" as const,
    staffProfile: null,
    userContacts: {
      email: "marco@example.com",
      facebook: "",
      instagram: "",
      phone: "+393331234567",
      showEmail: true,
      showFacebook: false,
      showInstagram: false,
    },
  };
}

describe("updateCompleteProfessionalProfile player experiences", () => {
  beforeEach(() => {
    mocks.fromMock.mockClear();
    mocks.profileUpdateEqMock.mockReset();
    mocks.profileUpdateMaybeSingleMock.mockReset();
    mocks.profileContactsUpsertMock.mockReset();
    mocks.privateContactsUpsertMock.mockReset();
    mocks.rpcMock.mockReset();
    mocks.agentProfilesUpsertMock.mockReset();
    mocks.directorProfilesUpsertMock.mockReset();
    mocks.fanProfilesUpsertMock.mockReset();
    mocks.mediaProfilesUpsertMock.mockReset();
    mocks.staffProfilesUpsertMock.mockReset();

    mocks.profileUpdateMaybeSingleMock.mockResolvedValue({
      data: { id: "profile-1" },
      error: null,
    });
    mocks.profileContactsUpsertMock.mockResolvedValue({ error: null });
    mocks.privateContactsUpsertMock.mockResolvedValue({ error: null });
    mocks.rpcMock.mockResolvedValue({ error: null });
    mocks.agentProfilesUpsertMock.mockResolvedValue({ error: null });
    mocks.directorProfilesUpsertMock.mockResolvedValue({ error: null });
    mocks.fanProfilesUpsertMock.mockResolvedValue({ error: null });
    mocks.mediaProfilesUpsertMock.mockResolvedValue({ error: null });
    mocks.staffProfilesUpsertMock.mockResolvedValue({ error: null });
  });

  it("persists player profile data and experiences through the atomic rpc", async () => {
    await updateCompleteProfessionalProfile({
      ...buildUpdateInput(),
      playerCareerEntries: [
        {
          appearances: 24,
          assists: 7,
          awards: "Capocannoniere",
          club_id: "club-1",
          club_name: "ASD Real Milano",
          competition_name: "Eccellenza",
          goals: 11,
          id: "experience-1",
          minutes_played: 2010,
          period_end_month: null,
          period_start_month: null,
          season_label: "2024/2025",
          season_period: "full",
          sort_order: 0,
          team_logo_url: "https://example.com/updated-logo.png",
        },
        {
          appearances: 12,
          assists: 4,
          awards: null,
          club_id: null,
          club_name: "USD Perugia Sud",
          competition_name: "Promozione",
          goals: 5,
          minutes_played: 900,
          period_end_month: null,
          period_start_month: null,
          season_label: "2023/2024",
          season_period: "full",
          sort_order: 1,
          team_logo_url: "https://example.com/perugia.png",
        },
      ],
    });

    expect(mocks.rpcMock).toHaveBeenCalledWith("save_player_profile_details", {
      p_career_entries: [
        {
          appearances: 24,
          assists: 7,
          awards: "Capocannoniere",
          club_id: "club-1",
          club_name: "ASD Real Milano",
          competition_name: "Eccellenza",
          goals: 11,
          id: "experience-1",
          minutes_played: 2010,
          period_end_month: null,
          period_start_month: null,
          season_label: "2024/2025",
          season_period: "full",
          sort_order: 0,
          team_logo_url: "https://example.com/updated-logo.png",
        },
        {
          appearances: 12,
          assists: 4,
          awards: null,
          club_id: null,
          club_name: "USD Perugia Sud",
          competition_name: "Promozione",
          goals: 5,
          minutes_played: 900,
          period_end_month: null,
          period_start_month: null,
          season_label: "2023/2024",
          season_period: "full",
          sort_order: 1,
          team_logo_url: "https://example.com/perugia.png",
        },
      ],
      p_player_profile: {
        availability_type: "REGIONS",
        height_cm: 180,
        highlight_video_url: null,
        media_items: [],
        media_urls: [],
        preferred_categories: ["Promozione"],
        preferred_foot: "right",
        primary_position: "striker",
        secondary_positions: [],
        transfer_provinces: [],
        transfer_regions: ["Umbria"],
        weight_kg: 75,
        willing_to_change_club: true,
      },
      p_profile_id: "profile-1",
    });
  });

  it("omits ids for brand new experiences in the rpc payload", async () => {
    await updateCompleteProfessionalProfile({
      ...buildUpdateInput(),
      playerCareerEntries: [
        {
          appearances: 18,
          assists: 3,
          awards: null,
          club_id: "club-1",
          club_name: "ASD Real Milano",
          competition_name: "Promozione",
          goals: 6,
          minutes_played: 1440,
          period_end_month: null,
          period_start_month: null,
          season_label: "2024/2025",
          season_period: "full",
          sort_order: 0,
          team_logo_url: "https://example.com/logo.png",
        },
      ],
    });

    expect(mocks.rpcMock).toHaveBeenCalledWith("save_player_profile_details", {
      p_career_entries: [
        {
          appearances: 18,
          assists: 3,
          awards: null,
          club_id: "club-1",
          club_name: "ASD Real Milano",
          competition_name: "Promozione",
          goals: 6,
          minutes_played: 1440,
          period_end_month: null,
          period_start_month: null,
          season_label: "2024/2025",
          season_period: "full",
          sort_order: 0,
          team_logo_url: "https://example.com/logo.png",
        },
      ],
      p_player_profile: {
        availability_type: "REGIONS",
        height_cm: 180,
        highlight_video_url: null,
        media_items: [],
        media_urls: [],
        preferred_categories: ["Promozione"],
        preferred_foot: "right",
        primary_position: "striker",
        secondary_positions: [],
        transfer_provinces: [],
        transfer_regions: ["Umbria"],
        weight_kg: 75,
        willing_to_change_club: true,
      },
      p_profile_id: "profile-1",
    });
  });

  it("persists staff roles, primary role and separate experience entries", async () => {
    await updateCompleteProfessionalProfile({
      ...buildUpdateInput(),
      playerCareerEntries: [],
      playerProfile: null,
      role: "staff",
      staffProfile: {
        availability_type: "REGIONS",
        available_from: "Da luglio",
        certifications: ["FIGC Match Analysis"],
        experience_entries: [
          {
            id: "staff-exp-1",
            category: "Serie D",
            role: "Match analyst",
            seasons: ["2024/2025"],
            teamName: "USD Virtus",
            type: "SINGLE_SEASON",
            period: null,
          },
          {
            id: "staff-exp-2",
            category: "Primavera 2",
            role: "Collaboratore tecnico",
            seasons: [],
            teamName: "USD Virtus",
            type: "CUSTOM_PERIOD",
            period: {
              startMonth: "Gennaio",
              startYear: "2024",
              endMonth: "Maggio",
              endYear: "2024",
            },
          },
        ],
        experience_summary: "Analisi video e supporto in campo.",
        open_to_work: true,
        primary_staff_role: "Match analyst",
        preferred_categories: ["Serie D", "Primavera 2"],
        preferred_provinces: [],
        preferred_regions: ["Lombardia"],
        specialization: "match_analyst",
        staff_roles: ["Match analyst", "Collaboratore tecnico"],
      },
    });

    expect(mocks.staffProfilesUpsertMock).toHaveBeenCalledWith({
      availability_type: "REGIONS",
      available_from: "Da luglio",
      certifications: ["FIGC Match Analysis"],
      experience_entries: [
        {
          id: "staff-exp-1",
          category: "Serie D",
          role: "Match analyst",
          seasons: ["2024/2025"],
          teamName: "USD Virtus",
          type: "SINGLE_SEASON",
          period: null,
        },
        {
          id: "staff-exp-2",
          category: "Primavera 2",
          role: "Collaboratore tecnico",
          seasons: [],
          teamName: "USD Virtus",
          type: "CUSTOM_PERIOD",
          period: {
            startMonth: "Gennaio",
            startYear: "2024",
            endMonth: "Maggio",
            endYear: "2024",
          },
        },
      ],
      experience_summary: "Analisi video e supporto in campo.",
      open_to_work: true,
      preferred_regions: ["Lombardia"],
      primary_staff_role: "Match analyst",
      preferred_categories: ["Serie D", "Primavera 2"],
      preferred_provinces: [],
      profile_id: "profile-1",
      specialization: "match_analyst",
      staff_roles: ["Match analyst", "Collaboratore tecnico"],
    });
  });

  it("persists agent-specific onboarding data in agent_profiles", async () => {
    await updateCompleteProfessionalProfile({
      ...buildUpdateInput(),
      agentProfile: {
        agency_logo_url: "https://example.com/agency.png",
        agency_name: "MB Football Management",
        federation: "FIGC (Italia)",
        has_other_football_experience: true,
        has_played_football: true,
        is_federation_licensed: true,
        main_player_roles: ["defender", "midfielder"],
        managed_players_count: "5-15 calciatori",
        open_to_clubs: true,
        open_to_players: false,
        other_football_roles: ["Ex calciatore", "Scout"],
        player_career_entries: [
          {
            id: "agent-player-exp-1",
            category: "Serie D",
            teamName: "ASD Test",
            seasons: ["2020/2021"],
            type: "FIRST_TEAM",
          },
        ],
        player_types: ["Giovani", "Senior"],
      },
      playerCareerEntries: [],
      playerProfile: null,
      role: "agent",
      staffProfile: null,
    });

    expect(mocks.agentProfilesUpsertMock).toHaveBeenCalledWith({
      agency_logo_url: "https://example.com/agency.png",
      agency_name: "MB Football Management",
      federation: "FIGC (Italia)",
      has_other_football_experience: true,
      has_played_football: true,
      is_federation_licensed: true,
      main_player_roles: ["defender", "midfielder"],
      managed_players_count: "5-15 calciatori",
      open_to_clubs: true,
      open_to_players: false,
      other_football_roles: ["Ex calciatore", "Scout"],
      player_career_entries: [
        {
          id: "agent-player-exp-1",
          category: "Serie D",
          teamName: "ASD Test",
          seasons: ["2020/2021"],
          type: "FIRST_TEAM",
        },
      ],
      player_types: ["Giovani", "Senior"],
      profile_id: "profile-1",
    });
  });

  it("persists fan interests in fan_profiles", async () => {
    await updateCompleteProfessionalProfile({
      ...buildUpdateInput(),
      fanProfile: {
        interest_categories: ["dilettanti", "mercato"],
        interest_regions: ["Umbria", "Toscana"],
      },
      playerCareerEntries: [],
      playerProfile: null,
      role: "fan",
      staffProfile: null,
    });

    expect(mocks.fanProfilesUpsertMock).toHaveBeenCalledWith({
      interest_categories: ["dilettanti", "mercato"],
      interest_regions: ["Umbria", "Toscana"],
      profile_id: "profile-1",
    });
  });

  it("persists media profile details and social channels", async () => {
    await updateCompleteProfessionalProfile({
      ...buildUpdateInput(),
      mediaProfile: {
        affiliation_name: "ASD Test",
        affiliation_type: "Società sportiva",
        content_types: ["Notizie", "Video"],
        entity_name: "TuttoDilettanti",
        focus_areas: ["Calcio locale", "Mercato"],
        logo_url: "https://example.com/logo.png",
        short_description: "Pagina dedicata al calcio regionale.",
      },
      playerCareerEntries: [],
      playerProfile: null,
      role: "media",
      staffProfile: null,
      userContacts: {
        ...buildUpdateInput().userContacts,
        facebook: "https://facebook.com/tuttodilettanti",
        instagram: "https://instagram.com/tuttodilettanti",
        showFacebook: true,
        showInstagram: true,
        showTikTok: true,
        showWebsite: true,
        showYouTube: true,
        tiktok: "https://tiktok.com/@tuttodilettanti",
        website: "https://tuttodilettanti.it",
        youtube: "https://youtube.com/@tuttodilettanti",
      },
    });

    expect(mocks.mediaProfilesUpsertMock).toHaveBeenCalledWith({
      affiliation_name: "ASD Test",
      affiliation_type: "Società sportiva",
      content_types: ["Notizie", "Video"],
      entity_name: "TuttoDilettanti",
      focus_areas: ["Calcio locale", "Mercato"],
      logo_url: "https://example.com/logo.png",
      profile_id: "profile-1",
      short_description: "Pagina dedicata al calcio regionale.",
    });

    expect(mocks.profileContactsUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tiktok: "https://tiktok.com/@tuttodilettanti",
        website: "https://tuttodilettanti.it",
        youtube: "https://youtube.com/@tuttodilettanti",
        show_tiktok: true,
        show_website: true,
        show_youtube: true,
      }),
    );
  });
});
