/**
 * I tre master del composer Position di DAS-REV-16 montati sui componenti
 * reali.
 *
 * Si verifica ciò che la specifica rende vincolante: lo step 1 che non crea
 * un record finché non si preme «Continua» (§21) e che non trasforma un
 * riepilogo informativo in un controllo (§10), l'hub che distingue pronta da
 * incompleta senza farne una checkbox (§12, §34), l'anteprima batch che non
 * seleziona nulla all'ingresso e non chiede una spunta ridondante con un solo
 * elemento pubblicabile (§24).
 *
 * Solo le chiamate di rete del servizio sono sostituite: tipi, mapping e
 * copy restano quelli veri, esattamente come in positions-screens.test.tsx.
 */
import React, { useEffect, type ReactNode } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PositionComposeStartScreen } from "./PositionComposeStartScreen";
import { PositionComposeHubScreen } from "./PositionComposeHubScreen";
import { PositionComposeBatchPreviewScreen } from "./PositionComposeBatchPreviewScreen";
import {
  ComposeSessionProvider,
  useComposeSession,
} from "./ComposeSessionProvider";
import type {
  PositionCatalogs,
  PositionComposerContext,
  PositionDraft,
  PositionEligibleTeam,
  PositionProfileType,
} from "./compose-types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const routerMocks = vi.hoisted(() => ({
  back: vi.fn(),
  canGoBack: vi.fn(() => true),
  dismissAll: vi.fn(),
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

vi.mock("../../../auth/use-session", () => ({
  useSession: sessionMocks.useSession,
}));

const identityMocks = vi.hoisted(() => ({ useDashboardIdentity: vi.fn() }));

vi.mock("../../identity/use-dashboard-identity", () => ({
  useDashboardIdentity: identityMocks.useDashboardIdentity,
}));

vi.mock("../../../../ui/Toast/ToastProvider", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

const serviceMocks = vi.hoisted(() => ({
  createPositionDrafts: vi.fn(),
  fetchCatalogs: vi.fn(),
  fetchComposerContext: vi.fn(),
  fetchEligibleTeams: vi.fn(),
  fetchPositionDrafts: vi.fn(),
  publishPositions: vi.fn(),
}));

/* Il servizio vero importa il client supabase, che in vitest non si
   inizializza. Si sostituiscono soltanto le chiamate di rete: tipi, mapping
   ed errori restano quelli veri. */
vi.mock("./compose-service", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return { ...actual, ...serviceMocks };
});

const COMO = "club-1";

/** Fixture di §36: AC Como verificata, quattro squadre, actor autorizzato. */
const CONTEXT: PositionComposerContext = {
  accessVerifiedAt: Date.now(),
  canCreate: true,
  canCreateSociety: true,
  canPublish: true,
  clubCity: null,
  clubId: COMO,
  clubIsVerified: true,
  clubLogoUrl: null,
  clubName: "AC Como",
  clubRegion: null,
  limits: {
    ageMax: 70,
    ageMin: 5,
    customRoleName: 80,
    description: 2000,
    requirements: 1000,
    responsibilities: 1500,
    staffQualification: 300,
  },
  schemaVersion: 1,
  timezoneName: "Europe/Rome",
};

const TEAMS: PositionEligibleTeam[] = [
  { canCreate: true, canPublish: true, contextLabel: "Serie D", teamId: "team-first", teamName: "Prima squadra" },
  { canCreate: true, canPublish: true, contextLabel: "Settore giovanile", teamId: "team-primavera", teamName: "Primavera" },
  { canCreate: true, canPublish: true, contextLabel: null, teamId: "team-u15", teamName: "Under 15" },
  { canCreate: true, canPublish: true, contextLabel: null, teamId: "team-u17", teamName: "Under 17" },
];

/* Un catalogo per profilo: `coach` ha deliberatamente un solo ruolo, per la
   verifica di §8 («Ruolo unico assegnato senza selector»). */
const CATALOGS_BY_PROFILE: Record<PositionProfileType, PositionCatalogs> = {
  coach: {
    categories: [],
    experiences: [],
    qualifications: [],
    roles: [{ id: "role-allenatore", isCustom: false, label: "Allenatore", needsContext: false }],
    seasons: [],
  },
  director: {
    categories: [],
    experiences: [],
    qualifications: [],
    roles: [
      { id: "role-direttore", isCustom: false, label: "Direttore sportivo", needsContext: false },
      { id: "role-team-manager", isCustom: false, label: "Team manager", needsContext: false },
    ],
    seasons: [],
  },
  player: {
    categories: [],
    experiences: [],
    qualifications: [],
    roles: [
      { id: "role-attaccante", isCustom: false, label: "Attaccante", needsContext: false },
      { id: "role-centrocampista", isCustom: false, label: "Centrocampista", needsContext: false },
    ],
    seasons: [],
  },
  staff: {
    categories: [],
    experiences: [],
    qualifications: [],
    roles: [
      { id: "role-staff-1", isCustom: false, label: "Preparatore atletico", needsContext: false },
      { id: "role-staff-2", isCustom: false, label: "Match analyst", needsContext: false },
    ],
    seasons: [],
  },
};

/** Una Position della sessione, con i default di una bozza player pronta. */
function draft(overrides: Partial<PositionDraft> & { id: string }): PositionDraft {
  return {
    ageMax: null,
    ageMin: null,
    ageMode: "unset",
    blockers: [],
    canEdit: true,
    canPublish: true,
    clubCity: null,
    clubId: COMO,
    clubIsVerified: true,
    clubLogoUrl: null,
    clubName: "AC Como",
    clubRegion: null,
    contextLabel: null,
    creationBatchId: null,
    customRoleName: null,
    deadlineDate: null,
    deadlineTimezone: null,
    description: null,
    details: {},
    hasDetails: false,
    profileType: "player",
    publishedAt: null,
    resourceVersion: 1,
    roleId: "role-attaccante",
    roleIsCustom: false,
    roleLabel: "Attaccante",
    schemaVersion: 1,
    scope: "team",
    secondaryTeams: [],
    status: "draft",
    teamId: "team-first",
    teamName: "Prima squadra",
    title: "Attaccante",
    updatedAt: null,
    ...overrides,
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
    current: { id: COMO, isOwner: true, kind: "society", name: "AC Como" },
  });

  serviceMocks.fetchComposerContext.mockResolvedValue(CONTEXT);
  serviceMocks.fetchEligibleTeams.mockResolvedValue(TEAMS);
  serviceMocks.fetchCatalogs.mockImplementation(
    async (profileType: PositionProfileType) => CATALOGS_BY_PROFILE[profileType],
  );
  serviceMocks.createPositionDrafts.mockResolvedValue([]);
  serviceMocks.fetchPositionDrafts.mockResolvedValue([]);
  serviceMocks.publishPositions.mockResolvedValue([]);
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

/** Ponte di test: precarica `createdIds` nella sessione prima del montaggio
 *  dello screen reale, senza passare dallo step 1. */
function SessionBridge({
  children,
  createdIds,
}: {
  children: ReactNode;
  createdIds: string[];
}) {
  const { setCreatedIds } = useComposeSession();

  useEffect(() => {
    setCreatedIds(createdIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}

async function render(element: React.ReactElement, createdIds?: string[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false, retryDelay: 0 } },
  });

  const body = createdIds ? (
    <SessionBridge createdIds={createdIds}>{element}</SessionBridge>
  ) : (
    element
  );

  let tree!: TestRenderer.ReactTestRenderer;

  await act(async () => {
    tree = TestRenderer.create(
      <QueryClientProvider client={client}>
        <ComposeSessionProvider>{body}</ComposeSessionProvider>
      </QueryClientProvider>,
    );
  });

  mounted.push(tree);
  await flush();

  return tree;
}

function texts(tree: TestRenderer.ReactTestRenderer): string[] {
  const hidden = hiddenNodes(tree);

  return tree.root
    .findAll(
      (node) => String(node.type) === "Text" && !hidden.has(node),
      { deep: true },
    )
    .map((node) =>
      node.children
        .filter((child): child is string => typeof child === "string")
        .join(""),
    )
    .filter((value) => value.length > 0);
}

function byTestID(tree: TestRenderer.ReactTestRenderer, id: string) {
  return hostsWith(tree, (node) => node.props?.testID === id)[0];
}

/**
 * Nodi **host** che soddisfano il predicato.
 *
 * `findAll` attraversa anche i componenti compositi, quindi un singolo
 * `Pressable` con `accessibilityRole="checkbox"` comparirebbe due volte e
 * ogni conteggio raddoppierebbe. `typeof node.type === "string"` tiene solo
 * l'elemento che finisce davvero nell'albero nativo.
 */
function hostsWith(
  tree: TestRenderer.ReactTestRenderer,
  predicate: (node: TestRenderer.ReactTestInstance) => boolean,
): TestRenderer.ReactTestInstance[] {
  const hidden = hiddenNodes(tree);

  return tree.root.findAll(
    (node) =>
      typeof node.type === "string" && !hidden.has(node) && predicate(node),
    { deep: true },
  );
}

/**
 * Nodi che stanno dentro un `Modal` chiuso.
 *
 * `BottomSheet` lascia il Modal montato anche con `visible={false}` — è una
 * scelta deliberata del componente, per ricevere `onDismiss` su iOS. Per un
 * test significa che le opzioni di ogni sheet già aperto una volta restano
 * nell'albero: senza escluderle, `texts` leggerebbe schermate invisibili e
 * un tap per testID colpirebbe il gestore sbagliato.
 */
function hiddenNodes(
  tree: TestRenderer.ReactTestRenderer,
): Set<TestRenderer.ReactTestInstance> {
  const hidden = new Set<TestRenderer.ReactTestInstance>();

  for (const modal of tree.root.findAll(
    (node) => String(node.type) === "Modal" && node.props?.visible === false,
    { deep: true },
  )) {
    for (const descendant of modal.findAll(() => true, { deep: true })) {
      hidden.add(descendant);
    }
  }

  return hidden;
}

/** Le stringhe dentro un sottoalbero, non in tutto lo schermo. */
function textsWithin(node: TestRenderer.ReactTestInstance): string[] {
  return node
    .findAll((child) => String(child.type) === "Text", { deep: true })
    .map((child) =>
      child.children
        .filter((value): value is string => typeof value === "string")
        .join(""),
    )
    .filter((value) => value.length > 0);
}

function findButtonByLabel(tree: TestRenderer.ReactTestRenderer, label: string) {
  return hostsWith(
    tree,
    (node) => node.props?.accessibilityRole === "button",
  ).find((node) => node.props?.accessibilityLabel === label);
}

async function press(tree: TestRenderer.ReactTestRenderer, testID: string) {
  act(() => {
    byTestID(tree, testID).props.onPress();
  });
  await flush();
}

describe("screen 01/02/03/09 — PositionComposeStartScreen", () => {
  it("con profilo, ruolo e squadra scelti mostra una sola CTA «Continua», senza riepilogo batch", async () => {
    const tree = await render(<PositionComposeStartScreen />);

    await press(tree, "compose-field-profile");
    await press(tree, "compose-option-player");

    await press(tree, "compose-field-role");
    await press(tree, "compose-option-role-attaccante");

    await press(tree, "compose-field-team");
    await press(tree, "compose-option-team-first");

    const content = texts(tree);

    expect(content).toContain("Nuova posizione");
    expect(content).toContain("1 di 3 · Posizione");
    expect(content.filter((line) => line === "Continua")).toHaveLength(1);
    expect(content).not.toContain("Posizioni da creare");
  });

  it("il selector del profilo elenca esattamente quattro opzioni, senza una quinta", async () => {
    const tree = await render(<PositionComposeStartScreen />);

    await press(tree, "compose-field-profile");

    const labels = hostsWith(
      tree,
      (node) =>
        typeof node.props?.testID === "string" &&
        node.props.testID.startsWith("compose-option-"),
    ).map((node) => node.props.accessibilityLabel);

    expect(labels).toEqual(["Calciatore", "Allenatore", "Staff", "Dirigente"]);
  });

  it("confermare una squadra aggiuntiva mostra «Posizioni da creare» come righe informative, senza chevron", async () => {
    const tree = await render(<PositionComposeStartScreen />);

    await press(tree, "compose-field-profile");
    await press(tree, "compose-option-player");
    await press(tree, "compose-field-role");
    await press(tree, "compose-option-role-attaccante");
    await press(tree, "compose-field-team");
    await press(tree, "compose-option-team-first");

    await press(tree, "compose-second-search");
    await press(tree, "compose-option-team-primavera");
    await press(tree, "compose-confirm-selection");

    const content = texts(tree);

    expect(content).toContain("Posizioni da creare");
    expect(content).toContain("2 posizioni distinte");

    /* §10: «È un riepilogo non tappabile; nessun chevron sulle righe.»
       L'asserzione è sul solo blocco: il campo «Squadra» sopra di esso è un
       pulsante legittimo e nomina per forza la squadra scelta. */
    const summary = byTestID(tree, "compose-batch-summary");

    expect(
      summary.findAll(
        (node) =>
          node.props?.accessibilityRole === "button" ||
          typeof node.props?.onPress === "function",
        { deep: true },
      ),
    ).toHaveLength(0);

    /* Le righe nominano comunque entrambe le ricerche. */
    expect(textsWithin(summary)).toEqual(
      expect.arrayContaining(["Prima squadra", "Primavera"]),
    );
  });

  it("con profilo Dirigente e ambito «Intera società» nasconde Squadra e la categoria, e mostra l'helper dell'incarico di club", async () => {
    const tree = await render(<PositionComposeStartScreen />);

    await press(tree, "compose-field-profile");
    await press(tree, "compose-option-director");
    await press(tree, "compose-field-scope");
    await press(tree, "compose-option-society");

    const content = texts(tree);

    expect(content).not.toContain("Squadra");
    expect(content).not.toContain("Serie D");
    expect(content).toContain("Un incarico per il club, senza una squadra specifica.");
  });

  it("§8: con un solo ruolo nel catalogo il campo Ruolo non compare e la CTA resta abilitata", async () => {
    const tree = await render(<PositionComposeStartScreen />);

    await press(tree, "compose-field-profile");
    await press(tree, "compose-option-coach");
    await press(tree, "compose-field-team");
    await press(tree, "compose-option-team-first");

    expect(texts(tree)).not.toContain("Ruolo");

    const cta = byTestID(tree, "compose-start-continue");

    expect(cta.props.accessibilityState?.disabled).toBe(false);
  });
});

describe("screen 04 — PositionComposeHubScreen", () => {
  it("distingue pronta da incompleta, nomina la CTA sulle sole pubblicabili e indica cosa resta in bozza", async () => {
    const drafts = [
      draft({ hasDetails: true, id: "pos-prima", teamId: "team-first", teamName: "Prima squadra", title: "Allenatore Prima squadra" }),
      draft({
        blockers: ["AGE_UNSET"],
        id: "pos-primavera",
        teamId: "team-primavera",
        teamName: "Primavera",
        title: "Allenatore Primavera",
      }),
    ];

    serviceMocks.fetchPositionDrafts.mockResolvedValue(drafts);

    const tree = await render(<PositionComposeHubScreen />, drafts.map((d) => d.id));
    const content = texts(tree);

    expect(content).toContain("Configura le posizioni");
    expect(content).toContain("2 di 3 · Dettagli");
    expect(content).toContain("Pronta per la pubblicazione");
    expect(content).toContain("Da completare");
    expect(content).toContain("La posizione Primavera resterà in bozza.");

    const cta = findButtonByLabel(tree, "Continua con 1 posizione");

    expect(cta).toBeDefined();
    expect(cta?.props.accessibilityState?.disabled).toBe(false);
  });

  it("con zero bozze pubblicabili la CTA è disabilitata e l'helper chiede di completarne almeno una", async () => {
    const drafts = [
      draft({ blockers: ["AGE_UNSET"], id: "pos-prima" }),
      draft({ blockers: ["AGE_UNSET"], id: "pos-primavera", teamName: "Primavera" }),
    ];

    serviceMocks.fetchPositionDrafts.mockResolvedValue(drafts);

    const tree = await render(<PositionComposeHubScreen />, drafts.map((d) => d.id));
    const content = texts(tree);

    expect(content).toContain("Completa almeno una posizione per continuare.");

    const cta = findButtonByLabel(tree, "Continua con 0 posizioni");

    expect(cta?.props.accessibilityState?.disabled).toBe(true);
  });

  it("§4/§34: nessuna riga dell'hub espone «Pronta» come checkbox", async () => {
    const drafts = [
      draft({ hasDetails: true, id: "pos-prima" }),
      draft({ blockers: ["AGE_UNSET"], id: "pos-primavera", teamName: "Primavera" }),
    ];

    serviceMocks.fetchPositionDrafts.mockResolvedValue(drafts);

    const tree = await render(<PositionComposeHubScreen />, drafts.map((d) => d.id));

    expect(hostsWith(tree, (node) => node.props?.accessibilityRole === "checkbox")).toHaveLength(0);
  });
});

describe("screen 11 — PositionComposeBatchPreviewScreen", () => {
  it("§24: con due pubblicabili nessuna checkbox è spuntata all'ingresso e l'helper chiede una selezione", async () => {
    const drafts = [
      draft({ id: "pos-a", title: "Attaccante" }),
      draft({ id: "pos-b", teamId: "team-primavera", teamName: "Primavera", title: "Centrocampista" }),
    ];

    serviceMocks.fetchPositionDrafts.mockResolvedValue(drafts);

    const tree = await render(<PositionComposeBatchPreviewScreen />, drafts.map((d) => d.id));

    const checkboxes = hostsWith(tree, (node) => node.props?.accessibilityRole === "checkbox");

    expect(checkboxes).toHaveLength(2);
    expect(checkboxes.every((node) => node.props?.accessibilityState?.checked === false)).toBe(true);
    expect(texts(tree)).toContain("Seleziona almeno una posizione da pubblicare.");
  });

  it("selezionando la prima la CTA diventa «Pubblica 1 posizione» e segnala 1 bozza residua", async () => {
    const drafts = [
      draft({ id: "pos-a", title: "Attaccante" }),
      draft({ id: "pos-b", teamId: "team-primavera", teamName: "Primavera", title: "Centrocampista" }),
    ];

    serviceMocks.fetchPositionDrafts.mockResolvedValue(drafts);

    const tree = await render(<PositionComposeBatchPreviewScreen />, drafts.map((d) => d.id));

    await press(tree, "compose-select-pos-a");

    const content = texts(tree);

    expect(content).toContain("1 posizione resterà in bozza");

    const cta = byTestID(tree, "compose-publish-batch");

    expect(cta.props.accessibilityLabel).toBe("Pubblica 1 posizione");
  });

  it("§24: con una sola bozza pubblicabile su due non compare nessuna checkbox e la CTA nomina comunque quella posizione", async () => {
    const drafts = [
      draft({ id: "pos-a", title: "Attaccante" }),
      draft({
        blockers: ["AGE_UNSET"],
        id: "pos-b",
        teamId: "team-primavera",
        teamName: "Primavera",
        title: "Centrocampista",
      }),
    ];

    serviceMocks.fetchPositionDrafts.mockResolvedValue(drafts);

    const tree = await render(<PositionComposeBatchPreviewScreen />, drafts.map((d) => d.id));

    expect(hostsWith(tree, (node) => node.props?.accessibilityRole === "checkbox")).toHaveLength(0);

    const cta = byTestID(tree, "compose-publish-batch");

    expect(cta.props.accessibilityLabel).toBe("Pubblica 1 posizione");
  });

  it("una bozza non pubblicabile mostra «Completa» e non è selezionabile", async () => {
    const drafts = [
      draft({ id: "pos-a", title: "Attaccante" }),
      draft({
        blockers: ["AGE_UNSET"],
        id: "pos-b",
        teamId: "team-primavera",
        teamName: "Primavera",
        title: "Centrocampista",
      }),
    ];

    serviceMocks.fetchPositionDrafts.mockResolvedValue(drafts);

    const tree = await render(<PositionComposeBatchPreviewScreen />, drafts.map((d) => d.id));

    expect(texts(tree)).toContain("Completa");
    expect(hostsWith(tree, (node) => node.props?.testID === "compose-select-pos-b")).toHaveLength(0);
  });
});
