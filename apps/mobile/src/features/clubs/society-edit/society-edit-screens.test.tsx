/**
 * Scenari a schermo della Modifica profilo Società (REV-PROF-18).
 *
 * Coprono quello che distingue questo flusso da un form unico e le regole che
 * la task vieta esplicitamente di infrangere:
 *
 *  - l'hub è un indice a nove voci in due macroaree, con contatori reali e
 *    **senza** una CTA di salvataggio globale;
 *  - Squadre, Affiliate, Posizioni e Media sono entry point ai flussi che
 *    esistono già, e non esiste una riga "Organico";
 *  - l'Identità del club non ha un pulsante separato "Modifica logo";
 *  - il Profilo sportivo non ha una seconda checklist delle categorie
 *    giovanili, e blocca una struttura che contraddice le squadre attive;
 *  - il toggle "Usa lo stesso indirizzo della sede" nasconde il campo invece
 *    di duplicare l'indirizzo;
 *  - un modulo salva soltanto la propria sezione.
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const routerMocks = vi.hoisted(() => ({
  back: vi.fn(),
  params: {} as Record<string, string>,
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("expo-router", () => ({
  /*
    Il guard delle modifiche non salvate si aggancia a "beforeRemove" del
    navigatore: senza questo stub le schermate di modifica non montano.
  */
  useNavigation: () => ({
    addListener: () => () => {},
    dispatch: () => {},
  }),
  router: routerMocks,
  useFocusEffect: (effect: () => void) => {
    React.useEffect(effect, [effect]);
  },
  useLocalSearchParams: () => routerMocks.params,
}));

const sessionMocks = vi.hoisted(() => ({ useSession: vi.fn() }));

vi.mock("../../auth/use-session", () => ({
  useSession: sessionMocks.useSession,
}));

const serviceMocks = vi.hoisted(() => ({
  fetchSocietyProfileEditor: vi.fn(),
  saveSection: vi.fn(),
}));

/*
  Il servizio vero importa il client supabase, che in vitest non si inizializza
  (react-native-url-polyfill / BlobModule). Si sostituiscono soltanto le due
  chiamate di rete: query key, mapping degli errori e invalidazioni restano
  quelli veri.
*/
vi.mock("./society-profile-edit-service", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>().catch(
    () => ({}),
  );
  const { useQuery, useMutation } = await import("@tanstack/react-query");

  return {
    ...actual,
    isSocietyConflictError: () => false,
    resolveSocietySaveErrorMessage: () =>
      "Non è stato possibile salvare le modifiche. Riprova.",
    useSocietyProfileEditorQuery: (clubId: string | null) =>
      useQuery({
        enabled: Boolean(clubId),
        queryFn: () => serviceMocks.fetchSocietyProfileEditor(clubId),
        queryKey: ["society-profile-editor", clubId ?? ""],
      }),
    useSocietySectionSave: () =>
      useMutation({
        mutationFn: (variables: unknown) => serviceMocks.saveSection(variables),
      }),
  };
});

const { SocietyProfileEditHubScreen } = await import(
  "./SocietyProfileEditHubScreen"
);
const { SocietyIdentityScreen } = await import(
  "./sections/SocietyIdentityScreen"
);
const { SocietySportProfileScreen } = await import(
  "./sections/SocietySportProfileScreen"
);
const { SocietyVenueScreen } = await import("./sections/SocietyVenueScreen");
const { SocietyDescriptionScreen } = await import(
  "./sections/SocietyDescriptionScreen"
);
const { SocietyPublicContactsScreen } = await import(
  "./sections/SocietyPublicContactsScreen"
);

function buildEditor(overrides: Record<string, unknown> = {}) {
  return {
    club: {
      category: "Serie D",
      city: "Predappio",
      clubColors: "Giallo, Blu",
      clubEmail: "info@asdpredappio.it",
      clubPhone: "+39 0543 000000",
      clubStructure: "first_team_and_youth",
      country: "IT",
      coverUrl: null,
      description: "Una società con una lunga tradizione.",
      facebook: null,
      fieldAddress: "Via dello Sport, 4",
      foundingYear: 1945,
      headquartersAddress: "Via Roma, 10",
      id: "club-1",
      instagram: "@asdpredappio",
      logoUrl: null,
      name: "ASD Predappio",
      province: "Forlì-Cesena",
      region: "Emilia-Romagna",
      showClubEmail: true,
      showClubPhone: true,
      showFacebook: false,
      showInstagram: false,
      showWebsite: true,
      stadium: "Stadio Comunale",
      updatedAt: "2026-10-08T10:00:00Z",
      venueAddressSameAsHeadquarters: false,
      verificationStatus: "verified",
      websiteUrl: "asdpredappio.it",
      ...((overrides.club as Record<string, unknown>) ?? {}),
    },
    counts: {
      affiliates: 1,
      media: 9,
      positions: 2,
      teams: 8,
      ...((overrides.counts as Record<string, unknown>) ?? {}),
    },
    teams: {
      firstTeam: { category: "Serie D", id: "team-1", name: "Prima squadra" },
      hasFirstTeam: true,
      hasYouthTeams: true,
      ...((overrides.teams as Record<string, unknown>) ?? {}),
    },
  };
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

  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (
      tree.root.findAllByProps({ testID: "society-edit-skeleton" }).length ===
        0 &&
      tree.root.findAllByProps({ testID: "society-edit-hub-skeleton" })
        .length === 0
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

async function type(
  tree: TestRenderer.ReactTestRenderer,
  testID: string,
  value: string,
) {
  await act(async () => {
    tree.root.findByProps({ testID }).props.onChangeText(value);
  });
}

async function toggle(
  tree: TestRenderer.ReactTestRenderer,
  testID: string,
  value: boolean,
) {
  await act(async () => {
    tree.root.findByProps({ testID }).props.onValueChange(value);
  });
}

function lastSave() {
  const calls = serviceMocks.saveSection.mock.calls;

  return calls[calls.length - 1][0] as {
    payload: Record<string, unknown>;
    section: string;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  routerMocks.params = {};
  sessionMocks.useSession.mockReturnValue({
    profile: { club_id: "club-1", role: "club_admin" },
    session: { user: { id: "owner-1" } },
  });
  serviceMocks.fetchSocietyProfileEditor.mockResolvedValue(buildEditor());
  serviceMocks.saveSection.mockResolvedValue(buildEditor());
});

describe("Hub Modifica profilo Società", () => {
  it("elenca le nove voci nelle due macroaree", async () => {
    const labels = texts(await render(<SocietyProfileEditHubScreen />));

    for (const title of [
      "Modifica profilo",
      "ASD Predappio",
      "Società",
      "Visualizza profilo",
      "Profilo",
      "Identità del club",
      "Profilo sportivo",
      "Sede e impianto",
      "Descrizione",
      "Contatti pubblici",
      "Gestione collegata",
      "Squadre del club",
      "Società affiliate",
      "Posizioni",
      "Media e contenuti",
    ]) {
      expect(labels).toContain(title);
    }
  });

  it("non ha una CTA di salvataggio globale", async () => {
    const tree = await render(<SocietyProfileEditHubScreen />);

    expect(
      tree.root.findAllByProps({ testID: "profile-edit-save" }),
    ).toHaveLength(0);
  });

  it("non espone un Organico globale né i dati del referente", async () => {
    const labels = texts(await render(<SocietyProfileEditHubScreen />));

    expect(labels).not.toContain("Organico");
    expect(labels).not.toContain("Referente");
    expect(labels.join(" ")).not.toContain("owner-1");
  });

  it("mostra contatori reali con singolare e plurale", async () => {
    const labels = texts(await render(<SocietyProfileEditHubScreen />));

    expect(labels).toContain("8 squadre");
    expect(labels).toContain("1 collegamento");
    expect(labels).toContain("2 posizioni aperte");
    expect(labels).toContain("9 contenuti");
    // Email, telefono e sito accesi e validi; Instagram ha un valore ma è spento.
    expect(labels).toContain("3 contatti visibili");
  });

  it("apre i flussi gestionali esistenti invece di ricrearli", async () => {
    const tree = await render(<SocietyProfileEditHubScreen />);

    await press(tree, "society-profile-edit-row-teams");
    expect(routerMocks.push).toHaveBeenCalledWith("/(tabs)/dashboard/teams");

    await press(tree, "society-profile-edit-row-affiliates");
    expect(routerMocks.push).toHaveBeenCalledWith("/club-admin/affiliates");

    await press(tree, "society-profile-edit-row-positions");
    expect(routerMocks.push).toHaveBeenCalledWith("/(tabs)/announcements");
  });

  it("non offre i flussi gestionali a chi non può raggiungerli", async () => {
    /*
      Amministratore delegato: non è `club_admin`, non ha un club in sessione e
      arriva dalla rotta pubblica con l'id. Lo stack /club-admin resta gated sul
      ruolo, quindi quelle due righe non si mostrano invece di rimbalzarlo.
    */
    sessionMocks.useSession.mockReturnValue({
      profile: { club_id: null, role: "coach" },
      session: { user: { id: "staff-1" } },
    });
    routerMocks.params = { clubId: "club-1" };

    const labels = texts(await render(<SocietyProfileEditHubScreen />));

    expect(labels).not.toContain("Squadre del club");
    expect(labels).not.toContain("Società affiliate");
    // Posizioni e Media non passano da /club-admin: restano raggiungibili.
    expect(labels).toContain("Posizioni");
    expect(labels).toContain("Media e contenuti");
  });

  it("riporta fuori chi non può più gestire la Società", async () => {
    serviceMocks.fetchSocietyProfileEditor.mockResolvedValue(null);

    await render(<SocietyProfileEditHubScreen />);

    expect(routerMocks.replace).toHaveBeenCalledWith("/(tabs)/profile");
  });
});

describe("Identità del club", () => {
  it("non ha un pulsante separato Modifica logo", async () => {
    const tree = await render(<SocietyIdentityScreen />);

    expect(texts(tree)).not.toContain("Modifica logo");
    // Il comando esiste, ma è l'avatar stesso.
    expect(tree.root.findAllByProps({ testID: "society-avatar-edit" }).length)
      .toBeGreaterThan(0);
    expect(texts(tree)).toContain("Modifica copertina");
  });

  it("salva solo la sezione identità", async () => {
    const tree = await render(<SocietyIdentityScreen />);

    await type(tree, "society-identity-name", "ASD  Predappio  1945");
    await press(tree, "profile-edit-save");

    const { payload, section } = lastSave();

    expect(section).toBe("identity");
    expect(payload.name).toBe("ASD Predappio 1945");
    expect(Object.keys(payload).sort()).toEqual([
      "club_colors",
      "cover_url",
      "founding_year",
      "logo_url",
      "name",
    ]);
  });

  it("rifiuta un anno di fondazione futuro senza cancellare il valore", async () => {
    const tree = await render(<SocietyIdentityScreen />);

    await type(tree, "society-identity-founding-year", "2999");
    await press(tree, "profile-edit-save");

    expect(serviceMocks.saveSection).not.toHaveBeenCalled();
    expect(texts(tree)).toContain(
      "L'anno di fondazione non può essere futuro.",
    );
    expect(
      tree.root.findByProps({ testID: "society-identity-founding-year" }).props
        .value,
    ).toBe("2999");
  });
});

describe("Profilo sportivo", () => {
  it("non mostra una seconda checklist delle categorie giovanili", async () => {
    const labels = texts(await render(<SocietySportProfileScreen />));

    expect(labels).toContain("Le categorie giovanili derivano dalle squadre attive.");
    for (const category of ["Primavera", "Juniores", "Allievi", "Giovanissimi"]) {
      expect(labels).not.toContain(category);
    }
  });

  it("nasconde la categoria quando il club è solo settore giovanile", async () => {
    serviceMocks.fetchSocietyProfileEditor.mockResolvedValue(
      buildEditor({ teams: { hasFirstTeam: false, hasYouthTeams: true } }),
    );
    const tree = await render(<SocietySportProfileScreen />);

    expect(texts(tree)).toContain("Categoria prima squadra");

    await press(tree, "society-structure-youth_only");

    expect(texts(tree)).not.toContain("Categoria prima squadra");
  });

  it("legge la categoria dalla prima squadra, non dal campo del club", async () => {
    serviceMocks.fetchSocietyProfileEditor.mockResolvedValue(
      buildEditor({
        club: { category: "Promozione" },
        teams: {
          firstTeam: { category: "Eccellenza", id: "team-1", name: "Prima squadra" },
          hasFirstTeam: true,
          hasYouthTeams: true,
        },
      }),
    );

    const tree = await render(<SocietySportProfileScreen />);

    expect(
      tree.root.findByProps({ testID: "society-first-team-category" }).props
        .value,
    ).toBe("Eccellenza");
  });

  it("blocca una struttura che contraddice le squadre attive", async () => {
    const tree = await render(<SocietySportProfileScreen />);

    await press(tree, "society-structure-first_team_only");

    expect(texts(tree)).toContain(
      "Sono presenti squadre giovanili attive. Gestiscile prima di modificare la struttura del club.",
    );

    await press(tree, "profile-edit-save");

    expect(serviceMocks.saveSection).not.toHaveBeenCalled();
  });

  it("apre la gestione Squadre già esistente", async () => {
    const tree = await render(<SocietySportProfileScreen />);

    await press(tree, "society-manage-teams");

    expect(routerMocks.push).toHaveBeenCalledWith("/(tabs)/dashboard/teams");
  });
});

describe("Sede e impianto", () => {
  it("nasconde l'indirizzo impianto quando coincide con la sede", async () => {
    const tree = await render(<SocietyVenueScreen />);

    expect(
      tree.root.findAllByProps({ testID: "society-venue-field-address" }).length,
    ).toBeGreaterThan(0);

    await toggle(tree, "society-venue-same-address", true);

    expect(
      tree.root.findAllByProps({ testID: "society-venue-field-address" }),
    ).toHaveLength(0);
  });

  it("restituisce l'indirizzo precedente riaprendo il campo", async () => {
    const tree = await render(<SocietyVenueScreen />);

    await toggle(tree, "society-venue-same-address", true);
    await toggle(tree, "society-venue-same-address", false);

    expect(
      tree.root.findByProps({ testID: "society-venue-field-address" }).props
        .value,
    ).toBe("Via dello Sport, 4");
  });

  it("non manda una seconda copia dell'indirizzo quando il toggle è attivo", async () => {
    const tree = await render(<SocietyVenueScreen />);

    await toggle(tree, "society-venue-same-address", true);
    await press(tree, "profile-edit-save");

    const { payload, section } = lastSave();

    expect(section).toBe("venue");
    expect(payload.venue_address_same_as_headquarters).toBe(true);
    expect(payload.field_address).toBe("");
    // La provincia la ricava il trigger del database dal comune.
    expect(payload).not.toHaveProperty("province");
  });
});

describe("Descrizione", () => {
  it("mostra il conteggio reale e non supera i 500 caratteri", async () => {
    const tree = await render(<SocietyDescriptionScreen />);

    await type(tree, "society-description-input", "x".repeat(600));

    expect(
      tree.root.findByProps({ testID: "society-description-input" }).props.value,
    ).toHaveLength(500);
    expect(texts(tree)).toContain("500/500");
    expect(texts(tree)).toContain(
      "Questa descrizione sarà visibile nella tab Info.",
    );
  });

  it("sanifica il testo incollato", async () => {
    const tree = await render(<SocietyDescriptionScreen />);

    await type(tree, "society-description-input", "<b>Storia</b> del club ");
    await press(tree, "profile-edit-save");

    const { payload, section } = lastSave();

    expect(section).toBe("description");
    expect(payload.description).toBe("Storia del club");
  });
});

describe("Contatti pubblici", () => {
  it("non precompila i recapiti dell'amministratore", async () => {
    const labels = texts(await render(<SocietyPublicContactsScreen />));

    expect(labels).toContain("info@asdpredappio.it");
    expect(labels.join(" ")).not.toContain("owner-1");
  });

  it("tiene disabilitato il toggle di un canale senza valore", async () => {
    const tree = await render(<SocietyPublicContactsScreen />);

    expect(
      tree.root.findByProps({ testID: "society-contact-facebook-visibility" })
        .props.disabled,
    ).toBe(true);
    expect(
      tree.root.findByProps({ testID: "society-contact-email-visibility" }).props
        .disabled,
    ).toBe(false);
  });

  it("spegnere un contatto non ne cancella il valore", async () => {
    const tree = await render(<SocietyPublicContactsScreen />);

    await toggle(tree, "society-contact-email-visibility", false);
    await press(tree, "profile-edit-save");

    const { payload, section } = lastSave();

    expect(section).toBe("contacts");
    expect(payload.show_club_email).toBe(false);
    expect(payload.club_email).toBe("info@asdpredappio.it");
  });
});
