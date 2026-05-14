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
      current_location_city: null,
      current_location_country: null,
      domicile: "Bergamo",
      full_name: "Andrea Colombo",
      gender: "male",
      id: "profile-1",
      is_open_to_transfer: false,
      legal_status: null,
      languages: ["it"],
      nationality: "IT",
      region: "Lombardia",
      residence: "Bergamo",
      residence_country: null,
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

function buildCoachProfile(): CompleteProfessionalProfile {
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
      coached_categories: ["Promozione"],
      coached_clubs: ["USD Virtus"],
      contract_end: null,
      current_club: null,
      game_philosophy: "Pressione alta e intensità.",
      licenses: ["UEFA B"],
      media_items: [],
      open_to_new_role: true,
      play_styles: ["Pressing alto"],
      preferred_categories: [],
      preferred_formation: "4-3-3",
      preferred_provinces: [],
      preferred_regions: ["Lombardia"],
      primary_role: "Allenatore",
      profile_id: "coach-1",
      secondary_formations: [],
      technical_video_url: null,
    },
    playerCareerEntries: [],
    playerPalmares: [],
    playerProfile: null,
    profile: {
      age: 44,
      avatar_url: null,
      bio: "Allenatore propositivo.",
      birth_date: "1982-01-10",
      city: null,
      current_location_city: "Bruxelles",
      current_location_country: "BE",
      domicile: null,
      full_name: "Marco Ferri",
      gender: "male",
      id: "coach-1",
      is_open_to_transfer: false,
      legal_status: "pending_permit",
      languages: ["it", "en"],
      nationality: "BR",
      region: null,
      residence: null,
      residence_country: "IT",
      role: "coach",
    },
    staffCareerEntries: [],
    staffCoachCareerEntries: [],
    staffPlayerCareerEntries: [],
    staffProfile: null,
    userContacts: {
      email: "coach@example.com",
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

  it("round-trips coach primary role, availability timing and international profile fields", () => {
    const completeProfile = buildCoachProfile();

    const initialState = buildInitialState(completeProfile);

    expect(initialState.coachPrimaryRole).toBe("Allenatore");
    expect(initialState.coachAvailableFrom).toBe("Da luglio");
    expect(initialState.residenceCountry).toBe("IT");
    expect(initialState.currentLocationCountry).toBe("BE");
    expect(initialState.currentLocationCity).toBe("Bruxelles");
    expect(initialState.legalStatus).toBe("pending_permit");

    const payload = buildFullUpdatePayload(completeProfile, {
      ...initialState,
      coachAvailableFrom: "Fine stagione",
      coachPrimaryRole: "Vice allenatore",
      currentLocationCity: "Anversa",
      currentLocationCountry: "BE",
      legalStatus: "has_permit",
      residenceCountry: "NL",
    });

    expect(payload.coachProfile).toMatchObject({
      available_from: "Fine stagione",
      primary_role: "Vice allenatore",
    });
    expect(payload.profile).toMatchObject({
      current_location_city: "Anversa",
      current_location_country: "BE",
      legal_status: "has_permit",
      residence: null,
      residence_country: "NL",
    });
  });
});
