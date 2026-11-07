/**
 * Test della proiezione professionale del candidato (§36).
 *
 * Qui stanno i rischi di §18: una stagione contata due volte, un totale
 * sommato al proprio sottoperiodo, una «categoria più alta» dedotta da un
 * confronto fra stringhe, uno zero al posto di un dato assente. Le fixture
 * sono quelle di §33 — Mario con 82/14/11 su cinque stagioni e Serie C come
 * categoria più alta — costruite dai dati di dominio e non da costanti.
 */
import { describe, expect, it } from "vitest";

import {
  buildCandidateInsight,
  highestSeniorCategory,
} from "./candidate-insight";
import type { CompleteProfessionalProfile } from "../../profiles/profile-service";

type PlayerSeason = {
  appearances: number | null;
  assists: number | null;
  category: string;
  club: string;
  goals: number | null;
  season: string;
};

/** Le cinque stagioni di Mario (§33): 12+10+18+20+22 = 82, 1+0+4+4+5 = 14, 1+1+3+3+3 = 11. */
const MARIO_SEASONS: PlayerSeason[] = [
  { appearances: 22, assists: 3, category: "Serie D", club: "AC Legnano", goals: 5, season: "2025/2026" },
  { appearances: 20, assists: 3, category: "Serie D", club: "Sangiuliano City", goals: 4, season: "2024/2025" },
  { appearances: 18, assists: 3, category: "Serie C", club: "Pro Patria", goals: 4, season: "2023/2024" },
  { appearances: 10, assists: 1, category: "Serie D", club: "Pro Patria", goals: 0, season: "2022/2023" },
  { appearances: 12, assists: 1, category: "Eccellenza", club: "Varzina", goals: 1, season: "2021/2022" },
];

function playerEntry(season: PlayerSeason, index: number) {
  return {
    appearances: season.appearances,
    assists: season.assists,
    awards: null,
    career_type: null,
    club_id: null,
    club_name: season.club,
    competition_name: season.category,
    experience_group_id: `grp-${season.club}-${season.season}`,
    goals: season.goals,
    id: `exp-${index}`,
    minutes_played: null,
    period_end_month: null,
    period_start_month: null,
    season_label: season.season,
    season_period: "full",
    sort_order: index,
    team_logo_url: null,
  };
}

function playerProfile(
  seasons: PlayerSeason[],
  overrides: Record<string, unknown> = {},
): CompleteProfessionalProfile {
  return {
    playerCareerEntries: seasons.map(playerEntry),
    playerProfile: {
      height_cm: 182,
      preferred_foot: "right",
      primary_position: "midfielder",
      secondary_positions: [],
      ...overrides,
    },
    profile: { id: "mario", role: "player" },
  } as unknown as CompleteProfessionalProfile;
}

describe("highestSeniorCategory", () => {
  it("usa l'ordinamento di dominio, non il confronto fra stringhe", () => {
    expect(highestSeniorCategory(["Serie D", "Serie C", "Eccellenza"])).toBe(
      "Serie C",
    );
    /* "Eccellenza" < "Serie D" in ordine alfabetico: un confronto fra
       stringhe darebbe la risposta sbagliata. */
    expect(highestSeniorCategory(["Serie D", "Eccellenza"])).toBe("Serie D");
  });

  it("non confronta scale incomparabili", () => {
    /* §18: «Non confrontare stringhe, ID numerici arbitrari o competizioni
       incomparabili.» Le giovanili sono una scala parallela. */
    expect(highestSeniorCategory(["Under 17", "Primavera"])).toBeNull();
  });

  it("omette il dato quando nessuna categoria è riconoscibile", () => {
    expect(highestSeniorCategory([null, "", "Coppa amatori"])).toBeNull();
  });
});

describe("buildCandidateInsight — Calciatore", () => {
  const insight = buildCandidateInsight({
    profile: playerProfile(MARIO_SEASONS),
    role: "player",
  });

  it("produce i totali della fixture dai dati, non da costanti", () => {
    expect(insight.stats).toEqual([
      { key: "appearances", label: "Presenze", value: 82 },
      { key: "goals", label: "Gol", value: 14 },
      { key: "assists", label: "Assist", value: 11 },
    ]);
  });

  it("riproduce la sintesi di carriera dello screen 05", () => {
    expect(insight.careerSummary).toBe("5 stagioni · Categoria più alta Serie C");
  });

  it("non conta due volte una stagione coperta da due esperienze", () => {
    /* §18: «Due esperienze nella stessa stagione non equivalgono
       automaticamente a due stagioni.» */
    const doubled = buildCandidateInsight({
      profile: playerProfile([
        ...MARIO_SEASONS,
        {
          appearances: null,
          assists: null,
          category: "Serie D",
          club: "Altra squadra",
          goals: null,
          season: "2025/2026",
        },
      ]),
      role: "player",
    });

    /* Sei esperienze, cinque stagioni distinte: la sesta copre una stagione
       già presente e non ne aggiunge una. */
    expect(doubled.careerSummary).toBe("5 stagioni · Categoria più alta Serie C");
  });

  it("mostra il profilo sportivo e non quello professionale", () => {
    expect(insight.professionalEyebrow).toBe("Profilo sportivo");
    expect(insight.professionalLines[1]).toBe("Destro · 182 cm");
  });

  it("mostra al massimo due esperienze recenti, nell'ordine canonico", () => {
    expect(insight.experiences).toHaveLength(2);
    expect(insight.experiences[0].clubName).toBe("AC Legnano");
    expect(insight.experiences[1].clubName).toBe("Sangiuliano City");
  });

  it("non trasforma una metrica assente in zero", () => {
    /* §18: «Zero è mostrabile solo come valore effettivo. Una metrica
       assente o privata non diventa zero.» */
    const partial = buildCandidateInsight({
      profile: playerProfile([
        {
          appearances: null,
          assists: null,
          category: "Serie D",
          club: "AC Legnano",
          goals: null,
          season: "2025/2026",
        },
      ]),
      role: "player",
    });

    expect(partial.stats?.map((stat) => stat.value)).toEqual([null, null, null]);
  });

  it("mostra uno zero effettivo", () => {
    const zeroed = buildCandidateInsight({
      profile: playerProfile([
        {
          appearances: 5,
          assists: 0,
          category: "Serie D",
          club: "AC Legnano",
          goals: 0,
          season: "2025/2026",
        },
      ]),
      role: "player",
    });

    expect(zeroed.stats?.map((stat) => stat.value)).toEqual([5, 0, 0]);
  });
});

function coachEntry(input: {
  club: string;
  category: string;
  role: string;
  seasons: string[];
}) {
  return {
    category: input.category,
    club_id: null,
    created_at: null,
    description: null,
    experience_group_id: `grp-${input.club}-${input.seasons[0]}`,
    experience_type: "SINGLE_SEASON",
    id: `exp-${input.club}-${input.seasons[0]}`,
    period_end_month: null,
    period_end_year: null,
    period_start_month: null,
    period_start_year: null,
    results: [],
    role: input.role,
    season_details: {},
    seasons: input.seasons,
    sort_order: 0,
    team_logo_url: null,
    team_name: input.club,
  };
}

describe("buildCandidateInsight — Allenatore, Staff, Dirigente", () => {
  const coach = buildCandidateInsight({
    profile: {
      coachCareerEntries: [
        coachEntry({ club: "Alcione", category: "Serie C", role: "Allenatore", seasons: ["2025/2026"] }),
        coachEntry({ club: "Varese", category: "Under 17", role: "Vice allenatore", seasons: ["2024/2025"] }),
      ],
      coachProfile: { licenses: ["UEFA B"], primary_role: "Allenatore" },
      profile: { id: "luca", role: "coach" },
    } as unknown as CompleteProfessionalProfile,
    role: "coach",
  });

  it("non espone statistiche da calciatore", () => {
    /* §17: «nessun blocco Presenze/Gol/Assist». `null` è l'assenza del
       blocco, non una lista vuota. */
    expect(coach.stats).toBeNull();
  });

  it("mostra la qualifica resa pubblica dal profilo", () => {
    expect(coach.professionalLines).toEqual(["Allenatore", "UEFA B"]);
  });

  it("deriva l'ambito dalle categorie effettive della carriera", () => {
    expect(coach.careerSummary).toBe("2 stagioni · Prima squadra e giovanili");
  });

  it("ordina le esperienze dalla più recente, col ruolo di quella stagione", () => {
    expect(coach.experiences.map((experience) => experience.clubName)).toEqual([
      "Alcione",
      "Varese",
    ]);
    expect(coach.experiences[1].line).toContain("Vice allenatore");
  });

  it("legge la carriera jsonb del Dirigente senza tabelle nuove", () => {
    const director = buildCandidateInsight({
      profile: {
        directorProfile: {
          career_entries: [
            {
              category: "Serie D",
              role: "Direttore sportivo",
              seasons: ["2025/2026"],
              team_name: "Varese",
            },
          ],
          experience_categories: ["Prima squadra", "Settore giovanile"],
          primary_role: "Direzione sportiva",
        },
        profile: { id: "marco", role: "director" },
      } as unknown as CompleteProfessionalProfile,
      role: "director",
    });

    expect(director.stats).toBeNull();
    expect(director.professionalLines[0]).toBe("Direzione sportiva");
    expect(director.experiences[0]?.clubName).toBe("Varese");
  });

  it("tace sui blocchi professionali per una tipologia non prevista", () => {
    /* §16: «non impedire l'accesso a una candidatura altrimenti valida». */
    const other = buildCandidateInsight({
      profile: {
        profile: { id: "x", role: "fan" },
      } as unknown as CompleteProfessionalProfile,
      role: null,
    });

    expect(other.professionalLines).toEqual([]);
    expect(other.careerSummary).toBeNull();
    expect(other.stats).toBeNull();
  });
});
