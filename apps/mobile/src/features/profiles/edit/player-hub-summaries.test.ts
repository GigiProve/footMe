/**
 * §F.2 / §AA — i riepiloghi dell'hub sono costruiti sui dati reali.
 *
 * I casi qui dentro sono quelli in cui è facile sbagliare: contare stagioni al
 * posto di esperienze, lasciar sfuggire un enum, mostrare territori di un
 * giocatore che non è disponibile, o stampare "null".
 */
import { describe, expect, it } from "vitest";


import type { CompleteProfessionalProfile } from "../profile-service";
import {
  buildAwardsSummary,
  buildCareerSummary,
  buildCurrentSituationSummary,
  buildMediaSummary,
  buildOpportunitiesSummary,
  buildPersonalSummary,
  buildPhotoSummary,
  buildPublicContactsSummary,
  buildTechnicalSummary,
} from "./player-hub-summaries";

type CareerRow = {
  career_type?: string;
  club_name: string;
  competition_name: string;
  experience_group_id?: string;
  season_label: string;
};

/** Stagione in corso rispetto a NOW, cosi il test non scade. */
const NOW = new Date("2025-03-01T00:00:00.000Z");
const CURRENT_SEASON = "2024/2025";

function careerRow(overrides: Partial<CareerRow> & Pick<CareerRow, "season_label">) {
  return {
    appearances: 10,
    assists: null,
    awards: "",
    career_type: "MULTI_SEASON",
    club_id: null,
    club_name: "ASD Romano Prodi",
    competition_name: "Serie A",
    experience_group_id: "exp-a",
    goals: 3,
    id: `row-${overrides.season_label}`,
    minutes_played: null,
    period_end_month: null,
    period_start_month: null,
    season_period: "full",
    sort_order: 0,
    team_logo_url: null,
    ...overrides,
  };
}

function buildProfile(
  overrides: Partial<CompleteProfessionalProfile> = {},
): CompleteProfessionalProfile {
  return {
    playerCareerEntries: [],
    playerPalmares: [],
    playerProfile: {
      availability_type: "REGIONS",
      contract_status: "tesserato",
      media_items: [],
      media_urls: [],
      preferred_categories: [],
      primary_position: "striker",
      secondary_positions: ["right_winger"],
      transfer_provinces: [],
      transfer_regions: ["Lazio", "Sicilia"],
      willing_to_change_club: true,
    },
    profile: {
      avatar_url: "https://example.com/a.jpg",
      birth_date: "1999-04-12",
      city: "Roma",
      cover_url: "https://example.com/cover.jpg",
      nationality: "IT",
      residence: "Roma",
    },
    userContacts: {
      email: "salvo@example.com",
      facebook: "",
      instagram: "salvosalvini_9",
      phone: "+39 345 678 9012",
      showEmail: true,
      showFacebook: false,
      showInstagram: true,
    },
    ...overrides,
  } as unknown as CompleteProfessionalProfile;
}

describe("Riepiloghi hub — Profilo", () => {
  it("riassume foto e copertina con la copy dello Screen Master", () => {
    expect(buildPhotoSummary(buildProfile())).toBe("Foto profilo e copertina");
  });

  it("nomina solo l'immagine che c'è davvero", () => {
    const onlyAvatar = buildProfile({
      profile: { ...buildProfile().profile, cover_url: null },
    } as Partial<CompleteProfessionalProfile>);

    expect(buildPhotoSummary(onlyAvatar)).toBe("Foto profilo");
    expect(
      buildPhotoSummary(
        buildProfile({
          profile: { avatar_url: null, cover_url: null },
        } as Partial<CompleteProfessionalProfile>),
      ),
    ).toBe("Da completare");
  });

  it("elenca i dati personali davvero compilati", () => {
    expect(buildPersonalSummary(buildProfile())).toBe(
      "Nascita, nazionalità e residenza",
    );
  });

  it("non inventa nulla quando i dati personali mancano", () => {
    const empty = buildProfile({
      profile: {
        avatar_url: null,
        birth_date: null,
        city: null,
        nationality: null,
        residence: null,
      },
    } as Partial<CompleteProfessionalProfile>);

    expect(buildPersonalSummary(empty)).toBe("Da completare");
  });

  it("mostra ruolo principale e secondario tradotti, mai l'enum", () => {
    const summary = buildTechnicalSummary(buildProfile());

    expect(summary).toBe("Attaccante · Ala destra");
    expect(summary).not.toContain("striker");
  });

  it("omette il ruolo secondario quando non c'è", () => {
    const profile = buildProfile({
      playerProfile: {
        ...buildProfile().playerProfile,
        secondary_positions: [],
      },
    } as Partial<CompleteProfessionalProfile>);

    expect(buildTechnicalSummary(profile)).toBe("Attaccante");
  });
});

describe("Riepiloghi hub — Opportunità", () => {
  it("nomina le regioni reali, non gli ID", () => {
    expect(buildOpportunitiesSummary(buildProfile())).toBe(
      "Disponibile · Lazio, Sicilia",
    );
  });

  it("non stampa mai ALL_ITALY come testo utente", () => {
    for (const availability_type of ["ITALY", "ALL_ITALY"]) {
      const profile = buildProfile({
        playerProfile: { ...buildProfile().playerProfile, availability_type },
      } as Partial<CompleteProfessionalProfile>);

      const summary = buildOpportunitiesSummary(profile);

      expect(summary).toBe("Disponibile · Ovunque in Italia");
      expect(summary).not.toContain("ALL_ITALY");
    }
  });

  it("elenca le province quando la modalità è per province", () => {
    const profile = buildProfile({
      playerProfile: {
        ...buildProfile().playerProfile,
        availability_type: "PROVINCES",
        transfer_provinces: ["Milano", "Bergamo"],
        transfer_regions: [],
      },
    } as Partial<CompleteProfessionalProfile>);

    expect(buildOpportunitiesSummary(profile)).toBe("Disponibile · Milano, Bergamo");
  });

  it("tace sui territori quando il trasferimento è disattivato (§J.2)", () => {
    const profile = buildProfile({
      playerProfile: {
        ...buildProfile().playerProfile,
        willing_to_change_club: false,
      },
    } as Partial<CompleteProfessionalProfile>);

    const summary = buildOpportunitiesSummary(profile);

    expect(summary).toBe("Non disponibile al trasferimento");
    expect(summary).not.toContain("Lazio");
  });
});

describe("Riepiloghi hub — Percorso e visibilità", () => {
  it("conta le esperienze, non le stagioni", () => {
    const profile = buildProfile({
      playerCareerEntries: [
        careerRow({ season_label: "2024/2025" }),
        careerRow({ season_label: "2023/2024" }),
        careerRow({ season_label: "2022/2023" }),
      ],
    } as unknown as Partial<CompleteProfessionalProfile>);

    // Tre stagioni, una sola esperienza: lo stesso experience_group_id.
    expect(buildCareerSummary(profile)).toBe("1 esperienza");
  });

  it("conta esperienze distinte quando i gruppi differiscono", () => {
    const profile = buildProfile({
      playerCareerEntries: [
        careerRow({ season_label: "2024/2025" }),
        careerRow({
          club_name: "FC Trastevere",
          experience_group_id: "exp-b",
          season_label: "2021/2022",
        }),
      ],
    } as unknown as Partial<CompleteProfessionalProfile>);

    expect(buildCareerSummary(profile)).toBe("2 esperienze");
  });

  it("dice che non c'è carriera invece di mostrare zero", () => {
    expect(buildCareerSummary(buildProfile())).toBe("Nessuna esperienza");
  });

  it("deriva la situazione attuale dalla carriera e traduce lo stato", () => {
    const profile = buildProfile({
      playerCareerEntries: [careerRow({ season_label: CURRENT_SEASON })],
    } as unknown as Partial<CompleteProfessionalProfile>);

    const summary = buildCurrentSituationSummary(profile, NOW);

    expect(summary).toContain("ASD Romano Prodi");
    expect(summary).toContain("Sotto contratto");
    expect(summary).not.toContain("tesserato");
  });

  it("non inventa un club quando non c'è esperienza corrente", () => {
    const profile = buildProfile({
      playerProfile: { ...buildProfile().playerProfile, contract_status: null },
    } as Partial<CompleteProfessionalProfile>);

    expect(buildCurrentSituationSummary(profile)).toBe("Nessuna esperienza attuale");
  });

  it("accorda i riconoscimenti al singolare e al plurale", () => {
    expect(buildAwardsSummary(buildProfile())).toBe("Nessun riconoscimento");
    expect(
      buildAwardsSummary(
        buildProfile({
          playerPalmares: [{}],
        } as unknown as Partial<CompleteProfessionalProfile>),
      ),
    ).toBe("1 riconoscimento");
    expect(
      buildAwardsSummary(
        buildProfile({
          playerPalmares: [{}, {}],
        } as unknown as Partial<CompleteProfessionalProfile>),
      ),
    ).toBe("2 riconoscimenti");
  });

  it("conta i contatti pubblici, non quelli salvati", () => {
    // Instagram ed email sono visibili, il telefono non è un canale pubblico.
    expect(buildPublicContactsSummary(buildProfile())).toBe("2 contatti visibili");
  });

  it("non conta un contatto salvato ma reso privato", () => {
    const profile = buildProfile({
      userContacts: {
        ...buildProfile().userContacts,
        showEmail: false,
        showInstagram: false,
      },
    } as Partial<CompleteProfessionalProfile>);

    expect(buildPublicContactsSummary(profile)).toBe("Nessun contatto visibile");
  });

  it("conta i contenuti media, legacy inclusi", () => {
    const profile = buildProfile({
      playerProfile: {
        ...buildProfile().playerProfile,
        media_items: [],
        media_urls: ["https://example.com/1.jpg", "https://example.com/2.mp4"],
      },
    } as Partial<CompleteProfessionalProfile>);

    expect(buildMediaSummary(profile)).toBe("2 contenuti");
    expect(buildMediaSummary(buildProfile())).toBe("Nessun contenuto");
  });
});
