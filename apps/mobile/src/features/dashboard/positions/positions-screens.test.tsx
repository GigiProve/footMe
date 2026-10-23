/**
 * I sei master di DAS-REV-15 montati sui componenti reali.
 *
 * Si verifica ciò che la tavola rende osservabile e che la specifica rende
 * vincolante: l'ordine delle righe della fixture, la CTA che esiste una sola
 * volta, le tre tab senza una quarta, il filtro che applica al tap, lo
 * screen 05 senza conteggi né primaria, e il vuoto che non è un errore.
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PositionsCenterScreen } from "./PositionsCenterScreen";
import type {
  PositionFilterOption,
  PositionRow,
  PositionsCenter,
  PositionsPage,
} from "./positions-types";

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
  fetchPositionFilterOptions: vi.fn(),
  fetchPositionsCenter: vi.fn(),
  fetchPositionsPage: vi.fn(),
}));

/* Il servizio vero importa il client supabase, che in vitest non si
   inizializza. Si sostituiscono soltanto le chiamate di rete: tipi, mapping
   e classi d'errore restano quelli veri. */
vi.mock("./positions-service", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return { ...actual, ...serviceMocks };
});

const COMO = "club-1";

function center(overrides: Partial<PositionsCenter> = {}): PositionsCenter {
  return {
    accessVerifiedAt: Date.now(),
    canCreate: true,
    canViewCounts: true,
    clubId: COMO,
    clubIsVerified: true,
    clubLogoUrl: null,
    clubName: "AC Como",
    countsScopeAll: true,
    dataRevision: 1,
    scopeLabel: null,
    ...overrides,
  };
}

function row(overrides: Partial<PositionRow> & { id: string }): PositionRow {
  return {
    applicationsNew: null,
    applicationsTotal: null,
    closedAt: null,
    contextLabel: null,
    countsAvailable: true,
    publishedAt: null,
    receivingClosed: false,
    roleRequired: null,
    scope: "team",
    seasonLabel: null,
    sortKey: overrides.id,
    status: "published",
    targetRole: "player",
    teamId: "team-1",
    teamIsInactive: false,
    teamName: null,
    title: null,
    updatedAt: null,
    ...overrides,
  };
}

/** Fixture di §32, nell'ordine atteso dallo screen 01. */
const ACTIVE: PositionRow[] = [
  row({
    applicationsNew: 3,
    applicationsTotal: 12,
    contextLabel: "Serie D",
    id: "pos-centrocampista",
    teamName: "Prima squadra",
    title: "Centrocampista centrale",
  }),
  row({
    applicationsNew: 2,
    applicationsTotal: 8,
    contextLabel: "Regionale",
    id: "pos-portiere",
    teamId: "team-u18",
    teamName: "Under 18",
    title: "Portiere",
  }),
  row({
    applicationsNew: 1,
    applicationsTotal: 5,
    id: "pos-direttore",
    scope: "society",
    teamId: null,
    teamName: null,
    title: "Direttore sportivo",
  }),
  row({
    applicationsNew: 0,
    applicationsTotal: 7,
    contextLabel: "Settore giovanile",
    id: "pos-preparatore",
    teamId: "team-primavera",
    teamName: "Primavera",
    title: "Preparatore atletico",
  }),
];

const OPTIONS: PositionFilterOption[] = [
  { kind: "all" },
  { kind: "society" },
  { isInactive: false, kind: "team", label: "Prima squadra", teamId: "team-1" },
  {
    isInactive: false,
    kind: "team",
    label: "Primavera",
    teamId: "team-primavera",
  },
  { isInactive: false, kind: "team", label: "Under 18", teamId: "team-u18" },
  { isInactive: false, kind: "team", label: "Under 17", teamId: "team-u17" },
];

function page(rows: PositionRow[]): PositionsPage {
  return {
    asOf: "2026-09-12T10:00:00Z",
    hasMore: false,
    nextCursor: null,
    rows,
  };
}

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

  serviceMocks.fetchPositionsCenter.mockResolvedValue(center());
  serviceMocks.fetchPositionFilterOptions.mockResolvedValue(OPTIONS);
  serviceMocks.fetchPositionsPage.mockResolvedValue(page(ACTIVE));
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

function byTestID(tree: TestRenderer.ReactTestRenderer, id: string) {
  return tree.root.findAll((node) => node.props?.testID === id)[0];
}

/**
 * Lo sheet è aperto?
 *
 * Non si guarda il testo: `BottomSheet` tiene il `Modal` **montato** anche
 * da chiuso — serve a consegnare `onDismiss` su iOS — quindi il titolo
 * resta nell'albero. La verità è il prop `visible` del modale.
 */
function sheetIsOpen(tree: TestRenderer.ReactTestRenderer): boolean {
  return tree.root
    .findAll((node) => node.props?.transparent === true)
    .some((node) => node.props?.visible === true);
}

describe("screen 01 — Attive", () => {
  it("mostra le quattro righe della fixture nell'ordine del master", async () => {
    const tree = await render(<PositionsCenterScreen />);
    const content = texts(tree);

    const order = [
      "Centrocampista centrale",
      "Portiere",
      "Direttore sportivo",
      "Preparatore atletico",
    ].map((title) => content.indexOf(title));

    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("riproduce i conteggi autorizzati, con «7 candidature» senza nuove", async () => {
    const content = texts(await render(<PositionsCenterScreen />));

    expect(content).toContain("12 candidature");
    expect(content).toContain("3 nuove");
    expect(content).toContain("5 candidature");
    expect(content).toContain("1 nuova");
    expect(content).toContain("7 candidature");
  });

  it("mostra «Intera società» per l'incarico SOCIETY", async () => {
    expect(texts(await render(<PositionsCenterScreen />))).toContain(
      "Intera società",
    );
  });

  it("non ripete lo stato su ogni riga né aggiunge una quarta tab", async () => {
    const content = texts(await render(<PositionsCenterScreen />));

    expect(content).toContain("Attive");
    expect(content).toContain("Bozze");
    expect(content).toContain("Chiuse");
    expect(content).not.toContain("Pubblicata");
    expect(content).not.toContain("Scadute");
    expect(content).not.toContain("Tutte");
  });

  it("apre il dettaglio gestionale della Position, non il Centro Candidature", async () => {
    const tree = await render(<PositionsCenterScreen />);

    act(() => {
      byTestID(tree, "position-row-pos-centrocampista").props.onPress();
    });

    /* DAS-REV-17 §6: il dettaglio è figlio della tab Dashboard, perché la
       bottom navigation deve restare visibile con Dashboard selezionata. */
    expect(routerMocks.push).toHaveBeenCalledWith(
      "/(tabs)/dashboard/positions/pos-centrocampista",
    );
  });
});

describe("screen 02 — filtro per ambito", () => {
  it("applica la scelta al tap e chiude, senza pulsante di conferma", async () => {
    const tree = await render(<PositionsCenterScreen />);

    act(() => {
      byTestID(tree, "position-scope-row").props.onPress();
    });
    await flush();

    expect(sheetIsOpen(tree)).toBe(true);
    expect(texts(tree)).toContain("Filtra per ambito");
    expect(texts(tree)).toContain("Scegli la società o una squadra.");
    expect(texts(tree)).toContain("Solo incarichi per il club");
    expect(texts(tree)).not.toContain("Conferma");

    serviceMocks.fetchPositionsPage.mockResolvedValue(
      page([ACTIVE[3]]),
    );

    act(() => {
      byTestID(tree, "position-filter-option-team-team-primavera").props.onPress();
    });
    await flush();

    expect(serviceMocks.fetchPositionsPage).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: expect.objectContaining({ kind: "team", teamId: "team-primavera" }),
      }),
    );
    expect(sheetIsOpen(tree)).toBe(false);
  });

  it("chiudere senza scegliere conserva il filtro precedente", async () => {
    const tree = await render(<PositionsCenterScreen />);

    act(() => {
      byTestID(tree, "position-scope-row").props.onPress();
    });
    await flush();

    act(() => {
      byTestID(tree, "position-filter-option-society").props.onPress();
    });
    await flush();

    // Riapre e chiude senza scegliere.
    act(() => {
      byTestID(tree, "position-scope-row").props.onPress();
    });
    await flush();

    const callsBefore = serviceMocks.fetchPositionsPage.mock.calls.length;

    act(() => {
      byTestID(tree, "position-scope-row").props.onPress();
    });
    await flush();

    expect(serviceMocks.fetchPositionsPage.mock.calls.length).toBe(callsBefore);
    expect(texts(tree)).toContain("Intera società");
  });
});

describe("screen 03 — Bozze", () => {
  it("mostra l'ultima modifica e «Posizione senza titolo», senza conteggi", async () => {
    const tree = await render(<PositionsCenterScreen />);

    serviceMocks.fetchPositionsPage.mockResolvedValue(
      page([
        row({
          applicationsTotal: 0,
          contextLabel: "Serie D",
          id: "draft-1",
          status: "draft",
          teamName: "Prima squadra",
          title: "Difensore centrale",
          updatedAt: "2026-09-12T10:00:00+02:00",
        }),
        row({
          id: "draft-3",
          status: "draft",
          teamId: "team-u18",
          teamName: "Under 18",
          title: null,
          updatedAt: "2026-09-10T10:00:00+02:00",
        }),
      ]),
    );

    act(() => {
      tree.root
        .findAll((node) => node.props?.accessibilityRole === "tab")
        .find((node) => node.props?.accessibilityLabel === "Bozze")
        ?.props.onPress();
    });
    await flush();

    const content = texts(tree);

    expect(content).toContain("Modificata il 12 settembre");
    expect(content).toContain("Posizione senza titolo");
    expect(content).not.toContain("Nessuna candidatura");
    expect(content).not.toContain("Continua");
  });
});

describe("screen 04 — Chiuse e storico", () => {
  it("mostra data, stagione e «Squadra non attiva», senza azioni distruttive", async () => {
    const tree = await render(<PositionsCenterScreen />);

    serviceMocks.fetchPositionsPage.mockResolvedValue(
      page([
        row({
          applicationsTotal: 34,
          closedAt: "2026-06-30T12:00:00+02:00",
          contextLabel: "Serie D",
          id: "closed-1",
          seasonLabel: "2025/26",
          status: "closed",
          teamName: "Prima squadra",
          title: "Attaccante",
        }),
        row({
          applicationsTotal: 10,
          closedAt: "2026-06-15T12:00:00+02:00",
          contextLabel: "Under 17",
          id: "closed-2",
          seasonLabel: "2025/26",
          status: "closed",
          teamId: "team-comashi",
          teamIsInactive: true,
          teamName: "Comashi",
          title: "Allenatore",
        }),
      ]),
    );

    act(() => {
      tree.root
        .findAll((node) => node.props?.accessibilityRole === "tab")
        .find((node) => node.props?.accessibilityLabel === "Chiuse")
        ?.props.onPress();
    });
    await flush();

    const content = texts(tree);

    expect(content).toContain("Prima squadra · Serie D · 2025/26");
    expect(content).toContain("Chiusa il 30 giugno 2026");
    expect(content).toContain("Comashi · Under 17 · 2025/26");
    expect(content).toContain("Chiusa il 15 giugno 2026");
    expect(content).toContain("Squadra non attiva");
    expect(content).toContain("Lo storico delle squadre resta consultabile.");
    expect(content).not.toContain("Riapri");
    expect(content).not.toContain("Duplica");
    expect(content).not.toContain("Elimina");
  });
});

describe("screen 05 — sola consultazione", () => {
  it("non mostra primaria, conteggi né un filtro a una sola opzione", async () => {
    serviceMocks.fetchPositionsCenter.mockResolvedValue(
      center({ canCreate: false, canViewCounts: false, scopeLabel: "Primavera" }),
    );
    serviceMocks.fetchPositionFilterOptions.mockResolvedValue([]);
    serviceMocks.fetchPositionsPage.mockResolvedValue(
      page([
        row({
          applicationsNew: null,
          applicationsTotal: null,
          contextLabel: "Settore giovanile",
          countsAvailable: false,
          id: "pos-preparatore",
          teamId: "team-primavera",
          teamName: "Primavera",
          title: "Preparatore atletico",
        }),
      ]),
    );

    const tree = await render(<PositionsCenterScreen />);
    const content = texts(tree);

    expect(hasTestID(tree, "positions-new-header")).toBe(false);
    expect(hasTestID(tree, "position-scope-row")).toBe(false);
    expect(hasTestID(tree, "position-scope-static")).toBe(true);
    expect(content).toContain("Ambito: Primavera");
    expect(content).toContain("Sola consultazione");
    expect(content).toContain("Preparatore atletico");
    expect(content).toContain("Primavera · Settore giovanile");
    expect(content.some((line) => line.includes("candidatur"))).toBe(false);
  });
});

describe("screen 06 — nessuna posizione", () => {
  it("mostra una sola «Nuova posizione», nel corpo e non nell'header", async () => {
    serviceMocks.fetchPositionsPage.mockResolvedValue(page([]));

    const tree = await render(<PositionsCenterScreen />);
    const content = texts(tree);

    expect(hasTestID(tree, "positions-new-header")).toBe(false);
    expect(content).toContain("Nessuna posizione aperta");
    expect(content).toContain(
      "Pubblica un'opportunità per iniziare a ricevere candidature.",
    );
    expect(content.filter((line) => line === "Nuova posizione")).toHaveLength(1);
    expect(content).not.toContain("Riprova");
  });

  it("un actor in sola lettura non vede né CTA né invito a pubblicare", async () => {
    serviceMocks.fetchPositionsCenter.mockResolvedValue(
      center({ canCreate: false }),
    );
    serviceMocks.fetchPositionsPage.mockResolvedValue(page([]));

    const content = texts(await render(<PositionsCenterScreen />));

    expect(content).not.toContain("Nuova posizione");
    expect(content).toContain("Le posizioni disponibili compariranno qui.");
  });
});

describe("errori e permessi (§8, §26)", () => {
  it("un errore di lista non diventa «Nessuna posizione»", async () => {
    serviceMocks.fetchPositionsPage.mockRejectedValue(new Error("boom"));

    const content = texts(await render(<PositionsCenterScreen />));

    expect(content).toContain("Non è stato possibile caricare le posizioni.");
    expect(content).not.toContain("Nessuna posizione aperta");
  });

  it("senza lettura Posizioni il Centro non si apre e non mostra un elenco vuoto", async () => {
    const { PositionsAccessError } = await import("./positions-service");

    serviceMocks.fetchPositionsCenter.mockRejectedValue(
      new PositionsAccessError("POSITIONS_CENTER_NOT_AUTHORIZED"),
    );

    const content = texts(await render(<PositionsCenterScreen />));

    expect(content).toContain("Non hai accesso alle posizioni della società.");
    expect(content).not.toContain("Nessuna posizione aperta");
  });
});

describe("ingressi con contesto (§5)", () => {
  it("l'ingresso dalla disattivazione preimposta Team e tab Attive", async () => {
    routerMocks.params = {
      from: "deactivation",
      tab: "active",
      teamId: "team-primavera",
    };

    await render(<PositionsCenterScreen />);

    expect(serviceMocks.fetchPositionsPage).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: expect.objectContaining({
          kind: "team",
          teamId: "team-primavera",
        }),
        group: "active",
      }),
    );
  });

  it("un ingresso esplicito può preimpostare le Bozze", async () => {
    routerMocks.params = { tab: "drafts" };

    await render(<PositionsCenterScreen />);

    expect(serviceMocks.fetchPositionFilterOptions).toHaveBeenCalledWith(
      expect.objectContaining({ group: "drafts" }),
    );
  });
});
