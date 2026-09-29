/**
 * Scenari a schermo della Modifica profilo Allenatore (REV-PROF-05).
 *
 * Coprono quello che distingue questo flusso da un form unico, e le due
 * regole che la task vieta esplicitamente di infrangere:
 *
 *  - l'hub è un indice modulare, con conteggi reali e **senza** una CTA di
 *    salvataggio globale;
 *  - nella schermata Foto e dati personali non esiste un pulsante separato
 *    "Modifica foto": la foto si cambia dal comando sovrapposto all'avatar.
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CompleteProfessionalProfile } from "../profile-service";

/*
  `act` flussa gli aggiornamenti solo se React sa di essere in un ambiente di
  test. Senza questo flag le query di TanStack restano in sospeso e la
  schermata resta allo scheletro. Ionicons e la safe area sono già sostituiti
  dagli alias di vitest.config.js.
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
}));

/*
  Il modulo vero importa il client supabase, che nell'ambiente vitest non si
  inizializza (react-native-url-polyfill / BlobModule). Qui serve solo la
  lettura del profilo.
*/
vi.mock("../profile-service", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>().catch(
    () => ({}),
  );

  return {
    ...actual,
    deleteCoachAchievement: vi.fn(),
    getCompleteProfessionalProfile: serviceMocks.getCompleteProfessionalProfile,
    searchTeams: vi.fn(async () => []),
    updateCompleteProfessionalProfile: vi.fn(),
    upsertCoachAchievement: vi.fn(),
  };
});

const { CoachProfileEditHubScreen } = await import(
  "./CoachProfileEditHubScreen"
);
const { CoachPersonalDataScreen } = await import(
  "./sections/CoachPersonalDataScreen"
);
const { CoachAwardsScreen } = await import("./sections/CoachAwardsScreen");

function buildProfile(
  overrides: Partial<CompleteProfessionalProfile> = {},
): CompleteProfessionalProfile {
  return {
    clubSeasonEntries: [],
    coachCareerEntries: [],
    coachDirectorCareerEntries: [],
    coachPlayerCareerEntries: [],
    coachProfile: {
      achievements: [],
      availability_type: "REGIONS",
      coached_categories: ["Prima Squadra"],
      coached_clubs: [],
      licenses: ["UEFA B"],
      media_items: [],
      open_to_new_role: true,
      play_styles: ["Possesso palla"],
      preferred_formation: "4-3-3",
      preferred_provinces: [],
      preferred_regions: ["Lazio", "Toscana"],
      primary_role: "Allenatore",
    },
    playerCareerEntries: [],
    playerPalmares: [],
    profile: {
      avatar_url: "https://example.com/a.jpg",
      birth_date: "1995-06-12",
      cover_url: "https://example.com/cover.jpg",
      full_name: "Luca Rossi",
      languages: ["Italiano"],
      role: "coach",
    },
    userContacts: {
      email: "luca@example.com",
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
    La query del profilo risolve dopo più salti di microtask (fetch, cache,
    render). Un solo flush basta a volte e a volte no, ed è proprio il tipo di
    flakiness che non si vuole in suite: qui si aspetta finché lo scheletro
    non ha lasciato il posto ai dati.
  */
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (tree.root.findAllByProps({ testID: "coach-edit-skeleton" }).length === 0 &&
        tree.root.findAllByProps({ testID: "coach-edit-hub-skeleton" }).length === 0) {
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
    profile: { role: "coach" },
    session: { user: { id: "coach-1" } },
  });
  serviceMocks.getCompleteProfessionalProfile.mockResolvedValue(buildProfile());
});

describe("Hub Modifica profilo", () => {
  it("elenca le otto voci nelle due macroaree", async () => {
    const tree = await render(<CoachProfileEditHubScreen />);
    const labels = texts(tree);

    for (const title of [
      "Foto e dati personali",
      "Profilo allenatore",
      "Opportunità",
      "Filosofia e stile di gioco",
      "Carriera",
      "Palmarès",
      "Contatti pubblici",
      "Media e contenuti",
    ]) {
      expect(labels).toContain(title);
    }

    expect(labels).toContain("Profilo");
    expect(labels).toContain("Percorso e visibilità");
  });

  it("non offre un salvataggio globale: ogni modulo salva per conto suo", async () => {
    const tree = await render(<CoachProfileEditHubScreen />);

    expect(tree.root.findAllByProps({ testID: "profile-edit-save" })).toHaveLength(
      0,
    );
  });

  it("mostra conteggi reali, con singolare e plurale corretti", async () => {
    serviceMocks.getCompleteProfessionalProfile.mockResolvedValue(
      buildProfile({
        coachProfile: {
          ...(buildProfile().coachProfile as Record<string, unknown>),
          achievements: [{ id: "a" }, { id: "b" }],
        },
      } as unknown as Partial<CompleteProfessionalProfile>),
    );

    const labels = texts(await render(<CoachProfileEditHubScreen />));

    expect(labels).toContain("2 riconoscimenti");
    expect(labels).toContain("1 contatto visibile");
    expect(labels).toContain("0 esperienze");
  });

  it("porta alla gestione carriera di REV-PROF-04, non a un secondo editor", async () => {
    const tree = await render(<CoachProfileEditHubScreen />);

    await act(async () => {
      tree.root
        .findByProps({ testID: "coach-profile-edit-row-career" })
        .props.onPress();
    });

    expect(routerMocks.push).toHaveBeenCalledWith("/profile/coach-career");
  });
});

describe("Foto e dati personali", () => {
  it("non mostra il pulsante separato «Modifica foto»", async () => {
    const tree = await render(<CoachPersonalDataScreen />);
    const labels = texts(tree);

    expect(labels).not.toContain("Modifica foto");
    expect(labels).toContain("Modifica copertina");
  });

  it("offre il cambio foto solo dal comando sovrapposto all'avatar", async () => {
    const tree = await render(<CoachPersonalDataScreen />);
    const avatarAction = tree.root.findByProps({ testID: "coach-avatar-edit" });

    expect(avatarAction.props.accessibilityLabel).toBe("Modifica foto profilo");
  });

  it("chiede nome e cognome prima di salvare", async () => {
    const tree = await render(<CoachPersonalDataScreen />);

    await act(async () => {
      tree.root
        .findByProps({ testID: "coach-personal-first-name" })
        .props.onChangeText("");
    });
    await act(async () => {
      tree.root.findByProps({ testID: "profile-edit-save" }).props.onPress();
    });

    expect(texts(tree)).toContain("Inserisci il nome.");
  });
});

describe("Palmarès", () => {
  it("mostra l'empty state della task quando non ci sono riconoscimenti", async () => {
    const labels = texts(await render(<CoachAwardsScreen />));

    expect(labels).toContain("Racconta i tuoi traguardi");
    expect(labels).toContain("+ Aggiungi riconoscimento");
    expect(labels).toContain("Fine");
  });

  it("blocca il duplicato esatto prima di chiamare il backend", async () => {
    serviceMocks.getCompleteProfessionalProfile.mockResolvedValue(
      buildProfile({
        coachProfile: {
          ...(buildProfile().coachProfile as Record<string, unknown>),
          achievements: [
            {
              achievement_type: "campionato",
              club_id: null,
              club_name: "Torino FC",
              coach_profile_id: "coach-1",
              competition_name: "Eccellenza",
              created_at: "2026-01-01T00:00:00.000Z",
              description: null,
              id: "a",
              label: "Vincitore campionato Eccellenza 2023/24",
              season_label: "2023/2024",
              sort_order: 0,
            },
          ],
        },
      } as unknown as Partial<CompleteProfessionalProfile>),
    );

    const tree = await render(<CoachAwardsScreen />);

    await act(async () => {
      tree.root.findByProps({ testID: "coach-awards-add" }).props.onPress();
    });
    await act(async () => {
      tree.root
        .findByProps({ testID: "coach-award-competition" })
        .props.onChangeText("eccellenza ");
    });
    await act(async () => {
      tree.root
        .findByProps({ testID: "coach-award-season" })
        .props.onChange("2023/2024");
    });
    await act(async () => {
      tree.root
        .findByProps({ testID: "coach-award-club" })
        .props.onChangeText("Torino FC");
    });
    await act(async () => {
      tree.root.findByProps({ testID: "profile-edit-save" }).props.onPress();
    });

    expect(texts(tree)).toContain("Questo riconoscimento è già presente.");
  });
});
