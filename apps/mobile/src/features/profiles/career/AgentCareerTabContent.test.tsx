import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import type { CompleteProfessionalProfile } from "../profile-service";
import { AgentCareerTabContent } from "./AgentCareerTabContent";

vi.mock("@expo/vector-icons/Ionicons", () => ({
  default: (props: Record<string, unknown>) => React.createElement("Ionicon", props),
}));

function buildAgentProfile(
  overrides: Partial<CompleteProfessionalProfile> = {},
): CompleteProfessionalProfile {
  return {
    agentCareerEntries: [
      {
        agency_logo_url: null,
        agency_name: "North Eleven",
        agent_profile_id: "profile-1",
        id: "career-1",
        period_end_month: null,
        period_end_year: 2020,
        period_start_month: null,
        period_start_year: 2018,
        role: "Scout",
        sort_order: 0,
      },
    ],
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
        primary_position: "defender",
        sort_order: 0,
      },
      {
        agent_profile_id: "profile-1",
        avatar_url: null,
        birth_year: 2007,
        category_label: "Juniores",
        display_name: "Marco Neri",
        id: "managed-2",
        is_free_agent: false,
        linked_profile_id: "player-2",
        primary_position: "midfielder",
        sort_order: 1,
      },
      {
        agent_profile_id: "profile-1",
        avatar_url: null,
        birth_year: 2001,
        category_label: "Eccellenza",
        display_name: "Andrea Verdi",
        id: "managed-3",
        is_free_agent: true,
        linked_profile_id: null,
        primary_position: "forward",
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
      main_player_roles: ["defender", "midfielder"],
      managed_players_count: "3 giocatori",
      media_items: [],
      open_to_clubs: true,
      open_to_players: true,
      operational_focuses: ["Valorizzazione giovani", "Mercato dilettanti"],
      operational_note: "Nord Italia e inserimento in prima squadra.",
      operating_macro_areas: ["Nord Italia"],
      operating_regions: ["Lombardia", "Veneto"],
      other_football_roles: ["Ex calciatore"],
      period_end_month: null,
      period_end_year: null,
      period_start_month: null,
      period_start_year: 2021,
      player_career_entries: [],
      player_types: ["Entrambi"],
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
      bio: "Agente sportivo orientato al calcio dilettantistico.",
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
      languages: ["it", "en"],
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

describe("AgentCareerTabContent", () => {
  it("renders the current agency, portfolio KPI and previous experience", () => {
    let tree!: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <AgentCareerTabContent
          completeProfile={buildAgentProfile()}
          isOwner
          onEdit={() => undefined}
        />,
      );
    });

    expect(tree.root.findByProps({ children: "MB Football Management" })).toBeTruthy();
    expect(tree.root.findByProps({ children: 3 })).toBeTruthy();
    expect(tree.root.findByProps({ children: " giocatori gestiti" })).toBeTruthy();
    expect(tree.root.findByProps({ children: "Serie D" })).toBeTruthy();
    expect(tree.root.findByProps({ children: "Under" })).toBeTruthy();
    expect(tree.root.findByProps({ children: "Svincolati" })).toBeTruthy();
    expect(tree.root.findByProps({ children: "North Eleven" })).toBeTruthy();
  });
});
