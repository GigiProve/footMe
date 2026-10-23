/**
 * I master di DAS-REV-13 montati sui componenti reali.
 *
 * Si verifica ciò che la tavola rende osservabile e che la specifica rende
 * vincolante: due sezioni separate con i propri conteggi, errore locale di
 * una sola lista, CTA assente per chi non può invitare, stati non
 * selezionabili nella ricerca, e la landing con **una sola** CTA.
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminCenterScreen } from "./AdminCenterScreen";
import { AdminInviteSearchScreen } from "./AdminInviteSearchScreen";
import { AdminInviteLandingScreen } from "./invite/AdminInviteLandingScreen";
import type { AdminCenter } from "./admins-types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const routerMocks = vi.hoisted(() => ({
  back: vi.fn(),
  canGoBack: vi.fn(() => true),
  params: {} as Record<string, string>,
  push: vi.fn(),
  replace: vi.fn(),
}));


/* `expo-clipboard` non si inizializza fuori da un runtime Expo; il fallback
   "Copia link" non è in gioco in questi casi. */
vi.mock("expo-clipboard", () => ({
  setStringAsync: vi.fn(async () => true),
}));
vi.mock("expo-router", () => ({
  router: routerMocks,
  useFocusEffect: () => {},
  useLocalSearchParams: () => routerMocks.params,
  useNavigation: () => ({ addListener: () => () => {}, dispatch: () => {} }),
  useRouter: () => routerMocks,
}));

const sessionMocks = vi.hoisted(() => ({ useSession: vi.fn() }));

vi.mock("../../auth/use-session", () => ({
  useSession: sessionMocks.useSession,
}));

const identityMocks = vi.hoisted(() => ({ useDashboardIdentity: vi.fn() }));

vi.mock("../identity/use-dashboard-identity", () => ({
  useDashboardIdentity: identityMocks.useDashboardIdentity,
}));

const serviceMocks = vi.hoisted(() => ({
  fetchAdminCenter: vi.fn(),
  fetchAdminInvitePublic: vi.fn(),
  fetchAdminInvites: vi.fn(),
  fetchAdmins: vi.fn(),
  resolveAdminInviteBinding: vi.fn(),
  searchAdminCandidates: vi.fn(),
}));

/*
  Il servizio vero importa il client supabase, che in vitest non si
  inizializza. Si sostituiscono soltanto le chiamate di rete: tipi, mapping e
  classi d'errore restano quelli veri.
*/
vi.mock("./admins-service", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return { ...actual, ...serviceMocks };
});

const COMO = "club-1";

function center(overrides: Partial<AdminCenter> = {}): AdminCenter {
  return {
    accessVerifiedAt: Date.now(),
    adminsCount: 4,
    canInvite: true,
    canOpenRoles: true,
    canViewAdmins: true,
    canViewInvites: true,
    clubId: COMO,
    clubIsVerified: true,
    clubLogoUrl: null,
    clubName: "AC Como",
    dataRevision: 1,
    invitesPendingCount: 1,
    scopeLabel: null,
    ...overrides,
  };
}

const ADMINS = {
  rows: [
    {
      avatarUrl: null,
      fullName: "Marco Rossi",
      isOwner: true,
      profileId: "p1",
      roleLabel: "Owner",
      scopeLabel: "Accesso completo",
    },
    {
      avatarUrl: null,
      fullName: "Luca Bianchi",
      isOwner: false,
      profileId: "p2",
      roleLabel: "Direttore sportivo",
      scopeLabel: "Intera società",
    },
  ],
  total: 4,
};

const INVITES = {
  rows: [
    {
      avatarUrl: null,
      createdAt: "2026-10-11T09:00:00Z",
      emailDisplay: null,
      expiresAt: "2026-10-18T09:00:00Z",
      fullName: "Luca Riva",
      inviteId: "i1",
      profileId: "p9",
      recipientKind: "member" as const,
      revision: 1,
      roleLabel: "Team manager",
      scopeLabel: "Under 17",
    },
  ],
  total: 1,
};

const mounted: TestRenderer.ReactTestRenderer[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  routerMocks.params = {};

  sessionMocks.useSession.mockReturnValue({
    isLoading: false,
    profile: { id: "actor-1" },
    session: { user: { id: "actor-1" } },
  });

  identityMocks.useDashboardIdentity.mockReturnValue({
    current: { id: COMO, isOwner: true, kind: "society" },
  });

  serviceMocks.fetchAdminCenter.mockResolvedValue(center());
  serviceMocks.fetchAdmins.mockResolvedValue(ADMINS);
  serviceMocks.fetchAdminInvites.mockResolvedValue(INVITES);
});

afterEach(() => {
  mounted.splice(0).forEach((tree) => {
    act(() => {
      tree.unmount();
    });
  });
});

async function flush(): Promise<void> {
  for (let turn = 0; turn < 5; turn += 1) {
    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
    });
  }
}

async function render(element: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false, retryDelay: 0 } },
  });

  let tree!: TestRenderer.ReactTestRenderer;

  await act(async () => {
    tree = TestRenderer.create(
      <QueryClientProvider client={client}>{element}</QueryClientProvider>,
    );
  });

  mounted.push(tree);
  await flush();

  return tree;
}

function texts(tree: TestRenderer.ReactTestRenderer): string[] {
  return tree.root
    .findAll((node) => String(node.type) === "Text", { deep: true })
    .map((node) =>
      node.children
        .filter((child): child is string => typeof child === "string")
        .join(""),
    )
    .filter((value) => value.length > 0);
}

function hasTestID(tree: TestRenderer.ReactTestRenderer, id: string): boolean {
  return tree.root.findAll((node) => node.props?.testID === id).length > 0;
}

describe("screen 01 — Centro Amministratori", () => {
  it("separa attivi e inviti con i rispettivi conteggi della fixture", async () => {
    const tree = await render(<AdminCenterScreen />);
    const content = texts(tree);

    expect(content).toContain("Amministratori attivi");
    expect(content).toContain("Inviti in attesa");
    expect(content).toContain("4");
    expect(content).toContain("1");
    // Il pending non gonfia gli attivi: cinque amministratori non esistono.
    expect(content).not.toContain("5");
  });

  it("l'invito interno è Invito inviato, non una consegna", async () => {
    const tree = await render(<AdminCenterScreen />);

    expect(texts(tree)).toContain("Invito inviato");
  });

  it("senza permesso di invitare la CTA non esiste, nemmeno disabilitata", async () => {
    serviceMocks.fetchAdminCenter.mockResolvedValue(
      center({ canInvite: false }),
    );

    const tree = await render(<AdminCenterScreen />);

    expect(hasTestID(tree, "admin-center-invite")).toBe(false);
    expect(texts(tree)).not.toContain("Invita amministratore");
  });

  it("senza lettura dei pending la sezione e il suo conteggio spariscono", async () => {
    serviceMocks.fetchAdminCenter.mockResolvedValue(
      center({ canViewInvites: false, invitesPendingCount: null }),
    );

    const tree = await render(<AdminCenterScreen />);
    const content = texts(tree);

    expect(content).toContain("Amministratori attivi");
    expect(content).not.toContain("Inviti in attesa");
    expect(serviceMocks.fetchAdminInvites).not.toHaveBeenCalled();
  });

  it("un errore sui soli pending lascia utilizzabili gli attivi", async () => {
    serviceMocks.fetchAdminInvites.mockRejectedValue(new Error("boom"));

    const tree = await render(<AdminCenterScreen />);
    const content = texts(tree);

    expect(content).toContain("Non siamo riusciti a caricare gli inviti.");
    expect(content).toContain("Marco Rossi");
    expect(content).toContain("Luca Bianchi");
  });

  it("nessun invito valido è uno stato pieno, non un errore", async () => {
    serviceMocks.fetchAdminInvites.mockResolvedValue({ rows: [], total: 0 });

    const tree = await render(<AdminCenterScreen />);

    expect(texts(tree)).toContain("Nessun invito in attesa");
  });
});

describe("screen 02 — Cerca persona", () => {
  it("rende selezionabile solo chi è eleggibile e dice perché gli altri non lo sono", async () => {
    routerMocks.params = {};
    serviceMocks.searchAdminCandidates.mockResolvedValue({
      rows: [
        {
          adminRole: null,
          avatarUrl: null,
          fullName: "Luca Romano",
          profileId: "p1",
          role: "director",
          status: "eligible" as const,
        },
        {
          adminRole: "Direttore sportivo",
          avatarUrl: null,
          fullName: "Luca Bianchi",
          profileId: "p2",
          role: "club_admin",
          status: "already_admin" as const,
        },
        {
          adminRole: "Team manager",
          avatarUrl: null,
          fullName: "Luca Riva",
          profileId: "p3",
          role: "staff",
          status: "already_invited" as const,
        },
      ],
      total: 3,
    });

    const tree = await render(<AdminInviteSearchScreen />);

    const field = tree.root.find(
      (node) => node.props?.testID === "admin-search-field",
    );

    await act(async () => {
      field.props.onChangeText("Luca");
    });
    /* §8: il debounce è reale (300 ms centralizzati). Il test aspetta quella
       finestra invece di aggirarla: è parte del comportamento, non un
       dettaglio di implementazione. */
    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 400);
      });
    });


    await flush();
    await flush();

    const content = texts(tree);

    expect(content).toContain("Luca Romano");
    expect(content).toContain("Già amministratore");
    expect(content).toContain("Invito già inviato");
    // Il descrittore pubblico non è il ruolo amministrativo (§9).
    expect(content).toContain("Dirigente");

    const eligible = tree.root.findAll(
      (node) => node.props?.testID === "admin-candidate-p1",
    );
    const blocked = tree.root.findAll(
      (node) => node.props?.testID === "admin-candidate-p2",
    );

    expect(eligible.some((node) => node.props.accessibilityRole === "button")).toBe(
      true,
    );
    expect(blocked.some((node) => node.props.accessibilityRole === "button")).toBe(
      false,
    );
  });

  it("il percorso esterno resta disponibile anche con risultati a schermo", async () => {
    serviceMocks.searchAdminCandidates.mockResolvedValue({
      rows: [],
      total: 0,
    });

    const tree = await render(<AdminInviteSearchScreen />);

    expect(texts(tree)).toContain("Invitala su PROLINK");
    expect(texts(tree)).toContain("Non trovi la persona?");
  });
});

describe("screen 06 — Apertura del link", () => {
  beforeEach(() => {
    serviceMocks.fetchAdminInvitePublic.mockResolvedValue({
      clubIsVerified: true,
      clubLogoUrl: null,
      clubName: "AC Como",
      roleLabel: "Responsabile recruiting",
      scopeLabel: "Primavera",
      state: "valid" as const,
    });
  });

  it("ha una sola CTA e nessuna delle alternative vietate", async () => {
    const tree = await render(<AdminInviteLandingScreen token="tok" />);
    const content = texts(tree);

    expect(content).toContain("Apri invito su PROLINK");
    expect(content).not.toContain("Continua su PROLINK");
    expect(content).not.toContain("Hai già un account? Accedi");
    expect(content).not.toContain("Accetta");
    expect(content).not.toContain("Rifiuta");
  });

  it("mostra i due helper del master e il contesto minimo condiviso", async () => {
    const tree = await render(<AdminInviteLandingScreen token="tok" />);
    const content = texts(tree);

    expect(content).toContain("PROLINK");
    expect(content).toContain("AC Como ti invita su PROLINK");
    expect(content).toContain("Sei stato invitato ad amministrare AC Como.");
    expect(content).toContain(
      "Apri l'invito nell'app. Se non l'hai, ti guideremo a scaricarla.",
    );
    expect(content).toContain(
      "L'accesso alla società si attiva solo dopo l'accettazione.",
    );
    expect(content).toContain("Responsabile recruiting");
    expect(content).toContain("Primavera");
  });

  it("aprire il link non attiva nessun accesso: nessuna risoluzione prima del tap", async () => {
    await render(<AdminInviteLandingScreen token="tok" />);

    expect(serviceMocks.resolveAdminInviteBinding).not.toHaveBeenCalled();
  });

  it("un token concluso mostra lo stato minimo, non l'invito", async () => {
    serviceMocks.fetchAdminInvitePublic.mockResolvedValue({
      state: "unavailable" as const,
    });

    const tree = await render(<AdminInviteLandingScreen token="tok" />);
    const content = texts(tree);

    expect(content).toContain("Invito non disponibile");
    expect(content).not.toContain("Apri invito su PROLINK");
  });
});
