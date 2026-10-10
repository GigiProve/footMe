/**
 * I sei stati del Dettaglio operativo Squadra (DAS-REV-09).
 *
 * I master della tavola non sono sei schermate: sono sei esiti dello stesso
 * componente. Questi test montano **una sola** `TeamDetailScreen` con sei
 * fixture diverse e verificano ciò che distingue uno stato dall'altro —
 * composizione, conteggi, CTA presenti e assenti, errore locale.
 *
 * Gli screen 01 e 02 non hanno un test separato per costruzione: sono due
 * posizioni di scorrimento dello stesso albero, e un test che li
 * distinguesse proverebbe l'esistenza di qualcosa che la task vieta.
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TeamDetailScreen } from "./TeamDetailScreen";
import type {
  TeamDetailPayload,
  TeamPositionsPayload,
} from "./team-detail-service";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const routerMocks = vi.hoisted(() => ({
  back: vi.fn(),
  canGoBack: vi.fn(() => true),
  params: {} as Record<string, string>,
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("expo-router", () => ({
  router: routerMocks,
  useLocalSearchParams: () => routerMocks.params,
  useNavigation: () => ({ addListener: () => () => {}, dispatch: () => {} }),
  useRouter: () => routerMocks,
}));

const sessionMocks = vi.hoisted(() => ({ useSession: vi.fn() }));

vi.mock("../../auth/use-session", () => ({
  useSession: sessionMocks.useSession,
}));

const serviceMocks = vi.hoisted(() => ({
  fetchTeamDetail: vi.fn(),
  fetchTeamPositionsPreview: vi.fn(),
}));

/*
  Il servizio vero importa il client supabase, che in vitest non si
  inizializza. Si sostituiscono soltanto le chiamate di rete: tipi, chiavi e
  mapping degli errori restano quelli veri.
*/
vi.mock("./team-detail-service", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return { ...actual, ...serviceMocks };
});

function detail(overrides: Partial<TeamDetailPayload> = {}): TeamDetailPayload {
  return {
    accessVerifiedAt: Date.now(),
    applicationsCount: 7,
    applicationsNewCount: 3,
    canCreatePositions: true,
    canEdit: true,
    canManageInvites: true,
    canManageRoster: true,
    canViewApplications: true,
    canViewInvites: true,
    canViewPositions: true,
    canViewRoster: true,
    city: "Cantù",
    cityInherited: false,
    clubId: "club-1",
    clubIsVerified: true,
    clubLogoUrl: null,
    clubName: "AC Como",
    crestInherited: true,
    crestUrl: null,
    dataRevision: 1,
    groupConversationId: null,
    groupMemberCount: null,
    groupSupported: false,
    groupTitle: null,
    hasSeasonConfig: true,
    invitesPendingCount: 2,
    isArchived: false,
    isOwner: true,
    levelId: "elite",
    levelLabel: "Élite",
    name: "Comashi",
    rosterAvatars: [
      { avatarUrl: null, id: "m1", initials: "AB" },
      { avatarUrl: null, id: "m2", initials: "CD" },
      { avatarUrl: null, id: "m3", initials: "EF" },
      { avatarUrl: null, id: "m4", initials: "GH" },
    ],
    rosterPlayersCount: 19,
    rosterStaffCount: 4,
    seasonId: "2026/27",
    seasonLabel: "2026/27",
    teamId: "team-1",
    typeId: "u18",
    typeLabel: "Under 18",
    ...overrides,
  };
}

function preview(
  overrides: Partial<TeamPositionsPayload> = {},
): TeamPositionsPayload {
  return {
    activeCount: 2,
    canCreate: true,
    canView: true,
    items: [
      { id: "p1", targetRole: "player", title: "Terzino destro" },
      { id: "p2", targetRole: "staff", title: "Preparatore atletico" },
    ],
    ...overrides,
  };
}

const mounted: TestRenderer.ReactTestRenderer[] = [];

async function render() {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false } },
  });

  let tree!: TestRenderer.ReactTestRenderer;

  await act(async () => {
    tree = TestRenderer.create(
      <QueryClientProvider client={client}>
        <TeamDetailScreen teamId="team-1" />
      </QueryClientProvider>,
    );
  });

  mounted.push(tree);

  await flush();

  return tree;
}

/**
 * Due provider indipendenti risolvono in momenti diversi e TanStack Query
 * programma le notifiche su macrotask: un giro di microtask lascerebbe
 * l'albero allo skeleton, e il test proverebbe il caricamento invece del
 * contenuto. Da qui `setTimeout(0)` ripetuto.
 */
async function flush(): Promise<void> {
  for (let turn = 0; turn < 4; turn += 1) {
    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
    });
  }
}

/** Tutto il testo reso, per asserzioni che non dipendono dalla struttura. */
function texts(tree: TestRenderer.ReactTestRenderer): string[] {
  return tree.root
    .findAll((node) => String(node.type) === "Text", {
      deep: true,
    })
    .map((node) =>
      node.children
        .filter((child): child is string => typeof child === "string")
        .join(""),
    )
    .filter((value) => value.length > 0);
}

/**
 * Solo i nodi host: un `Pressable` compare due volte nell'albero — una come
 * componente e una come vista nativa — e contarli entrambi farebbe sembrare
 * due righe quattro.
 */
function hosts(
  tree: TestRenderer.ReactTestRenderer,
  predicate: (testID: string) => boolean,
): TestRenderer.ReactTestInstance[] {
  return tree.root.findAll(
    (node) =>
      typeof node.type === "string" &&
      typeof node.props?.testID === "string" &&
      predicate(node.props.testID),
  );
}

function has(tree: TestRenderer.ReactTestRenderer, testID: string): boolean {
  return hosts(tree, (value) => value === testID).length > 0;
}

afterEach(() => {
  while (mounted.length > 0) {
    const tree = mounted.pop();
    act(() => {
      tree?.unmount();
    });
  }
});

beforeEach(() => {
  vi.clearAllMocks();
  routerMocks.canGoBack.mockReturnValue(true);
  sessionMocks.useSession.mockReturnValue({
    isLoading: false,
    profile: { id: "actor-1", role: "club_admin" },
    session: { user: { id: "actor-1" } },
  });
  serviceMocks.fetchTeamDetail.mockResolvedValue(detail());
  serviceMocks.fetchTeamPositionsPreview.mockResolvedValue(preview());
});

describe("master 01 e 02 — dettaglio standard, una sola pagina", () => {
  it("mostra header, Organico, Posizioni, Candidature e Inviti nello stesso albero", async () => {
    const tree = await render();
    const body = texts(tree);

    expect(body).toContain("Squadra");
    expect(body).toContain("Comashi");
    expect(body).toContain("Under 18 · Élite");
    expect(body).toContain("Squadra di AC Como");
    expect(body).toContain("Cantù · 2026/27");

    expect(body).toContain("Organico");
    expect(body).toContain("19 calciatori · 4 staff");
    expect(body).toContain("Vedi organico");

    expect(body).toContain("Posizioni aperte");
    expect(body).toContain("2 attive");
    expect(body).toContain("Terzino destro");
    expect(body).toContain("Preparatore atletico");
    expect(body).toContain("Vedi posizioni");
    expect(body).toContain("Nuova posizione");

    // §19/§20: Candidature e Inviti non sono una seconda schermata — vivono
    // nello stesso albero e diventano visibili scorrendo.
    expect(body).toContain("Candidature");
    expect(body).toContain("7 candidature · 3 nuove");
    expect(body).toContain("Inviti e richieste");
    expect(body).toContain("2 in attesa");
  });

  it("mostra al massimo quattro avatar e nessun badge +N", async () => {
    serviceMocks.fetchTeamDetail.mockResolvedValue(
      detail({
        rosterAvatars: Array.from({ length: 4 }, (_, index) => ({
          avatarUrl: null,
          id: `m${index}`,
          initials: "AB",
        })),
      }),
    );

    const tree = await render();

    expect(has(tree, "team-roster-avatars")).toBe(true);
    expect(texts(tree).some((value) => value.startsWith("+"))).toBe(false);
  });

  it("§8: nessun blocco «Informazioni squadra» che ripeta l'header", async () => {
    const tree = await render();
    const body = texts(tree);

    expect(body).not.toContain("Informazioni squadra");
    // Tipo, Livello, città e stagione compaiono una volta sola.
    expect(body.filter((value) => value === "Under 18 · Élite")).toHaveLength(1);
    expect(body.filter((value) => value === "Cantù · 2026/27")).toHaveLength(1);
  });

  it("«Modifica squadra» apre il form di DAS-REV-08 con lo stesso Team ID", async () => {
    const tree = await render();

    await act(async () => {
      tree.root
        .findAll((node) => node.props?.testID === "team-detail-edit")[0]
        .props.onPress();
    });

    expect(routerMocks.push).toHaveBeenCalledWith("/club-teams/team-1");
  });

  it("gli accessi mantengono il filtro Team e non copiano i dati mostrati", async () => {
    const tree = await render();

    const press = (testID: string) =>
      act(async () => {
        tree.root
          .findAll((node) => node.props?.testID === testID)[0]
          .props.onPress();
      });

    await press("team-positions-link");
    await press("team-applications-row");
    await press("team-invites-row");

    expect(routerMocks.push).toHaveBeenCalledWith(
      "/(tabs)/announcements?focus=positions&teamId=team-1",
    );
    expect(routerMocks.push).toHaveBeenCalledWith(
      "/(tabs)/announcements?focus=applications&teamId=team-1",
    );
    expect(routerMocks.push).toHaveBeenCalledWith(
      "/club-admin/invites?teamId=team-1",
    );
  });
});

describe("caricamento delle Posizioni — §14, §25", () => {
  it("in attesa non è zero: nessun «Nessuna posizione aperta» prematuro", async () => {
    let resolvePositions = (value: unknown) => value;
    serviceMocks.fetchTeamPositionsPreview.mockReturnValue(
      new Promise((resolve) => {
        resolvePositions = resolve;
      }),
    );

    const tree = await render();

    expect(has(tree, "team-positions-loading")).toBe(true);
    expect(texts(tree)).not.toContain("Nessuna posizione aperta");
    // La base della pagina è già leggibile: i due provider sono indipendenti.
    expect(texts(tree)).toContain("19 calciatori · 4 staff");

    await act(async () => {
      resolvePositions(preview({ activeCount: 0, items: [] }));
    });
    await flush();
  });
});

describe("master 03 — attività intensa", () => {
  it("quattro attive ma sempre due sole preview, stesso ordine dei moduli", async () => {
    serviceMocks.fetchTeamDetail.mockResolvedValue(
      detail({
        applicationsCount: 18,
        applicationsNewCount: 8,
        rosterPlayersCount: 18,
      }),
    );
    serviceMocks.fetchTeamPositionsPreview.mockResolvedValue(
      preview({
        activeCount: 4,
        items: [
          { id: "p1", targetRole: "player", title: "Portiere" },
          { id: "p2", targetRole: "player", title: "Difensore centrale" },
        ],
      }),
    );

    const tree = await render();
    const body = texts(tree);

    expect(body).toContain("18 calciatori · 4 staff");
    expect(body).toContain("4 attive");
    expect(body).toContain("Portiere");
    expect(body).toContain("Difensore centrale");
    expect(body).toContain("18 candidature · 8 nuove");

    // Nessuna terza o quarta riga di posizione: il totale non è la preview.
    expect(
      hosts(tree, (testID) => testID.startsWith("team-position-")),
    ).toHaveLength(2);
  });
});

describe("master 04 — squadra appena creata", () => {
  beforeEach(() => {
    serviceMocks.fetchTeamDetail.mockResolvedValue(
      detail({
        applicationsCount: 0,
        applicationsNewCount: 0,
        city: "Como",
        invitesPendingCount: 0,
        levelLabel: "Regionale",
        name: "Under 17 B",
        rosterAvatars: [],
        rosterPlayersCount: 0,
        rosterStaffCount: 0,
        typeLabel: "Under 17",
      }),
    );
    serviceMocks.fetchTeamPositionsPreview.mockResolvedValue(
      preview({ activeCount: 0, items: [] }),
    );
  });

  it("una sola CTA «Invita persona», nessun empty duplicato né zero decorativo", async () => {
    const tree = await render();
    const body = texts(tree);

    expect(body).toContain("Under 17 · Regionale");
    expect(body).toContain("Nessuna persona ancora collegata");
    expect(body).toContain("Invita calciatori, allenatori, staff e dirigenti.");
    expect(body).toContain("Invita persona");
    expect(body).toContain("Nessuna posizione aperta");
    expect(body).toContain("Crea posizione");
    // Il mockup non mostra "0 attive" accanto al titolo (§14).
    expect(body).not.toContain("0 attive");

    // §22: niente Candidature, niente secondo empty Inviti, niente conteggi 0.
    expect(body).not.toContain("Candidature");
    expect(body).not.toContain("Inviti e richieste");
    expect(body).not.toContain("0 calciatori · 0 staff");
    expect(body.filter((value) => value === "Invita persona")).toHaveLength(1);
  });

  it("lo stato vuoto non duplica Crea posizione, Nuova posizione e Vedi posizioni", async () => {
    const tree = await render();
    const body = texts(tree);

    expect(body).not.toContain("Nuova posizione");
    expect(body).not.toContain("Vedi posizioni");
  });

  it("«Invita persona» apre il flusso condiviso con il Team preimpostato", async () => {
    const tree = await render();

    await act(async () => {
      tree.root
        .findAll((node) => node.props?.testID === "team-roster-invite")[0]
        .props.onPress();
    });

    expect(routerMocks.push).toHaveBeenCalledWith(
      "/club-admin/roster?teamId=team-1&invite=player",
    );
  });
});

describe("master 05 — permessi limitati", () => {
  beforeEach(() => {
    serviceMocks.fetchTeamDetail.mockResolvedValue(
      detail({
        canCreatePositions: false,
        canEdit: false,
        canManageInvites: false,
        canManageRoster: false,
        canViewApplications: false,
        canViewInvites: false,
        canViewPositions: false,
        city: "Como",
        levelLabel: "Primavera 2",
        name: "Primavera",
        rosterPlayersCount: 22,
        rosterStaffCount: 5,
        typeLabel: "Primavera",
      }),
    );
    serviceMocks.fetchTeamPositionsPreview.mockResolvedValue(
      preview({ activeCount: null, canCreate: false, canView: false, items: [] }),
    );
  });

  it("Posizioni, Candidature e Inviti sono assenti, non disabilitati", async () => {
    const tree = await render();
    const body = texts(tree);

    expect(body).toContain("Primavera");
    expect(body).toContain("Primavera 2");
    expect(body).toContain("Organico");
    expect(body).toContain("22 calciatori · 5 staff");

    expect(body).not.toContain("Posizioni aperte");
    expect(body).not.toContain("Candidature");
    expect(body).not.toContain("Inviti e richieste");
    // §9: nessun lock, nessun messaggio sui permessi, nessun placeholder.
    expect(body.join(" ")).not.toContain("Non hai i permessi");
  });

  it("senza permesso di modifica l'azione dell'app bar non esiste", async () => {
    const tree = await render();

    expect(texts(tree)).not.toContain("Modifica squadra");
    expect(has(tree, "team-detail-edit")).toBe(false);
  });
});

describe("master 06 — errore di una sola sezione", () => {
  beforeEach(() => {
    serviceMocks.fetchTeamPositionsPreview.mockRejectedValue(
      new Error("boom"),
    );
  });

  it("Posizioni in errore, gli altri moduli restano leggibili", async () => {
    const tree = await render();
    const body = texts(tree);

    expect(body).toContain("Non è stato possibile caricare le posizioni.");
    expect(body).toContain("Riprova");

    // §24: nessun falso zero e nessun conteggio inventato.
    expect(body).not.toContain("0 attive");
    expect(body).not.toContain("Nessuna posizione aperta");

    // Gli altri moduli non sono toccati dall'errore.
    expect(body).toContain("19 calciatori · 4 staff");
    expect(body).toContain("7 candidature · 3 nuove");
    expect(body).toContain("2 in attesa");
  });

  it("il retry ricarica il solo dominio Posizioni", async () => {
    const tree = await render();

    serviceMocks.fetchTeamDetail.mockClear();
    serviceMocks.fetchTeamPositionsPreview.mockClear();
    serviceMocks.fetchTeamPositionsPreview.mockResolvedValue(preview());

    await act(async () => {
      tree.root
        .findAll((node) => node.props?.testID === "team-positions-error")[0]
        .findAll(
          (node) => node.props?.accessibilityRole === "button",
        )[0]
        .props.onPress();
    });

    await flush();

    expect(serviceMocks.fetchTeamPositionsPreview).toHaveBeenCalled();
    expect(serviceMocks.fetchTeamDetail).not.toHaveBeenCalled();
  });
});

describe("risorsa non disponibile e ritorno — §18, §27", () => {
  it("squadra non più accessibile: messaggio neutro, nessun dettaglio sulla risorsa", async () => {
    serviceMocks.fetchTeamDetail.mockRejectedValue(
      new Error("TEAM_NOT_FOUND"),
    );

    const tree = await render();
    const body = texts(tree);

    expect(body).toContain("Questa squadra non è più disponibile.");
    expect(body).not.toContain("Comashi");
    expect(body).not.toContain("AC Como");
  });

  it("deep link senza origine: il back torna al Centro Squadre", async () => {
    routerMocks.canGoBack.mockReturnValue(false);

    const tree = await render();

    await act(async () => {
      tree.root
        .findAll((node) => node.props?.testID === "team-detail-back")[0]
        .props.onPress();
    });

    expect(routerMocks.replace).toHaveBeenCalledWith("/(tabs)/dashboard/teams");
    expect(routerMocks.back).not.toHaveBeenCalled();
  });

  it("aprire la pagina non scrive nulla: due sole letture", async () => {
    await render();

    expect(serviceMocks.fetchTeamDetail).toHaveBeenCalledTimes(1);
    expect(serviceMocks.fetchTeamPositionsPreview).toHaveBeenCalledTimes(1);
    expect(serviceMocks.fetchTeamDetail).toHaveBeenCalledWith("team-1");
  });
});

describe("Gruppo squadra — §17", () => {
  it("con il dominio disponibile la riga intera apre il Gruppo", async () => {
    serviceMocks.fetchTeamDetail.mockResolvedValue(
      detail({
        groupConversationId: "conv-9",
        groupMemberCount: 23,
        groupSupported: true,
        groupTitle: "Comashi",
      }),
    );

    const tree = await render();

    expect(texts(tree)).toContain("Gruppo squadra");
    expect(texts(tree)).toContain("23 membri");

    const row = tree.root.findAll(
      (node) => node.props?.testID === "team-group-row",
    )[0];

    // Nessun secondo pulsante "Apri gruppo": la riga stessa è il bersaglio,
    // e la label accessibile esplicita l'azione.
    expect(row.props.accessibilityLabel).toBe("Apri gruppo Comashi");

    await act(async () => {
      row.props.onPress();
    });

    expect(routerMocks.push).toHaveBeenCalledWith("/messages/conv-9");
  });

  it("senza dominio il modulo non esiste: nessuna CTA senza destinazione", async () => {
    const tree = await render();

    expect(texts(tree)).not.toContain("Gruppo squadra");
    expect(texts(tree)).not.toContain("Crea gruppo squadra");
  });
});
