/**
 * Conteggi dell'hub Modifica profilo Allenatore (REV-PROF-05).
 *
 * I due errori che questa suite esiste per impedire:
 *  - contare le stagioni al posto delle esperienze (tre anni al Torino sono
 *    un'esperienza sola);
 *  - contare i contatti *salvati* invece di quelli davvero pubblici.
 */
import { describe, expect, it } from "vitest";

import type { CompleteProfessionalProfile } from "../profile-service";
import { buildCoachSectionSummary } from "./coach-hub-summaries";

function careerRow(seasonLabel: string, overrides: Record<string, unknown> = {}) {
  return {
    category: "Prima Squadra",
    club_id: null,
    coach_profile_id: "coach-1",
    description: null,
    experience_group_id: "torino",
    experience_type: "MULTI_SEASON",
    id: `row-${seasonLabel}`,
    period_end_month: null,
    period_end_year: null,
    period_start_month: null,
    period_start_year: null,
    results: [],
    role: "Allenatore",
    season_details: {},
    seasons: [seasonLabel],
    sort_order: 0,
    team_logo_url: null,
    team_name: "Torino FC",
    ...overrides,
  };
}

function buildProfile(
  overrides: Partial<CompleteProfessionalProfile> = {},
): CompleteProfessionalProfile {
  return {
    coachCareerEntries: [],
    coachDirectorCareerEntries: [],
    coachPlayerCareerEntries: [],
    coachProfile: {
      achievements: [],
      media_items: [],
    },
    profile: { full_name: "Luca Rossi", role: "coach" },
    userContacts: {
      email: "luca@example.com",
      facebook: "",
      instagram: "lucarossi.coach",
      phone: "+39 320 123 4567",
      showEmail: true,
      showFacebook: false,
      showInstagram: false,
      showPhone: false,
    },
    ...overrides,
  } as unknown as CompleteProfessionalProfile;
}

describe("Carriera", () => {
  it("conta le esperienze, non le stagioni", () => {
    const profile = buildProfile({
      coachCareerEntries: [
        careerRow("2022/2023"),
        careerRow("2023/2024"),
        careerRow("2024/2025"),
      ],
    } as Partial<CompleteProfessionalProfile>);

    expect(buildCoachSectionSummary("career", profile)).toBe("1 esperienza");
  });

  it("separa due incarichi distinti", () => {
    const profile = buildProfile({
      coachCareerEntries: [
        careerRow("2023/2024"),
        careerRow("2024/2025", {
          experience_group_id: "juve",
          id: "row-juve",
          team_name: "Juventus",
        }),
      ],
    } as Partial<CompleteProfessionalProfile>);

    expect(buildCoachSectionSummary("career", profile)).toBe("2 esperienze");
  });

  it("dice zero senza inventare una lista vuota", () => {
    expect(buildCoachSectionSummary("career", buildProfile())).toBe(
      "0 esperienze",
    );
  });
});

describe("Palmarès e media", () => {
  it("usa il singolare con un solo riconoscimento", () => {
    const profile = buildProfile({
      coachProfile: {
        achievements: [{ id: "a" }],
        media_items: [],
      },
    } as unknown as Partial<CompleteProfessionalProfile>);

    expect(buildCoachSectionSummary("awards", profile)).toBe(
      "1 riconoscimento",
    );
  });

  it("conta i contenuti media del profilo", () => {
    const profile = buildProfile({
      coachProfile: {
        achievements: [],
        media_items: [
          { id: "m1", type: "image", url: "https://example.com/1.jpg" },
          { id: "m2", type: "video", url: "https://example.com/2.mp4" },
        ],
      },
    } as unknown as Partial<CompleteProfessionalProfile>);

    expect(buildCoachSectionSummary("media", profile)).toBe("2 contenuti");
  });
});

describe("Contatti pubblici", () => {
  it("conta solo i contatti davvero visibili, non quelli salvati", () => {
    // Email pubblica, Instagram e telefono salvati ma privati.
    expect(buildCoachSectionSummary("contacts", buildProfile())).toBe(
      "1 contatto visibile",
    );
  });

  it("include il telefono quando il proprietario lo pubblica", () => {
    const profile = buildProfile({
      userContacts: {
        ...buildProfile().userContacts,
        showPhone: true,
      },
    } as Partial<CompleteProfessionalProfile>);

    expect(buildCoachSectionSummary("contacts", profile)).toBe(
      "2 contatti visibili",
    );
  });

  it("non conta nulla quando è tutto privato", () => {
    const profile = buildProfile({
      userContacts: {
        ...buildProfile().userContacts,
        showEmail: false,
      },
    } as Partial<CompleteProfessionalProfile>);

    expect(buildCoachSectionSummary("contacts", profile)).toBe(
      "0 contatti visibili",
    );
  });
});

describe("Sezioni a sottotitolo fisso", () => {
  it("non produce un conteggio per le voci della prima macroarea", () => {
    expect(buildCoachSectionSummary("personal", buildProfile())).toBeUndefined();
    expect(
      buildCoachSectionSummary("philosophy", buildProfile()),
    ).toBeUndefined();
  });
});
