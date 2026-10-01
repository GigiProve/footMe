/**
 * Payload di salvataggio della carriera Staff tecnico (REV-PROF-07).
 *
 * `save_staff_career_details` **cancella** tutto ciò che non trova nel
 * payload: è la trappola che rende necessario questo test. Salvare la carriera
 * nello staff non deve azzerare il percorso da allenatore, salvare un percorso
 * non deve azzerare la carriera, e nessuna delle due cose deve toccare il
 * ruolo principale dichiarato nel profilo.
 */
import { describe, expect, it } from "vitest";

import type { CompleteProfessionalProfile } from "../profile-service";
import type { CoachAssignment } from "../coach-career/coach-assignment-model";
import { buildStaffCareerPayload } from "./staff-career-service";

function assignment(
  overrides: Partial<CoachAssignment> & Pick<CoachAssignment, "id" | "groupId">,
): CoachAssignment {
  return {
    category: "Serie A",
    clubId: null,
    isOngoing: false,
    mode: "SINGLE_SEASON",
    period: null,
    role: "Preparatore atletico",
    seasonKey: "2024/2025",
    teamLogoUrl: "",
    teamName: "AC Milan",
    ...overrides,
  };
}

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
    directorProfile: null,
    playerCareerEntries: [],
    playerPalmares: [],
    playerProfile: null,
    profile: {
      age: 36,
      avatar_url: null,
      bio: null,
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
    staffCoachCareerEntries: [
      {
        category: "Juniores",
        club_id: null,
        description: null,
        experience_group_id: "coach-group",
        experience_type: "SINGLE_SEASON",
        head_coach_name: null,
        id: "coach-1",
        period_end_month: null,
        period_end_year: null,
        period_start_month: null,
        period_start_year: null,
        results: [],
        role: "Allenatore",
        season_details: {},
        seasons: ["2018/2019"],
        sort_order: 0,
        staff_profile_id: "profile-1",
        team_logo_url: null,
        team_name: "Pro Vercelli",
      },
    ],
    staffPlayerCareerEntries: [
      {
        appearances: 24,
        assists: 3,
        awards: null,
        career_type: "SINGLE_SEASON",
        category: "Serie C",
        experience_group_id: "player-group",
        goals: 5,
        id: "player-1",
        minutes_played: null,
        period_end_month: null,
        period_start_month: null,
        position: "Centrocampista",
        season: "2010/2011",
        season_period: "full",
        sort_order: 0,
        staff_profile_id: "profile-1",
        team_logo_url: null,
        team_name: "Como",
      },
    ],
    staffProfile: {
      availability_type: "REGIONS",
      available_from: "Da luglio",
      certifications: [],
      experience_entries: [],
      experience_summary: null,
      media_items: [],
      open_to_work: true,
      primary_staff_role: "Match analyst",
      preferred_categories: [],
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
      phone: "",
      showEmail: true,
      showFacebook: false,
      showInstagram: false,
      showPhone: false,
      showTikTok: false,
      showWebsite: false,
      showYouTube: false,
      tiktok: "",
      website: "",
      youtube: "",
    },
  } as CompleteProfessionalProfile;
}

describe("buildStaffCareerPayload", () => {
  it("non azzera i percorsi aggiuntivi quando salva la carriera nello staff", () => {
    const data = buildStaffProfile();

    const payload = buildStaffCareerPayload(data, {
      assignments: [assignment({ groupId: "milan", id: "milan-1" })],
    });

    expect(payload.staffCareerEntries).toHaveLength(1);
    expect(payload.staffCareerEntries?.[0]).toMatchObject({
      experience_group_id: "milan",
      role: "Preparatore atletico",
      seasons: ["2024/2025"],
      staff_profile_id: "profile-1",
    });
    // Le altre due carriere ripassano invariate: l'RPC cancella ciò che non
    // trova, quindi ometterle le eliminerebbe.
    expect(payload.staffCoachCareerEntries).toEqual(data.staffCoachCareerEntries);
    expect(payload.staffPlayerCareerEntries).toEqual(
      data.staffPlayerCareerEntries,
    );
  });

  it("non azzera la carriera nello staff quando salva il percorso da allenatore", () => {
    const data = buildStaffProfile();

    data.staffCareerEntries = [
      {
        category: "Serie A",
        club_id: null,
        description: null,
        experience_group_id: "milan",
        experience_type: "SINGLE_SEASON",
        head_coach_name: null,
        id: "staff-1",
        period_end_month: null,
        period_end_year: null,
        period_start_month: null,
        period_start_year: null,
        results: [],
        role: "Preparatore atletico",
        season_details: {},
        seasons: ["2024/2025"],
        sort_order: 0,
        staff_profile_id: "profile-1",
        team_logo_url: null,
        team_name: "AC Milan",
      },
    ];

    const payload = buildStaffCareerPayload(data, {
      coachAssignments: [
        assignment({
          groupId: "vercelli",
          id: "coach-1",
          role: "Allenatore",
          seasonKey: "2018/2019",
          teamName: "Pro Vercelli",
        }),
      ],
    });

    expect(payload.staffCareerEntries).toEqual(data.staffCareerEntries);
    expect(payload.staffCoachCareerEntries?.[0]).toMatchObject({
      experience_group_id: "vercelli",
      role: "Allenatore",
      team_name: "Pro Vercelli",
    });
  });

  it("non tocca il ruolo principale dichiarato nel profilo", () => {
    const data = buildStaffProfile();

    const payload = buildStaffCareerPayload(data, {
      assignments: [
        assignment({ groupId: "milan", id: "milan-1", role: "Fisioterapista" }),
      ],
    });

    expect(payload.staffProfile?.primary_staff_role).toBe("Match analyst");
    expect(payload.staffProfile?.staff_roles).toEqual(["Match analyst"]);
  });

  it("reimposta la data di nascita, che il payload base lascia vuota", () => {
    const data = buildStaffProfile();

    const payload = buildStaffCareerPayload(data, { assignments: [] });

    expect(payload.profile.birth_date).toBe("1990-02-10");
  });
});
