import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import type { CompleteProfessionalProfile } from "../profile-service";
import { DirectorProfileTabView } from "./DirectorProfileTabView";

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
      career_entries: [
        {
          category: "Serie D",
          description:
            "Costruzione della rosa, gestione mercato e coordinamento con lo staff tecnico.",
          id: "director-career-1",
          role: "Direttore sportivo",
          seasons: ["2022/2023", "2023/2024", "2024/2025"],
          teamLogoUrl: "https://example.com/como.png",
          teamName: "AC Como",
        },
        {
          category: "Settore giovanile",
          id: "director-career-2",
          period_end_year: 2022,
          period_start_year: 2019,
          role: "Responsabile scouting",
          team_logo_url: "https://example.com/monza.png",
          team_name: "Monza",
        },
      ],
      coach_career_entries: [
        {
          category: "Under 17",
          description: "Gestione del gruppo e sviluppo tecnico individuale.",
          id: "coach-previous-1",
          role: "Allenatore Under 17",
          seasons: ["2017/2018", "2018/2019"],
          teamLogoUrl: "https://example.com/academy.png",
          teamName: "Como Academy",
        },
      ],
      club_types: ["Societa dilettantistica"],
      director_roles: ["Direttore sportivo"],
      experience_categories: ["Serie D"],
      has_other_football_experience: true,
      has_played_football: true,
      main_focus: "Prima squadra",
      market_involvement: "Si, attivamente",
      other_football_roles: ["Allenatore"],
      player_career_entries: [
        {
          category: "Serie D / Eccellenza",
          clubName: "AC Renate",
          goals: "4",
          id: "player-previous-1",
          seasonLabel: "2015/2016",
          teamLogoUrl: "https://example.com/renate.png",
        },
      ],
      primary_role: "Direttore sportivo",
      profile_id: "director-1",
      responsibilities: ["Gestione rose e contratti"],
    },
    playerCareerEntries: [],
    playerPalmares: [],
    playerProfile: null,
    profile: {
      age: 44,
      avatar_url: null,
      bio:
        "Esperienza nella gestione e costruzione di squadre con focus su sviluppo giovani.",
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

describe("DirectorProfileTabView", () => {
  it("renders the Banani-aligned director timeline and previous experiences", () => {
    let tree!: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <DirectorProfileTabView completeProfile={buildDirectorProfile()} />,
      );
    });

    expect(tree.root.findByProps({ children: "Carriera dirigenziale" })).toBeTruthy();
    expect(tree.root.findAllByProps({ children: "AC Como" }).length).toBeGreaterThan(0);
    expect(
      tree.root.findAllByProps({ children: "Direttore sportivo" }).length,
    ).toBeGreaterThan(0);
    expect(
      tree.root.findByProps({ children: "2022/23 - 2024/25 - Serie D" }),
    ).toBeTruthy();
    expect(
      tree.root.findByProps({
        children:
          "Costruzione della rosa, gestione mercato e coordinamento con lo staff tecnico.",
      }),
    ).toBeTruthy();
    expect(tree.root.findByProps({ accessibilityLabel: "Logo AC Como" })).toBeTruthy();

    expect(tree.root.findByProps({ children: "Esperienze precedenti" })).toBeTruthy();
    expect(tree.root.findByProps({ children: "Allenatore" })).toBeTruthy();
    expect(tree.root.findByProps({ children: "Como Academy" })).toBeTruthy();
    expect(tree.root.findAllByProps({ children: "Calciatore" }).length).toBeGreaterThan(0);
    expect(tree.root.findByProps({ children: "AC Renate" })).toBeTruthy();
  });

  it("normalizes snake_case legacy career entries and falls back to a shield logo", () => {
    let tree!: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <DirectorProfileTabView
          completeProfile={buildDirectorProfile({
            directorProfile: {
              ...buildDirectorProfile().directorProfile!,
              career_entries: [
                {
                  category: "Eccellenza",
                  id: "legacy-director-1",
                  period_end_year: 2021,
                  period_start_year: 2019,
                  role: "Team manager",
                  team_name: "Legacy Club",
                },
              ],
              coach_career_entries: [],
              player_career_entries: [],
            },
          })}
        />,
      );
    });

    expect(tree.root.findAllByProps({ children: "Legacy Club" }).length).toBeGreaterThan(0);
    expect(tree.root.findByProps({ children: "Team manager" })).toBeTruthy();
    expect(tree.root.findByProps({ children: "2019 - 2021 - Eccellenza" })).toBeTruthy();
    expect(tree.root.findAllByProps({ name: "shield" }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ children: "Esperienze precedenti" })).toHaveLength(0);
  });
});
