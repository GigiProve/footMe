/**
 * Scenari a schermo della Modifica profilo Tifoso (REV-PROF-20).
 *
 * Coprono quello che distingue questo flusso da un form unico e le regole che
 * la task vieta di infrangere:
 *
 *  - l'hub è un indice modulare a sei voci, con riepiloghi reali, la label
 *    "Tifoso" e **senza** una CTA di salvataggio globale;
 *  - "Appassionato" non compare in nessuna superficie;
 *  - la squadra del cuore si scrive solo come relazione canonica, e il toggle
 *    pubblico non è attivabile senza una squadra;
 *  - gli interessi restano obbligatori come in onboarding, le categorie no;
 *  - le aree non hanno un toggle pubblico e mostrano "Visibile solo a te";
 *  - i dati personali non chiedono sesso né domicilio e dichiarano che data
 *    di nascita e residenza non sono pubbliche.
 */
import React from "react";
import { Alert } from "react-native";
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
  getCompleteProfessionalProfile: vi.fn(),
  updateCompleteProfessionalProfile: vi.fn(),
}));

vi.mock("../profile-service", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>().catch(
    () => ({}),
  );

  return {
    ...actual,
    getCompleteProfessionalProfile: serviceMocks.getCompleteProfessionalProfile,
    searchTeams: vi.fn(async () => []),
    updateCompleteProfessionalProfile:
      serviceMocks.updateCompleteProfessionalProfile,
  };
});

/*
  Il client supabase non si inizializza sotto vitest (polyfill URL / Blob): la
  catena viene sostituita da un registratore, così i test possono guardare
  **quali colonne** finiscono nella UPDATE.
*/
const supabaseMocks = vi.hoisted(() => {
  const updates: { payload: Record<string, unknown>; table: string }[] = [];
  const state = {
    clubs: [] as Record<string, unknown>[],
    /** Contenuti della Tribuna con `kind = 'photo'`. */
    mediaCount: 0,
    /** Bacheca storica: la seconda sorgente del conteggio. */
    legacyMediaCount: 0,
  };

  function chain(table: string) {
    const result =
      table === "clubs"
        ? { data: state.clubs[0] ?? null, error: null }
        : {
            count:
              table === "fan_media_posts"
                ? state.legacyMediaCount
                : state.mediaCount,
            data: null,
            error: null,
          };

    const api: Record<string, unknown> = {
      eq: () => api,
      in: () => api,
      insert: () => api,
      maybeSingle: () => Promise.resolve(result),
      order: () => api,
      range: () => Promise.resolve({ data: [], error: null }),
      select: () => api,
      then: (resolve: (value: unknown) => unknown, reject?: unknown) =>
        Promise.resolve(
          table === "fan_profiles"
            ? { data: { profile_id: "fan-1" }, error: null }
            : result,
        ).then(resolve, reject as never),
      update: (payload: Record<string, unknown>) => {
        updates.push({ payload, table });
        return api;
      },
    };

    return api;
  }

  return {
    from: vi.fn((table: string) => chain(table)),
    rpc: vi.fn(async (name: string) => {
      if (name === "search_fan_favorite_clubs") {
        return { data: state.clubs, error: null };
      }

      return { data: [], error: null };
    }),
    state,
    updates,
  };
});

vi.mock("../../../lib/supabase", () => ({
  supabase: { from: supabaseMocks.from, rpc: supabaseMocks.rpc },
}));

const { FanProfileEditHubScreen } = await import("./FanProfileEditHubScreen");
const { FanPersonalDataScreen } = await import(
  "./sections/FanPersonalDataScreen"
);
const { FanFavoriteClubScreen } = await import(
  "./sections/FanFavoriteClubScreen"
);
const { FanInterestsScreen } = await import("./sections/FanInterestsScreen");
const { FanCategoriesScreen } = await import("./sections/FanCategoriesScreen");
const { FanInterestAreasScreen } = await import(
  "./sections/FanInterestAreasScreen"
);

function buildProfile(
  fanProfile: Record<string, unknown> | null = {
    favorite_club_id: "club-1",
    favorite_club_is_public: true,
    favorite_team_name: null,
    football_types: ["professional", "amateur"],
    football_types_are_public: true,
    geo_scope: "REGIONS",
    interest_categories: ["Serie B", "Promozione"],
    interest_categories_are_public: true,
    interest_provinces: [],
    interest_regions: ["Campania", "Sicilia"],
    profile_id: "fan-1",
    updated_at: "2026-10-09T10:00:00.000000+00:00",
  },
): CompleteProfessionalProfile {
  return {
    clubSeasonEntries: [],
    fanProfile,
    playerCareerEntries: [],
    playerPalmares: [],
    profile: {
      avatar_url: "https://example.com/a.jpg",
      bio: null,
      birth_date: "1992-06-12",
      cover_url: "https://example.com/cover.jpg",
      full_name: "Filippo Filippi",
      gender: "male",
      id: "fan-1",
      languages: [],
      nationality: "IT",
      region: "Lombardia",
      residence: "Milano",
      role: "fan",
    },
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
    ...(fanProfile === null ? { fanProfile: null } : {}),
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

  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (
      tree.root.findAllByProps({ testID: "fan-edit-skeleton" }).length === 0 &&
      tree.root.findAllByProps({ testID: "fan-edit-hub-skeleton" }).length === 0
    ) {
      break;
    }

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  /*
    Il profilo non è l'unica query: la denominazione della squadra e il
    conteggio dei contenuti arrivano dopo, e sono proprio i riepiloghi che i
    test guardano. Qualche flusso in più costa poco e non dipende da un
    ordine di risoluzione.
  */
  for (let attempt = 0; attempt < 4; attempt += 1) {
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

async function toggle(
  tree: TestRenderer.ReactTestRenderer,
  testID: string,
  value: boolean,
) {
  await act(async () => {
    tree.root.findByProps({ testID }).props.onValueChange(value);
  });
}

async function save(tree: TestRenderer.ReactTestRenderer) {
  await act(async () => {
    tree.root.findByProps({ testID: "profile-edit-save" }).props.onPress();
  });

  for (let attempt = 0; attempt < 6; attempt += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

function lastFanUpdate() {
  const calls = supabaseMocks.updates.filter(
    (entry) => entry.table === "fan_profiles",
  );

  return calls[calls.length - 1]?.payload;
}

beforeEach(() => {
  vi.clearAllMocks();
  supabaseMocks.updates.length = 0;
  supabaseMocks.state.clubs = [
    {
      club_id: "club-2",
      logo_url: null,
      name: "ASD Casteltermini",
      subtitle: "Promozione · Sicilia",
    },
  ];
  supabaseMocks.state.mediaCount = 3;
  supabaseMocks.state.legacyMediaCount = 1;
  sessionMocks.useSession.mockReturnValue({
    profile: { role: "fan" },
    session: { user: { id: "fan-1" } },
  });
  serviceMocks.getCompleteProfessionalProfile.mockResolvedValue(buildProfile());
  serviceMocks.updateCompleteProfessionalProfile.mockResolvedValue(undefined);
});

describe("Hub Modifica profilo", () => {
  it("elenca le sei voci nelle due macroaree, con la label Tifoso", async () => {
    const labels = texts(await render(<FanProfileEditHubScreen />));

    expect(labels).toContain("Modifica profilo");
    expect(labels).toContain("Profilo");
    expect(labels).toContain("Contenuti");
    expect(labels).toContain("Foto e dati personali");
    expect(labels).toContain("Squadra del cuore");
    expect(labels).toContain("Interessi calcistici");
    expect(labels).toContain("Categorie seguite");
    expect(labels).toContain("Aree di interesse");
    expect(labels).toContain("Media e contenuti");
    expect(labels).toContain("Tifoso");
    expect(labels).toContain("Visualizza profilo");
  });

  it("non mostra Appassionato né un ruolo Media/Creator", async () => {
    const labels = texts(await render(<FanProfileEditHubScreen />)).join(" ");

    expect(labels).not.toContain("Appassionato");
    expect(labels).not.toContain("Media/Creator");
    expect(labels).not.toContain("Supporter");
  });

  it("non ha una CTA di salvataggio globale", async () => {
    const tree = await render(<FanProfileEditHubScreen />);

    expect(
      tree.root.findAllByProps({ testID: "profile-edit-save" }),
    ).toHaveLength(0);
    expect(texts(tree)).not.toContain("Salva modifiche");
  });

  it("riassume le aree come private e conta i contenuti reali", async () => {
    const labels = texts(await render(<FanProfileEditHubScreen />));

    expect(labels).toContain("2 regioni · Visibile solo a te");
    // Tre contenuti nuovi più uno della bacheca storica: il conteggio somma
    // le due sorgenti reali della tab Media.
    expect(labels).toContain("4 contenuti");
    expect(labels).toContain("2 selezionati");
    expect(labels).toContain("2 selezionate");
  });

  it("porta ogni voce al proprio modulo", async () => {
    const tree = await render(<FanProfileEditHubScreen />);

    await press(tree, "fan-profile-edit-row-favoriteClub");
    await press(tree, "fan-profile-edit-row-areas");
    await press(tree, "fan-profile-edit-row-media");

    expect(routerMocks.push.mock.calls.map((call) => call[0])).toEqual([
      "/profile/fan-edit/favorite-club",
      "/profile/fan-edit/areas",
      "/profile/fan-edit/media",
    ]);
  });
});

describe("Foto e dati personali", () => {
  it("non chiede sesso né domicilio e dichiara la privacy dei dati", async () => {
    const tree = await render(<FanPersonalDataScreen />);
    const labels = texts(tree);

    expect(labels).toContain("Nome");
    expect(labels).toContain("Cognome");
    expect(labels).toContain("Data di nascita");
    expect(labels).toContain("Nazionalità");
    expect(labels).toContain("Residenza");
    expect(labels).toContain("Data di nascita e residenza non sono pubbliche.");
    expect(labels).not.toContain("Sesso");
    expect(labels).not.toContain("Domicilio diverso dalla residenza");
    expect(
      tree.root.findAllByProps({ testID: "fan-personal-gender" }),
    ).toHaveLength(0);
  });

  it("non ha un pulsante testuale separato Modifica foto", async () => {
    const labels = texts(await render(<FanPersonalDataScreen />));

    expect(labels).toContain("Modifica copertina");
    expect(labels).not.toContain("Modifica foto");
  });
});

describe("Squadra del cuore", () => {
  it("mostra la squadra salvata letta dall'entità canonica", async () => {
    supabaseMocks.state.clubs = [
      {
        category: "Promozione",
        id: "club-1",
        logo_url: null,
        name: "ASD Casteltermini",
        region: "Sicilia",
        verification_status: "verified",
      },
    ];

    const tree = await render(<FanFavoriteClubScreen />);
    const labels = texts(tree);

    expect(labels).toContain("ASD Casteltermini");
    expect(labels).toContain("Promozione · Sicilia");
    expect(labels).toContain("Cambia");
    expect(labels).toContain("Rimuovi squadra");
    expect(labels).toContain("La squadra sarà visibile nella tab Info.");
  });

  it("salva soltanto relazione e visibilità", async () => {
    const tree = await render(<FanFavoriteClubScreen />);

    await toggle(tree, "fan-favorite-club-visibility", false);
    await save(tree);

    expect(lastFanUpdate()).toEqual({
      favorite_club_id: "club-1",
      favorite_club_is_public: false,
    });
  });

  it("senza squadra il toggle pubblico è spento e disabilitato", async () => {
    serviceMocks.getCompleteProfessionalProfile.mockResolvedValue(
      buildProfile({
        favorite_club_id: null,
        favorite_club_is_public: false,
        favorite_team_name: "Squadra scritta a mano",
        football_types: ["amateur"],
        football_types_are_public: true,
        geo_scope: "ITALY",
        interest_categories: [],
        interest_categories_are_public: false,
        interest_provinces: [],
        interest_regions: [],
        profile_id: "fan-1",
        updated_at: "2026-10-09T10:00:00.000000+00:00",
      }),
    );

    const tree = await render(<FanFavoriteClubScreen />);
    const switchProps = tree.root.findByProps({
      testID: "fan-favorite-club-visibility",
    }).props;

    expect(switchProps.value).toBe(false);
    expect(switchProps.disabled).toBe(true);
    // Il valore legacy non diventa una card: si chiede una nuova scelta.
    expect(texts(tree)).not.toContain("Squadra scritta a mano");
    expect(
      tree.root.findAllByProps({ testID: "fan-favorite-club-search" }).length,
    ).toBeGreaterThan(0);
  });

  it("chiede conferma prima di rimuovere la squadra", async () => {
    const alert = vi.spyOn(Alert, "alert").mockImplementation(() => undefined);
    const tree = await render(<FanFavoriteClubScreen />);

    await press(tree, "fan-favorite-club-remove");

    expect(alert).toHaveBeenCalledWith(
      "Rimuovere la squadra del cuore?",
      "La squadra non comparirà più nel tuo profilo.",
      expect.anything(),
    );

    alert.mockRestore();
  });
});

describe("Interessi calcistici", () => {
  it("elenca la tassonomia centralizzata", async () => {
    const labels = texts(await render(<FanInterestsScreen />));

    expect(labels).toContain("Calcio professionistico");
    expect(labels).toContain("Calcio dilettantistico");
    expect(labels).toContain("Calcio femminile");
    expect(labels).toContain("Calcio giovanile");
    expect(labels).not.toContain("Appassionato calcio dilettantistico");
  });

  it("salva identificativi e visibilità, e nient'altro", async () => {
    const tree = await render(<FanInterestsScreen />);

    await press(tree, "fan-interest-youth");
    await save(tree);

    expect(lastFanUpdate()).toEqual({
      football_types: ["professional", "amateur", "youth"],
      football_types_are_public: true,
    });
  });

  it("rifiuta il salvataggio senza nessun interesse", async () => {
    const tree = await render(<FanInterestsScreen />);

    await press(tree, "fan-interest-professional");
    await press(tree, "fan-interest-amateur");
    await save(tree);

    expect(texts(tree)).toContain("Seleziona almeno un interesse calcistico.");
    expect(lastFanUpdate()).toBeUndefined();
  });

  it("spegnere il toggle non cancella le selezioni", async () => {
    const tree = await render(<FanInterestsScreen />);

    await toggle(tree, "fan-interests-visibility", false);
    await save(tree);

    expect(lastFanUpdate()).toEqual({
      football_types: ["professional", "amateur"],
      football_types_are_public: false,
    });
  });
});

describe("Categorie seguite", () => {
  it("mostra i gruppi della tassonomia e i chip della selezione", async () => {
    const tree = await render(<FanCategoriesScreen />);
    const labels = texts(tree);

    expect(labels).toContain("Professionistico");
    expect(labels).toContain("Dilettantistico");
    expect(labels).toContain("Giovanile");
    expect(
      tree.root.findAllByProps({ testID: "fan-category-chip-Serie B" }).length,
    ).toBeGreaterThan(0);
  });

  it("rimuove una categoria dal chip", async () => {
    const tree = await render(<FanCategoriesScreen />);

    await press(tree, "fan-category-chip-Promozione");
    await save(tree);

    expect(lastFanUpdate()).toEqual({
      interest_categories: ["Serie B"],
      interest_categories_are_public: true,
    });
  });

  it("non introduce un obbligo che il prodotto non ha", async () => {
    const tree = await render(<FanCategoriesScreen />);

    await press(tree, "fan-category-chip-Serie B");
    await press(tree, "fan-category-chip-Promozione");
    await save(tree);

    expect(texts(tree)).not.toContain("Seleziona almeno una categoria.");
    expect(lastFanUpdate()).toEqual({
      interest_categories: [],
      interest_categories_are_public: false,
    });
  });

  it("segnala una categoria deprecata senza perderla", async () => {
    serviceMocks.getCompleteProfessionalProfile.mockResolvedValue(
      buildProfile({
        favorite_club_id: null,
        favorite_club_is_public: false,
        favorite_team_name: null,
        football_types: ["amateur"],
        football_types_are_public: true,
        geo_scope: "ITALY",
        interest_categories: ["Serie B", "Categoria Unica"],
        interest_categories_are_public: true,
        interest_provinces: [],
        interest_regions: [],
        profile_id: "fan-1",
        updated_at: "2026-10-09T10:00:00.000000+00:00",
      }),
    );

    const tree = await render(<FanCategoriesScreen />);

    expect(texts(tree)).toContain(
      "Questa categoria non è più disponibile. Aggiorna la selezione.",
    );
    expect(
      tree.root.findAllByProps({ testID: "fan-category-chip-Categoria Unica" })
        .length,
    ).toBeGreaterThan(0);
  });
});

describe("Aree di interesse", () => {
  it("dice che sono private e non offre un toggle pubblico", async () => {
    const tree = await render(<FanInterestAreasScreen />);
    const labels = texts(tree);

    expect(labels).toContain("Visibile solo a te");
    expect(labels).toContain(
      "Queste preferenze personalizzano la tua esperienza e non compariranno nel profilo.",
    );
    expect(labels).not.toContain("Mostra nel profilo");
    expect(
      tree.root.findAllByProps({ testID: "fan-areas-visibility" }),
    ).toHaveLength(0);
  });

  it("mostra le tre modalità e le aree selezionate", async () => {
    const tree = await render(<FanInterestAreasScreen />);
    const labels = texts(tree);

    expect(labels).toContain("Tutta Italia");
    expect(labels).toContain("In una o più regioni");
    expect(labels).toContain("Zone specifiche");
    expect(labels).toContain("Aree selezionate");
    expect(labels).toContain("Campania · Sicilia");
    expect(labels).toContain("Modifica aree");
  });

  it("chiede conferma quando il cambio modalità perde le selezioni", async () => {
    const alert = vi.spyOn(Alert, "alert").mockImplementation(() => undefined);
    const tree = await render(<FanInterestAreasScreen />);

    await press(tree, "fan-area-mode-italy");

    expect(alert).toHaveBeenCalledWith(
      "Cambiare modalità?",
      "Le aree selezionate in precedenza verranno rimosse.",
      expect.anything(),
    );
    alert.mockRestore();
  });

  it("salva modalità e territori attivi, senza residenza né visibilità", async () => {
    const alert = vi
      .spyOn(Alert, "alert")
      .mockImplementation((_title, _message, buttons) => {
        const confirm = (buttons as { onPress?: () => void }[])?.find(
          (button) => button.onPress,
        );
        confirm?.onPress?.();
      });

    const tree = await render(<FanInterestAreasScreen />);

    await press(tree, "fan-area-mode-italy");
    await save(tree);

    expect(lastFanUpdate()).toEqual({
      geo_scope: "ITALY",
      interest_provinces: [],
      interest_regions: [],
    });
    alert.mockRestore();
  });
});
