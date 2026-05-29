import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCompleteProfessionalProfile, searchTeams } from "./profile-service";

const mocks = vi.hoisted(() => {
  const clubMaybeSingleMock = vi.fn();
  const coachMaybeSingleMock = vi.fn();
  const directorMaybeSingleMock = vi.fn();
  const mediaMaybeSingleMock = vi.fn();
  const mediaAuthorsResultMock = vi.fn();
  const mediaChannelsResultMock = vi.fn();
  const mediaContactsResultMock = vi.fn();
  const mediaVerificationsResultMock = vi.fn();
  const playerCareerEqMock = vi.fn();
  const playerCareerFirstOrderMock = vi.fn();
  const playerCareerSecondOrderMock = vi.fn();
  const playerPalmaresEqMock = vi.fn();
  const playerPalmaresOrderMock = vi.fn();
  const playerMaybeSingleMock = vi.fn();
  const profileContactsMaybeSingleMock = vi.fn();
  const privateContactsMaybeSingleMock = vi.fn();
  const profileMaybeSingleMock = vi.fn();
  const rpcMock = vi.fn();
  const staffMaybeSingleMock = vi.fn();

  const playerCareerSecondOrderChain = {
    order: playerCareerSecondOrderMock,
  };
  const playerCareerFirstOrderChain = {
    order: playerCareerFirstOrderMock,
  };
  function createMediaListBuilder(resultMock: () => unknown) {
    const builder = {
      eq: vi.fn(() => builder),
      order: vi.fn(() => builder),
      then: (
        resolve: (value: unknown) => unknown,
        reject: (reason: unknown) => unknown,
      ) => Promise.resolve(resultMock()).then(resolve, reject),
    };

    return {
      select: vi.fn(() => builder),
    };
  }

  return {
    clubMaybeSingleMock,
    coachMaybeSingleMock,
    directorMaybeSingleMock,
    fromMock: vi.fn((table: string) => {
      if (table === "profiles_with_age") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: profileMaybeSingleMock,
            })),
          })),
        };
      }

      if (table === "player_profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: playerMaybeSingleMock,
            })),
          })),
        };
      }

      if (table === "coach_profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: coachMaybeSingleMock,
            })),
          })),
        };
      }

      if (table === "staff_profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: staffMaybeSingleMock,
            })),
          })),
        };
      }

      if (table === "director_profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: directorMaybeSingleMock,
            })),
          })),
        };
      }

      if (table === "media_profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: mediaMaybeSingleMock,
            })),
          })),
        };
      }

      if (table === "media_profile_channels") {
        return createMediaListBuilder(mediaChannelsResultMock);
      }

      if (table === "media_profile_authors") {
        return createMediaListBuilder(mediaAuthorsResultMock);
      }

      if (table === "media_profile_contacts") {
        return createMediaListBuilder(mediaContactsResultMock);
      }

      if (table === "media_profile_verifications") {
        return createMediaListBuilder(mediaVerificationsResultMock);
      }

      if (table === "clubs") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: clubMaybeSingleMock,
            })),
          })),
        };
      }

      if (table === "player_career_entries") {
        return {
          select: vi.fn(() => ({
            eq: playerCareerEqMock,
          })),
        };
      }

      if (table === "player_palmares") {
        return {
          select: vi.fn(() => ({
            eq: playerPalmaresEqMock,
          })),
        };
      }

      if (table === "club_season_entries") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                data: [],
                error: null,
              })),
            })),
          })),
        };
      }

      if (table === "profile_contacts") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: profileContactsMaybeSingleMock,
            })),
          })),
        };
      }

      if (table === "profile_private_contacts") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: privateContactsMaybeSingleMock,
            })),
          })),
        };
      }

      if (
        table === "staff_career_entries" ||
        table === "staff_coach_career_entries" ||
        table === "staff_player_career_entries"
      ) {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                data: [],
                error: null,
              })),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
    playerCareerEqMock,
    playerCareerFirstOrderChain,
    playerCareerFirstOrderMock,
    playerCareerSecondOrderChain,
    playerCareerSecondOrderMock,
    playerPalmaresEqMock,
    playerPalmaresOrderMock,
    mediaMaybeSingleMock,
    mediaAuthorsResultMock,
    mediaChannelsResultMock,
    mediaContactsResultMock,
    mediaVerificationsResultMock,
    playerMaybeSingleMock,
    privateContactsMaybeSingleMock,
    profileContactsMaybeSingleMock,
    profileMaybeSingleMock,
    rpcMock,
    staffMaybeSingleMock,
  };
});

vi.mock("../../lib/supabase", () => ({
  supabase: {
    from: mocks.fromMock,
    rpc: mocks.rpcMock,
  },
}));

describe("getCompleteProfessionalProfile", () => {
  beforeEach(() => {
    mocks.fromMock.mockClear();
    mocks.profileMaybeSingleMock.mockReset();
    mocks.playerMaybeSingleMock.mockReset();
    mocks.coachMaybeSingleMock.mockReset();
    mocks.directorMaybeSingleMock.mockReset();
    mocks.mediaMaybeSingleMock.mockReset();
    mocks.mediaAuthorsResultMock.mockReset();
    mocks.mediaChannelsResultMock.mockReset();
    mocks.mediaContactsResultMock.mockReset();
    mocks.mediaVerificationsResultMock.mockReset();
    mocks.staffMaybeSingleMock.mockReset();
    mocks.clubMaybeSingleMock.mockReset();
    mocks.rpcMock.mockReset();
    mocks.profileContactsMaybeSingleMock.mockReset();
    mocks.privateContactsMaybeSingleMock.mockReset();
    mocks.playerCareerEqMock.mockReset();
    mocks.playerCareerFirstOrderMock.mockReset();
    mocks.playerCareerSecondOrderMock.mockReset();
    mocks.playerPalmaresEqMock.mockReset();
    mocks.playerPalmaresOrderMock.mockReset();

    mocks.profileMaybeSingleMock.mockResolvedValue({
      data: {
        avatar_url: null,
        bio: null,
        birth_date: null,
        age: null,
        city: "Perugia",
        full_name: "Marco Rossi",
        id: "profile-1",
        is_open_to_transfer: true,
        nationality: "IT",
        region: "Umbria",
        role: "player",
      },
      error: null,
    });
    mocks.playerMaybeSingleMock.mockResolvedValue({
      data: {
        height_cm: 180,
        highlight_video_url: null,
        media_items: [],
        media_urls: [],
        preferred_categories: ["Promozione"],
        preferred_foot: "right",
        primary_position: "forward",
        profile_id: "profile-1",
        secondary_positions: ["left_winger", "right_winger"],
        transfer_regions: ["Umbria"],
        weight_kg: 75,
        willing_to_change_club: true,
      },
      error: null,
    });
    mocks.coachMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    mocks.directorMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    mocks.mediaMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    mocks.mediaAuthorsResultMock.mockReturnValue({ data: [], error: null });
    mocks.mediaChannelsResultMock.mockReturnValue({ data: [], error: null });
    mocks.mediaContactsResultMock.mockReturnValue({ data: [], error: null });
    mocks.mediaVerificationsResultMock.mockReturnValue({ data: [], error: null });
    mocks.staffMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    mocks.clubMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    mocks.profileContactsMaybeSingleMock.mockResolvedValue({
      data: {
        email: "marco@example.com",
        facebook: "https://facebook.com/marcorossi",
        instagram: "https://instagram.com/marcorossi",
        show_email: true,
        show_facebook: false,
        show_instagram: true,
      },
      error: null,
    });
    mocks.privateContactsMaybeSingleMock.mockResolvedValue({
      data: {
        phone: "+393331234567",
      },
      error: null,
    });
    mocks.playerCareerEqMock.mockImplementation(() => mocks.playerCareerFirstOrderChain);
    mocks.playerCareerFirstOrderMock.mockImplementation(
      () => mocks.playerCareerSecondOrderChain,
    );
    mocks.playerCareerSecondOrderMock.mockResolvedValue({
      data: [
        {
          appearances: 30,
          assists: 8,
          awards: null,
          club_id: "club-1",
          club_name: "AC FootMe",
          competition_name: "Promozione",
          goals: 12,
          id: "career-1",
          minutes_played: 2400,
          player_profile_id: "profile-1",
          season_label: "2024/25",
          sort_order: 0,
          team_logo_url: "https://example.com/club.png",
        },
      ],
      error: null,
    });
    mocks.playerPalmaresEqMock.mockImplementation(() => ({
      order: mocks.playerPalmaresOrderMock,
    }));
    mocks.playerPalmaresOrderMock.mockResolvedValue({
      data: [],
      error: null,
    });
  });

  it("throws when the base profile cannot be found", async () => {
    mocks.profileMaybeSingleMock.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    await expect(getCompleteProfessionalProfile("missing-profile")).rejects.toThrow(
      "Profilo non trovato.",
    );

    expect(mocks.fromMock).toHaveBeenCalledTimes(1);
  });

  it("loads player-specific data and career entries for player profiles", async () => {
    const result = await getCompleteProfessionalProfile("profile-1");

    expect(result.profile.role).toBe("player");
    expect(result.playerProfile?.primary_position).toBe("forward");
    expect(result.playerProfile?.secondary_positions).toEqual(["left_winger", "right_winger"]);
    expect(result.playerCareerEntries).toHaveLength(1);
    expect(result.playerCareerEntries[0]).toMatchObject({
      club_id: "club-1",
      team_logo_url: "https://example.com/club.png",
    });
    expect(result.userContacts).toEqual({
      email: "marco@example.com",
      facebook: "https://facebook.com/marcorossi",
      instagram: "https://instagram.com/marcorossi",
      phone: "+393331234567",
      showEmail: true,
      showFacebook: false,
      showInstagram: true,
      showTikTok: false,
      showWebsite: false,
      showYouTube: false,
      tiktok: "",
      website: "",
      youtube: "",
    });
    expect(mocks.playerCareerEqMock).toHaveBeenCalledWith(
      "player_profile_id",
      "profile-1",
    );
    expect(mocks.playerCareerFirstOrderMock).toHaveBeenCalledWith("sort_order", {
      ascending: true,
    });
    expect(mocks.playerCareerSecondOrderMock).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
  });

  it("loads only club data for club admins", async () => {
    const club = {
      category: "Eccellenza",
      city: "Roma",
      club_colors: null,
      club_email: null,
      club_phone: null,
      country: "IT",
      description: null,
      field_address: null,
      founding_year: null,
      gallery_urls: [],
      headquarters_address: null,
      id: "club-77",
      key_results: [],
      league: "Serie D",
      logo_url: null,
      name: "FC Roma",
      owner_profile_id: "profile-9",
      region: "Lazio",
      sports_focus: null,
      stadium: null,
      top_level_reached: null,
      verification_status: "unverified",
      website_url: null,
    };
    mocks.profileMaybeSingleMock.mockResolvedValueOnce({
      data: {
        avatar_url: null,
        bio: null,
        birth_date: null,
        age: null,
        city: "Roma",
        full_name: "Club Admin",
        id: "profile-9",
        is_open_to_transfer: false,
        nationality: null,
        region: "Lazio",
        role: "club_admin",
      },
      error: null,
    });
    mocks.clubMaybeSingleMock.mockResolvedValueOnce({ data: club, error: null });

    const result = await getCompleteProfessionalProfile("profile-9");

    expect(result.club).toEqual(club);
    expect(result.playerProfile).toBeNull();
    expect(result.playerCareerEntries).toEqual([]);
    expect(
      mocks.fromMock.mock.calls.some(([table]) => table === "player_career_entries"),
    ).toBe(false);
  });

  it("loads director-specific profile data for director profiles", async () => {
    mocks.profileMaybeSingleMock.mockResolvedValueOnce({
      data: {
        avatar_url: null,
        bio: "Costruzione rosa e sviluppo progetto sportivo.",
        birth_date: null,
        age: null,
        city: "Como",
        full_name: "Marco Rossi",
        id: "director-1",
        is_open_to_transfer: false,
        nationality: "IT",
        region: "Lombardia",
        role: "director",
      },
      error: null,
    });
    mocks.directorMaybeSingleMock.mockResolvedValueOnce({
      data: {
        career_entries: [],
        coach_career_entries: [
          {
            id: "director-coach-1",
            teamName: "Como Academy",
            role: "Allenatore Under 17",
          },
        ],
        club_types: ["Societa dilettantistica"],
        director_roles: ["Direttore sportivo"],
        experience_categories: ["Serie D", "Eccellenza"],
        has_other_football_experience: true,
        has_played_football: false,
        main_focus: "Prima squadra",
        market_involvement: "Solo supporto",
        other_football_roles: ["Scout"],
        player_career_entries: [],
        primary_role: "Direttore sportivo",
        profile_id: "director-1",
        responsibilities: ["Gestione rose e contratti", "Settore giovanile"],
      },
      error: null,
    });

    const result = await getCompleteProfessionalProfile("director-1");

    expect(result.profile.role).toBe("director");
    expect(result.directorProfile).toMatchObject({
      coach_career_entries: [
        expect.objectContaining({
          role: "Allenatore Under 17",
          teamName: "Como Academy",
        }),
      ],
      director_roles: ["Direttore sportivo"],
      experience_categories: ["Serie D", "Eccellenza"],
      main_focus: "Prima squadra",
      primary_role: "Direttore sportivo",
      responsibilities: ["Gestione rose e contratti", "Settore giovanile"],
    });
    expect(result.playerProfile).toBeNull();
    expect(
      mocks.fromMock.mock.calls.some(([table]) => table === "player_career_entries"),
    ).toBe(false);
  });

  it("loads media-specific profile data for media profiles", async () => {
    mocks.profileMaybeSingleMock.mockResolvedValueOnce({
      data: {
        avatar_url: "https://example.com/avatar.png",
        bio: "Notizie e racconti sul calcio italiano.",
        birth_date: null,
        age: null,
        city: "Milano",
        current_location_country: "IT",
        full_name: "Redazione FootMe",
        id: "media-1",
        is_open_to_transfer: false,
        nationality: "IT",
        region: "Lombardia",
        role: "media",
      },
      error: null,
    });
    mocks.mediaMaybeSingleMock.mockResolvedValueOnce({
      data: {
        affiliation_name: "FootMe News",
        affiliation_type: "Testata o sito",
        covered_competitions: ["Serie A"],
        covered_teams: ["Como"],
        covered_territories: ["Italia"],
        covered_topics: ["Calciomercato"],
        content_types: ["Notizie", "Interviste"],
        editorial_type: "Testata giornalistica / Media sportivo",
        entity_name: "FootMe News",
        focus_areas: ["Serie A", "Calciomercato"],
        logo_url: "https://example.com/logo.png",
        profile_id: "media-1",
        short_description: "Aggiornamenti quotidiani sul calcio.",
        verification_status: "verified",
      },
      error: null,
    });
    mocks.mediaChannelsResultMock.mockReturnValueOnce({
      data: [
        {
          channel_type: "x",
          id: "channel-x",
          is_public: true,
          label: "X / Twitter",
          media_profile_id: "media-1",
          sort_order: 1,
          url: "https://x.com/footmenews",
        },
      ],
      error: null,
    });
    mocks.mediaAuthorsResultMock.mockReturnValueOnce({
      data: [
        {
          avatar_url: "https://example.com/author.png",
          display_name: "Marco Bianchi",
          id: "author-1",
          is_public: true,
          is_verified: true,
          media_profile_id: "media-1",
          profile_id: "profile-author-1",
          role_label: "Giornalista",
          sort_order: 0,
        },
      ],
      error: null,
    });
    mocks.mediaContactsResultMock.mockReturnValueOnce({
      data: [
        {
          contact_type: "editorial",
          href: null,
          id: "contact-1",
          is_public: true,
          label: "Redazione",
          media_profile_id: "media-1",
          sort_order: 0,
          value: "redazione@footme.example",
        },
      ],
      error: null,
    });
    mocks.mediaVerificationsResultMock.mockReturnValueOnce({
      data: [
        {
          id: "verification-1",
          is_public: true,
          label: "Testata registrata",
          media_profile_id: "media-1",
          sort_order: 0,
          status: "verified",
          verification_type: "registered_publication",
          verified_at: "2026-05-01T00:00:00Z",
        },
      ],
      error: null,
    });
    mocks.profileContactsMaybeSingleMock.mockResolvedValueOnce({
      data: {
        email: "",
        facebook: "https://facebook.com/footmenews",
        instagram: "https://instagram.com/footmenews",
        show_email: false,
        show_facebook: true,
        show_instagram: true,
        show_tiktok: false,
        show_website: true,
        show_youtube: true,
        tiktok: "",
        website: "https://footme.example/news",
        youtube: "https://youtube.com/@footmenews",
      },
      error: null,
    });

    const result = await getCompleteProfessionalProfile("media-1");

    expect(result.profile.role).toBe("media");
    expect(result.mediaProfile).toEqual({
      affiliation_name: "FootMe News",
      affiliation_type: "Testata o sito",
      covered_competitions: ["Serie A"],
      covered_teams: ["Como"],
      covered_territories: ["Italia"],
      covered_topics: ["Calciomercato"],
      content_types: ["Notizie", "Interviste"],
      editorial_type: "Testata giornalistica / Media sportivo",
      entity_name: "FootMe News",
      focus_areas: ["Serie A", "Calciomercato"],
      logo_url: "https://example.com/logo.png",
      profile_id: "media-1",
      short_description: "Aggiornamenti quotidiani sul calcio.",
      verification_status: "verified",
    });
    expect(result.mediaProfileChannels).toEqual([
      {
        channel_type: "x",
        id: "channel-x",
        is_public: true,
        label: "X / Twitter",
        media_profile_id: "media-1",
        sort_order: 1,
        url: "https://x.com/footmenews",
      },
    ]);
    expect((result.mediaProfileAuthors ?? [])[0]).toMatchObject({
      display_name: "Marco Bianchi",
      id: "author-1",
      is_verified: true,
    });
    expect((result.mediaProfileContacts ?? [])[0]).toMatchObject({
      contact_type: "editorial",
      value: "redazione@footme.example",
    });
    expect((result.mediaProfileVerifications ?? [])[0]).toMatchObject({
      label: "Testata registrata",
      status: "verified",
    });
    expect(result.userContacts.website).toBe("https://footme.example/news");
    expect(result.userContacts.youtube).toBe("https://youtube.com/@footmenews");
    expect(mocks.mediaMaybeSingleMock).toHaveBeenCalledTimes(1);
    expect(
      mocks.fromMock.mock.calls.some(([table]) => table === "player_career_entries"),
    ).toBe(false);
  });

  it("normalizes legacy null and missing fields without crashing", async () => {
    mocks.profileMaybeSingleMock.mockResolvedValueOnce({
      data: {
        avatar_url: null,
        bio: null,
        birth_date: null,
        age: null,
        city: null,
        full_name: "Legacy Staff",
        id: "profile-legacy",
        is_open_to_transfer: null,
        nationality: null,
        region: null,
        role: "staff",
      },
      error: null,
    });
    mocks.playerMaybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    mocks.coachMaybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    mocks.staffMaybeSingleMock.mockResolvedValueOnce({
      data: {
        availability_type: null,
        available_from: null,
        certifications: null,
        experience_entries: null,
        experience_summary: null,
        open_to_work: null,
        primary_staff_role: null,
        preferred_categories: null,
        preferred_provinces: null,
        preferred_regions: null,
        profile_id: "profile-legacy",
        specialization: null,
        staff_roles: null,
      },
      error: null,
    });
    mocks.clubMaybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    mocks.profileContactsMaybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    mocks.privateContactsMaybeSingleMock.mockResolvedValueOnce({ data: null, error: null });

    const result = await getCompleteProfessionalProfile("profile-legacy");

    expect(result.profile).toMatchObject({
      city: null,
      is_open_to_transfer: false,
      nationality: null,
      region: null,
      role: "staff",
    });
    expect(result.staffProfile).toEqual({
      availability_type: null,
      available_from: null,
      certifications: [],
      experience_entries: [],
      experience_summary: null,
      media_items: [],
      open_to_work: false,
      primary_staff_role: null,
      preferred_categories: [],
      preferred_provinces: [],
      preferred_regions: [],
      profile_id: "profile-legacy",
      specialization: "fitness_coach",
      staff_roles: [],
    });
    expect(result.userContacts).toEqual({
      email: "",
      facebook: "",
      instagram: "",
      phone: "",
      showEmail: false,
      showFacebook: false,
      showInstagram: false,
      showTikTok: false,
      showWebsite: false,
      showYouTube: false,
      tiktok: "",
      website: "",
      youtube: "",
    });
  });
});

describe("searchTeams", () => {
  it("returns club suggestions for team autocomplete", async () => {
    mocks.rpcMock.mockResolvedValueOnce({
      data: [
        {
          city: "Milano",
          id: "club-1",
          is_community: false,
          logo_url: "https://example.com/logo.png",
          name: "ASD Real Milano",
        },
      ],
      error: null,
    });

    const result = await searchTeams("Mil");

    expect(mocks.rpcMock).toHaveBeenCalledWith("search_teams", {
      p_query: "Mil",
      p_limit: 5,
    });
    expect(result).toEqual([
      {
        city: "Milano",
        id: "club-1",
        isCustom: false,
        logoUrl: "https://example.com/logo.png",
        name: "ASD Real Milano",
      },
    ]);
  });
});
