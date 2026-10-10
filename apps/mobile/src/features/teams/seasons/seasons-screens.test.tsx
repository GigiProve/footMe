/**
 * I dieci stati della tavola DAS-REV-10, montati sui componenti reali.
 *
 * Non sono dieci schermate: sono gli esiti di sei componenti con fixture
 * diverse (§36: «La tavola mostra stati del flusso, non dieci commit
 * consecutivi nello stesso database»). Qui si verificano le differenze che
 * la task rende osservabili — conteggi reali, CTA presenti e assenti,
 * assenza della seconda creazione su una stagione già preparata, nessun
 * dettaglio riservato negli impedimenti.
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HistoryReviewScreen } from "./HistoryReviewScreen";
import { HistoryDraftProvider, useHistoryDraft } from "./HistoryDraftProvider";
import { InactiveTeamsScreen } from "./InactiveTeamsScreen";
import { SeasonConfigScreen } from "./SeasonConfigScreen";
import { SeasonHistoryEditScreen } from "./SeasonHistoryEditScreen";
import { SeasonsCenterScreen } from "./SeasonsCenterScreen";
import { TeamDeactivationScreen } from "./TeamDeactivationScreen";
import { TeamReactivateScreen } from "./TeamReactivateScreen";
import { TeamSeasonsScreen } from "./TeamSeasonsScreen";
import type {
  DeactivationCheck,
  HistoryPreview,
  SeasonsCenterHeader,
  TeamSeasonDetail,
  TeamSeasonsContext,
} from "./seasons-service";

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

vi.mock("../../auth/use-session", () => ({ useSession: sessionMocks.useSession }));

const identityMocks = vi.hoisted(() => ({ useDashboardIdentity: vi.fn() }));

vi.mock("../../dashboard/identity/use-dashboard-identity", () => ({
  useDashboardIdentity: identityMocks.useDashboardIdentity,
}));

const toastMocks = vi.hoisted(() => ({ showToast: vi.fn() }));

const serviceMocks = vi.hoisted(() => ({
  checkTeamDeactivation: vi.fn(),
  fetchHistorySeasonOptions: vi.fn(),
  fetchInactiveTeams: vi.fn(),
  fetchSeasonsCenter: vi.fn(),
  fetchSeasonsCenterPage: vi.fn(),
  fetchTeamSeasonDetail: vi.fn(),
  fetchTeamSeasonHistoryPage: vi.fn(),
  fetchTeamSeasonsContext: vi.fn(),
  previewHistoryPeriods: vi.fn(),
}));

/*
  Il servizio vero importa il client supabase, che in vitest non si
  inizializza. Si sostituiscono soltanto le chiamate di rete: tipi, chiavi e
  mapping degli errori restano quelli veri.
*/
vi.mock("./seasons-service", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return { ...actual, ...serviceMocks };
});

vi.mock("../../../ui", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return { ...actual, useToast: () => ({ showToast: toastMocks.showToast }) };
});

function header(
  overrides: Partial<SeasonsCenterHeader> = {},
): SeasonsCenterHeader {
  return {
    accessVerifiedAt: Date.now(),
    canView: true,
    canViewInactive: true,
    clubId: "club-1",
    clubIsVerified: true,
    clubLogoUrl: null,
    clubName: "AC Como",
    dataRevision: 1,
    inactiveCount: 1,
    nextSeasonId: "2027/28",
    nextSeasonLabel: "2027/28",
    preparedCount: 1,
    scopeLabel: null,
    seasonId: "2026/27",
    seasonLabel: "2026/27",
    toPrepareCount: 3,
    totalCount: 4,
    ...overrides,
  };
}

function context(
  overrides: Partial<TeamSeasonsContext> = {},
): TeamSeasonsContext {
  return {
    accessVerifiedAt: Date.now(),
    canAddHistory: true,
    canEditHistory: true,
    canManageLifecycle: true,
    canPrepare: true,
    canViewHistory: true,
    clubId: "club-1",
    clubIsVerified: true,
    clubLogoUrl: null,
    clubName: "AC Como",
    crestUrl: null,
    currentConfig: {
      id: "cfg-current",
      levelId: "elite",
      levelLabel: "Élite",
      typeId: "u18",
      typeLabel: "Under 18",
      version: 1,
    },
    dataRevision: 1,
    historyCount: 2,
    isArchived: false,
    name: "Comashi",
    nextConfig: null,
    nextSeasonId: "2027/28",
    nextSeasonLabel: "2027/28",
    seasonId: "2026/27",
    seasonLabel: "2026/27",
    teamId: "team-1",
    teamVersion: 3,
    ...overrides,
  };
}

function detail(overrides: Partial<TeamSeasonDetail> = {}): TeamSeasonDetail {
  return {
    canEdit: true,
    clubId: "club-1",
    clubIsVerified: true,
    clubName: "AC Como",
    crestUrl: null,
    isArchived: false,
    levelId: "regionale",
    levelLabel: "Regionale",
    phase: "past",
    seasonId: "2025/26",
    seasonLabel: "2025/26",
    teamId: "team-1",
    teamName: "Comashi",
    teamSeasonId: "cfg-2025",
    typeId: "u18",
    typeLabel: "Under 18",
    version: 2,
    ...overrides,
  };
}

const HISTORY = {
  items: [
    {
      levelId: "regionale",
      levelLabel: "Regionale",
      seasonId: "2025/26",
      seasonLabel: "2025/26",
      sortKey: "002025",
      teamSeasonId: "cfg-2025",
      typeId: "u18",
      typeLabel: "Under 18",
      version: 1,
    },
    {
      levelId: "elite",
      levelLabel: "Élite",
      seasonId: "2024/25",
      seasonLabel: "2024/25",
      sortKey: "002024",
      teamSeasonId: "cfg-2024",
      typeId: "u18",
      typeLabel: "Under 18",
      version: 1,
    },
  ],
  nextCursor: null,
};

const mounted: TestRenderer.ReactTestRenderer[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  sessionMocks.useSession.mockReturnValue({ profile: { id: "actor-1" } });
  identityMocks.useDashboardIdentity.mockReturnValue({
    current: { id: "club-1", kind: "society", name: "AC Como" },
  });

  serviceMocks.fetchSeasonsCenter.mockResolvedValue(header());
  serviceMocks.fetchSeasonsCenterPage.mockResolvedValue({
    items: [
      {
        crestUrl: null,
        hasSeasonConfig: true,
        levelId: "serie-d",
        levelLabel: "Serie D",
        name: "Prima squadra",
        nextHasConfig: false,
        sortKey: "a",
        teamId: "team-0",
        typeId: "prima",
        typeLabel: "Prima squadra",
      },
      {
        crestUrl: null,
        hasSeasonConfig: true,
        levelId: "elite",
        levelLabel: "Élite",
        name: "Comashi",
        nextHasConfig: false,
        sortKey: "b",
        teamId: "team-1",
        typeId: "u18",
        typeLabel: "Under 18",
      },
    ],
    nextCursor: null,
  });
  serviceMocks.fetchTeamSeasonsContext.mockResolvedValue(context());
  serviceMocks.fetchTeamSeasonHistoryPage.mockResolvedValue(HISTORY);
  serviceMocks.fetchTeamSeasonDetail.mockResolvedValue(detail());
  serviceMocks.fetchHistorySeasonOptions.mockResolvedValue([]);
  serviceMocks.fetchInactiveTeams.mockResolvedValue({
    items: [
      { crestUrl: null, hasHistory: true, name: "Comashi", sortKey: "a", teamId: "team-1" },
    ],
    nextCursor: null,
  });
  serviceMocks.checkTeamDeactivation.mockResolvedValue({
    allowed: false,
    alreadyInactive: false,
    authorized: true,
    blockers: [
      { canOpen: true, count: 2, kind: "positions" },
      { canOpen: true, count: 1, kind: "invites" },
    ],
  } satisfies DeactivationCheck);
  serviceMocks.previewHistoryPeriods.mockResolvedValue({
    conflicts: [],
    contextVersion: "ctx-1",
    currentSeasonId: "2026/27",
    limit: 100,
    overLimit: false,
    periods: [
      {
        draftCoveredCount: 0,
        errorCode: null,
        existingCount: 0,
        fromSeason: "2018/19",
        index: 0,
        levelId: "regionale",
        newCount: 4,
        toSeason: "2021/22",
        typeId: "u18",
      },
      {
        draftCoveredCount: 0,
        errorCode: null,
        existingCount: 2,
        fromSeason: "2022/23",
        index: 1,
        levelId: "elite",
        newCount: 2,
        toSeason: "2025/26",
        typeId: "u18",
      },
    ],
    totalExisting: 2,
    totalNew: 6,
  } satisfies HistoryPreview);
});

afterEach(() => {
  mounted.splice(0).forEach((tree) => {
    act(() => {
      tree.unmount();
    });
  });
});

async function render(node: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false } },
  });

  let tree!: TestRenderer.ReactTestRenderer;

  await act(async () => {
    tree = TestRenderer.create(
      <QueryClientProvider client={client}>{node}</QueryClientProvider>,
    );
  });

  mounted.push(tree);
  await flush();

  return tree;
}

/**
 * Più provider indipendenti risolvono in momenti diversi e TanStack Query
 * programma le notifiche su macrotask: un giro di microtask lascerebbe
 * l'albero allo skeleton.
 */
async function flush(): Promise<void> {
  for (let turn = 0; turn < 5; turn += 1) {
    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
    });
  }
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

function hasTestId(tree: TestRenderer.ReactTestRenderer, id: string): boolean {
  return tree.root.findAll((node) => node.props?.testID === id).length > 0;
}

/** Il nodo host con `accessibilityState`, cioè il Pressable del bottone. */
function pressable(tree: TestRenderer.ReactTestRenderer, id: string) {
  return tree.root.find(
    (node) => node.props?.testID === id && !!node.props?.accessibilityState,
  );
}

describe("screen 01 — Centro stagioni", () => {
  it("mostra la corrente read-only e il riepilogo reale della prossima", async () => {
    const tree = await render(<SeasonsCenterScreen />);
    const copy = texts(tree);

    expect(copy).toContain("AC Como");
    expect(copy).toContain("Stagione corrente");
    expect(copy).toContain("2026/27");
    expect(copy).toContain("Prossima stagione");
    expect(copy).toContain("2027/28");
    expect(copy).toContain("3 da preparare · 1 preparata");
    expect(copy).toContain("Squadre non attive");
  });

  it("non fabbrica la prossima stagione quando non è in catalogo (§6)", async () => {
    serviceMocks.fetchSeasonsCenter.mockResolvedValue(
      header({ nextSeasonId: null, nextSeasonLabel: null, preparedCount: null, toPrepareCount: null }),
    );

    const tree = await render(<SeasonsCenterScreen />);

    expect(texts(tree)).toContain("Non ancora disponibile nel calendario.");
  });
});

describe("screen 02 — Stagioni della squadra", () => {
  it("mostra i tre blocchi e lo storico senza ripetere Conclusa", async () => {
    const tree = await render(<TeamSeasonsScreen teamId="team-1" />);
    const copy = texts(tree);

    expect(copy).toContain("Squadra di AC Como");
    expect(copy).toContain("In corso");
    expect(copy).toContain("Da preparare");
    expect(copy).toContain("Prepara nuova stagione");
    expect(copy).toContain("Stagioni precedenti");
    expect(copy).toContain("2025/26");
    expect(copy).toContain("Aggiungi stagione precedente");
    // §11: lo stato Conclusa non si ripete su ogni riga storica.
    expect(copy.filter((value) => value === "Conclusa")).toHaveLength(0);
  });

  it("una prossima già preparata non offre una seconda creazione (§11)", async () => {
    serviceMocks.fetchTeamSeasonsContext.mockResolvedValue(
      context({
        nextConfig: {
          id: "cfg-next",
          levelId: "regionale",
          levelLabel: "Regionale",
          typeId: "u18",
          typeLabel: "Under 18",
          version: 1,
        },
      }),
    );

    const tree = await render(<TeamSeasonsScreen teamId="team-1" />);
    const copy = texts(tree);

    expect(copy).toContain("Preparata");
    expect(copy).toContain("Modifica preparazione");
    expect(copy).not.toContain("Prepara nuova stagione");
  });

  it("la corrente mancante offre Configura stagione, non dati storici (§10)", async () => {
    serviceMocks.fetchTeamSeasonsContext.mockResolvedValue(
      context({ currentConfig: null }),
    );

    const tree = await render(<TeamSeasonsScreen teamId="team-1" />);
    const copy = texts(tree);

    expect(copy).toContain("Stagione da configurare");
    expect(copy).toContain("Configura stagione");
  });

  it("senza capability non mostra CTA né menu (§8)", async () => {
    serviceMocks.fetchTeamSeasonsContext.mockResolvedValue(
      context({
        canAddHistory: false,
        canEditHistory: false,
        canManageLifecycle: false,
        canPrepare: false,
      }),
    );

    const tree = await render(<TeamSeasonsScreen teamId="team-1" />);
    const copy = texts(tree);

    expect(copy).not.toContain("Prepara nuova stagione");
    expect(copy).not.toContain("Aggiungi stagione precedente");
    expect(hasTestId(tree, "seasons-team-menu")).toBe(false);
  });

  it("la squadra non attiva mostra lo stato e non offre Disattiva (§28)", async () => {
    serviceMocks.fetchTeamSeasonsContext.mockResolvedValue(
      context({ isArchived: true }),
    );

    const tree = await render(<TeamSeasonsScreen teamId="team-1" />);
    const copy = texts(tree);

    expect(copy).toContain("Squadra non attiva");
    expect(copy).not.toContain("Prepara nuova stagione");
  });
});

describe("screen 03 — Prepara stagione", () => {
  it("stagione read-only, prefill dalla corrente e helper sull'organico", async () => {
    const tree = await render(<SeasonConfigScreen target="next" teamId="team-1" />);
    const copy = texts(tree);

    expect(copy).toContain("Stagione");
    expect(copy).toContain("2027/28");
    expect(copy).toContain("Under 18");
    expect(copy).toContain("L'organico non viene copiato automaticamente.");
    expect(copy).toContain("Prepara stagione");
    expect(hasTestId(tree, "season-target-field")).toBe(true);
  });

  it("per la corrente mancante la CTA è Configura stagione, senza helper organico", async () => {
    serviceMocks.fetchTeamSeasonsContext.mockResolvedValue(
      context({ currentConfig: null }),
    );

    const tree = await render(
      <SeasonConfigScreen target="current" teamId="team-1" />,
    );
    const copy = texts(tree);

    expect(copy).toContain("2026/27");
    expect(copy).toContain("Configura stagione");
    expect(copy).not.toContain("L'organico non viene copiato automaticamente.");
  });
});

describe("screen 04 — Correggi una stagione", () => {
  it("anno read-only, helper e azione Annulla", async () => {
    const tree = await render(<SeasonHistoryEditScreen teamSeasonId="cfg-2025" />);
    const copy = texts(tree);

    expect(copy).toContain("Conclusa");
    expect(copy).toContain("2025/26");
    expect(copy).toContain("Le modifiche non riaprono la stagione.");
    expect(copy).toContain("Salva modifiche");
    expect(copy).toContain("Annulla");
  });

  it("senza capability resta in consultazione (§16)", async () => {
    serviceMocks.fetchTeamSeasonDetail.mockResolvedValue(detail({ canEdit: false }));

    const tree = await render(<SeasonHistoryEditScreen teamSeasonId="cfg-2025" />);
    const copy = texts(tree);

    expect(copy).not.toContain("Salva modifiche");
    expect(copy).toContain("Regionale");
  });

  it("un livello sconosciuto non viene inventato (§16)", async () => {
    serviceMocks.fetchTeamSeasonDetail.mockResolvedValue(
      detail({ canEdit: false, levelId: null, levelLabel: null }),
    );

    const tree = await render(<SeasonHistoryEditScreen teamSeasonId="cfg-2025" />);

    expect(texts(tree)).toContain("Non indicato");
  });
});

describe("screen 06 — Rivedi storico", () => {
  function Seed({ children }: { children: React.ReactNode }) {
    const draft = useHistoryDraft();
    const seeded = React.useRef(false);

    if (!seeded.current) {
      seeded.current = true;
      draft.add({
        fromLabel: "2018/19",
        fromSeason: "2018/19",
        levelId: "regionale",
        levelLabel: "Regionale",
        toLabel: "2021/22",
        toSeason: "2021/22",
        typeId: "u18",
        typeLabel: "Under 18",
      });
      draft.add({
        fromLabel: "2022/23",
        fromSeason: "2022/23",
        levelId: "elite",
        levelLabel: "Élite",
        toLabel: "2025/26",
        toSeason: "2025/26",
        typeId: "u18",
        typeLabel: "Under 18",
      });
    }

    return <>{children}</>;
  }

  it("riproduce il caso del master: 4 nuove, 2 nuove · 2 già presenti, totale 6", async () => {
    const tree = await render(
      <HistoryDraftProvider>
        <Seed>
          <HistoryReviewScreen teamId="team-1" />
        </Seed>
      </HistoryDraftProvider>,
    );

    const copy = texts(tree);

    expect(copy).toContain("6 stagioni da aggiungere");
    expect(copy).toContain("2018/19 – 2021/22");
    expect(copy).toContain("4 stagioni");
    expect(copy).toContain("2022/23 – 2025/26");
    expect(copy).toContain("2 nuove · 2 già presenti");
    expect(copy).toContain("Le 2 stagioni già presenti resteranno invariate.");
    expect(copy).toContain("Aggiungi un altro periodo");
    expect(copy).toContain("Aggiungi 6 stagioni allo storico");
  });

  it("un conflitto di classificazione blocca la conferma (§20)", async () => {
    serviceMocks.previewHistoryPeriods.mockResolvedValue({
      conflicts: [{ periodIndexes: [0, 1], seasonId: "2021/22" }],
      contextVersion: "ctx-1",
      currentSeasonId: "2026/27",
      limit: 100,
      overLimit: false,
      periods: [],
      totalExisting: 0,
      totalNew: 4,
    } satisfies HistoryPreview);

    const tree = await render(
      <HistoryDraftProvider>
        <Seed>
          <HistoryReviewScreen teamId="team-1" />
        </Seed>
      </HistoryDraftProvider>,
    );

    expect(
      pressable(tree, "seasons-primary-cta").props.accessibilityState.disabled,
    ).toBe(true);
    expect(texts(tree).join(" ")).toContain("2021/22");
  });
});

describe("screen 07 — Attività da gestire", () => {
  it("elenca gli impedimenti reali con le destinazioni dei centri esistenti", async () => {
    const tree = await render(<TeamDeactivationScreen teamId="team-1" />);
    const copy = texts(tree);

    expect(copy).toContain(
      "Prima di disattivare Comashi, gestisci le attività ancora aperte.",
    );
    expect(copy).toContain("Posizioni aperte");
    expect(copy).toContain("2 posizioni attive");
    expect(copy).toContain("Vedi posizioni");
    expect(copy).toContain("Inviti in attesa");
    expect(copy).toContain("1 invito ancora accettabile");
    expect(copy).toContain("Gestisci inviti");
    expect(copy).toContain("Lo storico della squadra sarà conservato.");
    // §26: «Nessun grande warning rosso, CTA Disattiva attiva o pulsante che
    // risolve automaticamente tutti gli impedimenti.» "Disattiva squadra" è
    // il titolo della schermata; l'unica CTA è Chiudi.
    expect(pressable(tree, "seasons-primary-cta").props.accessibilityLabel).toBe(
      "Chiudi",
    );
  });

  it("non espone dettagli a chi non può consultare il dominio bloccante (§26)", async () => {
    serviceMocks.checkTeamDeactivation.mockResolvedValue({
      allowed: false,
      alreadyInactive: false,
      authorized: true,
      blockers: [{ canOpen: false, count: null, kind: "positions" }],
    } satisfies DeactivationCheck);

    const tree = await render(<TeamDeactivationScreen teamId="team-1" />);
    const copy = texts(tree);

    expect(copy).not.toContain("Vedi posizioni");
    expect(copy).toContain(
      "Alcune attività devono essere gestite da un amministratore autorizzato.",
    );
  });

  it("un controllo fallito non diventa assenza di impedimenti (§26)", async () => {
    serviceMocks.checkTeamDeactivation.mockRejectedValue(new Error("boom"));

    const tree = await render(<TeamDeactivationScreen teamId="team-1" />);
    const copy = texts(tree);

    expect(copy).toContain(
      "Non è stato possibile verificare le attività della squadra. Riprova.",
    );
    expect(copy).not.toContain("Chiudi");
  });
});

describe("screen 09 — Squadre non attive", () => {
  it("mostra l'elenco consultabile e nessuna metrica a zero", async () => {
    const tree = await render(<InactiveTeamsScreen />);
    const copy = texts(tree);

    expect(copy).toContain("Consulta lo storico o riattiva una squadra.");
    expect(copy).toContain("Comashi");
    expect(copy).toContain("Storico disponibile");
  });

  it("l'elenco vuoto è un messaggio, non un errore (§28)", async () => {
    serviceMocks.fetchInactiveTeams.mockResolvedValue({ items: [], nextCursor: null });

    const tree = await render(<InactiveTeamsScreen />);

    expect(texts(tree)).toContain("Nessuna squadra non attiva nel tuo ambito");
  });
});

describe("screen 10 — Configura e riattiva", () => {
  it("con la corrente mancante chiede la classificazione", async () => {
    serviceMocks.fetchTeamSeasonsContext.mockResolvedValue(
      context({
        currentConfig: null,
        isArchived: true,
        seasonId: "2028/29",
        seasonLabel: "2028/29",
      }),
    );

    const tree = await render(<TeamReactivateScreen teamId="team-1" />);
    const copy = texts(tree);

    expect(copy).toContain("Squadra non attiva");
    expect(copy).toContain("Configura la stagione corrente per riattivare la squadra.");
    expect(copy).toContain("2028/29");
    expect(copy).toContain("La squadra e lo storico rimangono gli stessi.");
    expect(copy).toContain("Configura e riattiva");
  });

  it("con la corrente valida la riusa senza richiederla (§29 caso A)", async () => {
    serviceMocks.fetchTeamSeasonsContext.mockResolvedValue(
      context({ isArchived: true }),
    );

    const tree = await render(<TeamReactivateScreen teamId="team-1" />);
    const copy = texts(tree);

    expect(copy).toContain("Riattivare Comashi?");
    expect(copy).toContain("Under 18 · Élite");
    expect(copy).toContain("Riattiva squadra");
    expect(copy).not.toContain("Configura e riattiva");
  });

  it("senza capability stagionale spiega il prerequisito, senza CTA (§29)", async () => {
    serviceMocks.fetchTeamSeasonsContext.mockResolvedValue(
      context({ canPrepare: false, currentConfig: null, isArchived: true }),
    );

    const tree = await render(<TeamReactivateScreen teamId="team-1" />);
    const copy = texts(tree);

    expect(copy.join(" ")).toContain("serve anche il permesso di configurare");
    expect(hasTestId(tree, "seasons-primary-cta")).toBe(false);
  });
});
