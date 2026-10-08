/**
 * Conteggi dell'hub Modifica profilo Procuratore (REV-PROF-16, "I contatori
 * devono essere calcolati dai dati reali").
 *
 * Sono regole, non etichette: un numero sbagliato qui racconta all'utente una
 * carriera o un portfolio che non ha. Si provano senza montare una schermata
 * perché il modulo è puro.
 */
import { describe, expect, it } from "vitest";

import type { AgentPublicAssistito } from "../../relationships/agent-representation-service";
import type { CompleteProfessionalProfile } from "../profile-service";
import { AGENT_EDIT_SECTION_GROUPS } from "./agent-edit-sections";
import {
  buildAgentAssistitiSummary,
  buildAgentSectionSummary,
  countAgentAdditionalPaths,
  countAgentExperiences,
  countAgentPublicContacts,
} from "./agent-hub-summaries";

const CAREER_ENTRY = {
  agency_logo_url: null,
  agency_name: "Prova Sport",
  agent_profile_id: "agent-1",
  description: null,
  id: "exp-1",
  is_current: true,
  is_primary: true,
  manual_organization_id: null,
  organization_city: null,
  organization_club_id: null,
  organization_country: null,
  organization_mode: "agency",
  period_end_month: null,
  period_end_precision: "month",
  period_end_year: null,
  period_start_month: "01",
  period_start_precision: "month",
  period_start_year: 2019,
  role: "Procuratore",
  sort_order: 0,
  visibility: "public",
};

function buildProfile(
  agentOverrides: Record<string, unknown> = {},
  overrides: Record<string, unknown> = {},
): CompleteProfessionalProfile {
  return {
    agentCareerEntries: [CAREER_ENTRY],
    agentManagedPlayerEntries: [],
    agentProfile: {
      activity_scopes: [],
      career_migrated_at: "2026-10-01T00:00:00Z",
      coach_career_entries: [],
      director_career_entries: [],
      media_items: [],
      operational_focuses: [],
      player_career_entries: [],
      primary_activities: [],
      staff_career_entries: [],
      ...agentOverrides,
    },
    profile: { id: "agent-1", role: "agent" },
    userContacts: {
      email: "procuratore@example.com",
      facebook: "",
      instagram: "",
      linkedin: "",
      phone: "+39 320 7654321",
      showEmail: true,
      showFacebook: false,
      showInstagram: false,
      showLinkedIn: false,
      showPhone: false,
    },
    ...overrides,
  } as unknown as CompleteProfessionalProfile;
}

function buildAssistito(
  overrides: Partial<AgentPublicAssistito> = {},
): AgentPublicAssistito {
  return {
    created_at: "2026-01-01T00:00:00Z",
    current_team: "ASD Prova",
    featured_rank: null,
    id: "rel-1",
    player_avatar_url: null,
    player_full_name: "Luca Bianchi",
    player_profile_id: "player-1",
    primary_position: "forward",
    relationship_type: "procuratore",
    ...overrides,
  };
}

describe("registro delle voci dell'hub", () => {
  it("espone dieci moduli in due macroaree, senza una voce Situazione attuale", () => {
    const ids = AGENT_EDIT_SECTION_GROUPS.flatMap((group) =>
      group.sections.map((section) => section.id),
    );

    expect(AGENT_EDIT_SECTION_GROUPS).toHaveLength(2);
    expect(ids).toEqual([
      "personal",
      "professional",
      "activities",
      "opportunities",
      "bio",
      "assistiti",
      "career",
      "paths",
      "contacts",
      "media",
    ]);
    // Agenzia, ruolo e incarico derivano dalla carriera: nessun modulo li edita.
    expect(ids).not.toContain("situation");
  });

  it("manda Carriera e Percorsi aggiuntivi al gestore di REV-PROF-15", () => {
    const routes = Object.fromEntries(
      AGENT_EDIT_SECTION_GROUPS.flatMap((group) =>
        group.sections.map((section) => [section.id, section.route]),
      ),
    );

    expect(routes.career).toBe("/profile/agent-career");
    expect(routes.paths).toBe("/profile/agent-career?section=paths");
  });
});

describe("conteggio degli incarichi da procuratore", () => {
  it("conta gli incarichi, non i percorsi aggiuntivi", () => {
    const profile = buildProfile({
      coach_career_entries: [
        {
          id: "c-1",
          seasons: ["2019/2020"],
          teamName: "Como",
          type: "SINGLE_SEASON",
        },
      ],
      player_career_entries: [
        { clubName: "Lecco", id: "p-1", seasonLabel: "2008/2009" },
      ],
    });

    expect(countAgentExperiences(profile)).toBe(1);
  });

  it("usa singolare, plurale e una frase quando è a zero", () => {
    expect(buildAgentSectionSummary("career", buildProfile())).toBe(
      "1 esperienza",
    );
    expect(
      buildAgentSectionSummary("career", buildProfile({}, { agentCareerEntries: [] })),
    ).toBe("Nessuna esperienza");
  });
});

describe("conteggio dei percorsi aggiuntivi", () => {
  it("conta i percorsi non vuoti, non le esperienze che contengono", () => {
    const profile = buildProfile({
      player_career_entries: [
        { clubName: "Lecco", id: "p-1", seasonLabel: "2008/2009" },
        { clubName: "Como", id: "p-2", seasonLabel: "2009/2010" },
      ],
    });

    // Sei stagioni da calciatore restano un percorso solo.
    expect(countAgentAdditionalPaths(profile)).toBe(1);
  });

  it("vale zero quando nessun percorso è stato aggiunto", () => {
    expect(buildAgentSectionSummary("paths", buildProfile())).toBe(
      "Nessun percorso aggiunto",
    );
  });
});

describe("conteggio dei contatti visibili", () => {
  it("conta i canali pubblicati, non quelli salvati", () => {
    // Email pubblica, telefono salvato ma spento.
    expect(countAgentPublicContacts(buildProfile())).toBe(1);
  });

  it("include LinkedIn quando è stato reso pubblico", () => {
    const profile = buildProfile(
      {},
      {
        userContacts: {
          email: "",
          facebook: "",
          instagram: "",
          linkedin: "https://www.linkedin.com/in/luca-rinaldi",
          phone: "",
          showEmail: false,
          showFacebook: false,
          showInstagram: false,
          showLinkedIn: true,
          showPhone: false,
        },
      },
    );

    expect(countAgentPublicContacts(profile)).toBe(1);
    expect(buildAgentSectionSummary("contacts", profile)).toBe(
      "1 contatto visibile",
    );
  });

  it("non conta un canale acceso senza un valore valido", () => {
    const profile = buildProfile(
      {},
      {
        userContacts: {
          email: "",
          facebook: "",
          instagram: "",
          linkedin: "non un profilo",
          phone: "",
          showEmail: false,
          showFacebook: false,
          showInstagram: false,
          showLinkedIn: true,
          showPhone: false,
        },
      },
    );

    expect(countAgentPublicContacts(profile)).toBe(0);
  });
});

describe("sottotitolo degli assistiti", () => {
  it("affianca il totale pubblico a quanti sono in evidenza", () => {
    expect(
      buildAgentAssistitiSummary([
        buildAssistito({ featured_rank: 1 }),
        buildAssistito({ featured_rank: 2, id: "rel-2" }),
        buildAssistito({ id: "rel-3" }),
      ]),
    ).toBe("3 assistiti · 2 in evidenza");
  });

  it("omette la seconda metà quando nessuno è in evidenza", () => {
    expect(buildAgentAssistitiSummary([buildAssistito()])).toBe("1 assistito");
  });

  it("dice che non ce ne sono, invece di scrivere zero", () => {
    expect(buildAgentAssistitiSummary([])).toBe("Nessun assistito pubblico");
  });

  it("resta vuoto finché l'elenco non è arrivato", () => {
    // Durante il caricamento "Nessun assistito" sarebbe un'informazione
    // sbagliata, non un'informazione mancante.
    expect(buildAgentAssistitiSummary(undefined)).toBe("");
  });
});
