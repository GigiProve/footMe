/**
 * Conteggi dell'hub Modifica profilo Staff tecnico (REV-PROF-08).
 *
 * Le tre regole che la task isola — carriera solo staff, percorsi contati come
 * percorsi e non come esperienze, contatti solo se pubblici e validi — sono
 * calcoli puri: si provano qui, senza montare una schermata.
 */
import { describe, expect, it } from "vitest";

import type { CompleteProfessionalProfile } from "../profile-service";
import {
  buildStaffSectionSummary,
  countStaffAdditionalPaths,
  countStaffExperiences,
  countStaffPublicContacts,
} from "./staff-hub-summaries";

let entryId = 0;

function staffEntry(overrides: Record<string, unknown> = {}) {
  entryId += 1;

  return {
    category: "Serie D",
    club_id: null,
    description: null,
    experience_group_id: "group-1",
    experience_type: "SINGLE_SEASON",
    head_coach_name: null,
    id: `entry-${entryId}`,
    period_end_month: null,
    period_end_year: null,
    period_start_month: null,
    period_start_year: null,
    results: [],
    role: "Preparatore atletico",
    season_details: {},
    seasons: ["2023/2024"],
    sort_order: 0,
    staff_profile_id: "staff-1",
    team_logo_url: null,
    team_name: "ASD Prova",
    ...overrides,
  };
}

function staffPlayerEntry(overrides: Record<string, unknown> = {}) {
  entryId += 1;

  return {
    appearances: null,
    assists: null,
    awards: null,
    career_type: "SINGLE_SEASON",
    category: "Serie D",
    club_id: null,
    experience_group_id: "player-group",
    goals: null,
    id: `player-${entryId}`,
    minutes_played: null,
    period_end_month: null,
    period_start_month: null,
    position: "Centrocampista",
    season: "2015/2016",
    season_period: "full",
    sort_order: 0,
    staff_profile_id: "staff-1",
    team_logo_url: null,
    team_name: "US Vecchia",
    ...overrides,
  };
}

function buildProfile(
  overrides: Partial<CompleteProfessionalProfile> = {},
): CompleteProfessionalProfile {
  return {
    profile: { id: "staff-1", role: "staff" },
    staffCareerEntries: [],
    staffCoachCareerEntries: [],
    staffPlayerCareerEntries: [],
    staffProfile: { media_items: [], staff_roles: [] },
    userContacts: {
      email: "",
      facebook: "",
      instagram: "",
      phone: "",
      showEmail: false,
      showFacebook: false,
      showInstagram: false,
      showPhone: false,
    },
    ...overrides,
  } as unknown as CompleteProfessionalProfile;
}

describe("Conteggio Carriera", () => {
  it("conta le esperienze nello staff e ignora i percorsi aggiuntivi", () => {
    const data = buildProfile({
      staffCareerEntries: [
        staffEntry({ team_name: "ASD Prova", experience_group_id: "g1" }),
        staffEntry({ team_name: "ASD Prova", experience_group_id: "g1", seasons: ["2024/2025"] }),
        staffEntry({ team_name: "US Altro", experience_group_id: "g2" }),
      ],
      staffCoachCareerEntries: [
        staffEntry({ team_name: "Da allenatore", experience_group_id: "c1" }),
      ],
    } as unknown as Partial<CompleteProfessionalProfile>);

    // Due società, non tre record: la seconda stagione non è una seconda
    // esperienza, e l'esperienza da allenatore non entra nel conto.
    expect(countStaffExperiences(data)).toBe(2);
    expect(buildStaffSectionSummary("career", data)).toBe("2 esperienze");
  });

  it("dice «Nessuna esperienza» invece di «0 esperienze»", () => {
    expect(buildStaffSectionSummary("career", buildProfile())).toBe(
      "Nessuna esperienza",
    );
  });

  it("usa il singolare con una sola esperienza", () => {
    const data = buildProfile({
      staffCareerEntries: [staffEntry()],
    } as unknown as Partial<CompleteProfessionalProfile>);

    expect(buildStaffSectionSummary("career", data)).toBe("1 esperienza");
  });
});

describe("Conteggio Percorsi aggiuntivi", () => {
  it("conta i percorsi, non le esperienze che contengono", () => {
    const data = buildProfile({
      staffCoachCareerEntries: [
        staffEntry({ experience_group_id: "c1", team_name: "Club A" }),
        staffEntry({ experience_group_id: "c2", team_name: "Club B" }),
      ],
    } as unknown as Partial<CompleteProfessionalProfile>);

    expect(countStaffAdditionalPaths(data)).toBe(1);
    expect(buildStaffSectionSummary("paths", data)).toBe("1 percorso");
  });

  it("arriva al massimo a due percorsi", () => {
    const data = buildProfile({
      staffCoachCareerEntries: [staffEntry({ experience_group_id: "c1" })],
      staffPlayerCareerEntries: [staffPlayerEntry()],
    } as unknown as Partial<CompleteProfessionalProfile>);

    expect(buildStaffSectionSummary("paths", data)).toBe("2 percorsi");
  });

  it("dichiara l'assenza invece di mostrare zero", () => {
    expect(buildStaffSectionSummary("paths", buildProfile())).toBe(
      "Nessun percorso aggiunto",
    );
  });
});

describe("Conteggio Contatti pubblici", () => {
  it("conta solo i contatti configurati, validi e pubblici", () => {
    const data = buildProfile({
      userContacts: {
        email: "staff@example.com",
        facebook: "",
        instagram: "@profilo",
        phone: "+39 320 1234567",
        showEmail: true,
        showFacebook: false,
        // Instagram è configurato ma privato: non entra nel conto.
        showInstagram: false,
        showPhone: true,
      },
    } as unknown as Partial<CompleteProfessionalProfile>);

    expect(countStaffPublicContacts(data)).toBe(2);
    expect(buildStaffSectionSummary("contacts", data)).toBe(
      "2 contatti visibili",
    );
  });

  it("non pubblica un contatto acceso ma vuoto", () => {
    const data = buildProfile({
      userContacts: {
        email: "",
        facebook: "",
        instagram: "",
        phone: "",
        showEmail: true,
        showFacebook: false,
        showInstagram: false,
        showPhone: true,
      },
    } as unknown as Partial<CompleteProfessionalProfile>);

    expect(buildStaffSectionSummary("contacts", data)).toBe(
      "Nessun contatto visibile",
    );
  });
});

describe("Conteggio Media", () => {
  it("usa il conteggio canonico dei contenuti del profilo", () => {
    const data = buildProfile({
      staffProfile: {
        media_items: [
          { id: "m1", type: "image", url: "https://example.com/1.jpg" },
          { id: "m2", type: "video", url: "https://example.com/2.mp4" },
        ],
        staff_roles: [],
      },
    } as unknown as Partial<CompleteProfessionalProfile>);

    expect(buildStaffSectionSummary("media", data)).toBe("2 contenuti");
    expect(buildStaffSectionSummary("media", buildProfile())).toBe(
      "Nessun contenuto",
    );
  });
});

describe("Voci senza conteggio", () => {
  it("lascia il sottotitolo fisso alle tre voci della prima macroarea", () => {
    const data = buildProfile();

    expect(buildStaffSectionSummary("personal", data)).toBeUndefined();
    expect(buildStaffSectionSummary("professional", data)).toBeUndefined();
    expect(buildStaffSectionSummary("opportunities", data)).toBeUndefined();
  });
});
