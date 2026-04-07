import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getCompleteProfessionalProfile,
  saveCoachProfileMedia,
} from "./profile-service";

const mocks = vi.hoisted(() => {
  const coachCareerEqMock = vi.fn();
  const coachCareerFirstOrderMock = vi.fn();
  const coachCareerOrderMock = vi.fn();
  const coachDirectorEqMock = vi.fn();
  const coachDirectorFirstOrderMock = vi.fn();
  const coachDirectorOrderMock = vi.fn();
  const coachMaybeSingleMock = vi.fn();
  const coachPlayerEqMock = vi.fn();
  const coachPlayerFirstOrderMock = vi.fn();
  const coachPlayerOrderMock = vi.fn();
  const coachProfilesUpsertMock = vi.fn();
  const profileContactsMaybeSingleMock = vi.fn();
  const privateContactsMaybeSingleMock = vi.fn();
  const profileMaybeSingleMock = vi.fn();

  return {
    coachCareerEqMock,
    coachCareerFirstOrderMock,
    coachCareerOrderMock,
    coachDirectorEqMock,
    coachDirectorFirstOrderMock,
    coachDirectorOrderMock,
    coachMaybeSingleMock,
    coachPlayerEqMock,
    coachPlayerFirstOrderMock,
    coachPlayerOrderMock,
    coachProfilesUpsertMock,
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

      if (table === "coach_profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: coachMaybeSingleMock,
            })),
          })),
          upsert: coachProfilesUpsertMock,
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

      if (table === "coach_career_entries") {
        return {
          select: vi.fn(() => ({
            eq: coachCareerEqMock,
          })),
        };
      }

      if (table === "coach_player_career_entries") {
        return {
          select: vi.fn(() => ({
            eq: coachPlayerEqMock,
          })),
        };
      }

      if (table === "coach_director_career_entries") {
        return {
          select: vi.fn(() => ({
            eq: coachDirectorEqMock,
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
    privateContactsMaybeSingleMock,
    profileContactsMaybeSingleMock,
    profileMaybeSingleMock,
  };
});

vi.mock("../../lib/supabase", () => ({
  supabase: {
    from: mocks.fromMock,
    rpc: vi.fn(),
  },
}));

describe("coach media profile service", () => {
  beforeEach(() => {
    mocks.fromMock.mockClear();
    mocks.coachMaybeSingleMock.mockReset();
    mocks.coachCareerEqMock.mockReset();
    mocks.coachCareerFirstOrderMock.mockReset();
    mocks.coachCareerOrderMock.mockReset();
    mocks.coachDirectorEqMock.mockReset();
    mocks.coachDirectorFirstOrderMock.mockReset();
    mocks.coachDirectorOrderMock.mockReset();
    mocks.coachPlayerEqMock.mockReset();
    mocks.coachPlayerFirstOrderMock.mockReset();
    mocks.coachPlayerOrderMock.mockReset();
    mocks.coachProfilesUpsertMock.mockReset();
    mocks.profileMaybeSingleMock.mockReset();
    mocks.profileContactsMaybeSingleMock.mockReset();
    mocks.privateContactsMaybeSingleMock.mockReset();

    mocks.profileMaybeSingleMock.mockResolvedValue({
      data: {
        age: null,
        avatar_url: null,
        bio: null,
        birth_date: null,
        city: "Como",
        full_name: "Marco Rossi",
        id: "coach-1",
        is_open_to_transfer: false,
        languages: [],
        nationality: "IT",
        region: "Lombardia",
        role: "coach",
      },
      error: null,
    });
    mocks.profileContactsMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    mocks.privateContactsMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    mocks.coachProfilesUpsertMock.mockResolvedValue({ error: null });
    mocks.coachCareerEqMock.mockImplementation(() => ({
      order: mocks.coachCareerFirstOrderMock,
    }));
    mocks.coachCareerFirstOrderMock.mockImplementation(() => ({
      order: mocks.coachCareerOrderMock,
    }));
    mocks.coachCareerOrderMock.mockResolvedValue({ data: [], error: null });
    mocks.coachPlayerEqMock.mockImplementation(() => ({
      order: mocks.coachPlayerFirstOrderMock,
    }));
    mocks.coachPlayerFirstOrderMock.mockImplementation(() => ({
      order: mocks.coachPlayerOrderMock,
    }));
    mocks.coachPlayerOrderMock.mockResolvedValue({ data: [], error: null });
    mocks.coachDirectorEqMock.mockImplementation(() => ({
      order: mocks.coachDirectorFirstOrderMock,
    }));
    mocks.coachDirectorFirstOrderMock.mockImplementation(() => ({
      order: mocks.coachDirectorOrderMock,
    }));
    mocks.coachDirectorOrderMock.mockResolvedValue({ data: [], error: null });
  });

  it("loads coach media items from coach profile", async () => {
    mocks.coachMaybeSingleMock.mockResolvedValue({
      data: {
        availability_type: "ITALY",
        coached_categories: ["Promozione"],
        coached_clubs: ["USD Virtus"],
        game_philosophy: null,
        licenses: ["UEFA B"],
        media_items: [
          {
            id: "media-1",
            is_featured: true,
            tag: "tactics",
            thumbnail_url: "https://example.com/thumb.jpg",
            type: "image",
            url: "https://example.com/thumb.jpg",
          },
        ],
        open_to_new_role: true,
        preferred_provinces: [],
        preferred_regions: [],
        profile_id: "coach-1",
        technical_video_url: null,
      },
      error: null,
    });

    const result = await getCompleteProfessionalProfile("coach-1");

    expect(result.coachProfile?.media_items).toEqual([
      {
        created_at: null,
        description: null,
        id: "media-1",
        is_featured: true,
        tag: "tactics",
        thumbnail_url: "https://example.com/thumb.jpg",
        type: "image",
        url: "https://example.com/thumb.jpg",
      },
    ]);
  });

  it("persists coach media items through coach_profiles upsert", async () => {
    await saveCoachProfileMedia({
      coachProfile: {
        achievements: [],
        availability_type: "ITALY",
        coached_categories: [],
        coached_clubs: [],
        contract_end: null,
        current_club: null,
        game_philosophy: null,
        licenses: [],
        media_items: [],
        open_to_new_role: false,
        play_styles: [],
        preferred_categories: [],
        preferred_formation: null,
        preferred_provinces: [],
        preferred_regions: [],
        profile_id: "coach-1",
        secondary_formations: [],
        technical_video_url: null,
      },
      mediaItems: [
        {
          created_at: null,
          description: "Seduta di tattica",
          id: "media-1",
          is_featured: true,
          tag: "tactics",
          thumbnail_url: "https://example.com/thumb.jpg",
          type: "image",
          url: "https://example.com/thumb.jpg",
        },
      ],
      profileId: "coach-1",
    });

    expect(mocks.coachProfilesUpsertMock).toHaveBeenCalledWith({
      availability_type: "ITALY",
      coached_categories: [],
      coached_clubs: [],
      game_philosophy: null,
      licenses: [],
      media_items: [
        {
          created_at: null,
          description: "Seduta di tattica",
          id: "media-1",
          is_featured: true,
          tag: "tactics",
          thumbnail_url: "https://example.com/thumb.jpg",
          type: "image",
          url: "https://example.com/thumb.jpg",
        },
      ],
      open_to_new_role: false,
      preferred_provinces: [],
      preferred_regions: [],
      profile_id: "coach-1",
      technical_video_url: null,
    });
  });
});
