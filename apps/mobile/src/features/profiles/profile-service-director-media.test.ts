import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getCompleteProfessionalProfile,
  saveDirectorProfileMedia,
} from "./profile-service";

const mocks = vi.hoisted(() => {
  const directorMaybeSingleMock = vi.fn();
  const directorProfilesUpsertMock = vi.fn();
  const privateContactsMaybeSingleMock = vi.fn();
  const profileContactsMaybeSingleMock = vi.fn();
  const profileMaybeSingleMock = vi.fn();

  return {
    directorMaybeSingleMock,
    directorProfilesUpsertMock,
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

      if (table === "director_profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: directorMaybeSingleMock,
            })),
          })),
          upsert: directorProfilesUpsertMock,
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

describe("director media profile service", () => {
  beforeEach(() => {
    mocks.fromMock.mockClear();
    mocks.directorMaybeSingleMock.mockReset();
    mocks.directorProfilesUpsertMock.mockReset();
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
        id: "director-1",
        is_open_to_transfer: false,
        languages: [],
        nationality: "IT",
        region: "Lombardia",
        role: "director",
      },
      error: null,
    });
    mocks.profileContactsMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    mocks.privateContactsMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    mocks.directorProfilesUpsertMock.mockResolvedValue({ error: null });
  });

  it("loads director media items from director profile", async () => {
    mocks.directorMaybeSingleMock.mockResolvedValue({
      data: {
        career_entries: [],
        coach_career_entries: [],
        club_types: ["Societa dilettantistica"],
        director_roles: ["Direttore sportivo"],
        experience_categories: ["Serie D"],
        has_other_football_experience: false,
        has_played_football: false,
        main_focus: "Prima squadra",
        market_involvement: "Solo supporto",
        media_items: [
          {
            created_at: "2026-05-15T08:00:00.000Z",
            description: "Intervista sul progetto sportivo.",
            id: "media-1",
            is_featured: true,
            linked_targets: [
              {
                avatar_url: "https://example.com/club.png",
                display_name: "AC Como",
                role: "club",
                subtitle: "Serie D",
                target_id: "club-1",
                target_type: "club",
              },
            ],
            tag: "interview",
            thumbnail_url: null,
            type: "video",
            url: "https://example.com/interview.mp4",
          },
        ],
        other_football_roles: [],
        player_career_entries: [],
        primary_role: "Direttore sportivo",
        profile_id: "director-1",
        responsibilities: ["Gestione rose e contratti"],
      },
      error: null,
    });

    const result = await getCompleteProfessionalProfile("director-1");

    expect(result.directorProfile?.media_items).toEqual([
      {
        created_at: "2026-05-15T08:00:00.000Z",
        description: "Intervista sul progetto sportivo.",
        id: "media-1",
        is_featured: true,
        linked_targets: [
          {
            avatar_url: "https://example.com/club.png",
            display_name: "AC Como",
            role: "club",
            subtitle: "Serie D",
            target_id: "club-1",
            target_type: "club",
          },
        ],
        tag: "interview",
        thumbnail_url: null,
        type: "video",
        url: "https://example.com/interview.mp4",
      },
    ]);
  });

  it("persists director media items through director_profiles upsert", async () => {
    await saveDirectorProfileMedia({
      directorProfile: {
        career_entries: [],
        coach_career_entries: [],
        club_types: [],
        director_roles: ["Direttore sportivo"],
        experience_categories: ["Serie D"],
        has_other_football_experience: false,
        has_played_football: false,
        main_focus: "Prima squadra",
        market_involvement: null,
        media_items: [],
        other_football_roles: [],
        player_career_entries: [],
        primary_role: "Direttore sportivo",
        profile_id: "director-1",
        responsibilities: [],
      },
      mediaItems: [
        {
          created_at: "2026-05-15T08:00:00.000Z",
          description: "Presentazione ufficiale.",
          id: "media-1",
          is_featured: true,
          linked_targets: [],
          tag: "presentation",
          thumbnail_url: "https://example.com/photo.jpg",
          type: "image",
          url: "https://example.com/photo.jpg",
        },
      ],
      profileId: "director-1",
    });

    expect(mocks.directorProfilesUpsertMock).toHaveBeenCalledWith({
      career_entries: [],
      coach_career_entries: [],
      club_types: [],
      director_roles: ["Direttore sportivo"],
      experience_categories: ["Serie D"],
      has_other_football_experience: false,
      has_played_football: false,
      main_focus: "Prima squadra",
      market_involvement: null,
      media_items: [
        {
          created_at: "2026-05-15T08:00:00.000Z",
          description: "Presentazione ufficiale.",
          id: "media-1",
          is_featured: true,
          linked_targets: [],
          tag: "presentation",
          thumbnail_url: "https://example.com/photo.jpg",
          type: "image",
          url: "https://example.com/photo.jpg",
        },
      ],
      other_football_roles: [],
      player_career_entries: [],
      primary_role: "Direttore sportivo",
      profile_id: "director-1",
      responsibilities: [],
    });
  });
});
