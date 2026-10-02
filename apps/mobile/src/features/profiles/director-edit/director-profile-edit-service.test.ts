/**
 * Payload per sezione della Modifica profilo Dirigente (REV-PROF-11).
 *
 * `director_profiles` si scrive con un `upsert` che riscrive la riga intera:
 * la proprietà che conta è che ogni payload parta dal profilo canonico, così
 * salvare una sezione non azzera le altre. Qui si prova proprio quello, senza
 * montare nessuna schermata.
 */
import { describe, expect, it } from "vitest";

import type { CompleteProfessionalProfile } from "../profile-service";
import { buildDirectorSectionPayload } from "./director-profile-edit-service";

const CAREER = [
  {
    category: "Serie C",
    id: "dir-a",
    role: "Direttore sportivo",
    seasons: ["2023/2024"],
    teamName: "ASD Prova",
    type: "SINGLE_SEASON",
  },
];

const PLAYER_CAREER = [
  { clubName: "Lecco", id: "p-1", seasonLabel: "2008/2009" },
];

function buildProfile(): CompleteProfessionalProfile {
  return {
    clubSeasonEntries: [],
    directorProfile: {
      availability_type: "REGIONS",
      career_entries: CAREER,
      coach_career_entries: [],
      club_types: ["Societa dilettantistica"],
      director_roles: ["Direttore sportivo"],
      experience_categories: ["Serie C"],
      has_other_football_experience: false,
      has_played_football: true,
      main_focus: "Entrambi",
      market_involvement: null,
      media_items: [
        {
          id: "media-1",
          is_featured: true,
          linked_targets: [],
          type: "image",
          url: "https://example.com/a.jpg",
        },
      ],
      open_to_clubs: true,
      open_to_others: false,
      open_to_players: false,
      open_to_staff: true,
      open_to_work: true,
      other_career_entries: [],
      other_football_roles: [],
      other_role_label: null,
      player_career_entries: PLAYER_CAREER,
      preferred_provinces: [],
      preferred_regions: ["Sicilia"],
      previous_roles: ["player"],
      primary_role: "Direttore sportivo",
      profile_id: "director-1",
      responsibilities: ["Mercato calciatori"],
      staff_career_entries: [],
    },
    playerCareerEntries: [],
    playerPalmares: [],
    profile: {
      avatar_url: null,
      bio: "Bio esistente.",
      birth_date: "1980-04-12",
      cover_url: null,
      full_name: "Salvatore Burgio",
      id: "director-1",
      languages: ["Italiano"],
      nationality: "IT",
      region: "Sicilia",
      residence: "Palermo",
      role: "director",
    },
    userContacts: {
      email: "salvatore@example.com",
      facebook: "",
      instagram: "",
      phone: "",
      showEmail: true,
      showFacebook: false,
      showInstagram: false,
      showPhone: false,
    },
  } as unknown as CompleteProfessionalProfile;
}

describe("payload per sezione del Dirigente", () => {
  it("riscrive le cinque carriere identiche quando la sezione non le riguarda", () => {
    const payload = buildDirectorSectionPayload(buildProfile(), {
      directorProfile: { main_focus: "Prima squadra" },
    });

    expect(payload.directorProfile?.main_focus).toBe("Prima squadra");
    expect(payload.directorProfile?.career_entries).toEqual(CAREER);
    expect(payload.directorProfile?.player_career_entries).toEqual(
      PLAYER_CAREER,
    );
    expect(payload.directorProfile?.coach_career_entries).toEqual([]);
    expect(payload.directorProfile?.staff_career_entries).toEqual([]);
    expect(payload.directorProfile?.other_career_entries).toEqual([]);
  });

  it("non perde i media salvando un'altra sezione", () => {
    const payload = buildDirectorSectionPayload(buildProfile(), {
      directorProfile: { responsibilities: ["Budget e finanze"] },
    });

    expect(payload.directorProfile?.media_items).toHaveLength(1);
  });

  it("conserva la disponibilità salvando i dati personali", () => {
    const payload = buildDirectorSectionPayload(buildProfile(), {
      fullName: "Salvatore Burgio",
    });

    expect(payload.directorProfile?.open_to_work).toBe(true);
    expect(payload.directorProfile?.availability_type).toBe("REGIONS");
    expect(payload.directorProfile?.preferred_regions).toEqual(["Sicilia"]);
  });

  it("reimposta la data di nascita, che il payload condiviso lascia a null", () => {
    const payload = buildDirectorSectionPayload(buildProfile(), {});

    expect(payload.profile.birth_date).toBe("1980-04-12");
  });

  it("dichiara il ruolo director, così l'upsert giusto viene eseguito", () => {
    const payload = buildDirectorSectionPayload(buildProfile(), {});

    expect(payload.role).toBe("director");
    expect(payload.profileId).toBe("director-1");
  });

  it("non inventa un profilo Dirigente quando non esiste", () => {
    const data = buildProfile();
    const payload = buildDirectorSectionPayload(
      { ...data, directorProfile: null } as CompleteProfessionalProfile,
      { directorProfile: { main_focus: "Prima squadra" } },
    );

    expect(payload.directorProfile).toBeUndefined();
  });
});
