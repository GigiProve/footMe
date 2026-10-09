/**
 * Scenari a schermo della Modifica profilo Media/Creator (REV-PROF-22).
 *
 * Coprono quello che distingue questo flusso da un form unico e le regole che
 * la task vieta di infrangere:
 *
 *  - l'hub è un indice modulare a otto voci, con riepiloghi reali e **senza**
 *    una CTA di salvataggio globale;
 *  - la testata è la realtà editoriale, non la persona che la amministra:
 *    nome, cognome e avatar del proprietario non compaiono, e un profilo
 *    incompleto dice "Da completare" invece di inventarsi un nome;
 *  - ogni modulo salva solo le proprie colonne: la descrizione non tocca gli
 *    ambiti, gli ambiti non toccano il logo;
 *  - un canale senza valore non ha un interruttore e non entra nel conteggio;
 *  - i dati personali non mostrano la copertina della realtà e dichiarano di
 *    non comparire nel profilo pubblico.
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
    updateCompleteProfessionalProfile:
      serviceMocks.updateCompleteProfessionalProfile,
  };
});

/*
  Il client supabase non si inizializza sotto vitest (polyfill URL / Blob): la
  catena viene sostituita da un registratore, così i test possono guardare
  **quali colonne** finiscono in ogni scrittura.
*/
const supabaseMocks = vi.hoisted(() => {
  const writes: { op: string; payload: Record<string, unknown>; table: string }[] =
    [];
  const state = { contentCount: 0 };

  function chain(table: string) {
    const result = {
      count: table === "media_profile_posts" ? state.contentCount : 0,
      data: null,
      error: null,
    };

    const api: Record<string, unknown> = {
      eq: () => api,
      insert: (payload: Record<string, unknown>) => {
        writes.push({ op: "insert", payload, table });
        return api;
      },
      maybeSingle: () =>
        Promise.resolve({ data: { profile_id: "media-1" }, error: null }),
      select: () => api,
      then: (resolve: (value: unknown) => unknown, reject?: unknown) =>
        Promise.resolve(result).then(resolve, reject as never),
      update: (payload: Record<string, unknown>) => {
        writes.push({ op: "update", payload, table });
        return api;
      },
      upsert: (payload: Record<string, unknown>) => {
        writes.push({ op: "upsert", payload, table });
        return Promise.resolve({ data: null, error: null });
      },
    };

    return api;
  }

  return {
    from: vi.fn((table: string) => chain(table)),
    rpc: vi.fn(async () => ({ data: [], error: null })),
    state,
    writes,
  };
});

vi.mock("../../../lib/supabase", () => ({
  supabase: { from: supabaseMocks.from, rpc: supabaseMocks.rpc },
}));

const { MediaProfileEditHubScreen } = await import(
  "./MediaProfileEditHubScreen"
);
const { MediaIdentityScreen } = await import("./sections/MediaIdentityScreen");
const { MediaPresentationScreen } = await import(
  "./sections/MediaPresentationScreen"
);
const { MediaCoverageScreen } = await import("./sections/MediaCoverageScreen");
const { MediaContentTypesScreen } = await import(
  "./sections/MediaContentTypesScreen"
);
const { MediaAreasScreen } = await import("./sections/MediaAreasScreen");
const { MediaChannelsScreen } = await import("./sections/MediaChannelsScreen");
const { MediaPersonalDataScreen } = await import(
  "./sections/MediaPersonalDataScreen"
);

const BASE_MEDIA_PROFILE = {
  affiliation_name: null,
  affiliation_type: null,
  content_types: ["Notizie", "Analisi"],
  coverage_scope: "REGIONS",
  covered_competitions: [],
  covered_provinces: [],
  covered_teams: [],
  covered_territories: ["Lombardia", "Piemonte", "Liguria"],
  covered_topics: [],
  creator_type: "news_outlet",
  creator_type_other: null,
  editorial_type: null,
  entity_name: "Redazione Nord",
  focus_areas: ["Calcio dilettantistico", "Calcio giovanile"],
  logo_url: "https://cdn.test/logo.png",
  profile_id: "media-1",
  short_description: "Notizie e analisi dal dilettantismo.",
  updated_at: "2026-10-09T10:00:00.000000+00:00",
  verification_status: "unverified",
};

function buildProfile(
  mediaProfile: Record<string, unknown> | null = BASE_MEDIA_PROFILE,
  contacts: Record<string, unknown> = {},
): CompleteProfessionalProfile {
  return {
    clubSeasonEntries: [],
    mediaProfile,
    playerCareerEntries: [],
    playerPalmares: [],
    profile: {
      avatar_url: "https://cdn.test/owner-avatar.jpg",
      bio: null,
      birth_date: "1992-06-12",
      cover_url: "https://cdn.test/cover.jpg",
      full_name: "Marco Rossi",
      gender: "male",
      id: "media-1",
      languages: [],
      nationality: "IT",
      region: "Lombardia",
      residence: "Milano",
      role: "media",
    },
    userContacts: {
      email: "",
      facebook: "",
      instagram: "@redazionenord",
      phone: "+39 333 123 4567",
      showEmail: false,
      showFacebook: false,
      showInstagram: true,
      showPhone: false,
      showTikTok: false,
      showWebsite: true,
      showYouTube: false,
      tiktok: "",
      website: "redazionenord.it",
      youtube: "",
      ...contacts,
    },
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
      tree.root.findAllByProps({ testID: "media-edit-skeleton" }).length === 0 &&
      tree.root.findAllByProps({ testID: "media-edit-hub-skeleton" }).length ===
        0
    ) {
      break;
    }

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  /*
    Il profilo non è l'unica query: il conteggio dei contenuti arriva dopo, ed
    è proprio il riepilogo che alcuni test guardano.
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

async function type(
  tree: TestRenderer.ReactTestRenderer,
  testID: string,
  value: string,
) {
  await act(async () => {
    tree.root.findByProps({ testID }).props.onChangeText(value);
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

function lastWrite(table: string) {
  const entries = supabaseMocks.writes.filter((entry) => entry.table === table);

  return entries[entries.length - 1]?.payload;
}

beforeEach(() => {
  vi.clearAllMocks();
  supabaseMocks.writes.length = 0;
  supabaseMocks.state.contentCount = 0;
  sessionMocks.useSession.mockReturnValue({
    profile: { role: "media" },
    session: { user: { id: "media-1" } },
  });
  serviceMocks.getCompleteProfessionalProfile.mockResolvedValue(buildProfile());
  serviceMocks.updateCompleteProfessionalProfile.mockResolvedValue(undefined);
});

describe("hub Modifica profilo", () => {
  it("elenca gli otto moduli senza una CTA di salvataggio globale", async () => {
    const tree = await render(<MediaProfileEditHubScreen />);
    const labels = texts(tree);

    for (const title of [
      "Identità editoriale",
      "Presentazione",
      "Copertura",
      "Tipi di contenuto",
      "Aree coperte",
      "Canali ufficiali",
      "Dati personali",
      "Media e contenuti",
    ]) {
      expect(labels).toContain(title);
    }

    expect(
      tree.root.findAllByProps({ testID: "profile-edit-save" }),
    ).toHaveLength(0);
  });

  it("mostra la realtà editoriale e non il proprietario", async () => {
    const tree = await render(<MediaProfileEditHubScreen />);
    const labels = texts(tree);

    expect(labels).toContain("Redazione Nord");
    expect(labels).toContain("Testata giornalistica");
    expect(labels).not.toContain("Marco Rossi");
    // Il descrittore è quello canonico: "Media sportivo" non esiste nel modello.
    expect(labels).not.toContain("Media sportivo");
  });

  it("dichiara incompleta una realtà senza nome invece di inventarne uno", async () => {
    serviceMocks.getCompleteProfessionalProfile.mockResolvedValue(
      buildProfile({
        ...BASE_MEDIA_PROFILE,
        creator_type: null,
        entity_name: null,
      }),
    );

    const tree = await render(<MediaProfileEditHubScreen />);

    expect(texts(tree)).toContain("Da completare");
    expect(texts(tree)).not.toContain("Marco Rossi");
  });

  it("riassume ambiti, tipi, aree e canali con i dati reali", async () => {
    const tree = await render(<MediaProfileEditHubScreen />);
    const labels = texts(tree);

    expect(labels).toContain("2 ambiti selezionati");
    expect(labels).toContain("2 selezionati");
    expect(labels).toContain("Lombardia, Piemonte e Liguria");
    // Instagram e sito sono accesi e validi; gli altri tre non esistono.
    expect(labels).toContain("2 visibili");
  });

  it("apre il modulo Media condiviso e non una gestione Articoli", async () => {
    const tree = await render(<MediaProfileEditHubScreen />);

    await press(tree, "media-profile-edit-row-media");

    expect(routerMocks.push).toHaveBeenCalledWith("/profile/media-edit/media");
    for (const forbidden of [
      "Articoli",
      "Scrivi su PROLINK",
      "Bozze",
      "Programmati",
    ]) {
      expect(texts(tree)).not.toContain(forbidden);
    }
  });
});

describe("Identità editoriale", () => {
  it("salva solo nome, tipo e logo e scrive la copertina su profiles", async () => {
    const tree = await render(<MediaIdentityScreen />);

    await type(tree, "media-identity-name", "  Redazione   Sud  ");
    await save(tree);

    expect(lastWrite("media_profiles")).toEqual({
      creator_type: "news_outlet",
      creator_type_other: null,
      entity_name: "Redazione Sud",
      logo_url: "https://cdn.test/logo.png",
    });
    expect(lastWrite("profiles")).toEqual({
      cover_url: "https://cdn.test/cover.jpg",
    });
  });

  it("rifiuta un nome vuoto senza toccare il backend", async () => {
    const tree = await render(<MediaIdentityScreen />);

    await type(tree, "media-identity-name", "   ");
    await save(tree);

    expect(texts(tree)).toContain("Inserisci il nome della realtà.");
    expect(supabaseMocks.writes).toHaveLength(0);
  });

  it("non offre un pulsante separato per modificare il logo", async () => {
    const tree = await render(<MediaIdentityScreen />);

    expect(texts(tree)).not.toContain("Modifica foto");
    expect(texts(tree)).toContain("Modifica copertina");
    expect(
      tree.root.findAllByProps({ testID: "media-avatar-edit" }).length,
    ).toBeGreaterThan(0);
  });
});

describe("Presentazione", () => {
  it("salva la sola descrizione, sanificata", async () => {
    const tree = await render(<MediaPresentationScreen />);

    await type(tree, "media-presentation-input", "<b>Notizie</b> locali ");
    await save(tree);

    expect(lastWrite("media_profiles")).toEqual({
      short_description: "Notizie locali",
    });
  });

  it("tronca mentre si scrive invece di rifiutare dopo", async () => {
    const tree = await render(<MediaPresentationScreen />);

    await type(tree, "media-presentation-input", "a".repeat(500));

    expect(
      tree.root.findByProps({ testID: "media-presentation-input" }).props.value,
    ).toHaveLength(400);
  });
});

describe("Copertura e Tipi di contenuto", () => {
  it("salva gli ambiti senza nominare i tipi di contenuto", async () => {
    const tree = await render(<MediaCoverageScreen />);

    await press(tree, "media-coverage-option-Calciomercato");
    await save(tree);

    const payload = lastWrite("media_profiles");

    expect(payload).toEqual({
      focus_areas: [
        "Calcio dilettantistico",
        "Calcio giovanile",
        "Calciomercato",
      ],
    });
    expect(payload).not.toHaveProperty("content_types");
  });

  it("salva i tipi di contenuto senza nominare gli ambiti", async () => {
    const tree = await render(<MediaContentTypesScreen />);

    await press(tree, "media-content-types-option-Podcast");
    await save(tree);

    const payload = lastWrite("media_profiles");

    expect(payload).toEqual({
      content_types: ["Notizie", "Analisi", "Podcast"],
    });
    expect(payload).not.toHaveProperty("focus_areas");
  });
});

describe("Aree coperte", () => {
  it("chiede conferma quando il cambio modalità perde le selezioni", async () => {
    const alert = vi.spyOn(Alert, "alert").mockImplementation(() => undefined);
    const tree = await render(<MediaAreasScreen />);

    await press(tree, "media-area-mode-italy");

    expect(alert).toHaveBeenCalledWith(
      "Cambiare modalità?",
      "Le aree selezionate in precedenza verranno rimosse.",
      expect.anything(),
    );
    alert.mockRestore();
  });

  it("scrive modalità e aree attive, svuotando quelle della modalità lasciata", async () => {
    const alert = vi
      .spyOn(Alert, "alert")
      .mockImplementation((_title, _message, buttons) => {
        const confirm = (buttons as { onPress?: () => void }[])?.find(
          (button) => button.onPress,
        );
        confirm?.onPress?.();
      });

    const tree = await render(<MediaAreasScreen />);

    await press(tree, "media-area-mode-italy");
    await save(tree);

    expect(lastWrite("media_profiles")).toEqual({
      coverage_scope: "ITALY",
      covered_provinces: [],
      covered_territories: [],
    });
    alert.mockRestore();
  });

  it("dichiara che le aree non sono la residenza", async () => {
    const tree = await render(<MediaAreasScreen />);

    expect(texts(tree)).toContain(
      "Indicano la copertura editoriale, non la tua residenza.",
    );
    // La residenza del proprietario non compare e non è preselezionata.
    expect(texts(tree)).not.toContain("Milano");
  });

  it("non considera dichiarata una copertura mai scelta", async () => {
    serviceMocks.getCompleteProfessionalProfile.mockResolvedValue(
      buildProfile({
        ...BASE_MEDIA_PROFILE,
        coverage_scope: null,
        covered_territories: [],
      }),
    );

    const tree = await render(<MediaAreasScreen />);

    expect(
      tree.root.findByProps({ testID: "media-area-mode-italy" }).props.selected,
    ).toBe(false);
    expect(
      tree.root.findByProps({ testID: "profile-edit-save" }).props.disabled,
    ).toBe(true);
  });
});

describe("Canali ufficiali", () => {
  it("invita ad aggiungere un canale assente, senza interruttore", async () => {
    const tree = await render(<MediaChannelsScreen />);

    expect(texts(tree)).toContain("Aggiungi canale");
    expect(
      tree.root.findAllByProps({ testID: "media-channel-tiktok-visibility" }),
    ).toHaveLength(0);
    expect(
      tree.root.findAllByProps({ testID: "media-channel-instagram-visibility" })
        .length,
    ).toBeGreaterThan(0);
  });

  it("normalizza i valori e scrive solo le colonne dei cinque canali", async () => {
    const tree = await render(<MediaChannelsScreen />);

    await act(async () => {
      tree.root
        .findByProps({ testID: "media-channel-youtube-row" })
        .props.onPress();
    });
    await type(tree, "media-channel-youtube-input", "@redazionenord");
    await save(tree);

    const payload = lastWrite("profile_contacts") as Record<string, unknown>;

    expect(payload.youtube).toBe("https://youtube.com/@redazionenord");
    expect(payload.website).toBe("https://redazionenord.it");
    // Un canale appena inserito non diventa pubblico da solo.
    expect(payload.show_youtube).toBe(false);
    // Email e LinkedIn vivono nella stessa riga e non vengono nominati.
    expect(payload).not.toHaveProperty("email");
    expect(payload).not.toHaveProperty("linkedin");
  });

  it("non lascia salvare un canale acceso senza un valore valido", async () => {
    const tree = await render(<MediaChannelsScreen />);

    await act(async () => {
      tree.root
        .findByProps({ testID: "media-channel-instagram-visibility" })
        .props.onValueChange(true);
    });
    await act(async () => {
      tree.root
        .findByProps({ testID: "media-channel-instagram-row" })
        .props.onPress();
    });
    await type(tree, "media-channel-instagram-input", "https://nonvalido");
    await save(tree);

    expect(texts(tree)).toContain("Inserisci un profilo Instagram valido.");
    expect(lastWrite("profile_contacts")).toBeUndefined();
  });
});

describe("Dati personali", () => {
  it("non mostra la copertina della realtà e dichiara la privacy", async () => {
    const tree = await render(<MediaPersonalDataScreen />);
    const labels = texts(tree);

    expect(
      tree.root.findAllByProps({ testID: "media-cover-avatar-editor" }),
    ).toHaveLength(0);
    expect(labels).toContain("Visibili solo a te");
    expect(labels).toContain("Questi dati non compaiono nel profilo pubblico.");
  });

  it("porta il telefono privato, che l'hub del Media non ha altrove", async () => {
    const tree = await render(<MediaPersonalDataScreen />);

    expect(
      tree.root.findByProps({ testID: "media-personal-phone" }).props.value,
    ).toBe("+39 333 123 4567");
  });
});
