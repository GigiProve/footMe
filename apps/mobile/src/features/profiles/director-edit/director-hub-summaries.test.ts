/**
 * Conteggi dell'hub Modifica profilo Dirigente (REV-PROF-11, "Conteggi").
 *
 * Sono regole, non etichette: un numero sbagliato qui racconta all'utente una
 * carriera che non ha. Si provano senza montare una schermata perché il
 * modulo è puro.
 */
import { describe, expect, it } from "vitest";

import type { CompleteProfessionalProfile } from "../profile-service";
import {
  buildDirectorSectionSummary,
  countDirectorAdditionalPaths,
  countDirectorExperiences,
} from "./director-hub-summaries";

const DIRECTOR_ENTRY = {
  category: "Serie C",
  id: "dir-a",
  role: "Direttore sportivo",
  seasons: ["2023/2024", "2024/2025"],
  teamName: "ASD Prova",
  type: "MULTI_SEASON",
};

function buildProfile(
  directorOverrides: Record<string, unknown> = {},
  overrides: Record<string, unknown> = {},
): CompleteProfessionalProfile {
  return {
    directorProfile: {
      career_entries: [DIRECTOR_ENTRY],
      coach_career_entries: [],
      media_items: [],
      other_career_entries: [],
      player_career_entries: [],
      staff_career_entries: [],
      ...directorOverrides,
    },
    profile: { id: "director-1", role: "director" },
    userContacts: {
      email: "dirigente@example.com",
      facebook: "",
      instagram: "",
      phone: "+39 320 7654321",
      showEmail: true,
      showFacebook: false,
      showInstagram: false,
      showPhone: false,
    },
    ...overrides,
  } as unknown as CompleteProfessionalProfile;
}

describe("conteggio delle esperienze dirigenziali", () => {
  it("raggruppa le stagioni della stessa esperienza, come il Master Profile", () => {
    // Due stagioni nella stessa società restano un'esperienza sola.
    expect(countDirectorExperiences(buildProfile())).toBe(1);
  });

  it("non somma i percorsi aggiuntivi alla carriera dirigenziale", () => {
    const profile = buildProfile({
      coach_career_entries: [
        { id: "c-1", seasons: ["2019/2020"], teamName: "Como", type: "SINGLE_SEASON" },
      ],
      player_career_entries: [
        { clubName: "Lecco", id: "p-1", seasonLabel: "2008/2009" },
      ],
    });

    expect(countDirectorExperiences(profile)).toBe(1);
  });

  it("usa il singolare e il plurale giusti, e una frase quando è a zero", () => {
    expect(buildDirectorSectionSummary("career", buildProfile())).toBe(
      "1 esperienza",
    );
    expect(
      buildDirectorSectionSummary(
        "career",
        buildProfile({
          career_entries: [
            DIRECTOR_ENTRY,
            { ...DIRECTOR_ENTRY, id: "dir-b", teamName: "US Altro" },
          ],
        }),
      ),
    ).toBe("2 esperienze");
    expect(
      buildDirectorSectionSummary("career", buildProfile({ career_entries: [] })),
    ).toBe("Nessuna esperienza");
  });
});

describe("conteggio dei percorsi aggiuntivi", () => {
  it("conta i percorsi non vuoti, non le esperienze che contengono", () => {
    const profile = buildProfile({
      coach_career_entries: [
        { id: "c-1", seasons: ["2019/2020"], teamName: "Como", type: "SINGLE_SEASON" },
        { id: "c-2", seasons: ["2020/2021"], teamName: "Lecco", type: "SINGLE_SEASON" },
      ],
      player_career_entries: [
        { clubName: "Lecco", id: "p-1", seasonLabel: "2008/2009" },
      ],
    });

    // Quattro esperienze in due percorsi: il numero da mostrare è due.
    expect(countDirectorAdditionalPaths(profile)).toBe(2);
    expect(buildDirectorSectionSummary("paths", profile)).toBe("2 percorsi");
  });

  it("arriva a quattro, uno per ciascun percorso supportato", () => {
    const profile = buildProfile({
      coach_career_entries: [
        { id: "c-1", seasons: ["2019/2020"], teamName: "Como", type: "SINGLE_SEASON" },
      ],
      other_career_entries: [
        { id: "o-1", role: "Scout", seasons: ["2018/2019"], teamName: "Pro Patria", type: "SINGLE_SEASON" },
      ],
      player_career_entries: [
        { clubName: "Lecco", id: "p-1", seasonLabel: "2008/2009" },
      ],
      staff_career_entries: [
        { id: "s-1", seasons: ["2017/2018"], teamName: "Monza", type: "SINGLE_SEASON" },
      ],
    });

    expect(countDirectorAdditionalPaths(profile)).toBe(4);
  });

  it("non mostra «0 percorsi» ma una frase", () => {
    expect(buildDirectorSectionSummary("paths", buildProfile())).toBe(
      "Nessun percorso aggiunto",
    );
  });
});

describe("conteggio dei contatti pubblici", () => {
  it("conta solo i contatti davvero visibili, non quelli salvati", () => {
    // Il telefono c'è ma è privato: non entra nel conteggio.
    expect(buildDirectorSectionSummary("contacts", buildProfile())).toBe(
      "1 contatto visibile",
    );
  });

  it("aggiorna il conteggio quando un contatto diventa pubblico", () => {
    const profile = buildProfile(
      {},
      {
        userContacts: {
          email: "dirigente@example.com",
          facebook: "",
          instagram: "",
          phone: "+39 320 7654321",
          showEmail: true,
          showFacebook: false,
          showInstagram: false,
          showPhone: true,
        },
      },
    );

    expect(buildDirectorSectionSummary("contacts", profile)).toBe(
      "2 contatti visibili",
    );
  });
});

describe("conteggio dei contenuti", () => {
  it("usa i media del profilo Dirigente", () => {
    expect(buildDirectorSectionSummary("media", buildProfile())).toBe(
      "Nessun contenuto",
    );
    expect(
      buildDirectorSectionSummary(
        "media",
        buildProfile({
          media_items: [
            {
              id: "media-1",
              is_featured: false,
              type: "image",
              url: "https://example.com/a.jpg",
            },
          ],
        }),
      ),
    ).toBe("1 contenuto");
  });
});

describe("voci a sottotitolo fisso", () => {
  it("non calcola un conteggio per le voci della prima macroarea", () => {
    for (const section of [
      "personal",
      "professional",
      "responsibilities",
      "opportunities",
      "bio",
    ] as const) {
      expect(buildDirectorSectionSummary(section, buildProfile())).toBeUndefined();
    }
  });
});
