import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CompleteProfessionalProfile } from "../profile-service";
import { AgentInfoTab } from "./AgentInfoTab";

const pushMock = vi.fn();

vi.mock("expo-router", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("@expo/vector-icons/Ionicons", () => {
  const MockIonicons = Object.assign(
    (props: Record<string, unknown>) => React.createElement("Ionicon", props),
    {
      glyphMap: {
        "business-outline": 1,
        "checkmark": 1,
        "chevron-down": 1,
        "chevron-forward": 1,
        "chevron-up": 1,
        close: 1,
        "logo-facebook": 1,
        "logo-instagram": 1,
        "mail-outline": 1,
        pencil: 1,
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
    agentManagedPlayerEntries: [
      {
        agent_profile_id: "profile-1",
        avatar_url: null,
        birth_year: 2004,
        category_label: "Serie D",
        display_name: "Luca Bianchi",
        id: "managed-1",
        is_free_agent: false,
        linked_profile_id: "player-1",
        primary_position: "midfielder",
        sort_order: 0,
      },
      {
        agent_profile_id: "profile-1",
        avatar_url: null,
        birth_year: 2007,
        category_label: "Juniores",
        display_name: "Marco Rossi",
        id: "managed-2",
        is_free_agent: false,
        linked_profile_id: "player-2",
        primary_position: "forward",
        sort_order: 1,
      },
      {
        agent_profile_id: "profile-1",
        avatar_url: null,
        birth_year: 1999,
        category_label: "Eccellenza",
        display_name: "Andrea Verdi",
        id: "managed-3",
        is_free_agent: true,
        linked_profile_id: null,
        primary_position: "defender",
        sort_order: 2,
      },
    ],
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
  });

  it("renders the portfolio focus and filters the managed players list", () => {
    let tree!: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <AgentInfoTab
          completeProfile={buildAgentProfile()}
          isOwner={false}
          onEdit={() => undefined}
        />,
      );
    });

    expect(
      tree.root.findByProps({ children: "Giocatori rappresentati (3)" }),
    ).toBeTruthy();
    expect(tree.root.findByProps({ children: "Svincolati" })).toBeTruthy();
    expect(() => tree.root.findByProps({ children: "MB Football Management" })).toThrow();
    expect(() => tree.root.findByProps({ children: "FIGC" })).toThrow();

    const categoryTrigger = tree.root.findByProps({
      accessibilityLabel: "Apri filtro Categoria",
    });

    act(() => {
      categoryTrigger.props.onPress();
    });

    const selectSerieD = tree.root.findByProps({
      accessibilityLabel: "Seleziona Categoria Serie D",
    });

    act(() => {
      selectSerieD.props.onPress();
    });

    expect(
      tree.root.findByProps({ accessibilityLabel: "Rimuovi filtro Serie D" }),
    ).toBeTruthy();
    expect(
      tree.root.findByProps({ accessibilityLabel: "Apri profilo di Luca Bianchi" }),
    ).toBeTruthy();
    expect(() =>
      tree.root.findByProps({ accessibilityLabel: "Andrea Verdi, profilo non collegato" }),
    ).toThrow();
  });

  it("navigates only for linked players", () => {
    let tree!: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <AgentInfoTab
          completeProfile={buildAgentProfile()}
          isOwner={false}
          onEdit={() => undefined}
        />,
      );
    });

    const linkedRow = tree.root.findByProps({
      accessibilityLabel: "Apri profilo di Luca Bianchi",
    });
    const manualRow = tree.root.findByProps({
      accessibilityLabel: "Andrea Verdi, profilo non collegato",
    });

    act(() => {
      linkedRow.props.onPress();
    });

    expect(pushMock).toHaveBeenCalledWith("/profile/player-1");
    expect(manualRow.props.onPress).toBeUndefined();
  });
});
