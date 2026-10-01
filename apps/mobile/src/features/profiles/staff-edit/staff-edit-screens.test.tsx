/**
 * Scenari a schermo della Modifica profilo Staff tecnico (REV-PROF-08).
 *
 * Coprono quello che distingue questo flusso da un form unico, e le regole che
 * la task vieta esplicitamente di infrangere:
 *
 *  - l'hub è un indice modulare, con conteggi reali e **senza** una CTA di
 *    salvataggio globale, e non contiene una seconda "Situazione attuale";
 *  - "Carriera" e "Percorsi aggiuntivi" puntano a REV-PROF-07, non a un
 *    secondo editor;
 *  - nella schermata Foto e dati personali non esiste un pulsante separato
 *    "Modifica foto";
 *  - ruoli e ruolo principale si salvano insieme, e un ruolo principale fuori
 *    dai ruoli selezionati non raggiunge mai il backend.
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
    saveStaffProfileMedia: vi.fn(),
    searchTeams: vi.fn(async () => []),
    updateCompleteProfessionalProfile:
      serviceMocks.updateCompleteProfessionalProfile,
  };
});

const { StaffProfileEditHubScreen } = await import(
  "./StaffProfileEditHubScreen"
);
const { StaffPersonalDataScreen } = await import(
  "./sections/StaffPersonalDataScreen"
);
const { StaffProfessionalProfileScreen } = await import(
  "./sections/StaffProfessionalProfileScreen"
);
const { StaffOpportunitiesScreen } = await import(
  "./sections/StaffOpportunitiesScreen"
);

let entryId = 0;

function staffEntry(overrides: Record<string, unknown> = {}) {
  entryId += 1;

  return {
    category: "Serie D",
    club_id: null,
    description: null,
    experience_group_id: `group-${entryId}`,
    experience_type: "SINGLE_SEASON",
    head_coach_name: null,
    id: `entry-${entryId}`,
    period_end_month: null,
    period_end_year: null,
    period_start_month: null,
    period_start_year: null,
    results: [],
    role: "Preparatore atletico",
    season_details: {},
    seasons: ["2023/2024"],
    sort_order: 0,
    staff_profile_id: "staff-1",
    team_logo_url: null,
    team_name: "ASD Prova",
    ...overrides,
  };
}

function buildProfile(
  overrides: Record<string, unknown> = {},
): CompleteProfessionalProfile {
  return {
    clubSeasonEntries: [],
    playerCareerEntries: [],
    playerPalmares: [],
    profile: {
      avatar_url: "https://example.com/a.jpg",
      birth_date: "1995-04-12",
      cover_url: "https://example.com/cover.jpg",
      full_name: "Marco Rossi",
      id: "staff-1",
      languages: ["Italiano"],
      nationality: "Italiana",
      region: "Lombardia",
      residence: "Milano",
      role: "staff",
    },
    staffCareerEntries: [staffEntry(), staffEntry({ team_name: "US Altro" })],
    staffCoachCareerEntries: [],
    staffPlayerCareerEntries: [],
    staffProfile: {
      availability_type: "REGIONS",
      available_from: "",
      certifications: [],
      experience_entries: [],
      experience_summary: null,
      media_items: [],
      open_to_work: true,
      preferred_categories: [],
      preferred_provinces: [],
      preferred_regions: ["Lombardia", "Piemonte"],
      primary_staff_role: "Preparatore atletico",
      profile_id: "staff-1",
      specialization: "fitness_coach",
      staff_roles: ["Preparatore atletico", "Match analyst"],
    },
    userContacts: {
      email: "marco@example.com",
      facebook: "",
      instagram: "",
      phone: "",
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
      tree.root.findAllByProps({ testID: "staff-edit-skeleton" }).length === 0 &&
      tree.root.findAllByProps({ testID: "staff-edit-hub-skeleton" }).length ===
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

beforeEach(() => {
  vi.clearAllMocks();
  sessionMocks.useSession.mockReturnValue({
    profile: { role: "staff" },
    session: { user: { id: "staff-1" } },
  });
  serviceMocks.getCompleteProfessionalProfile.mockResolvedValue(buildProfile());
  serviceMocks.updateCompleteProfessionalProfile.mockResolvedValue(undefined);
});

describe("Hub Modifica profilo", () => {
  it("elenca le sette voci nelle due macroaree", async () => {
    const tree = await render(<StaffProfileEditHubScreen />);
    const labels = texts(tree);

    for (const title of [
      "Profilo",
      "Foto e dati personali",
      "Profilo professionale",
      "Opportunità",
      "Percorso e visibilità",
      "Carriera",
      "Percorsi aggiuntivi",
      "Contatti pubblici",
      "Media e contenuti",
    ]) {
      expect(labels).toContain(title);
    }

    expect(labels).toContain("Staff tecnico");
  });

  it("non duplica la Situazione attuale né la società corrente", async () => {
    const labels = texts(await render(<StaffProfileEditHubScreen />));

    expect(labels).not.toContain("Situazione attuale");
    expect(labels).not.toContain("Categorie di esperienza");
  });

  it("non offre un salvataggio globale: ogni modulo salva per conto suo", async () => {
    const tree = await render(<StaffProfileEditHubScreen />);

    expect(tree.root.findAllByProps({ testID: "profile-edit-save" })).toHaveLength(
      0,
    );
  });

  it("mostra conteggi reali, con singolare e plurale corretti", async () => {
    const labels = texts(await render(<StaffProfileEditHubScreen />));

    // Due società nello staff, nessun percorso aggiuntivo, una sola email
    // pubblica, nessun contenuto.
    expect(labels).toContain("2 esperienze");
    expect(labels).toContain("Nessun percorso aggiunto");
    expect(labels).toContain("1 contatto visibile");
    expect(labels).toContain("Nessun contenuto");
  });

  it("porta alla gestione carriera di REV-PROF-07, non a un secondo editor", async () => {
    const tree = await render(<StaffProfileEditHubScreen />);

    await act(async () => {
      tree.root
        .findByProps({ testID: "staff-profile-edit-row-career" })
        .props.onPress();
    });

    expect(routerMocks.push).toHaveBeenCalledWith("/profile/staff-career");
  });

  it("apre i Percorsi aggiuntivi sullo stesso gestore, non su un hub nuovo", async () => {
    const tree = await render(<StaffProfileEditHubScreen />);

    await act(async () => {
      tree.root
        .findByProps({ testID: "staff-profile-edit-row-paths" })
        .props.onPress();
    });

    expect(routerMocks.push).toHaveBeenCalledWith(
      "/profile/staff-career?section=paths",
    );
  });
});

describe("Foto e dati personali", () => {
  it("non mostra il pulsante separato «Modifica foto»", async () => {
    const labels = texts(await render(<StaffPersonalDataScreen />));

    expect(labels).toContain("Modifica copertina");
    expect(labels).not.toContain("Modifica foto");
  });

  it("offre il cambio foto solo dal comando sovrapposto all'avatar", async () => {
    const tree = await render(<StaffPersonalDataScreen />);
    const avatarAction = tree.root.findByProps({ testID: "staff-avatar-edit" });

    expect(avatarAction.props.accessibilityLabel).toBe("Modifica foto profilo");
  });

  it("chiede il nome prima di salvare", async () => {
    const tree = await render(<StaffPersonalDataScreen />);

    await act(async () => {
      tree.root
        .findByProps({ testID: "staff-personal-first-name" })
        .props.onChangeText("   ");
    });

    await act(async () => {
      tree.root.findByProps({ testID: "profile-edit-save" }).props.onPress();
    });

    expect(texts(tree)).toContain("Inserisci il nome.");
    expect(serviceMocks.updateCompleteProfessionalProfile).not.toHaveBeenCalled();
  });
});

describe("Profilo professionale", () => {
  it("salva ruoli e ruolo principale nella stessa operazione", async () => {
    const tree = await render(<StaffProfessionalProfileScreen />);

    await act(async () => {
      tree.root
        .findByProps({ testID: "staff-professional-role-Team manager" })
        .props.onPress();
    });

    await act(async () => {
      tree.root.findByProps({ testID: "profile-edit-save" }).props.onPress();
    });

    expect(serviceMocks.updateCompleteProfessionalProfile).toHaveBeenCalledTimes(
      1,
    );

    const payload =
      serviceMocks.updateCompleteProfessionalProfile.mock.calls[0][0];

    expect(payload.staffProfile.staff_roles).toEqual([
      "Preparatore atletico",
      "Match analyst",
      "Team manager",
    ]);
    expect(payload.staffProfile.primary_staff_role).toBe("Preparatore atletico");
  });

  it("non lascia salvare senza un ruolo principale coerente", async () => {
    const tree = await render(<StaffProfessionalProfileScreen />);

    // Si toglie proprio il ruolo che era principale.
    await act(async () => {
      tree.root
        .findByProps({ testID: "staff-professional-role-Preparatore atletico" })
        .props.onPress();
    });

    await act(async () => {
      tree.root.findByProps({ testID: "profile-edit-save" }).props.onPress();
    });

    expect(texts(tree)).toContain(
      "Il ruolo principale deve essere incluso nei ruoli selezionati.",
    );
    expect(serviceMocks.updateCompleteProfessionalProfile).not.toHaveBeenCalled();
  });

  it("non lascia salvare senza nemmeno un ruolo", async () => {
    const tree = await render(<StaffProfessionalProfileScreen />);

    for (const role of ["Preparatore atletico", "Match analyst"]) {
      await act(async () => {
        tree.root
          .findByProps({ testID: `staff-professional-role-${role}` })
          .props.onPress();
      });
    }

    await act(async () => {
      tree.root.findByProps({ testID: "profile-edit-save" }).props.onPress();
    });

    expect(texts(tree)).toContain("Seleziona almeno un ruolo.");
    expect(serviceMocks.updateCompleteProfessionalProfile).not.toHaveBeenCalled();
  });

  it("limita il ruolo principale ai ruoli ancora selezionati", async () => {
    const tree = await render(<StaffProfessionalProfileScreen />);
    const selector = tree.root.findByProps({
      testID: "staff-professional-primary-role",
    });

    expect(selector.props.options.map((option: { value: string }) => option.value)).toEqual([
      "Preparatore atletico",
      "Match analyst",
    ]);
  });

  it("non riscrive la carriera cambiando il ruolo principale", async () => {
    const tree = await render(<StaffProfessionalProfileScreen />);

    await act(async () => {
      tree.root
        .findByProps({ testID: "staff-professional-primary-role" })
        .props.onChange("Match analyst");
    });

    await act(async () => {
      tree.root.findByProps({ testID: "profile-edit-save" }).props.onPress();
    });

    const payload =
      serviceMocks.updateCompleteProfessionalProfile.mock.calls[0][0];

    expect(payload.staffProfile.primary_staff_role).toBe("Match analyst");
    // Le stagioni restano com'erano: il ruolo del profilo non è quello delle
    // esperienze.
    expect(payload.staffCareerEntries).toHaveLength(2);
    expect(
      payload.staffCareerEntries.every(
        (entry: { role: string }) => entry.role === "Preparatore atletico",
      ),
    ).toBe(true);
  });
});

describe("Opportunità", () => {
  it("usa la copy dello Staff tecnico, non quella dell'Allenatore", async () => {
    const labels = texts(await render(<StaffOpportunitiesScreen />));

    expect(labels).toContain("Disponibile per nuove collaborazioni");
    expect(labels).not.toContain("Disponibile per una nuova squadra");
  });

  it("riepiloga le zone correnti senza valori fissi", async () => {
    const labels = texts(await render(<StaffOpportunitiesScreen />));

    expect(labels).toContain("Zone selezionate");
    expect(labels).toContain("Lombardia, Piemonte");
  });

  it("scrive disponibilità e zone sulle colonne dello Staff tecnico", async () => {
    const tree = await render(<StaffOpportunitiesScreen />);

    await act(async () => {
      tree.root.findByProps({ testID: "profile-edit-save" }).props.onPress();
    });

    const payload =
      serviceMocks.updateCompleteProfessionalProfile.mock.calls[0][0];

    expect(payload.staffProfile.open_to_work).toBe(true);
    expect(payload.staffProfile.availability_type).toBe("REGIONS");
    expect(payload.staffProfile.preferred_regions).toEqual([
      "Lombardia",
      "Piemonte",
    ]);
  });
});
