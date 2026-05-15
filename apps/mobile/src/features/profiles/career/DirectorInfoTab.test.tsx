import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import type { CompleteProfessionalProfile } from "../profile-service";
import { DirectorInfoTab } from "./DirectorInfoTab";

vi.mock("@expo/vector-icons/Ionicons", () => ({
  default: (props: Record<string, unknown>) => React.createElement("Ionicon", props),
}));

function buildDirectorProfile(
  overrides: Partial<CompleteProfessionalProfile> = {},
): CompleteProfessionalProfile {
  return {
    agentCareerEntries: [],
    agentManagedPlayerEntries: [],
    agentProfile: null,
    club: null,
    clubSeasonEntries: [],
    coachCareerEntries: [],
    coachDirectorCareerEntries: [],
    coachPlayerCareerEntries: [],
    coachProfile: null,
    directorProfile: {
      career_entries: [],
      club_types: ["Societa dilettantistica"],
      director_roles: ["Direttore sportivo"],
      experience_categories: ["Eccellenza", "Serie D", "Settore giovanile"],
      has_other_football_experience: true,
      has_played_football: false,
      main_focus: "Prima squadra",
      market_involvement: "Solo supporto",
      other_football_roles: ["Scout"],
      player_career_entries: [],
      primary_role: "Direttore sportivo",
      profile_id: "director-1",
      responsibilities: [
        "Gestione rose e contratti",
        "Settore giovanile",
        "Mercato calciatori",
      ],
    },
    playerCareerEntries: [],
    playerPalmares: [],
    playerProfile: null,
    profile: {
      age: 44,
      avatar_url: null,
      bio:
        "Impegnato nella gestione e costruzione della rosa con attenzione allo sviluppo dei giovani prospetti.",
      birth_date: null,
      city: "Como",
      current_location_city: null,
      current_location_country: null,
      domicile: null,
      full_name: "Marco Rossi",
      gender: "male",
      id: "director-1",
      is_open_to_transfer: false,
      legal_status: null,
      languages: [],
      nationality: "IT",
      region: "Lombardia",
      residence: "Como",
      residence_country: null,
      role: "director",
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
    ...overrides,
  };
}

describe("DirectorInfoTab", () => {
  it("renders the Banani-aligned director info modules", () => {
    let tree!: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <DirectorInfoTab
          completeProfile={buildDirectorProfile()}
          onConnect={() => undefined}
          onMessage={() => undefined}
        />,
      );
    });

    expect(tree.root.findByProps({ children: "Collegati" })).toBeTruthy();
    expect(tree.root.findByProps({ children: "Invia un messaggio" })).toBeTruthy();
    expect(tree.root.findByProps({ children: "Direttore sportivo" })).toBeTruthy();
    expect(tree.root.findAllByProps({ children: "Prima squadra" }).length).toBeGreaterThan(0);
    expect(tree.root.findByProps({ children: "Costruzione rosa" })).toBeTruthy();
    expect(tree.root.findByProps({ children: "Sviluppo settore" })).toBeTruthy();
    expect(tree.root.findByProps({ children: "Valutazione opportunita" })).toBeTruthy();
    expect(tree.root.findByProps({ children: "Serie D" })).toBeTruthy();
    expect(tree.root.findByProps({ children: "Eccellenza" })).toBeTruthy();
    expect(tree.root.findByProps({ children: "Settore giovanile" })).toBeTruthy();
    expect(tree.root.findByProps({ children: "Lombardia" })).toBeTruthy();
    expect(tree.root.findByProps({ children: "Nord Italia" })).toBeTruthy();
    expect(tree.root.findByProps({ numberOfLines: 2 })).toBeTruthy();
  });

  it("falls back to the first role and omits empty optional sections", () => {
    let tree!: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <DirectorInfoTab
          completeProfile={buildDirectorProfile({
            directorProfile: {
              career_entries: [],
              club_types: [],
              director_roles: ["Team manager"],
              experience_categories: [],
              has_other_football_experience: false,
              has_played_football: false,
              main_focus: null,
              market_involvement: null,
              other_football_roles: [],
              player_career_entries: [],
              primary_role: null,
              profile_id: "director-1",
              responsibilities: [],
            },
            profile: {
              ...buildDirectorProfile().profile,
              bio: null,
              region: null,
              residence: "Milano",
            },
          })}
        />,
      );
    });

    expect(tree.root.findByProps({ children: "Team manager" })).toBeTruthy();
    expect(tree.root.findByProps({ children: "Attivita operative in definizione." })).toBeTruthy();
    expect(tree.root.findByProps({ children: "Milano" })).toBeTruthy();
    expect(tree.root.findAllByProps({ children: "DESCRIZIONE" })).toHaveLength(0);
  });
});
