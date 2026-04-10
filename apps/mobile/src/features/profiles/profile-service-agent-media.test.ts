import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getCompleteProfessionalProfile,
  saveAgentProfileMedia,
} from "./profile-service";

const mocks = vi.hoisted(() => {
  const agentCareerEqMock = vi.fn();
  const agentCareerOrderMock = vi.fn();
  const agentManagedPlayersEqMock = vi.fn();
  const agentManagedPlayersOrderMock = vi.fn();
  const agentMaybeSingleMock = vi.fn();
  const agentProfilesUpsertMock = vi.fn();
  const privateContactsMaybeSingleMock = vi.fn();
  const profileContactsMaybeSingleMock = vi.fn();
  const profileMaybeSingleMock = vi.fn();

  return {
    agentCareerEqMock,
    agentCareerOrderMock,
    agentManagedPlayersEqMock,
    agentManagedPlayersOrderMock,
    agentMaybeSingleMock,
    agentProfilesUpsertMock,
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

      if (table === "agent_profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: agentMaybeSingleMock,
            })),
          })),
          upsert: agentProfilesUpsertMock,
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

      if (table === "agent_career_entries") {
        return {
          select: vi.fn(() => ({
            eq: agentCareerEqMock,
          })),
        };
      }

      if (table === "agent_managed_player_entries") {
        return {
          select: vi.fn(() => ({
            eq: agentManagedPlayersEqMock,
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

describe("agent media profile service", () => {
  beforeEach(() => {
    mocks.fromMock.mockClear();
    mocks.agentCareerEqMock.mockReset();
    mocks.agentCareerOrderMock.mockReset();
    mocks.agentManagedPlayersEqMock.mockReset();
    mocks.agentManagedPlayersOrderMock.mockReset();
    mocks.agentMaybeSingleMock.mockReset();
    mocks.agentProfilesUpsertMock.mockReset();
    mocks.profileMaybeSingleMock.mockReset();
    mocks.profileContactsMaybeSingleMock.mockReset();
    mocks.privateContactsMaybeSingleMock.mockReset();

    mocks.profileMaybeSingleMock.mockResolvedValue({
      data: {
        age: null,
        avatar_url: null,
        bio: null,
        birth_date: null,
        city: "Milano",
        full_name: "Andrea Serra",
        id: "agent-1",
        is_open_to_transfer: false,
        languages: [],
        nationality: "IT",
        region: "Lombardia",
        role: "agent",
      },
      error: null,
    });
    mocks.profileContactsMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    mocks.privateContactsMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    mocks.agentProfilesUpsertMock.mockResolvedValue({ error: null });
    mocks.agentCareerEqMock.mockImplementation(() => ({
      order: mocks.agentCareerOrderMock,
    }));
    mocks.agentCareerOrderMock.mockResolvedValue({ data: [], error: null });
    mocks.agentManagedPlayersEqMock.mockImplementation(() => ({
      order: mocks.agentManagedPlayersOrderMock,
    }));
    mocks.agentManagedPlayersOrderMock.mockResolvedValue({ data: [], error: null });
  });

  it("loads agent media items from agent profile", async () => {
    mocks.agentMaybeSingleMock.mockResolvedValue({
      data: {
        agency_logo_url: null,
        agency_name: "MB Football Management",
        agency_role: "Founder",
        federation: "FIGC",
        has_other_football_experience: true,
        has_played_football: true,
        is_federation_licensed: true,
        main_player_roles: ["defender"],
        managed_players_count: "4 giocatori",
        media_items: [
          {
            created_at: "2026-04-10T08:00:00.000Z",
            description: "Inserimento in Serie D",
            id: "media-1",
            operation_type: "insertion",
            tag: "transfer",
            tagged_players: [
              {
                avatar_url: "https://example.com/player.png",
                display_name: "Marco Rossi",
                profile_id: "player-1",
              },
            ],
            thumbnail_url: null,
            type: "video",
            url: "https://example.com/video.mp4",
          },
        ],
        open_to_clubs: true,
        open_to_players: true,
        operational_focuses: [],
        operational_note: null,
        operating_macro_areas: [],
        operating_regions: [],
        other_football_roles: [],
        period_end_month: null,
        period_end_year: null,
        period_start_month: null,
        period_start_year: 2021,
        player_career_entries: [],
        player_types: [],
        profile_id: "agent-1",
      },
      error: null,
    });

    const result = await getCompleteProfessionalProfile("agent-1");

    expect(result.agentProfile?.media_items).toEqual([
      {
        created_at: "2026-04-10T08:00:00.000Z",
        description: "Inserimento in Serie D",
        id: "media-1",
        operation_type: "insertion",
        tag: "transfer",
        tagged_players: [
          {
            avatar_url: "https://example.com/player.png",
            display_name: "Marco Rossi",
            profile_id: "player-1",
          },
        ],
        thumbnail_url: null,
        type: "video",
        url: "https://example.com/video.mp4",
      },
    ]);
  });

  it("persists agent media items through agent_profiles upsert", async () => {
    await saveAgentProfileMedia({
      agentProfile: {
        agency_logo_url: null,
        agency_name: "MB Football Management",
        agency_role: "Founder",
        federation: "FIGC",
        has_other_football_experience: true,
        has_played_football: true,
        is_federation_licensed: true,
        main_player_roles: ["defender"],
        managed_players_count: "4 giocatori",
        media_items: [],
        open_to_clubs: true,
        open_to_players: true,
        operational_focuses: [],
        operational_note: null,
        operating_macro_areas: [],
        operating_regions: [],
        other_football_roles: [],
        period_end_month: null,
        period_end_year: null,
        period_start_month: null,
        period_start_year: 2021,
        player_career_entries: [],
        player_types: [],
        profile_id: "agent-1",
      },
      mediaItems: [
        {
          created_at: "2026-04-10T08:00:00.000Z",
          description: "Firma ufficiale",
          id: "media-1",
          operation_type: "signature",
          tag: "signature",
          tagged_players: [
            {
              avatar_url: "https://example.com/player.png",
              display_name: "Marco Rossi",
              profile_id: "player-1",
            },
          ],
          thumbnail_url: "https://example.com/thumb.jpg",
          type: "image",
          url: "https://example.com/thumb.jpg",
        },
      ],
      profileId: "agent-1",
    });

    expect(mocks.agentProfilesUpsertMock).toHaveBeenCalledWith({
      agency_logo_url: null,
      agency_name: "MB Football Management",
      agency_role: "Founder",
      federation: "FIGC",
      has_other_football_experience: true,
      has_played_football: true,
      is_federation_licensed: true,
      main_player_roles: ["defender"],
      managed_players_count: "4 giocatori",
      media_items: [
        {
          created_at: "2026-04-10T08:00:00.000Z",
          description: "Firma ufficiale",
          id: "media-1",
          operation_type: "signature",
          tag: "signature",
          tagged_players: [
            {
              avatar_url: "https://example.com/player.png",
              display_name: "Marco Rossi",
              profile_id: "player-1",
            },
          ],
          thumbnail_url: "https://example.com/thumb.jpg",
          type: "image",
          url: "https://example.com/thumb.jpg",
        },
      ],
      open_to_clubs: true,
      open_to_players: true,
      operational_focuses: [],
      operational_note: null,
      operating_macro_areas: [],
      operating_regions: [],
      other_football_roles: [],
      period_end_month: null,
      period_end_year: null,
      period_start_month: null,
      period_start_year: 2021,
      player_career_entries: [],
      player_types: [],
      profile_id: "agent-1",
    });
  });
});
