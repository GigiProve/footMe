/**
 * Scenari a schermo della Modifica profilo Procuratore (REV-PROF-16).
 *
 * Coprono quello che distingue questo flusso da un form unico, e le regole
 * che la task vieta esplicitamente di infrangere:
 *
 *  - l'hub è un indice modulare a dieci voci, con conteggi reali e **senza**
 *    una CTA di salvataggio globale;
 *  - "Carriera" e "Percorsi aggiuntivi" puntano a REV-PROF-15, non a un
 *    secondo editor;
 *  - il Profilo professionale non ha campi per agenzia, ruolo o anno di
 *    inizio: quelli derivano dalla carriera, e l'unica azione è "Gestisci
 *    carriera";
 *  - il numero di licenza non compare in nessun payload pubblico;
 *  - nella schermata Foto e dati personali non esiste un pulsante separato
 *    "Modifica foto";
 *  - le due preferenze di Opportunità sono autonome e nessuna delle due fa da
 *    gate all'area operativa;
 *  - un modulo che salva il proprio dato non riscrive quelli degli altri.
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CompleteProfessionalProfile } from "../profile-service";

/*
  `act` flussa gli aggiornamenti solo se React sa di essere in un ambiente di
  test. Senza questo flag le query di TanStack restano in sospeso e la
  schermata resta allo scheletro.
*/
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const routerMocks = vi.hoisted(() => ({
  back: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("expo-router", () => ({
  router: routerMocks,
  useFocusEffect: (effect: () => void) => {
    React.useEffect(effect, [effect]);
  },
  useLocalSearchParams: () => ({}),
}));

const sessionMocks = vi.hoisted(() => ({ useSession: vi.fn() }));

vi.mock("../../auth/use-session", () => ({
  useSession: sessionMocks.useSession,
}));

const serviceMocks = vi.hoisted(() => ({
  fetchAgentLicenseNumber: vi.fn(),
  getCompleteProfessionalProfile: vi.fn(),
  saveAgentProfilePatch: vi.fn(),
  updateCompleteProfessionalProfile: vi.fn(),
}));

/*
  Il modulo vero importa il client supabase, che nell'ambiente vitest non si
  inizializza (react-native-url-polyfill / BlobModule).
*/
vi.mock("../profile-service", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>().catch(
    () => ({}),
  );

  return {
    ...actual,
    fetchAgentLicenseNumber: serviceMocks.fetchAgentLicenseNumber,
    getCompleteProfessionalProfile: serviceMocks.getCompleteProfessionalProfile,
    saveAgentProfileMedia: vi.fn(),
    saveAgentProfilePatch: serviceMocks.saveAgentProfilePatch,
    updateCompleteProfessionalProfile:
      serviceMocks.updateCompleteProfessionalProfile,
  };
});

const representationMocks = vi.hoisted(() => ({
  fetchAgentPublicAssistiti: vi.fn(),
  setAgentFeaturedAssistiti: vi.fn(),
}));

vi.mock("../../relationships/agent-representation-service", async (
  importOriginal,
) => {
  const actual = await importOriginal<Record<string, unknown>>().catch(
    () => ({}),
  );

  return {
    ...actual,
    fetchAgentPublicAssistiti: representationMocks.fetchAgentPublicAssistiti,
    setAgentFeaturedAssistiti: representationMocks.setAgentFeaturedAssistiti,
  };
});

const { AgentProfileEditHubScreen } = await import(
  "./AgentProfileEditHubScreen"
);
const { AgentPersonalDataScreen } = await import(
  "./sections/AgentPersonalDataScreen"
);
const { AgentProfessionalProfileScreen } = await import(
  "./sections/AgentProfessionalProfileScreen"
);
const { AgentActivitiesMarketsScreen } = await import(
  "./sections/AgentActivitiesMarketsScreen"
);
const { AgentOpportunitiesScreen } = await import(
  "./sections/AgentOpportunitiesScreen"
);
const { AgentBioLanguagesScreen } = await import(
  "./sections/AgentBioLanguagesScreen"
);
const { AgentFeaturedAssistitiScreen } = await import(
  "./sections/AgentFeaturedAssistitiScreen"
);
const { AgentPublicContactsScreen } = await import(
  "./sections/AgentPublicContactsScreen"
);

/** Un incarico in corso: è la fonte di agenzia, ruolo e situazione attuale. */
const CAREER_ENTRIES = [
  {
    agency_logo_url: null,
    agency_name: "Rinaldi Sport",
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
    period_start_year: 2018,
    role: "Procuratore",
    sort_order: 0,
    visibility: "public",
  },
];

const ASSISTITI = [
  {
    created_at: "2026-01-03T00:00:00Z",
    current_team: "Serie A",
    featured_rank: 1,
    id: "rel-1",
    player_avatar_url: null,
    player_full_name: "Luca Bianchi",
    player_profile_id: "player-1",
    primary_position: "forward",
    relationship_type: "procuratore",
  },
  {
    created_at: "2026-01-02T00:00:00Z",
    current_team: "Serie B",
    featured_rank: 2,
    id: "rel-2",
    player_avatar_url: null,
    player_full_name: "Marco Verdi",
    player_profile_id: "player-2",
    primary_position: "goalkeeper",
    relationship_type: "procuratore",
  },
  {
    created_at: "2026-01-01T00:00:00Z",
    current_team: "Serie C",
    featured_rank: null,
    id: "rel-3",
    player_avatar_url: null,
    player_full_name: "Lorenzo Costa",
    player_profile_id: "player-3",
    primary_position: "defender",
    relationship_type: "procuratore",
  },
];

function buildProfile(
  overrides: Record<string, unknown> = {},
): CompleteProfessionalProfile {
  return {
    agentCareerEntries: CAREER_ENTRIES,
    agentManagedPlayerEntries: [],
    agentProfile: {
      activity_scopes: ["professional", "youth"],
      agency_logo_url: null,
      agency_name: "Rinaldi Sport",
      agency_role: "Founder",
      career_migrated_at: "2026-10-01T00:00:00Z",
      coach_career_entries: [],
      director_career_entries: [],
      federation: "FIGC",
      has_no_previous_experience: false,
      has_other_football_experience: false,
      has_played_football: false,
      is_federation_licensed: true,
      main_player_roles: [],
      managed_players_count: null,
      media_items: [],
      open_to_clubs: true,
      open_to_players: true,
      operating_area_type: "REGIONS",
      operating_countries: [],
      operating_macro_areas: [],
      operating_provinces: [],
      operating_regions: ["Lombardia", "Lazio"],
      operational_focuses: [],
      operational_note: null,
      other_football_roles: [],
      period_end_month: null,
      period_end_year: null,
      period_start_month: null,
      period_start_year: null,
      player_career_entries: [],
      player_types: [],
      portfolio_range: null,
      primary_activities: ["Valorizzazione giovani", "Scouting"],
      previous_roles: [],
      professional_mode: "agency",
      profile_id: "agent-1",
      staff_career_entries: [],
      works_abroad: false,
    },
    clubSeasonEntries: [],
    playerCareerEntries: [],
    playerPalmares: [],
    profile: {
      avatar_url: "https://example.com/a.jpg",
      bio: "Procuratore sportivo con esperienza nella valorizzazione dei giovani.",
      birth_date: "1985-04-12",
      cover_url: "https://example.com/cover.jpg",
      full_name: "Luca Rinaldi",
      id: "agent-1",
      languages: ["Italiano", "Inglese", "Spagnolo"],
      nationality: "IT",
      region: "Lombardia",
      residence: "Milano",
      role: "agent",
    },
    userContacts: {
      email: "luca.rinaldi@email.it",
      facebook: "",
      instagram: "lucarinaldi.agent",
      linkedin: "https://www.linkedin.com/in/luca-rinaldi",
      phone: "+39 320 7654321",
      showEmail: true,
      showFacebook: false,
      showInstagram: false,
      showLinkedIn: true,
      showPhone: true,
    },
    ...overrides,
  } as unknown as CompleteProfessionalProfile;
}

async function render(element: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false } },
  });

  let tree!: TestRenderer.ReactTestRenderer;

  await act(async () => {
    tree = TestRenderer.create(
      <QueryClientProvider client={client}>{element}</QueryClientProvider>,
    );
  });

  /*
    Le query risolvono dopo più salti di microtask: qui si aspetta finché lo
    scheletro non ha lasciato il posto ai dati, invece di sperare che un solo
    flush basti.
  */
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (
      tree.root.findAllByProps({ testID: "agent-edit-skeleton" }).length === 0 &&
      tree.root.findAllByProps({ testID: "agent-edit-hub-skeleton" }).length ===
        0
    ) {
      break;
    }

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  return tree;
}

function texts(tree: TestRenderer.ReactTestRenderer): string[] {
  return tree.root
    .findAll((node) => (node.type as unknown as string) === "Text")
    .flatMap((node) =>
      React.Children.toArray(node.props.children).filter(
        (child): child is string => typeof child === "string",
      ),
    );
}

async function press(tree: TestRenderer.ReactTestRenderer, testID: string) {
  await act(async () => {
    tree.root.findByProps({ testID }).props.onPress();
  });
}

/** I toggle espongono `onValueChange`, non `onPress`. */
async function toggle(
  tree: TestRenderer.ReactTestRenderer,
  testID: string,
  value: boolean,
) {
  await act(async () => {
    tree.root.findByProps({ testID }).props.onValueChange(value);
  });
}

function lastAgentPatch() {
  const calls = serviceMocks.saveAgentProfilePatch.mock.calls;

  return calls[calls.length - 1][0].patch as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionMocks.useSession.mockReturnValue({
    profile: { role: "agent" },
    session: { user: { id: "agent-1" } },
  });
  serviceMocks.fetchAgentLicenseNumber.mockResolvedValue("12345");
  serviceMocks.getCompleteProfessionalProfile.mockResolvedValue(buildProfile());
  serviceMocks.saveAgentProfilePatch.mockResolvedValue(undefined);
  serviceMocks.updateCompleteProfessionalProfile.mockResolvedValue(undefined);
  representationMocks.fetchAgentPublicAssistiti.mockResolvedValue(ASSISTITI);
  representationMocks.setAgentFeaturedAssistiti.mockResolvedValue(undefined);
});

describe("Hub Modifica profilo", () => {
  it("elenca le dieci voci nelle due macroaree", async () => {
    const labels = texts(await render(<AgentProfileEditHubScreen />));

    for (const title of [
      "Modifica profilo",
      "Profilo",
      "Foto e dati personali",
      "Profilo professionale",
      "Attività e mercati",
      "Opportunità",
      "Bio e lingue",
      "Percorso e visibilità",
      "Assistiti",
      "Carriera",
      "Percorsi aggiuntivi",
      "Contatti pubblici",
      "Media e contenuti",
    ]) {
      expect(labels).toContain(title);
    }

    // Il riepilogo dice il ruolo, non una società.
    expect(labels).toContain("Procuratore sportivo");
    expect(labels).toContain("Visualizza profilo");
  });

  it("non ha una CTA di salvataggio globale: ogni modulo salva da sé", async () => {
    const tree = await render(<AgentProfileEditHubScreen />);

    expect(tree.root.findAllByProps({ testID: "profile-edit-save" })).toHaveLength(
      0,
    );
  });

  it("calcola i conteggi dai dati reali, assistiti in evidenza compresi", async () => {
    const labels = texts(await render(<AgentProfileEditHubScreen />));

    expect(labels).toContain("3 assistiti · 2 in evidenza");
    expect(labels).toContain("1 esperienza");
    // Telefono, email e LinkedIn pubblicati; Instagram salvato ma spento.
    expect(labels).toContain("3 contatti visibili");
    expect(labels).toContain("Nessun contenuto");
  });

  it("manda Carriera al gestore di REV-PROF-15, non a un secondo editor", async () => {
    const tree = await render(<AgentProfileEditHubScreen />);

    await press(tree, "agent-profile-edit-row-career");
    expect(routerMocks.push).toHaveBeenCalledWith("/profile/agent-career");

    await press(tree, "agent-profile-edit-row-paths");
    expect(routerMocks.push).toHaveBeenCalledWith(
      "/profile/agent-career?section=paths",
    );
  });
});

describe("Foto e dati personali", () => {
  it("non espone un pulsante separato Modifica foto", async () => {
    const labels = texts(await render(<AgentPersonalDataScreen />));

    expect(labels).toContain("Modifica copertina");
    expect(labels).not.toContain("Modifica foto");
  });

  it("non duplica telefono ed email, che vivono nei Contatti pubblici", async () => {
    const labels = texts(await render(<AgentPersonalDataScreen />));

    expect(labels).not.toContain("Telefono");
    expect(labels).not.toContain("Email");
  });
});

describe("Profilo professionale", () => {
  it("non ha campi per agenzia, ruolo o anno di inizio", async () => {
    const labels = texts(await render(<AgentProfessionalProfileScreen />));

    expect(labels).toContain("Abilitazione professionale");
    expect(labels).toContain(
      "Agenzia, ruolo e situazione attuale derivano dalla carriera.",
    );

    for (const forbidden of [
      "Agenzia",
      "Studio",
      "Ruolo attuale",
      "Anno di inizio",
      "Incarico in corso",
      "Esperienza principale",
      "Modalità professionale",
    ]) {
      expect(labels).not.toContain(forbidden);
    }
  });

  it("dice che la licenza non sarà pubblica e apre la gestione carriera", async () => {
    const tree = await render(<AgentProfessionalProfileScreen />);

    expect(texts(tree)).toContain("Il numero di licenza non sarà pubblico.");

    await press(tree, "agent-professional-manage-career");
    expect(routerMocks.push).toHaveBeenCalledWith("/profile/agent-career");
  });

  it("salva solo abilitazione, ente e visibilità: nient'altro del profilo", async () => {
    const tree = await render(<AgentProfessionalProfileScreen />);

    await toggle(tree, "agent-professional-federation-visibility", false);
    await press(tree, "profile-edit-save");

    const patch = lastAgentPatch();

    expect(Object.keys(patch).sort()).toEqual([
      "federation",
      "is_federation_licensed",
      "license_number",
    ]);
    // Spegnere l'ente nasconde la pill, non cancella il dato.
    expect(patch.is_federation_licensed).toBe(false);
    expect(patch.federation).toBe("FIGC");
  });

  it("non legge il numero di licenza dal profilo condiviso", async () => {
    await render(<AgentProfessionalProfileScreen />);

    /*
      Il numero arriva dalla tabella owner-only, non da `agent_profiles`: è
      quella separazione — non il rendering — a tenerlo fuori dai payload che
      un visitor può chiedere.
    */
    expect(serviceMocks.fetchAgentLicenseNumber).toHaveBeenCalledWith("agent-1");

    const profile = buildProfile();
    expect(profile.agentProfile).not.toHaveProperty("license_number");
  });

  it("non manda il numero di licenza nel salvataggio del profilo condiviso", async () => {
    const tree = await render(<AgentProfessionalProfileScreen />);

    await toggle(tree, "agent-professional-federation-visibility", false);
    await press(tree, "profile-edit-save");

    // Niente scrittura su `profiles` o sui contatti da questo modulo.
    expect(serviceMocks.updateCompleteProfessionalProfile).not.toHaveBeenCalled();
  });
});

describe("Attività e mercati", () => {
  it("non accetta la quarta attività e lo dice sul posto", async () => {
    const tree = await render(<AgentActivitiesMarketsScreen />);

    // Indici 2 e 3: Intermediazione e Gestione svincolati.
    await press(tree, "agent-activity-2");
    await press(tree, "agent-activity-3");

    expect(texts(tree)).toContain(
      "Puoi selezionare fino a 3 attività principali.",
    );
  });

  it("salva attività e mercati, senza toccare le altre colonne", async () => {
    const tree = await render(<AgentActivitiesMarketsScreen />);

    await press(tree, "agent-activity-2");
    await press(tree, "profile-edit-save");

    const patch = lastAgentPatch();

    expect(Object.keys(patch).sort()).toEqual([
      "activity_scopes",
      "primary_activities",
    ]);
    expect(patch.primary_activities).toEqual([
      "Valorizzazione giovani",
      "Scouting",
      "Intermediazione",
    ]);
    expect(patch.activity_scopes).toEqual(["professional", "youth"]);
  });
});

describe("Opportunità", () => {
  it("mostra due preferenze autonome e l'area operativa, senza un gate unico", async () => {
    const labels = texts(await render(<AgentOpportunitiesScreen />));

    expect(labels).toContain("Aperto a richieste di rappresentanza");
    expect(labels).toContain("I calciatori possono contattarti.");
    expect(labels).toContain("Disponibile a collaborare con club");
    expect(labels).toContain("I club possono proporti collaborazioni.");
    expect(labels).toContain("Area operativa");
    expect(labels).toContain("Aree selezionate");
    // Il Procuratore non dichiara una data di inizio disponibilità.
    expect(labels).not.toContain("Disponibile da");
  });

  it("spegnere una preferenza non tocca l'altra né l'area operativa", async () => {
    const tree = await render(<AgentOpportunitiesScreen />);

    await toggle(tree, "agent-opportunities-preference-players", false);
    await press(tree, "profile-edit-save");

    const patch = lastAgentPatch();

    expect(patch.open_to_players).toBe(false);
    expect(patch.open_to_clubs).toBe(true);
    expect(patch.operating_regions).toEqual(["Lombardia", "Lazio"]);
  });
});

describe("Bio e lingue", () => {
  it("mostra il contatore sul limite della review, non su quello dell'onboarding", async () => {
    const labels = texts(await render(<AgentBioLanguagesScreen />));

    expect(labels).toContain("Bio professionale");
    expect(labels).toContain("Lingue parlate");
    expect(labels.some((label) => label.endsWith("/300"))).toBe(true);
  });
});

describe("Assistiti in evidenza", () => {
  it("mostra il contatore e l'elenco eleggibile, con i selezionati in testa", async () => {
    const tree = await render(<AgentFeaturedAssistitiScreen />);
    const labels = texts(tree);

    expect(labels).toContain(
      "Scegli fino a 3 assistiti pubblici da mostrare nel profilo.",
    );
    expect(labels).toContain("2 di 3 selezionati");
    expect(labels).toContain("Luca Bianchi");
    expect(labels).toContain("Gestisci tutti gli assistiti");
  });

  it("non offre nessuna azione di gestione del rapporto", async () => {
    const labels = texts(await render(<AgentFeaturedAssistitiScreen />));

    for (const forbidden of [
      "Aggiungi assistito",
      "Invita",
      "Rendi pubblico",
      "Approva",
      "Elimina",
    ]) {
      expect(labels).not.toContain(forbidden);
    }
  });

  it("salva soltanto gli id e il loro ordine", async () => {
    const tree = await render(<AgentFeaturedAssistitiScreen />);

    await press(tree, "agent-assistito-rel-2-up");
    await press(tree, "profile-edit-save");

    expect(representationMocks.setAgentFeaturedAssistiti).toHaveBeenCalledWith(
      "agent-1",
      ["rel-2", "rel-1"],
    );
  });

  it("rifiuta il quarto assistito senza togliere i tre già scelti", async () => {
    representationMocks.fetchAgentPublicAssistiti.mockResolvedValue([
      ...ASSISTITI.slice(0, 2),
      { ...ASSISTITI[2], featured_rank: 3 },
      {
        created_at: "2026-01-04T00:00:00Z",
        current_team: "Primavera",
        featured_rank: null,
        id: "rel-4",
        player_avatar_url: null,
        player_full_name: "Andrea Neri",
        player_profile_id: "player-4",
        primary_position: "midfielder",
        relationship_type: "procuratore",
      },
    ]);

    const tree = await render(<AgentFeaturedAssistitiScreen />);

    await press(tree, "agent-assistito-rel-4");

    expect(texts(tree)).toContain("Puoi mettere in evidenza fino a 3 assistiti.");
    expect(texts(tree)).toContain("3 di 3 selezionati");
  });

  it("mostra l'empty state quando non c'è nessun assistito eleggibile", async () => {
    representationMocks.fetchAgentPublicAssistiti.mockResolvedValue([]);

    const labels = texts(await render(<AgentFeaturedAssistitiScreen />));

    expect(labels).toContain("Nessun assistito disponibile");
    expect(labels).toContain(
      "Puoi mettere in evidenza gli assistiti collegati e visibili pubblicamente.",
    );
    expect(labels).toContain("Gestisci assistiti");
  });

  it("mostra un errore locale quando l'elenco non si carica", async () => {
    representationMocks.fetchAgentPublicAssistiti.mockRejectedValue(
      new Error("boom"),
    );

    const labels = texts(await render(<AgentFeaturedAssistitiScreen />));

    expect(labels).toContain("Non è stato possibile caricare gli assistiti.");
    expect(labels).toContain("Riprova");
  });
});

describe("Contatti pubblici", () => {
  it("apre con i cinque canali del mockup, LinkedIn compreso", async () => {
    const labels = texts(await render(<AgentPublicContactsScreen />));

    expect(labels).toContain(
      "Scegli quali contatti rendere visibili. La chat PROLINK resta il canale principale.",
    );
    for (const channel of [
      "Telefono",
      "Email",
      "Instagram",
      "LinkedIn",
      "Sito web",
    ]) {
      expect(labels).toContain(channel);
    }
  });

  it("non pubblica un canale senza un valore: il toggle resta disabilitato", async () => {
    const tree = await render(<AgentPublicContactsScreen />);

    expect(
      tree.root.findByProps({ testID: "agent-contact-website-visibility" }).props
        .disabled,
    ).toBe(true);
    expect(
      tree.root.findByProps({ testID: "agent-contact-email-visibility" }).props
        .disabled,
    ).toBe(false);
  });
});
