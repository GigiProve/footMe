import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CompleteProfessionalProfile } from "../profile-service";
import { AgentInfoTab } from "./AgentInfoTab";

const pushMock = vi.fn();
const fetchAgentAssistitiMock = vi.fn();

vi.mock("expo-router", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("../../relationships/agent-representation-service", () => ({
  cancelRequest: vi.fn(),
  fetchAgentAssistiti: (...args: unknown[]) => fetchAgentAssistitiMock(...args),
  getRelationshipTypeLabel: (t: string) =>
    t === "procuratore"
      ? "Procuratore"
      : t === "intermediario"
        ? "Intermediario"
        : "Referente sportivo",
}));

vi.mock("@expo/vector-icons/Ionicons", () => {
  const MockIonicons = Object.assign(
    (props: Record<string, unknown>) => React.createElement("Ionicon", props),
    {
      glyphMap: {
        "business-outline": 1,
        checkmark: 1,
        "chevron-down": 1,
        "chevron-forward": 1,
        "chevron-up": 1,
        close: 1,
        "logo-facebook": 1,
        "logo-instagram": 1,
        "mail-outline": 1,
        pencil: 1,
        "people-outline": 1,
        "shield-checkmark-outline": 1,
      },
    },
  );

  return {
    default: MockIonicons,
  };
});

function buildAgentProfile(
  overrides: Partial<CompleteProfessionalProfile> = {},
): CompleteProfessionalProfile {
  return {
    agentCareerEntries: [],
    agentManagedPlayerEntries: [],
    agentProfile: {
      agency_logo_url: null,
      agency_name: "MB Football Management",
      agency_role: "Founder",
      federation: "FIGC",
      has_other_football_experience: true,
      has_played_football: true,
      is_federation_licensed: true,
      main_player_roles: ["midfielder", "forward"],
      managed_players_count: "3 giocatori",
      media_items: [],
      open_to_clubs: true,
      open_to_players: true,
      operational_focuses: ["Valorizzazione giovani"],
      operational_note: null,
      operating_macro_areas: ["Nord Italia"],
      operating_regions: ["Lombardia", "Veneto"],
      other_football_roles: [],
      period_end_month: null,
      period_end_year: null,
      period_start_month: null,
      period_start_year: 2021,
      player_career_entries: [],
      player_types: ["Giovani", "Senior"],
      profile_id: "profile-1",
    },
    club: null,
    clubSeasonEntries: [],
    coachCareerEntries: [],
    coachDirectorCareerEntries: [],
    coachPlayerCareerEntries: [],
    coachProfile: null,
    directorProfile: null,
    playerCareerEntries: [],
    playerPalmares: [],
    playerProfile: null,
    profile: {
      age: 35,
      avatar_url: null,
      bio: "Agente sportivo.",
      birth_date: "1991-05-10",
      city: "Milano",
      current_location_city: null,
      current_location_country: null,
      domicile: null,
      full_name: "Davide Rossi",
      gender: null,
      id: "profile-1",
      is_open_to_transfer: false,
      legal_status: null,
      languages: ["it"],
      nationality: "IT",
      region: "Lombardia",
      residence: "Milano",
      residence_country: null,
      role: "agent",
    },
    staffCareerEntries: [],
    staffCoachCareerEntries: [],
    staffPlayerCareerEntries: [],
    staffProfile: null,
    userContacts: {
      email: "agent@example.com",
      facebook: "",
      instagram: "agent_profile",
      phone: "+393331234567",
      showEmail: true,
      showFacebook: false,
      showInstagram: true,
    },
    ...overrides,
  };
}

describe("AgentInfoTab", () => {
  beforeEach(() => {
    pushMock.mockReset();
    fetchAgentAssistitiMock.mockReset();
    fetchAgentAssistitiMock.mockResolvedValue([]);
  });

  it("renders the positioning copy and the Assistiti section", async () => {
    let tree!: TestRenderer.ReactTestRenderer;

    await act(async () => {
      tree = TestRenderer.create(
        <AgentInfoTab
          completeProfile={buildAgentProfile()}
          isOwner={false}
          onEdit={() => undefined}
        />,
      );
    });

    expect(
      tree.root.findAllByProps({ children: "Valorizzazione giovani" }).length,
    ).toBeGreaterThan(0);
    expect(tree.root.findByProps({ children: "Assistiti" })).toBeTruthy();
    expect(fetchAgentAssistitiMock).toHaveBeenCalledWith("profile-1");
  });

  it("lets the owner open the add-assistito flow", async () => {
    let tree!: TestRenderer.ReactTestRenderer;

    await act(async () => {
      tree = TestRenderer.create(
        <AgentInfoTab
          completeProfile={buildAgentProfile()}
          isOwner
          onEdit={() => undefined}
        />,
      );
    });

    const addButton = tree.root.findByProps({
      label: "+ Aggiungi assistito",
    });

    act(() => {
      addButton.props.onPress();
    });

    expect(pushMock).toHaveBeenCalledWith("/representation/add");
  });
});
