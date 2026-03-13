import { beforeEach, describe, expect, it, vi } from "vitest";

import { updateCompleteProfessionalProfile } from "./profile-service";

const mocks = vi.hoisted(() => {
  const profileUpdateEqMock = vi.fn();
  const profileContactsUpsertMock = vi.fn();
  const privateContactsUpsertMock = vi.fn();
  const rpcMock = vi.fn();

  return {
    privateContactsUpsertMock,
    profileContactsUpsertMock,
    profileUpdateEqMock,
    rpcMock,
    fromMock: vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          update: vi.fn(() => ({
            eq: profileUpdateEqMock,
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
    coachProfile: null,
    playerCareerEntries: [],
    playerProfile: {
      height_cm: 180,
      highlight_video_url: null,
      preferred_categories: ["Promozione"],
      preferred_foot: "right" as const,
      primary_position: "striker" as const,
      secondary_position: null,
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
      is_available: true,
      is_open_to_transfer: true,
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
    mocks.profileContactsUpsertMock.mockReset();
    mocks.privateContactsUpsertMock.mockReset();
    mocks.rpcMock.mockReset();

    mocks.profileUpdateEqMock.mockResolvedValue({ error: null });
    mocks.profileContactsUpsertMock.mockResolvedValue({ error: null });
    mocks.privateContactsUpsertMock.mockResolvedValue({ error: null });
    mocks.rpcMock.mockResolvedValue({ error: null });
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
          season_label: "2024/2025",
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
          season_label: "2023/2024",
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
          season_label: "2024/2025",
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
          season_label: "2023/2024",
          sort_order: 1,
          team_logo_url: "https://example.com/perugia.png",
        },
      ],
      p_player_profile: {
        height_cm: 180,
        highlight_video_url: null,
        preferred_categories: ["Promozione"],
        preferred_foot: "right",
        primary_position: "striker",
        secondary_position: null,
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
          season_label: "2024/2025",
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
          season_label: "2024/2025",
          sort_order: 0,
          team_logo_url: "https://example.com/logo.png",
        },
      ],
      p_player_profile: {
        height_cm: 180,
        highlight_video_url: null,
        preferred_categories: ["Promozione"],
        preferred_foot: "right",
        primary_position: "striker",
        secondary_position: null,
        transfer_regions: ["Umbria"],
        weight_kg: 75,
        willing_to_change_club: true,
      },
      p_profile_id: "profile-1",
    });
  });
});
