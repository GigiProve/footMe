import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import type { CompleteProfessionalProfile } from "../profile-service";
import { CoachInfoTab } from "./CoachInfoTab";

vi.mock("@expo/vector-icons/Ionicons", () => ({
  default: (props: Record<string, unknown>) => React.createElement("Ionicon", props),
}));

function buildCoachProfile(
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
    coachProfile: {
      achievements: [],
      availability_type: "REGIONS",
      available_from: "Da luglio",
      coached_categories: ["Promozione", "Juniores"],
      coached_clubs: ["USD Virtus"],
      contract_end: null,
      current_club: null,
      game_philosophy: "Squadra aggressiva e propositiva.",
      licenses: ["UEFA B"],
      media_items: [],
      open_to_new_role: true,
      play_styles: [],
      preferred_categories: [],
      preferred_formation: null,
      preferred_provinces: [],
      preferred_regions: ["Lombardia"],
      primary_role: "Allenatore",
      profile_id: "profile-1",
      secondary_formations: [],
      technical_video_url: "https://example.com/video.mp4",
    },
    playerCareerEntries: [],
    playerPalmares: [],
    playerProfile: null,
    profile: {
      age: 39,
      avatar_url: null,
      bio: "Allenatore orientato al lavoro sul campo.",
      birth_date: "1987-05-20",
      city: "Milano",
      current_location_city: null,
      current_location_country: null,
      domicile: "Milano",
      full_name: "Luca Bianchi",
      gender: "male",
      id: "profile-1",
      is_open_to_transfer: false,
      legal_status: null,
      languages: ["it"],
      nationality: "IT",
      region: "Lombardia",
      residence: "Milano",
      residence_country: null,
      role: "coach",
    },
    staffCareerEntries: [],
    staffCoachCareerEntries: [],
    staffPlayerCareerEntries: [],
    staffProfile: null,
    userContacts: {
      email: "coach@example.com",
      facebook: "",
      instagram: "coach_example",
      phone: "+393331234567",
      showEmail: true,
      showFacebook: false,
      showInstagram: true,
    },
    ...overrides,
  };
}

describe("CoachInfoTab", () => {
  it("renders the coach info cards and owner edit actions", () => {
    let tree!: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <CoachInfoTab
          completeProfile={buildCoachProfile()}
          isOwner
          onEdit={() => undefined}
        />,
      );
    });

    expect(tree.root.findByProps({ children: "Disponibile" })).toBeTruthy();
    expect(tree.root.findByProps({ children: "UEFA B" })).toBeTruthy();
    expect(tree.root.findByProps({ accessibilityLabel: "Modifica disponibilità" })).toBeTruthy();
    expect(tree.root.findByProps({ accessibilityLabel: "Modifica identità tecnica" })).toBeTruthy();
    expect(tree.root.findByProps({ accessibilityLabel: "Modifica risultati" })).toBeTruthy();
    expect(tree.root.findByProps({ accessibilityLabel: "Modifica contatti" })).toBeTruthy();
  });

  it("shows empty states and hides owner actions for visitors", () => {
    let tree!: TestRenderer.ReactTestRenderer;

    act(() => {
      tree = TestRenderer.create(
        <CoachInfoTab
          completeProfile={buildCoachProfile({
            coachProfile: {
              achievements: [],
              availability_type: null,
              available_from: null,
              coached_categories: [],
              coached_clubs: [],
              contract_end: null,
              current_club: null,
              game_philosophy: null,
              licenses: [],
              media_items: [],
              open_to_new_role: false,
              play_styles: [],
              preferred_categories: [],
              preferred_formation: null,
              preferred_provinces: [],
              preferred_regions: [],
              primary_role: null,
              profile_id: "profile-1",
              secondary_formations: [],
              technical_video_url: null,
            },
            userContacts: {
              email: "",
              facebook: "",
              instagram: "",
              phone: "",
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
    expect(tree.root.findByProps({ children: "Nessun risultato inserito." })).toBeTruthy();
    expect(() => tree.root.findByProps({ accessibilityLabel: "Modifica contatti" })).toThrow();
    expect(() => tree.root.findByProps({ accessibilityLabel: "Modifica disponibilità" })).toThrow();
  });
});
