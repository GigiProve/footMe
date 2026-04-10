import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CompleteProfessionalProfile } from "./profile-service";
import { PublicProfileScreen } from "./PublicProfileScreen";
import { useSession } from "../auth/use-session";
import { getCompleteProfessionalProfile } from "./profile-service";

const backMock = vi.fn();
const localSearchParamsMock = vi.fn();

vi.mock("expo-router", () => ({
  Redirect: (props: Record<string, unknown>) => React.createElement("Redirect", props),
  useLocalSearchParams: () => localSearchParamsMock(),
  useRouter: () => ({
    back: backMock,
  }),
}));

vi.mock("../auth/use-session", () => ({
  useSession: vi.fn(),
}));

vi.mock("./profile-service", () => ({
  getCompleteProfessionalProfile: vi.fn(),
}));

vi.mock("./profile-edit-helpers", () => ({
  buildAgentProfileHeaderDetails: () => ({
    agencyLabel: "MB Football Management",
    bio: null,
    fullName: "Davide Rossi",
    locationLabel: "Milano",
    primaryRole: "Agente sportivo",
    statusBadge: "Licenza FIGC",
  }),
  buildCoachProfileHeaderDetails: () => null,
  buildHeaderDetails: () => null,
  buildPlayerProfileHeaderDetails: () => null,
  buildStaffProfileHeaderDetails: () => null,
}));

vi.mock("./AgentProfileHeader", () => ({
  AgentProfileHeader: ({
    onEditProfilePress,
  }: {
    onEditProfilePress?: () => void;
  }) =>
    React.createElement(
      "AgentProfileHeader",
      { mode: onEditProfilePress ? "owner" : "visitor" },
      onEditProfilePress ? "owner" : "visitor",
    ),
}));

vi.mock("./career/AgentProfileTabView", () => ({
  AgentProfileTabView: ({ isOwner }: { isOwner: boolean }) =>
    React.createElement("AgentProfileTabView", { isOwner }, isOwner ? "owner" : "visitor"),
}));

vi.mock("./career/ProfileTabView", () => ({
  ProfileTabView: ({ isOwner }: { isOwner: boolean }) =>
    React.createElement("ProfileTabView", { isOwner }, isOwner ? "owner" : "visitor"),
}));

vi.mock("./career/CoachProfileTabView", () => ({
  CoachProfileTabView: ({ isOwner }: { isOwner: boolean }) =>
    React.createElement("CoachProfileTabView", { isOwner }, isOwner ? "owner" : "visitor"),
}));

vi.mock("./career/StaffProfileTabView", () => ({
  StaffProfileTabView: ({ isOwner }: { isOwner: boolean }) =>
    React.createElement("StaffProfileTabView", { isOwner }, isOwner ? "owner" : "visitor"),
}));

vi.mock("./ProfileReadonlyView", () => ({
  ProfileReadonlyView: ({ editable }: { editable?: boolean }) =>
    React.createElement("ProfileReadonlyView", { editable }, editable ? "editable" : "readonly"),
}));

vi.mock("./profile-screen-components", () => ({
  CoachProfileHeader: () => React.createElement("CoachProfileHeader"),
  PlayerProfileHeader: () => React.createElement("PlayerProfileHeader"),
  ProfileHeader: () => React.createElement("ProfileHeader"),
  StaffProfileHeader: () => React.createElement("StaffProfileHeader"),
}));

vi.mock("@expo/vector-icons/Ionicons", () => {
  const MockIonicons = Object.assign(
    (props: Record<string, unknown>) => React.createElement("Ionicon", props),
    {
      glyphMap: {
        "chevron-back": 1,
      },
    },
  );

  return {
    default: MockIonicons,
  };
});

function buildAgentProfile(): CompleteProfessionalProfile {
  return {
    agentCareerEntries: [],
    agentManagedPlayerEntries: [],
    agentProfile: {
      agency_logo_url: null,
      agency_name: "MB Football Management",
      agency_role: "Founder",
      federation: "FIGC",
      has_other_football_experience: false,
      has_played_football: false,
      is_federation_licensed: true,
      main_player_roles: [],
      managed_players_count: null,
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
      period_start_year: null,
      player_career_entries: [],
      player_types: [],
      profile_id: "agent-2",
    },
    club: null,
    clubSeasonEntries: [],
    coachCareerEntries: [],
    coachDirectorCareerEntries: [],
    coachPlayerCareerEntries: [],
    coachProfile: null,
    playerCareerEntries: [],
    playerPalmares: [],
    playerProfile: null,
    profile: {
      age: 38,
      avatar_url: null,
      bio: null,
      birth_date: null,
      city: "Milano",
      full_name: "Davide Rossi",
      id: "agent-2",
      is_open_to_transfer: false,
      languages: [],
      nationality: null,
      region: "Lombardia",
      role: "agent",
    },
    staffCareerEntries: [],
    staffCoachCareerEntries: [],
    staffPlayerCareerEntries: [],
    staffProfile: null,
    userContacts: {
      email: "",
      facebook: "",
      instagram: "",
      phone: "",
      showEmail: false,
      showFacebook: false,
      showInstagram: false,
    },
  };
}

describe("PublicProfileScreen", () => {
  beforeEach(() => {
    backMock.mockReset();
    localSearchParamsMock.mockReset();
    vi.mocked(useSession).mockReset();
    vi.mocked(getCompleteProfessionalProfile).mockReset();
  });

  it("redirects to the owner profile when the requested id matches the session user", () => {
    localSearchParamsMock.mockReturnValue({ id: "user-1" });
    vi.mocked(useSession).mockReturnValue({
      isLoading: false,
      needsOnboarding: false,
      profile: null,
      refreshProfile: vi.fn(),
      session: {
        user: {
          id: "user-1",
        },
      } as never,
    });

    let tree!: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(<PublicProfileScreen />);
    });

    expect(tree.root.findByProps({ href: "/(tabs)/profile" })).toBeTruthy();
  });

  it("renders a remote agent profile in visitor mode", async () => {
    localSearchParamsMock.mockReturnValue({ id: "agent-2" });
    vi.mocked(useSession).mockReturnValue({
      isLoading: false,
      needsOnboarding: false,
      profile: {
        avatar_url: null,
        city: "Milano",
        club_id: null,
        club_name: null,
        full_name: "Mario Rossi",
        id: "user-1",
        is_admin: false,
        region: "Lombardia",
        role: "player",
      },
      refreshProfile: vi.fn(),
      session: {
        user: {
          id: "user-1",
        },
      } as never,
    });
    vi.mocked(getCompleteProfessionalProfile).mockResolvedValue(buildAgentProfile());

    let tree!: TestRenderer.ReactTestRenderer;

    await act(async () => {
      tree = TestRenderer.create(<PublicProfileScreen />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(tree.root.findByProps({ mode: "visitor" })).toBeTruthy();
    expect(tree.root.findByProps({ isOwner: false })).toBeTruthy();
  });
});
