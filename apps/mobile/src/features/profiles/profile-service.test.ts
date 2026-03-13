import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCompleteProfessionalProfile, searchTeams } from "./profile-service";

const mocks = vi.hoisted(() => {
  const clubMaybeSingleMock = vi.fn();
  const clubSearchIlikeMock = vi.fn();
  const clubSearchLimitMock = vi.fn();
  const clubSearchOrderMock = vi.fn();
  const coachMaybeSingleMock = vi.fn();
  const playerCareerEqMock = vi.fn();
  const playerCareerFirstOrderMock = vi.fn();
  const playerCareerSecondOrderMock = vi.fn();
  const playerMaybeSingleMock = vi.fn();
  const profileContactsMaybeSingleMock = vi.fn();
  const privateContactsMaybeSingleMock = vi.fn();
  const profileMaybeSingleMock = vi.fn();
  const staffMaybeSingleMock = vi.fn();

  const playerCareerSecondOrderChain = {
    order: playerCareerSecondOrderMock,
  };
  const playerCareerFirstOrderChain = {
    order: playerCareerFirstOrderMock,
  };
  const clubSearchOrderChain = {
    limit: clubSearchLimitMock,
  };
  const clubSearchIlikeChain = {
    order: clubSearchOrderMock,
  };

  return {
    clubMaybeSingleMock,
    clubSearchIlikeMock,
    clubSearchIlikeChain,
    clubSearchLimitMock,
    clubSearchOrderChain,
    clubSearchOrderMock,
    coachMaybeSingleMock,
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

      if (table === "clubs") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: clubMaybeSingleMock,
            })),
            ilike: clubSearchIlikeMock,
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

      throw new Error(`Unexpected table: ${table}`);
    }),
    playerCareerEqMock,
    playerCareerFirstOrderChain,
    playerCareerFirstOrderMock,
    playerCareerSecondOrderChain,
    playerCareerSecondOrderMock,
    playerMaybeSingleMock,
    privateContactsMaybeSingleMock,
    profileContactsMaybeSingleMock,
    profileMaybeSingleMock,
    staffMaybeSingleMock,
  };
});

vi.mock("../../lib/supabase", () => ({
  supabase: {
    from: mocks.fromMock,
  },
}));

describe("getCompleteProfessionalProfile", () => {
  beforeEach(() => {
    mocks.fromMock.mockClear();
    mocks.profileMaybeSingleMock.mockReset();
    mocks.playerMaybeSingleMock.mockReset();
    mocks.coachMaybeSingleMock.mockReset();
    mocks.staffMaybeSingleMock.mockReset();
    mocks.clubMaybeSingleMock.mockReset();
    mocks.clubSearchIlikeMock.mockReset();
    mocks.clubSearchOrderMock.mockReset();
    mocks.clubSearchLimitMock.mockReset();
    mocks.profileContactsMaybeSingleMock.mockReset();
    mocks.privateContactsMaybeSingleMock.mockReset();
    mocks.playerCareerEqMock.mockReset();
    mocks.playerCareerFirstOrderMock.mockReset();
    mocks.playerCareerSecondOrderMock.mockReset();

    mocks.profileMaybeSingleMock.mockResolvedValue({
      data: {
        avatar_url: null,
        bio: null,
        birth_date: null,
        age: null,
        city: "Perugia",
        full_name: "Marco Rossi",
        id: "profile-1",
        is_available: true,
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
        preferred_categories: ["Promozione"],
        preferred_foot: "right",
        primary_position: "forward",
        profile_id: "profile-1",
        secondary_position: null,
        transfer_regions: ["Umbria"],
        weight_kg: 75,
        willing_to_change_club: true,
      },
      error: null,
    });
    mocks.coachMaybeSingleMock.mockResolvedValue({ data: null, error: null });
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
    mocks.clubSearchIlikeMock.mockImplementation(() => mocks.clubSearchIlikeChain);
    mocks.clubSearchOrderMock.mockImplementation(() => mocks.clubSearchOrderChain);
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
      description: null,
      gallery_urls: [],
      id: "club-77",
      league: "Serie D",
      logo_url: null,
      name: "FC Roma",
      owner_profile_id: "profile-9",
      region: "Lazio",
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
        is_available: false,
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
        is_available: null,
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
        certifications: null,
        experience_summary: null,
        open_to_work: null,
        preferred_regions: null,
        profile_id: "profile-legacy",
        specialization: null,
      },
      error: null,
    });
    mocks.clubMaybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    mocks.profileContactsMaybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    mocks.privateContactsMaybeSingleMock.mockResolvedValueOnce({ data: null, error: null });

    const result = await getCompleteProfessionalProfile("profile-legacy");

    expect(result.profile).toMatchObject({
      city: null,
      is_available: false,
      is_open_to_transfer: false,
      nationality: null,
      region: null,
      role: "staff",
    });
    expect(result.staffProfile).toEqual({
      certifications: [],
      experience_summary: null,
      open_to_work: false,
      preferred_regions: [],
      profile_id: "profile-legacy",
      specialization: "fitness_coach",
    });
    expect(result.userContacts).toEqual({
      email: "",
      facebook: "",
      instagram: "",
      phone: "",
      showEmail: false,
      showFacebook: false,
      showInstagram: false,
    });
  });
});

describe("searchTeams", () => {
  it("returns club suggestions for team autocomplete", async () => {
    mocks.clubSearchLimitMock.mockResolvedValueOnce({
      data: [
        {
          city: "Milano",
          id: "club-1",
          logo_url: "https://example.com/logo.png",
          name: "ASD Real Milano",
        },
      ],
      error: null,
    });

    const result = await searchTeams("Mil");

    expect(mocks.clubSearchIlikeMock).toHaveBeenCalledWith("name", "%Mil%");
    expect(mocks.clubSearchOrderMock).toHaveBeenCalledWith("name", {
      ascending: true,
    });
    expect(mocks.clubSearchLimitMock).toHaveBeenCalledWith(5);
    expect(result).toEqual([
      {
        city: "Milano",
        id: "club-1",
        logoUrl: "https://example.com/logo.png",
        name: "ASD Real Milano",
      },
    ]);
  });
});
