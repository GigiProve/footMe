/**
 * Stati a schermo del Centro Squadre e del form condiviso (DAS-REV-08).
 *
 * Gli otto master della tavola sono stati dello stesso sistema: questi test
 * coprono quelli che la task descrive con una regola verificabile — totale e
 * "+ Nuova", empty con e senza permesso, ambito limitato, riga senza
 * configurazione stagionale, prefill e campi disabilitati del form, avviso
 * duplicato superabile e bloccante.
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const routerMocks = vi.hoisted(() => ({
  back: vi.fn(),
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

vi.mock("../auth/use-session", () => ({ useSession: sessionMocks.useSession }));

const identityMocks = vi.hoisted(() => ({ useDashboardIdentity: vi.fn() }));

vi.mock("../dashboard/identity/use-dashboard-identity", () => ({
  useDashboardIdentity: identityMocks.useDashboardIdentity,
}));

const serviceMocks = vi.hoisted(() => ({
  checkTeamDuplicates: vi.fn(),
  createClubTeam: vi.fn(),
  fetchTeamEditor: vi.fn(),
  fetchTeamLevelOptions: vi.fn(),
  fetchTeamsCenter: vi.fn(),
  fetchTeamsCenterPage: vi.fn(),
  fetchTeamTypeOptions: vi.fn(),
  updateClubTeam: vi.fn(),
}));

/*
  Il servizio vero importa il client supabase, che in vitest non si
  inizializza. Si sostituiscono soltanto le chiamate di rete: mapping degli
  errori, tipi e chiavi restano quelli veri.
*/
vi.mock("./teams-service", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return { ...actual, ...serviceMocks };
});

const { TeamsCenterScreen } = await import("./TeamsCenterScreen");
const { TeamFormScreen } = await import("./TeamFormScreen");
const { ToastProvider } = await import("../../ui");

function header(overrides: Record<string, unknown> = {}) {
  return {
    accessVerifiedAt: Date.now(),
    canCreate: true,
    canView: true,
    canViewCounts: true,
    clubCity: "Como",
    clubId: "club-1",
    clubIsVerified: true,
    clubLogoUrl: null,
    clubName: "AC Como",
    clubRegion: "Lombardia",
    dataRevision: 1,
    inactiveCount: 0,
    scopeLabel: null,
    seasonId: "2026/27",
    seasonLabel: "2026/27",
    totalCount: 8,
    ...overrides,
  };
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    canEdit: true,
    countsAvailable: true,
    crestInherited: true,
    crestUrl: null,
    hasSeasonConfig: true,
    levelId: "elite",
    levelLabel: "Élite",
    name: "Comashi",
    playersCount: 19,
    sortKey: "1-0040-0003-comashi-team-4",
    staffCount: 4,
    teamId: "team-4",
    typeId: "under_18",
    typeLabel: "Under 18",
    ...overrides,
  };
}

async function render(element: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false } },
  });

  let tree!: TestRenderer.ReactTestRenderer;

  await act(async () => {
    tree = TestRenderer.create(
      <QueryClientProvider client={client}>
        <ToastProvider>{element}</ToastProvider>
      </QueryClientProvider>,
    );
  });

  /*
    TanStack Query consegna i risultati tramite il proprio notifyManager, che
    usa un task del loop e non una semplice microtask: svuotare la coda con
    `Promise.resolve()` lasciava le query a metà in modo non deterministico.
  */
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  return tree;
}

/** Tutte le stringhe rese dall'albero, per asserire copy e assenze. */
function texts(tree: TestRenderer.ReactTestRenderer): string[] {
  return tree.root
    .findAll((node) => typeof node.type === "string")
    .flatMap((node) =>
      node.children.filter(
        (child): child is string => typeof child === "string",
      ),
    );
}

beforeEach(() => {
  vi.clearAllMocks();
  routerMocks.params = {};
  sessionMocks.useSession.mockReturnValue({ profile: { id: "actor-1" } });
  identityMocks.useDashboardIdentity.mockReturnValue({
    current: { id: "club-1", kind: "society", name: "AC Como" },
  });
  serviceMocks.fetchTeamsCenter.mockResolvedValue(header());
  serviceMocks.fetchTeamsCenterPage.mockResolvedValue({
    items: [row()],
    nextCursor: null,
  });
  serviceMocks.fetchTeamTypeOptions.mockResolvedValue([
    { id: "first_team", label: "Prima squadra" },
    { id: "under_18", label: "Under 18" },
  ]);
  serviceMocks.fetchTeamLevelOptions.mockResolvedValue([
    { id: "elite", isActive: true, label: "Élite" },
    { id: "regionale", isActive: true, label: "Regionale" },
  ]);
});

describe("Centro Squadre — master 01", () => {
  it("mostra contesto, stagione, totale del backend e + Nuova", async () => {
    const tree = await render(<TeamsCenterScreen />);
    const content = texts(tree);

    expect(content).toContain("Squadre");
    expect(content).toContain("AC Como");
    expect(content).toContain("Stagione 2026/27");
    expect(content).toContain("8 squadre");
    expect(content).toContain("Nuova");
    expect(content).toContain("Comashi");
    expect(content).toContain("Under 18 · Élite");
    expect(content).toContain("19 calciatori · 4 staff");
  });

  it("apre il form di creazione con il contesto della Società (§12)", async () => {
    const tree = await render(<TeamsCenterScreen />);

    await act(async () => {
      tree.root.findByProps({ testID: "teams-new-action" }).props.onPress();
    });

    expect(routerMocks.push).toHaveBeenCalledWith("/club-teams/new?clubId=club-1");
  });

  it("distingue stagione da configurare e conteggi non consultabili", async () => {
    serviceMocks.fetchTeamsCenterPage.mockResolvedValue({
      items: [
        row({
          countsAvailable: false,
          hasSeasonConfig: false,
          levelLabel: null,
          playersCount: null,
          staffCount: null,
          typeLabel: null,
        }),
      ],
      nextCursor: null,
    });

    const content = texts(await render(<TeamsCenterScreen />));

    expect(content).toContain("Stagione da configurare");
    expect(content.some((value) => value.includes("calciatori"))).toBe(false);
  });
});

describe("Centro Squadre — master 07 e 08", () => {
  it("nessuna squadra: messaggio e una sola CTA di creazione", async () => {
    serviceMocks.fetchTeamsCenter.mockResolvedValue(header({ totalCount: 0 }));
    serviceMocks.fetchTeamsCenterPage.mockResolvedValue({
      items: [],
      nextCursor: null,
    });

    const tree = await render(<TeamsCenterScreen />);
    const content = texts(tree);

    expect(content).toContain("Nessuna squadra configurata");
    expect(content).toContain("Crea la prima squadra");
    expect(tree.root.findAllByProps({ testID: "teams-new-action" })).toHaveLength(
      0,
    );
  });

  it("senza permesso di creazione non mostra CTA impossibili (§11)", async () => {
    serviceMocks.fetchTeamsCenter.mockResolvedValue(
      header({ canCreate: false, totalCount: 0 }),
    );
    serviceMocks.fetchTeamsCenterPage.mockResolvedValue({
      items: [],
      nextCursor: null,
    });

    const content = texts(await render(<TeamsCenterScreen />));

    expect(content).toContain("Nessuna squadra disponibile nel tuo ambito");
    expect(content).not.toContain("Crea la prima squadra");
  });

  it("ambito limitato: etichetta non interattiva e nessun + Nuova", async () => {
    serviceMocks.fetchTeamsCenter.mockResolvedValue(
      header({ canCreate: false, scopeLabel: "Primavera", totalCount: 1 }),
    );
    serviceMocks.fetchTeamsCenterPage.mockResolvedValue({
      items: [
        row({
          levelLabel: "Primavera 2",
          name: "Primavera",
          playersCount: 22,
          staffCount: 5,
          teamId: "team-2",
          typeLabel: "Primavera",
        }),
      ],
      nextCursor: null,
    });

    const tree = await render(<TeamsCenterScreen />);
    const content = texts(tree);

    expect(content).toContain("Ambito: Primavera");
    expect(content).toContain("Primavera");
    expect(content).toContain("22 calciatori · 5 staff");
    expect(tree.root.findAllByProps({ testID: "teams-new-action" })).toHaveLength(
      0,
    );
    // §11: nessuna squadra fuori perimetro, nemmeno come nome.
    expect(content).not.toContain("Comashi");
  });
});

describe("Nuova squadra — master 02", () => {
  it("precompila il nome, disabilita il livello e eredita stemma e città", async () => {
    const tree = await render(<TeamFormScreen clubId="club-1" mode="create" />);
    const content = texts(tree);

    expect(content).toContain("Nuova squadra");
    expect(content).toContain("Stagione corrente · 2026/27");
    expect(content).toContain("Seleziona prima il tipo");
    expect(content).toContain("Stemma della società");
    expect(content).toContain("Ereditata dalla società");
    expect(content).toContain("Como, Lombardia");

    expect(
      tree.root.findByProps({ testID: "team-name-field" }).props.value,
    ).toBe("AC Como");

    expect(
      tree.root.findByProps({ testID: "team-level-field" }).props.disabled,
    ).toBe(true);
  });
});

describe("Modifica squadra — master 05", () => {
  beforeEach(() => {
    routerMocks.params = { teamId: "team-4" };
    serviceMocks.fetchTeamEditor.mockResolvedValue({
      canEdit: true,
      city: "Cantù",
      cityMode: "custom",
      clubCity: "Como",
      clubId: "club-1",
      clubIsVerified: true,
      clubLogoUrl: null,
      clubName: "AC Como",
      clubRegion: "Lombardia",
      crestMode: "inherited",
      crestUrl: null,
      levelId: "elite",
      levelLabel: "Élite",
      name: "Comashi",
      province: "CO",
      region: "Lombardia",
      seasonConfigId: "config-1",
      seasonId: "2026/27",
      seasonLabel: "2026/27",
      seasonVersion: 3,
      teamId: "team-4",
      teamVersion: 7,
      typeId: "under_18",
      typeLabel: "Under 18",
    });
  });

  it("carica i dati reali e offre il ritorno alla città della società", async () => {
    const tree = await render(<TeamFormScreen mode="edit" teamId="team-4" />);
    const content = texts(tree);

    expect(content).toContain("Modifica squadra");
    expect(content).toContain("Under 18");
    expect(content).toContain("Élite");
    expect(content).toContain("Cantù, Lombardia");
    expect(content).toContain("Usa la città della società");
    expect(content).not.toContain("Ereditata dalla società");
  });

  it("invia solo i campi modificati con le versioni attese (§22)", async () => {
    serviceMocks.checkTeamDuplicates.mockResolvedValue({
      candidates: [],
      confirmationToken: null,
      verdict: "clear",
    });
    serviceMocks.updateClubTeam.mockResolvedValue({
      seasonVersion: 4,
      teamVersion: 8,
    });

    const tree = await render(<TeamFormScreen mode="edit" teamId="team-4" />);

    await act(async () => {
      tree.root
        .findByProps({ testID: "team-name-field" })
        .props.onChangeText("Comashi B");
    });

    await act(async () => {
      tree.root.findByProps({ testID: "profile-edit-save" }).props.onPress();
    });

    expect(serviceMocks.updateClubTeam).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedSeasonVersion: 3,
        expectedTeamVersion: 7,
        patch: { name: "Comashi B" },
        teamId: "team-4",
      }),
    );
  });
});

describe("Possibile duplicato — master 06", () => {
  it("offre Crea comunque solo per un avviso superabile (§20)", async () => {
    serviceMocks.checkTeamDuplicates.mockResolvedValue({
      candidates: [
        {
          crestUrl: null,
          id: "team-5",
          levelLabel: "Regionale",
          name: "Under 17 A",
          typeLabel: "Under 17",
        },
      ],
      confirmationToken: "token-1",
      verdict: "warning",
    });

    const tree = await render(<TeamFormScreen clubId="club-1" mode="create" />);

    await act(async () => {
      tree.root
        .findByProps({ testID: "team-name-field" })
        .props.onChangeText("Under 17 B");
    });

    await act(async () => {
      tree.root.findByProps({ testID: "team-type-field" }).props.onPress();
    });

    await act(async () => {
      tree.root
        .findByProps({ testID: "team-selector-option-under_18" })
        .props.onPress();
    });

    await act(async () => {
      tree.root.findByProps({ testID: "profile-edit-save" }).props.onPress();
    });

    expect(serviceMocks.createClubTeam).not.toHaveBeenCalled();
    expect(texts(tree)).toContain("Possibile duplicato");
    expect(texts(tree)).toContain("Esiste già una squadra con dati simili.");
    expect(
      tree.root.findAllByProps({ testID: "duplicate-create-anyway" }).length,
    ).toBeGreaterThan(0);

    serviceMocks.createClubTeam.mockResolvedValue({
      created: true,
      teamId: "team-9",
    });

    await act(async () => {
      tree.root
        .findAllByProps({ testID: "duplicate-create-anyway" })[0]
        .props.onPress();
    });

    expect(serviceMocks.createClubTeam).toHaveBeenCalledWith(
      expect.objectContaining({ confirmationToken: "token-1" }),
    );
  });

  it("un conflitto bloccante non mostra Crea comunque (§20)", async () => {
    serviceMocks.checkTeamDuplicates.mockResolvedValue({
      candidates: [
        {
          crestUrl: null,
          id: "team-1",
          levelLabel: "Serie D",
          name: "Prima squadra",
          typeLabel: "Prima squadra",
        },
      ],
      confirmationToken: null,
      verdict: "conflict",
    });

    const tree = await render(<TeamFormScreen clubId="club-1" mode="create" />);

    await act(async () => {
      tree.root.findByProps({ testID: "team-type-field" }).props.onPress();
    });

    await act(async () => {
      tree.root
        .findByProps({ testID: "team-selector-option-first_team" })
        .props.onPress();
    });

    await act(async () => {
      tree.root.findByProps({ testID: "profile-edit-save" }).props.onPress();
    });

    expect(texts(tree)).toContain("Possibile duplicato");
    expect(
      tree.root.findAllByProps({ testID: "duplicate-create-anyway" }),
    ).toHaveLength(0);
    expect(serviceMocks.createClubTeam).not.toHaveBeenCalled();
  });
});
