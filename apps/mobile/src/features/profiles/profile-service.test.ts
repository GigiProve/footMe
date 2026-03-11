import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getCompleteProfessionalProfile,
  updateCompleteProfessionalProfile,
} from "./profile-service";

const mocks = vi.hoisted(() => {
  const clubMaybeSingleMock = vi.fn();
  const coachMaybeSingleMock = vi.fn();
  const playerCareerDeleteEqMock = vi.fn();
  const playerCareerDeleteInMock = vi.fn();
  const playerCareerEqMock = vi.fn();
  const playerCareerFirstOrderMock = vi.fn();
  const playerCareerSecondOrderMock = vi.fn();
  const playerCareerInsertMock = vi.fn();
  const playerCareerSelectIdsEqMock = vi.fn();
  const playerCareerUpsertMock = vi.fn();
  const playerMaybeSingleMock = vi.fn();
  const playerProfileUpsertMock = vi.fn();
  const profileMaybeSingleMock = vi.fn();
  const profileUpdateEqMock = vi.fn();
  const staffMaybeSingleMock = vi.fn();

  const playerCareerSecondOrderChain = {
    order: playerCareerSecondOrderMock,
  };
  const playerCareerFirstOrderChain = {
    order: playerCareerFirstOrderMock,
  };

  return {
    clubMaybeSingleMock,
    coachMaybeSingleMock,
    fromMock: vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: profileMaybeSingleMock,
            })),
          })),
          update: vi.fn(() => ({
            eq: profileUpdateEqMock,
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
          upsert: playerProfileUpsertMock,
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
          })),
        };
      }

      if (table === "player_career_entries") {
        return {
          delete: vi.fn(() => ({
            eq: playerCareerDeleteEqMock,
          })),
          insert: playerCareerInsertMock,
          select: vi.fn((columns: string) => ({
            eq:
              columns === "id"
                ? playerCareerSelectIdsEqMock
                : playerCareerEqMock,
          })),
          upsert: playerCareerUpsertMock,
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
    playerCareerDeleteEqMock,
    playerCareerDeleteInMock,
    playerCareerEqMock,
    playerCareerFirstOrderChain,
    playerCareerFirstOrderMock,
    playerCareerInsertMock,
    playerCareerSecondOrderChain,
    playerCareerSecondOrderMock,
    playerCareerSelectIdsEqMock,
    playerCareerUpsertMock,
    playerMaybeSingleMock,
    playerProfileUpsertMock,
    profileMaybeSingleMock,
    profileUpdateEqMock,
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
    mocks.playerCareerEqMock.mockReset();
    mocks.playerCareerFirstOrderMock.mockReset();
    mocks.playerCareerSecondOrderMock.mockReset();
    mocks.profileUpdateEqMock.mockReset();
    mocks.playerProfileUpsertMock.mockReset();
    mocks.playerCareerSelectIdsEqMock.mockReset();
    mocks.playerCareerUpsertMock.mockReset();
    mocks.playerCareerInsertMock.mockReset();
    mocks.playerCareerDeleteEqMock.mockReset();
    mocks.playerCareerDeleteInMock.mockReset();

    mocks.profileMaybeSingleMock.mockResolvedValue({
      data: {
        avatar_url: null,
        bio: null,
        birth_date: null,
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
          club_name: "AC FootMe",
          competition_name: "Promozione",
          goals: 12,
          id: "career-1",
          minutes_played: 2400,
          player_profile_id: "profile-1",
          season_label: "24/25",
          sort_order: 0,
        },
      ],
      error: null,
    });
    mocks.profileUpdateEqMock.mockResolvedValue({ error: null });
    mocks.playerProfileUpsertMock.mockResolvedValue({ error: null });
    mocks.playerCareerSelectIdsEqMock.mockResolvedValue({ data: [], error: null });
    mocks.playerCareerUpsertMock.mockResolvedValue({ error: null });
    mocks.playerCareerInsertMock.mockResolvedValue({ error: null });
    mocks.playerCareerDeleteEqMock.mockReturnValue({
      in: mocks.playerCareerDeleteInMock,
    });
    mocks.playerCareerDeleteInMock.mockResolvedValue({ error: null });
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
});

describe("updateCompleteProfessionalProfile", () => {
  beforeEach(() => {
    mocks.profileUpdateEqMock.mockClear();
    mocks.playerProfileUpsertMock.mockClear();
    mocks.playerCareerSelectIdsEqMock.mockClear();
    mocks.playerCareerUpsertMock.mockClear();
    mocks.playerCareerInsertMock.mockClear();
    mocks.playerCareerDeleteEqMock.mockClear();
    mocks.playerCareerDeleteInMock.mockClear();
  });

  it("rejects player career entries with a season outside the xx/xx format", async () => {
    await expect(
      updateCompleteProfessionalProfile({
        club: null,
        coachProfile: null,
        playerCareerEntries: [
          {
            appearances: 10,
            assists: 3,
            club_name: "AC FootMe",
            competition_name: "Promozione",
            goals: 5,
            minutes_played: 900,
            season_label: "2024/25",
            sort_order: 0,
            awards: null,
          },
        ],
        playerProfile: {
          height_cm: 180,
          highlight_video_url: null,
          preferred_categories: [],
          preferred_foot: "right",
          primary_position: "forward",
          secondary_position: null,
          transfer_regions: [],
          weight_kg: 75,
          willing_to_change_club: true,
        },
        profile: {
          avatar_url: null,
          bio: null,
          birth_date: "1998-02-18",
          city: "Perugia",
          full_name: "Marco Rossi",
          is_available: true,
          is_open_to_transfer: true,
          nationality: "IT",
          region: "Umbria",
        },
        profileId: "profile-1",
        role: "player",
        staffProfile: null,
      }),
    ).rejects.toThrow("Il formato della stagione deve essere xx/xx, ad esempio 24/25.");

    expect(mocks.playerCareerInsertMock).not.toHaveBeenCalled();
    expect(mocks.playerCareerUpsertMock).not.toHaveBeenCalled();
  });

  it("reads existing career ids before inserts so new seasons are not deleted", async () => {
    mocks.playerCareerSelectIdsEqMock.mockResolvedValueOnce({
      data: [{ id: "career-existing" }],
      error: null,
    });

    await updateCompleteProfessionalProfile({
      club: null,
      coachProfile: null,
      playerCareerEntries: [
        {
          appearances: 28,
          assists: 7,
          awards: null,
          club_name: "AC FootMe",
          competition_name: "Promozione",
          goals: 11,
          id: "career-existing",
          minutes_played: 2200,
          season_label: "23/24",
          sort_order: 0,
        },
        {
          appearances: 30,
          assists: 8,
          awards: "Capocannoniere",
          club_name: "FC FootMe",
          competition_name: "Eccellenza",
          goals: 14,
          minutes_played: 2500,
          season_label: "24/25",
          sort_order: 1,
        },
      ],
      playerProfile: {
        height_cm: 180,
        highlight_video_url: null,
        preferred_categories: ["Promozione"],
        preferred_foot: "right",
        primary_position: "forward",
        secondary_position: null,
        transfer_regions: ["Umbria"],
        weight_kg: 75,
        willing_to_change_club: true,
      },
      profile: {
        avatar_url: null,
        bio: null,
        birth_date: "1998-02-18",
        city: "Perugia",
        full_name: "Marco Rossi",
        is_available: true,
        is_open_to_transfer: true,
        nationality: "IT",
        region: "Umbria",
      },
      profileId: "profile-1",
      role: "player",
      staffProfile: null,
    });

    expect(mocks.playerCareerSelectIdsEqMock).toHaveBeenCalledWith(
      "player_profile_id",
      "profile-1",
    );
    expect(mocks.playerCareerInsertMock).toHaveBeenCalledWith([
      {
        appearances: 30,
        assists: 8,
        awards: "Capocannoniere",
        club_name: "FC FootMe",
        competition_name: "Eccellenza",
        goals: 14,
        minutes_played: 2500,
        player_profile_id: "profile-1",
        season_label: "24/25",
        sort_order: 1,
      },
    ]);
    expect(mocks.playerCareerSelectIdsEqMock.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.playerCareerInsertMock.mock.invocationCallOrder[0],
    );
    expect(mocks.playerCareerDeleteInMock).not.toHaveBeenCalled();
  });
});
