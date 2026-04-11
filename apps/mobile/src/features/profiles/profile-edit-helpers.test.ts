import { describe, expect, it } from "vitest";

import {
  buildFullUpdatePayload,
  buildInitialState,
} from "./profile-edit-helpers";
import type { CompleteProfessionalProfile } from "./profile-service";

function buildStaffProfile(): CompleteProfessionalProfile {
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
      age: 36,
      avatar_url: null,
      bio: "Match analyst con esperienza tra prima squadra e Primavera.",
      birth_date: "1990-02-10",
      city: "Bergamo",
      full_name: "Andrea Colombo",
      id: "profile-1",
      is_open_to_transfer: false,
      languages: ["it"],
      nationality: "IT",
      region: "Lombardia",
      role: "staff",
    },
    staffCareerEntries: [],
    staffCoachCareerEntries: [],
    staffPlayerCareerEntries: [],
    staffProfile: {
      availability_type: "REGIONS",
      available_from: "Da luglio",
      certifications: ["FIGC Match Analysis"],
      experience_entries: [],
      experience_summary: "Analisi video e supporto in campo.",
      media_items: [],
      open_to_work: true,
      primary_staff_role: "Match analyst",
      preferred_categories: ["Serie D", "Primavera 2"],
      preferred_provinces: [],
      preferred_regions: ["Lombardia"],
      profile_id: "profile-1",
      specialization: "match_analyst",
      staff_roles: ["Match analyst"],
    },
    userContacts: {
      email: "andrea@example.com",
      facebook: "",
      instagram: "",
      phone: "+393331234567",
      showEmail: true,
      showFacebook: false,
      showInstagram: false,
    },
  };
}

describe("profile-edit-helpers staff roundtrip", () => {
  it("preserves staff availability timing and preferred categories", () => {
    const completeProfile = buildStaffProfile();

    const initialState = buildInitialState(completeProfile);

    expect(initialState.staffAvailableFrom).toBe("Da luglio");
    expect(initialState.staffPreferredCategories).toBe("Serie D, Primavera 2");

    const payload = buildFullUpdatePayload(completeProfile, {
      ...initialState,
      preferredRegions: "Piemonte, Lombardia",
      staffAvailabilityType: "REGIONS",
      staffAvailableFrom: "Fine stagione",
      staffPreferredCategories: "Eccellenza, Promozione",
      staffPreferredProvinces: "Milano, Monza e Brianza",
    });

    expect(payload.staffProfile).toMatchObject({
      availability_type: "REGIONS",
      available_from: "Fine stagione",
      preferred_categories: ["Eccellenza", "Promozione"],
      preferred_provinces: ["Milano", "Monza e Brianza"],
      preferred_regions: ["Piemonte", "Lombardia"],
    });
  });
});
