/**
 * Scenari a schermo della Modifica profilo Dirigente (REV-PROF-11).
 *
 * Coprono quello che distingue questo flusso da un form unico, e le regole che
 * la task vieta esplicitamente di infrangere:
 *
 *  - l'hub è un indice modulare a nove voci, con conteggi reali e **senza**
 *    una CTA di salvataggio globale, senza una seconda "Situazione attuale" e
 *    senza "Salvati" o "Seguiti";
 *  - "Carriera" e "Percorsi aggiuntivi" puntano a REV-PROF-10, non a un
 *    secondo editor;
 *  - nella schermata Foto e dati personali non esiste un pulsante separato
 *    "Modifica foto";
 *  - ruoli e ruolo principale si salvano insieme, e un ruolo principale fuori
 *    dai ruoli selezionati non raggiunge mai il backend;
 *  - nessun modulo riscrive la carriera: le cinque colonne `jsonb` ripassano
 *    identiche a ogni salvataggio;
 *  - la disponibilità spenta conserva i destinatari invece di cancellarli.
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
  getCompleteProfessionalProfile: vi.fn(),
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
    getCompleteProfessionalProfile: serviceMocks.getCompleteProfessionalProfile,
    saveDirectorProfileMedia: vi.fn(),
    searchDirectorMediaTargets: vi.fn(async () => []),
    searchTeams: vi.fn(async () => []),
    updateCompleteProfessionalProfile:
      serviceMocks.updateCompleteProfessionalProfile,
  };
});

const { DirectorProfileEditHubScreen } = await import(
  "./DirectorProfileEditHubScreen"
);
const { DirectorPersonalDataScreen } = await import(
  "./sections/DirectorPersonalDataScreen"
);
const { DirectorProfessionalProfileScreen } = await import(
  "./sections/DirectorProfessionalProfileScreen"
);
const { DirectorResponsibilitiesScreen } = await import(
  "./sections/DirectorResponsibilitiesScreen"
);
const { DirectorOpportunitiesScreen } = await import(
  "./sections/DirectorOpportunitiesScreen"
);
const { DirectorBioLanguagesScreen } = await import(
  "./sections/DirectorBioLanguagesScreen"
);
const { DirectorPublicContactsScreen } = await import(
  "./sections/DirectorPublicContactsScreen"
);

/** Carriera dirigenziale nella forma in cui l'onboarding la salva. */
const DIRECTOR_ENTRIES = [
  {
    category: "Serie C",
    id: "dir-a",
    role: "Direttore sportivo",
    seasons: ["2023/2024", "2024/2025"],
    teamName: "ASD Prova",
    type: "MULTI_SEASON",
  },
  {
    category: "Serie D",
    id: "dir-b",
    role: "Direttore generale",
    seasons: ["2021/2022"],
    teamName: "US Altro",
    type: "SINGLE_SEASON",
  },
];

function buildProfile(
  overrides: Record<string, unknown> = {},
): CompleteProfessionalProfile {
  return {
    clubSeasonEntries: [],
    directorProfile: {
      availability_type: "REGIONS",
      career_entries: DIRECTOR_ENTRIES,
      coach_career_entries: [
        {
          category: "Under 17",
          id: "dir-coach-a",
          role: "Allenatore",
          seasons: ["2016/2017"],
          teamName: "Como Academy",
          type: "SINGLE_SEASON",
        },
      ],
      club_types: [],
      director_roles: ["Direttore sportivo", "Direttore generale"],
      experience_categories: [],
      has_other_football_experience: false,
      has_played_football: false,
      main_focus: "Entrambi",
      market_involvement: null,
      media_items: [],
      open_to_clubs: true,
      open_to_others: false,
      open_to_players: false,
      open_to_staff: true,
      open_to_work: true,
      other_career_entries: [],
      other_football_roles: [],
      other_role_label: null,
      player_career_entries: [],
      preferred_provinces: [],
      preferred_regions: ["Sicilia"],
      previous_roles: [],
      primary_role: "Direttore sportivo",
      profile_id: "director-1",
      responsibilities: ["Gestione rose e contratti", "Mercato calciatori"],
      staff_career_entries: [],
    },
    playerCareerEntries: [],
    playerPalmares: [],
    profile: {
      avatar_url: "https://example.com/a.jpg",
      bio: "Direttore sportivo con esperienza nella costruzione delle rose.",
      birth_date: "1980-04-12",
      cover_url: "https://example.com/cover.jpg",
      full_name: "Salvatore Burgio",
      id: "director-1",
      languages: ["Italiano", "Inglese"],
      // Codice ISO, come lo scrive il selector di nazionalità: è quello che
      // decide se la residenza italiana viene conservata.
      nationality: "IT",
      region: "Sicilia",
      residence: "Palermo",
      role: "director",
    },
    userContacts: {
      email: "salvatore.burgio@email.it",
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
    La query del profilo risolve dopo più salti di microtask: qui si aspetta
    finché lo scheletro non ha lasciato il posto ai dati, invece di sperare che
    un solo flush basti.
  */
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (
      tree.root.findAllByProps({ testID: "director-edit-skeleton" }).length ===
        0 &&
      tree.root.findAllByProps({ testID: "director-edit-hub-skeleton" })
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

function lastPayload() {
  const calls = serviceMocks.updateCompleteProfessionalProfile.mock.calls;

  return calls[calls.length - 1][0];
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionMocks.useSession.mockReturnValue({
    profile: { role: "director" },
    session: { user: { id: "director-1" } },
  });
  serviceMocks.getCompleteProfessionalProfile.mockResolvedValue(buildProfile());
  serviceMocks.updateCompleteProfessionalProfile.mockResolvedValue(undefined);
});

describe("Hub Modifica profilo", () => {
  it("elenca le nove voci nelle due macroaree", async () => {
    const labels = texts(await render(<DirectorProfileEditHubScreen />));

    for (const title of [
      "Profilo",
      "Foto e dati personali",
      "Profilo professionale",
      "Responsabilità e focus",
      "Opportunità",
      "Bio e lingue",
      "Percorso e visibilità",
      "Carriera",
      "Percorsi aggiuntivi",
      "Contatti pubblici",
      "Media e contenuti",
    ]) {
      expect(labels).toContain(title);
    }

    expect(labels).toContain("Dirigente");
    expect(labels).toContain("Visualizza profilo");
  });

  it("non duplica la Situazione attuale né mostra Salvati e Seguiti", async () => {
    const labels = texts(await render(<DirectorProfileEditHubScreen />));

    for (const forbidden of [
      "Situazione attuale",
      "Categorie di esperienza",
      "Salvati",
      "Seguiti",
    ]) {
      expect(labels).not.toContain(forbidden);
    }
  });

  it("non offre un salvataggio globale: ogni modulo salva per conto suo", async () => {
    const tree = await render(<DirectorProfileEditHubScreen />);

    expect(
      tree.root.findAllByProps({ testID: "profile-edit-save" }),
    ).toHaveLength(0);
  });

  it("mostra conteggi reali, con singolare e plurale corretti", async () => {
    const labels = texts(await render(<DirectorProfileEditHubScreen />));

    // Due esperienze dirigenziali, un solo percorso aggiuntivo popolato, una
    // sola email pubblica, nessun contenuto.
    expect(labels).toContain("2 esperienze");
    expect(labels).toContain("1 percorso");
    expect(labels).toContain("1 contatto visibile");
    expect(labels).toContain("Nessun contenuto");
  });

  it("porta alla gestione carriera di REV-PROF-10, non a un secondo editor", async () => {
    const tree = await render(<DirectorProfileEditHubScreen />);

    await act(async () => {
      tree.root
        .findByProps({ testID: "director-profile-edit-row-career" })
        .props.onPress();
    });

    expect(routerMocks.push).toHaveBeenCalledWith("/profile/director-career");
  });

  it("apre i Percorsi aggiuntivi sullo stesso gestore, non su un hub nuovo", async () => {
    const tree = await render(<DirectorProfileEditHubScreen />);

    await act(async () => {
      tree.root
        .findByProps({ testID: "director-profile-edit-row-paths" })
        .props.onPress();
    });

    expect(routerMocks.push).toHaveBeenCalledWith(
      "/profile/director-career?section=paths",
    );
  });
});

describe("Autorizzazioni", () => {
  it("rimanda indietro chi non è un Dirigente, invece di mostrargli un hub vuoto", async () => {
    sessionMocks.useSession.mockReturnValue({
      profile: { role: "player" },
      session: { user: { id: "player-1" } },
    });

    await render(<DirectorProfileEditHubScreen />);

    expect(routerMocks.replace).toHaveBeenCalledWith("/(tabs)/profile");
    // Nessuna query sul profilo altrui: l'id non arriva dalla navigazione.
    expect(serviceMocks.getCompleteProfessionalProfile).not.toHaveBeenCalled();
  });

  it("non apre nemmeno i singoli moduli a chi non è il proprietario", async () => {
    sessionMocks.useSession.mockReturnValue({
      profile: { role: "coach" },
      session: { user: { id: "coach-1" } },
    });

    await render(<DirectorProfessionalProfileScreen />);

    expect(routerMocks.replace).toHaveBeenCalledWith("/(tabs)/profile");
    expect(serviceMocks.getCompleteProfessionalProfile).not.toHaveBeenCalled();
  });
});

describe("Foto e dati personali", () => {
  it("non mostra il pulsante separato «Modifica foto»", async () => {
    const labels = texts(await render(<DirectorPersonalDataScreen />));

    expect(labels).toContain("Modifica copertina");
    expect(labels).not.toContain("Modifica foto");
  });

  it("offre il cambio foto solo dal comando sovrapposto all'avatar", async () => {
    const tree = await render(<DirectorPersonalDataScreen />);
    const avatarAction = tree.root.findByProps({
      testID: "director-avatar-edit",
    });

    expect(avatarAction.props.accessibilityLabel).toBe("Modifica foto profilo");
  });

  it("chiede il nome prima di salvare", async () => {
    const tree = await render(<DirectorPersonalDataScreen />);

    await act(async () => {
      tree.root
        .findByProps({ testID: "director-personal-first-name" })
        .props.onChangeText("   ");
    });

    await act(async () => {
      tree.root.findByProps({ testID: "profile-edit-save" }).props.onPress();
    });

    expect(texts(tree)).toContain("Inserisci il nome.");
    expect(
      serviceMocks.updateCompleteProfessionalProfile,
    ).not.toHaveBeenCalled();
  });
});

describe("Profilo professionale", () => {
  it("salva ruoli e ruolo principale nella stessa operazione", async () => {
    const tree = await render(<DirectorProfessionalProfileScreen />);

    await act(async () => {
      tree.root
        .findByProps({ testID: "director-professional-role-Responsabile scouting" })
        .props.onPress();
    });

    await act(async () => {
      tree.root.findByProps({ testID: "profile-edit-save" }).props.onPress();
    });

    expect(
      serviceMocks.updateCompleteProfessionalProfile,
    ).toHaveBeenCalledTimes(1);

    const payload = lastPayload();

    expect(payload.directorProfile.director_roles).toEqual([
      "Direttore sportivo",
      "Direttore generale",
      "Responsabile scouting",
    ]);
    expect(payload.directorProfile.primary_role).toBe("Direttore sportivo");
  });

  it("non lascia salvare senza un ruolo principale coerente", async () => {
    const tree = await render(<DirectorProfessionalProfileScreen />);

    // Si toglie proprio il ruolo che era principale.
    await act(async () => {
      tree.root
        .findByProps({ testID: "director-professional-role-Direttore sportivo" })
        .props.onPress();
    });

    await act(async () => {
      tree.root.findByProps({ testID: "profile-edit-save" }).props.onPress();
    });

    expect(texts(tree)).toContain(
      "Il ruolo principale deve essere incluso nei ruoli selezionati.",
    );
    expect(
      serviceMocks.updateCompleteProfessionalProfile,
    ).not.toHaveBeenCalled();
  });

  it("non lascia salvare senza nemmeno un ruolo", async () => {
    const tree = await render(<DirectorProfessionalProfileScreen />);

    for (const role of ["Direttore sportivo", "Direttore generale"]) {
      await act(async () => {
        tree.root
          .findByProps({ testID: `director-professional-role-${role}` })
          .props.onPress();
      });
    }

    await act(async () => {
      tree.root.findByProps({ testID: "profile-edit-save" }).props.onPress();
    });

    expect(texts(tree)).toContain("Seleziona almeno un ruolo.");
    expect(
      serviceMocks.updateCompleteProfessionalProfile,
    ).not.toHaveBeenCalled();
  });

  it("limita il ruolo principale ai ruoli ancora selezionati", async () => {
    const tree = await render(<DirectorProfessionalProfileScreen />);
    const selector = tree.root.findByProps({
      testID: "director-professional-primary-role",
    });

    expect(
      selector.props.options.map((option: { value: string }) => option.value),
    ).toEqual(["Direttore sportivo", "Direttore generale"]);
  });

  it("chiede di specificare il ruolo quando si sceglie «Altro»", async () => {
    const tree = await render(<DirectorProfessionalProfileScreen />);

    await act(async () => {
      tree.root
        .findByProps({ testID: "director-professional-role-Altro" })
        .props.onPress();
    });

    await act(async () => {
      tree.root.findByProps({ testID: "profile-edit-save" }).props.onPress();
    });

    expect(texts(tree)).toContain("Specifica il ruolo selezionato come «Altro».");
    expect(
      serviceMocks.updateCompleteProfessionalProfile,
    ).not.toHaveBeenCalled();
  });

  it("non riscrive la carriera cambiando il ruolo principale", async () => {
    const tree = await render(<DirectorProfessionalProfileScreen />);

    await act(async () => {
      tree.root
        .findByProps({ testID: "director-professional-primary-role" })
        .props.onChange("Direttore generale");
    });

    await act(async () => {
      tree.root.findByProps({ testID: "profile-edit-save" }).props.onPress();
    });

    const payload = lastPayload();

    expect(payload.directorProfile.primary_role).toBe("Direttore generale");
    // Le stagioni restano com'erano: il ruolo del profilo non è quello delle
    // esperienze.
    expect(payload.directorProfile.career_entries).toEqual(DIRECTOR_ENTRIES);
    expect(payload.directorProfile.coach_career_entries).toHaveLength(1);
  });
});

describe("Responsabilità e focus", () => {
  it("usa la tassonomia dell'onboarding, non una lista nuova", async () => {
    const labels = texts(await render(<DirectorResponsibilitiesScreen />));

    for (const area of [
      "Gestione rose e contratti",
      "Mercato calciatori",
      "Scouting e osservazione",
      "Relazioni con la federazione",
      "Settore giovanile",
      "Budget e finanze",
    ]) {
      expect(labels).toContain(area);
    }

    for (const focus of ["Prima squadra", "Settore giovanile", "Entrambi"]) {
      expect(labels).toContain(focus);
    }
  });

  it("tiene il focus a scelta singola", async () => {
    const tree = await render(<DirectorResponsibilitiesScreen />);

    await act(async () => {
      tree.root
        .findByProps({ testID: "director-focus-Prima squadra" })
        .props.onPress();
    });

    await act(async () => {
      tree.root.findByProps({ testID: "profile-edit-save" }).props.onPress();
    });

    expect(lastPayload().directorProfile.main_focus).toBe("Prima squadra");
  });

  it("non lascia salvare senza nemmeno un'area di responsabilità", async () => {
    const tree = await render(<DirectorResponsibilitiesScreen />);

    for (const area of ["Gestione rose e contratti", "Mercato calciatori"]) {
      await act(async () => {
        tree.root
          .findByProps({ testID: `director-responsibility-${area}` })
          .props.onPress();
      });
    }

    await act(async () => {
      tree.root.findByProps({ testID: "profile-edit-save" }).props.onPress();
    });

    expect(texts(tree)).toContain("Seleziona almeno un'area di responsabilità.");
    expect(
      serviceMocks.updateCompleteProfessionalProfile,
    ).not.toHaveBeenCalled();
  });

  it("non copia le responsabilità dentro le esperienze di carriera", async () => {
    const tree = await render(<DirectorResponsibilitiesScreen />);

    await act(async () => {
      tree.root
        .findByProps({ testID: "director-responsibility-Budget e finanze" })
        .props.onPress();
    });

    await act(async () => {
      tree.root.findByProps({ testID: "profile-edit-save" }).props.onPress();
    });

    expect(lastPayload().directorProfile.career_entries).toEqual(
      DIRECTOR_ENTRIES,
    );
  });

  it("mantiene l'ordine canonico della tassonomia, non quello dei tap", async () => {
    const tree = await render(<DirectorResponsibilitiesScreen />);

    // "Scouting e osservazione" viene prima di "Budget e finanze" in
    // tassonomia, anche se lo si seleziona dopo.
    await act(async () => {
      tree.root
        .findByProps({ testID: "director-responsibility-Budget e finanze" })
        .props.onPress();
    });
    await act(async () => {
      tree.root
        .findByProps({ testID: "director-responsibility-Scouting e osservazione" })
        .props.onPress();
    });

    await act(async () => {
      tree.root.findByProps({ testID: "profile-edit-save" }).props.onPress();
    });

    expect(lastPayload().directorProfile.responsibilities).toEqual([
      "Gestione rose e contratti",
      "Mercato calciatori",
      "Scouting e osservazione",
      "Budget e finanze",
    ]);
  });
});

describe("Opportunità", () => {
  it("usa la copy del Dirigente e non chiede «Disponibile da»", async () => {
    const tree = await render(<DirectorOpportunitiesScreen />);
    const labels = texts(tree);

    expect(labels).toContain("Disponibile per nuove opportunità");
    expect(labels).toContain("Disponibile per");
    expect(labels).toContain("Area operativa");
    expect(labels).toContain("In una o più aree");
    expect(labels).toContain("Aree selezionate");
    expect(
      tree.root.findAllByProps({
        testID: "director-opportunities-available-from",
      }),
    ).toHaveLength(0);
  });

  it("mostra i quattro destinatari canonici con lo stato reale", async () => {
    const tree = await render(<DirectorOpportunitiesScreen />);

    expect(
      tree.root.findByProps({
        testID: "director-opportunities-audience-clubs",
      }).props.value,
    ).toBe(true);
    expect(
      tree.root.findByProps({
        testID: "director-opportunities-audience-players",
      }).props.value,
    ).toBe(false);
  });

  it("non lascia pubblicare una disponibilità senza destinatari", async () => {
    const tree = await render(<DirectorOpportunitiesScreen />);

    for (const audience of ["clubs", "staff"]) {
      await act(async () => {
        tree.root
          .findByProps({
            testID: `director-opportunities-audience-${audience}`,
          })
          .props.onValueChange(false);
      });
    }

    await act(async () => {
      tree.root.findByProps({ testID: "profile-edit-save" }).props.onPress();
    });

    expect(texts(tree)).toContain("Seleziona almeno un destinatario.");
    expect(
      serviceMocks.updateCompleteProfessionalProfile,
    ).not.toHaveBeenCalled();
  });

  it("spegnendo la disponibilità conserva i destinatari invece di cancellarli", async () => {
    const tree = await render(<DirectorOpportunitiesScreen />);

    await act(async () => {
      tree.root
        .findByProps({ testID: "director-opportunities-toggle" })
        .props.onValueChange(false);
    });

    await act(async () => {
      tree.root.findByProps({ testID: "profile-edit-save" }).props.onPress();
    });

    const { directorProfile } = lastPayload();

    expect(directorProfile.open_to_work).toBe(false);
    expect(directorProfile.open_to_clubs).toBe(true);
    expect(directorProfile.open_to_staff).toBe(true);
  });

  it("scrive l'area operativa senza toccare la residenza", async () => {
    const tree = await render(<DirectorOpportunitiesScreen />);

    await act(async () => {
      tree.root
        .findByProps({ testID: "director-opportunities-mode-italy" })
        .props.onPress();
    });

    await act(async () => {
      tree.root.findByProps({ testID: "profile-edit-save" }).props.onPress();
    });

    const payload = lastPayload();

    expect(payload.directorProfile.availability_type).toBe("ITALY");
    // La modalità nazionale non porta territori con sé.
    expect(payload.directorProfile.preferred_regions).toEqual([]);
    expect(payload.profile.residence).toBe("Palermo");
  });
});

describe("Bio e lingue", () => {
  it("mostra il contatore sul limite di 300 caratteri", async () => {
    const tree = await render(<DirectorBioLanguagesScreen />);

    expect(texts(tree)).toContain("63/300");
  });

  it("non salva una bio fatta di soli spazi", async () => {
    const tree = await render(<DirectorBioLanguagesScreen />);

    await act(async () => {
      tree.root
        .findByProps({ testID: "director-bio-field" })
        .props.onChangeText("     ");
    });

    await act(async () => {
      tree.root.findByProps({ testID: "profile-edit-save" }).props.onPress();
    });

    expect(lastPayload().profile.bio).toBeNull();
  });

  it("blocca il salvataggio di una bio storica oltre il limite invece di troncarla", async () => {
    serviceMocks.getCompleteProfessionalProfile.mockResolvedValue(
      buildProfile({
        profile: {
          ...buildProfile().profile,
          bio: "a".repeat(420),
        },
      }),
    );

    const tree = await render(<DirectorBioLanguagesScreen />);

    await act(async () => {
      tree.root.findByProps({ testID: "profile-edit-save" }).props.onPress();
    });

    expect(texts(tree)).toContain(
      "La bio non può superare 300 caratteri.",
    );
    expect(
      serviceMocks.updateCompleteProfessionalProfile,
    ).not.toHaveBeenCalled();
  });

  it("salva le lingue sul profilo, non su una copia dirigenziale", async () => {
    const tree = await render(<DirectorBioLanguagesScreen />);

    await act(async () => {
      tree.root
        .findByProps({ testID: "director-languages" })
        .props.onChange(["Italiano"]);
    });

    await act(async () => {
      tree.root.findByProps({ testID: "profile-edit-save" }).props.onPress();
    });

    expect(lastPayload().profile.languages).toEqual(["Italiano"]);
  });
});

describe("Contatti pubblici", () => {
  it("dichiara che la chat PROLINK resta il canale principale", async () => {
    const labels = texts(await render(<DirectorPublicContactsScreen />));

    expect(
      labels.some((label) => label.includes("La chat PROLINK resta il")),
    ).toBe(true);
  });

  it("il toggle governa la visibilità reale, non solo la resa", async () => {
    const tree = await render(<DirectorPublicContactsScreen />);

    await act(async () => {
      tree.root
        .findByProps({ testID: "director-contact-phone-visibility" })
        .props.onValueChange(true);
    });

    await act(async () => {
      tree.root.findByProps({ testID: "profile-edit-save" }).props.onPress();
    });

    const { userContacts } = lastPayload();

    expect(userContacts.showPhone).toBe(true);
    expect(userContacts.phone).toBe("+39 320 7654321");
  });

  it("non riscrive la carriera salvando i contatti", async () => {
    const tree = await render(<DirectorPublicContactsScreen />);

    await act(async () => {
      tree.root.findByProps({ testID: "profile-edit-save" }).props.onPress();
    });

    expect(lastPayload().directorProfile.career_entries).toEqual(
      DIRECTOR_ENTRIES,
    );
  });
});
