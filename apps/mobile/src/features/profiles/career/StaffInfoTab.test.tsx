import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import type { CompleteProfessionalProfile } from "../profile-service";
import { StaffInfoTab } from "./StaffInfoTab";

vi.mock("@expo/vector-icons/Ionicons", () => ({
  default: (props: Record<string, unknown>) => React.createElement("Ionicon", props),
}));

function buildStaffProfile(
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
    playerCareerEntries: [],
    playerPalmares: [],
    playerProfile: null,
    profile: {
      age: 38,
      avatar_url: null,
      bio: "Professionista orientato alla performance.",
      birth_date: "1988-05-20",
      city: "Milano",
      current_location_city: null,
      current_location_country: null,
      domicile: "Milano",
      full_name: "Matteo Ferrari",
      gender: "male",
      id: "profile-1",
      is_open_to_transfer: false,
      legal_status: null,
      languages: ["it"],
      nationality: "IT",
      region: "Lombardia",
      residence: "Milano",
      residence_country: null,
      role: "staff",
    },
    staffCareerEntries: [
      {
        category: "Serie D",
        club_id: null,
        description: "Monitoraggio performance e prevenzione infortuni.",
        experience_type: "SINGLE_SEASON",
        head_coach_name: "Marco Rossi",
        id: "staff-exp-1",
        period_end_month: null,
        period_end_year: null,
        period_start_month: null,
        period_start_year: null,
        results: [],
        role: "Preparatore atletico",
        season_details: {
          "2024/2025": {
            category: "Serie D",
            role: "Preparatore atletico",
          },
        },
        seasons: ["2024/2025"],
        sort_order: 0,
        staff_profile_id: "profile-1",
        team_logo_url: null,
        team_name: "USD Virtus",
      },
    ],
    staffCoachCareerEntries: [
      {
        category: "Eccellenza",
        club_id: null,
        description: "Supporto al recupero e gestione carichi settimanali.",
        experience_type: "SINGLE_SEASON",
        head_coach_name: "Luca Bianchi",
        id: "staff-exp-2",
        period_end_month: null,
        period_end_year: null,
        period_start_month: null,
        period_start_year: null,
        results: [],
        role: "Collaboratore tecnico",
        season_details: {
          "2023/2024": {
            category: "Eccellenza",
            role: "Collaboratore tecnico",
          },
        },
        seasons: ["2023/2024"],
        sort_order: 1,
        staff_profile_id: "profile-1",
        team_logo_url: null,
        team_name: "ASD Aurora",
      },
    ],
    staffPlayerCareerEntries: [
      {
        appearances: 24,
        assists: 4,
        category: "Serie D",
        goals: 3,
        id: "player-exp-1",
        position: "central_midfielder",
        season: "2018/2019",
        sort_order: 0,
        staff_profile_id: "profile-1",
        team_logo_url: null,
        team_name: "USD Virtus",
      },
    ],
    staffProfile: {
      availability_type: "REGIONS",
      available_from: "Da luglio",
      certifications: ["Laurea in Scienze Motorie", "UEFA Fitness"],
      experience_entries: [],
      experience_summary: "Lavoro su carichi, recupero e prevenzione infortuni.",
      media_items: [],
      open_to_work: true,
      primary_staff_role: "Preparatore atletico",
      preferred_categories: ["Serie D", "Eccellenza"],
      preferred_provinces: [],
      preferred_regions: ["Lombardia", "Piemonte"],
      profile_id: "profile-1",
      specialization: "fitness_coach",
      staff_roles: ["Preparatore atletico", "Match analyst"],
    },
    userContacts: {
      email: "staff@example.com",
      facebook: "",
      instagram: "matteo.ferrari_fit",
      phone: "+393331234567",
      showEmail: true,
      showFacebook: false,
      showInstagram: true,
    },
    ...overrides,
  };
}

describe("StaffInfoTab", () => {
  it("renders the redesigned professional card with owner actions", () => {
    let tree!: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <StaffInfoTab
          completeProfile={buildStaffProfile()}
          isOwner
          onEdit={() => undefined}
        />,
      );
    });

    expect(tree.root.findByProps({ children: "Disponibile" })).toBeTruthy();
    expect(tree.root.findByProps({ children: "Lombardia • Piemonte" })).toBeTruthy();
    expect(
      tree.root.findAllByProps({ children: "Serie D • Eccellenza" }).length,
    ).toBeGreaterThan(0);
    expect(tree.root.findByProps({ children: "Da luglio" })).toBeTruthy();
    expect(tree.root.findByProps({ children: "Preparatore atletico" })).toBeTruthy();
    expect(tree.root.findByProps({ children: "Match analyst" })).toBeTruthy();
    expect(tree.root.findByProps({ children: "2 anni esperienza" })).toBeTruthy();
    expect(tree.root.findByProps({ children: "Laurea in Scienze Motorie" })).toBeTruthy();
    expect(tree.root.findByProps({ children: "Marco Rossi" })).toBeTruthy();
    expect(tree.root.findByProps({ children: "Luca Bianchi" })).toBeTruthy();
    expect(tree.root.findByProps({ children: "Ex Centrocampista centrale" })).toBeTruthy();
    expect(tree.root.findByProps({ children: "staff@example.com" })).toBeTruthy();
    expect(
      tree.root.findByProps({
        accessibilityLabel: "Modifica disponibilita e profilo staff",
      }),
    ).toBeTruthy();
    expect(tree.root.findByProps({ accessibilityLabel: "Modifica contatti" })).toBeTruthy();
  });

  it("hides empty staff sections for visitors and keeps private phone hidden", () => {
    let tree!: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <StaffInfoTab
          completeProfile={buildStaffProfile({
            staffCareerEntries: [],
            staffCoachCareerEntries: [],
            staffPlayerCareerEntries: [],
            staffProfile: {
              availability_type: "ITALY",
              available_from: null,
              certifications: [],
              experience_entries: [],
              experience_summary: null,
              media_items: [],
              open_to_work: false,
              primary_staff_role: null,
              preferred_categories: [],
              preferred_provinces: [],
              preferred_regions: [],
              profile_id: "profile-1",
              specialization: "match_analyst",
              staff_roles: [],
            },
            userContacts: {
              email: "",
              facebook: "",
              instagram: "",
              phone: "+393331234567",
              showEmail: false,
              showFacebook: false,
              showInstagram: false,
            },
          })}
          isOwner={false}
          onEdit={() => undefined}
        />,
      );
    });

    expect(tree.root.findByProps({ children: "Non disponibile" })).toBeTruthy();
    expect(tree.root.findAllByProps({ children: "PROFILO OPERATIVO" })).toHaveLength(0);
    expect(tree.root.findAllByProps({ children: "HA LAVORATO CON" })).toHaveLength(0);
    expect(tree.root.findAllByProps({ children: "BACKGROUND" })).toHaveLength(0);
    expect(tree.root.findAllByProps({ children: "+393331234567" })).toHaveLength(0);
    expect(() =>
      tree.root.findByProps({
        accessibilityLabel: "Modifica disponibilita e profilo staff",
      }),
    ).toThrow();
    expect(() =>
      tree.root.findByProps({ accessibilityLabel: "Modifica contatti" }),
    ).toThrow();
  });
});
