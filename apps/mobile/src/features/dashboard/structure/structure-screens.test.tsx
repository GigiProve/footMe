/**
 * I sei screen master di DAS-REV-12, montati sul componente reale.
 *
 * Non sono sei schermate: sono sei esiti della **stessa** pagina con fixture
 * e autorizzazioni diverse (§16 — «Una sola pagina deve rappresentare i sei
 * master attraverso dati, accessi e stato, non attraverso switch hardcoded
 * sul nome della Society»). Qui si verifica ciò che la tavola rende
 * osservabile: ordine dei domini, summary associati alla sezione giusta,
 * righe presenti e **assenti**, errore locale di un solo riepilogo, scope
 * Primavera e assenza di stemma/check inventati.
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SocietyStructureScreen } from "./SocietyStructureScreen";
import type { SocietyStructure } from "./structure-types";

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

const structureMocks = vi.hoisted(() => ({ fetchSocietyStructure: vi.fn() }));

/*
  Il servizio vero importa il client supabase, che in vitest non si
  inizializza. Si sostituiscono soltanto le chiamate di rete: tipi, mapping
  dei segnali e classi d'errore restano quelli veri.
*/
vi.mock("./structure-service", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return { ...actual, ...structureMocks };
});

const teamsMocks = vi.hoisted(() => ({ fetchTeamsCenter: vi.fn() }));

vi.mock("../../teams/teams-service", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return { ...actual, ...teamsMocks };
});

const networkMocks = vi.hoisted(() => ({ fetchNetworkHeader: vi.fn() }));

vi.mock("../../network/network-service", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return { ...actual, ...networkMocks };
});

const COMO = "club-1";

function structure(overrides: Partial<SocietyStructure> = {}): SocietyStructure {
  return {
    accessVerifiedAt: Date.now(),
    adminInvitesPendingCount: 1,
    adminsCount: 4,
    canEditCompanyData: true,
    canOpenAdminCenter: true,
    canViewAdminInvites: true,
    canViewAdmins: true,
    canViewCompanyData: true,
    canViewNetwork: true,
    canViewRequests: true,
    canViewSeasons: true,
    canViewTeams: true,
    city: "Como",
    clubId: COMO,
    dataRevision: 1,
    isVerified: true,
    logoUrl: "https://cdn.example/como.png",
    name: "AC Como",
    scopeLabel: null,
    signals: [],
    ...overrides,
  };
}

function teamsCenter(totalCount: number | null) {
  return {
    accessVerifiedAt: Date.now(),
    canCreate: true,
    canView: true,
    canViewCounts: true,
    clubCity: "Como",
    clubId: COMO,
    clubIsVerified: true,
    clubLogoUrl: null,
    clubName: "AC Como",
    clubRegion: "Lombardia",
    dataRevision: 1,
    inactiveCount: 0,
    scopeLabel: null,
    seasonId: "2026-27",
    seasonLabel: "2026/27",
    totalCount,
  };
}

function networkHeader(
  overrides: Partial<{
    activeRelationshipCount: number | null;
    requestsReceivedCount: number | null;
    requestsSentCount: number | null;
  }> = {},
) {
  return {
    accessVerifiedAt: Date.now(),
    activeRelationshipCount: 2,
    capabilities: ["network_view", "network_requests_view"],
    city: "Como",
    clubId: COMO,
    dataRevision: 1,
    distinctSocietyCount: 2,
    historyCount: 0,
    isVerified: true,
    logoUrl: null,
    name: "AC Como",
    openInvitesCount: 0,
    province: "CO",
    region: "Lombardia",
    requestsReceivedCount: 0,
    requestsSentCount: 0,
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
    current: { id: COMO, isOwner: true, kind: "society" },
  });

  structureMocks.fetchSocietyStructure.mockResolvedValue(structure());
  teamsMocks.fetchTeamsCenter.mockResolvedValue(teamsCenter(8));
  networkMocks.fetchNetworkHeader.mockResolvedValue(networkHeader());
});

afterEach(() => {
  mounted.splice(0).forEach((tree) => {
    act(() => {
      tree.unmount();
    });
  });
});

async function render() {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false, retryDelay: 0 } },
  });

  let tree!: TestRenderer.ReactTestRenderer;

  await act(async () => {
    tree = TestRenderer.create(
      <QueryClientProvider client={client}>
        <SocietyStructureScreen />
      </QueryClientProvider>,
    );
  });

  mounted.push(tree);
  await flush();

  return tree;
}

/**
 * Tre provider indipendenti risolvono in momenti diversi e TanStack Query
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

function pressable(tree: TestRenderer.ReactTestRenderer, id: string) {
  return tree.root.find(
    (node) =>
      node.props?.testID === id && typeof node.props?.onPress === "function",
  );
}

async function press(tree: TestRenderer.ReactTestRenderer, id: string) {
  await act(async () => {
    pressable(tree, id).props.onPress();
  });
  await flush();
}

describe("screen 02 — struttura completa", () => {
  it("compone i quattro domini nell'ordine prescritto con i loro summary", async () => {
    const tree = await render();
    const copy = texts(tree);

    expect(copy).toContain("Struttura societaria");
    expect(copy).toContain("AC Como");
    expect(copy).toContain("Società");

    // §6: l'ordine dei domini è fisso e non dipende dai conteggi.
    const order = copy.filter((line) =>
      [
        "Squadre del club",
        "Società collegate",
        "Amministrazione e accessi",
        "Dati della società",
      ].includes(line),
    );

    expect(order).toEqual([
      "Squadre del club",
      "Società collegate",
      "Amministrazione e accessi",
      "Dati della società",
    ]);

    expect(copy).toContain("8 squadre attive");
    expect(copy).toContain("2 collegamenti attivi");
    expect(copy).toContain("4 amministratori · 1 invito in attesa");
    expect(copy).toContain("Como");
  });

  it("mostra le cinque righe dell'hub e nessuna attività Da gestire", async () => {
    const tree = await render();

    expect(hasTestId(tree, "structure-row-teams")).toBe(true);
    expect(hasTestId(tree, "structure-row-seasons")).toBe(true);
    expect(hasTestId(tree, "structure-row-network")).toBe(true);
    expect(hasTestId(tree, "structure-row-admins")).toBe(true);
    expect(hasTestId(tree, "structure-row-company_edit")).toBe(true);

    // §13: senza segnali pertinenti spariscono titolo, contenitore e spazio.
    expect(texts(tree)).not.toContain("Da gestire");
  });

  it("apre i centri canonici con la Società corrente (QA-06)", async () => {
    const tree = await render();

    await press(tree, "structure-row-teams");
    expect(routerMocks.push).toHaveBeenCalledWith("/(tabs)/dashboard/teams");

    await press(tree, "structure-row-seasons");
    expect(routerMocks.push).toHaveBeenCalledWith("/(tabs)/dashboard/seasons");

    await press(tree, "structure-row-network");
    expect(routerMocks.push).toHaveBeenCalledWith("/(tabs)/dashboard/network");

    await press(tree, "structure-row-company_edit");
    expect(routerMocks.push).toHaveBeenCalledWith(
      "/profile/society-edit?clubId=club-1",
    );
  });

  it("non esegue nessuna mutation aprendo la pagina (QA-66)", async () => {
    await render();

    // Lettura e basta: l'hub non possiede endpoint di scrittura e il suo
    // ingresso non ne chiama nessuno.
    expect(structureMocks.fetchSocietyStructure).toHaveBeenCalledTimes(1);
    expect(routerMocks.push).not.toHaveBeenCalled();
  });
});

describe("screen 03 — attività da gestire", () => {
  beforeEach(() => {
    structureMocks.fetchSocietyStructure.mockResolvedValue(
      structure({
        signals: [
          {
            actionLabel: "Valuta richiesta",
            clubId: COMO,
            context: "Lario Academy · Partnership",
            count: 1,
            id: "network_request:rel-in",
            kind: "network_request",
            relationshipId: "rel-in",
            seasonTarget: null,
            teamId: null,
            title: "1 richiesta da valutare",
          },
        ],
      }),
    );

    // Due richieste complessive in attesa — una ricevuta e una inviata — ma
    // una sola da valutare: §13 tiene distinte le due metriche.
    networkMocks.fetchNetworkHeader.mockResolvedValue(
      networkHeader({ requestsReceivedCount: 1, requestsSentCount: 1 }),
    );
  });

  it("mostra il modulo Da gestire sopra i quattro domini", async () => {
    const tree = await render();
    const copy = texts(tree);

    expect(copy).toContain("Da gestire");
    expect(copy).toContain("1 richiesta da valutare");
    expect(copy).toContain("Lario Academy · Partnership");
    expect(copy).toContain("Valuta richiesta");

    expect(copy.indexOf("Da gestire")).toBeLessThan(
      copy.indexOf("Squadre del club"),
    );
  });

  it("conta due richieste nel summary e una sola da valutare", async () => {
    const copy = texts(await render());

    expect(copy).toContain("2 collegamenti attivi · 2 richieste in attesa");
    expect(copy).toContain("1 richiesta da valutare");
  });

  it("conserva Dati della società nello scroll (QA-36)", async () => {
    const tree = await render();

    // §6: l'aggiunta di Da gestire spinge la sezione sotto il viewport, non
    // la rimuove dalla pagina.
    expect(texts(tree)).toContain("Dati della società");
    expect(hasTestId(tree, "structure-company")).toBe(true);
    expect(hasTestId(tree, "structure-row-company_edit")).toBe(true);
  });

  it("apre la revisione senza accettare la richiesta (QA-37)", async () => {
    const tree = await render();

    await press(tree, "structure-signal-cta-network_request:rel-in");

    expect(routerMocks.push).toHaveBeenCalledWith(
      "/society-link/review?clubId=club-1&relationshipId=rel-in",
    );
  });
});

describe("screen 04 — società appena avviata", () => {
  beforeEach(() => {
    structureMocks.fetchSocietyStructure.mockResolvedValue(
      structure({
        adminInvitesPendingCount: 0,
        adminsCount: 1,
        city: "Como",
        isVerified: false,
        logoUrl: null,
        name: "Como Academy ASD",
      }),
    );
    teamsMocks.fetchTeamsCenter.mockResolvedValue(teamsCenter(1));
    networkMocks.fetchNetworkHeader.mockResolvedValue(
      networkHeader({ activeRelationshipCount: 0 }),
    );
  });

  it("usa i singolari corretti e non mostra zeri decorativi", async () => {
    const copy = texts(await render());

    expect(copy).toContain("Como Academy ASD");
    expect(copy).toContain("1 squadra attiva");
    expect(copy).toContain("Nessun collegamento attivo");
    expect(copy).toContain("1 amministratore");
    expect(copy).not.toContain("0 inviti in attesa");
    expect(copy).not.toContain("1 amministratore · 0 inviti in attesa");
  });

  it("non inventa stemma né verifica assenti (QA-32)", async () => {
    const tree = await render();

    // `Avatar` senza `uri` disegna le iniziali: è "omettere l'immagine" senza
    // rompere l'allineamento, non uno scudo generico.
    const images = tree.root.findAll(
      (node) => String(node.type) === "Image" && !!node.props?.source,
    );

    expect(images).toHaveLength(0);
    expect(
      tree.root.findAll(
        (node) => node.props?.accessibilityLabel === "Società verificata",
      ),
    ).toHaveLength(0);
  });

  it("conserva i quattro domini e le stesse azioni autorizzate", async () => {
    const tree = await render();

    expect(hasTestId(tree, "structure-row-teams")).toBe(true);
    expect(hasTestId(tree, "structure-row-network")).toBe(true);
    expect(hasTestId(tree, "structure-row-admins")).toBe(true);
    expect(hasTestId(tree, "structure-row-company_edit")).toBe(true);
  });
});

describe("screen 05 — ambito Primavera", () => {
  beforeEach(() => {
    structureMocks.fetchSocietyStructure.mockResolvedValue(
      structure({
        adminInvitesPendingCount: null,
        adminsCount: null,
        canEditCompanyData: false,
        canOpenAdminCenter: false,
        canViewAdminInvites: false,
        canViewAdmins: false,
        canViewCompanyData: false,
        canViewNetwork: false,
        canViewRequests: false,
        scopeLabel: "Primavera",
      }),
    );
    teamsMocks.fetchTeamsCenter.mockResolvedValue(teamsCenter(1));
  });

  it("mostra l'ambito come informazione, non come controllo (§7)", async () => {
    const tree = await render();

    expect(texts(tree)).toContain("Ambito: Primavera");

    const scope = tree.root.find((node) => node.props?.testID === "structure-scope");

    expect(scope.props.onPress).toBeUndefined();
  });

  it("mostra il solo dominio Squadre con i suoi due accessi (QA-14)", async () => {
    const tree = await render();
    const copy = texts(tree);

    expect(copy).toContain("Squadre del club");
    expect(copy).toContain("1 squadra nel tuo ambito");

    expect(hasTestId(tree, "structure-row-teams")).toBe(true);
    expect(hasTestId(tree, "structure-row-seasons")).toBe(true);

    // Nessun altro dominio, nessun lock, nessuna card 403.
    expect(copy).not.toContain("Società collegate");
    expect(copy).not.toContain("Amministrazione e accessi");
    expect(copy).not.toContain("Dati della società");
    expect(hasTestId(tree, "structure-row-network")).toBe(false);
    expect(hasTestId(tree, "structure-row-admins")).toBe(false);
  });

  it("non interroga i provider dei domini non autorizzati", async () => {
    await render();

    // §24: «Non restituire nomi, ID, conteggi … non autorizzati per
    // nasconderli nel frontend.» Nemmeno chiederli.
    expect(networkMocks.fetchNetworkHeader).not.toHaveBeenCalled();
  });
});

describe("screen 06 — errore di un riepilogo", () => {
  beforeEach(() => {
    networkMocks.fetchNetworkHeader.mockRejectedValue(new Error("boom"));
  });

  it("isola l'errore nel dominio Società collegate (QA-45)", async () => {
    const tree = await render();
    const copy = texts(tree);

    expect(copy).toContain("Riepilogo non disponibile.");
    expect(copy).toContain("Riprova");

    // Nessun falso zero e nessun errore globale.
    expect(copy).not.toContain("Nessun collegamento attivo");
    expect(copy).not.toContain(
      "Non siamo riusciti a caricare la struttura societaria.",
    );

    // Gli altri domini restano disponibili e utilizzabili.
    expect(copy).toContain("8 squadre attive");
    expect(copy).toContain("4 amministratori · 1 invito in attesa");
    expect(hasTestId(tree, "structure-row-company_edit")).toBe(true);
  });

  it("conserva l'accesso al centro rete, che è ancora autorizzato", async () => {
    const tree = await render();

    expect(hasTestId(tree, "structure-row-network")).toBe(true);

    await press(tree, "structure-row-network");

    expect(routerMocks.push).toHaveBeenCalledWith("/(tabs)/dashboard/network");
  });

  it("non trasforma un errore tecnico in un'attività Da gestire (QA-41)", async () => {
    expect(texts(await render())).not.toContain("Da gestire");
  });

  it("ritenta il solo provider fallito, senza toccare gli altri (QA-46)", async () => {
    const tree = await render();

    teamsMocks.fetchTeamsCenter.mockClear();
    structureMocks.fetchSocietyStructure.mockClear();

    await press(tree, "structure-network-error-retry");

    expect(networkMocks.fetchNetworkHeader).toHaveBeenCalledTimes(2);
    expect(teamsMocks.fetchTeamsCenter).not.toHaveBeenCalled();
    expect(structureMocks.fetchSocietyStructure).not.toHaveBeenCalled();
  });
});

describe("stati generali", () => {
  it("distingue una risposta valida con zero da una richiesta fallita (QA-48)", async () => {
    teamsMocks.fetchTeamsCenter.mockResolvedValue(teamsCenter(0));

    const copy = texts(await render());

    expect(copy).toContain("Nessuna squadra attiva");
    expect(copy).not.toContain("Riepilogo non disponibile.");
  });

  it("non converte in zero un conteggio non autorizzato (§15)", async () => {
    teamsMocks.fetchTeamsCenter.mockResolvedValue(teamsCenter(null));

    const copy = texts(await render());

    expect(copy).toContain("Squadre del club");
    expect(copy).not.toContain("Nessuna squadra attiva");
    expect(copy).not.toContain("0 squadre attive");
  });

  it("usa l'errore generale quando non c'è composizione affidabile (QA-49)", async () => {
    structureMocks.fetchSocietyStructure.mockRejectedValue(new Error("boom"));

    const copy = texts(await render());

    expect(copy).toContain(
      "Non siamo riusciti a caricare la struttura societaria.",
    );
    expect(copy).toContain("Riprova tra poco.");

    // Nessuna CTA operativa in un errore generale: lo stato del dominio non
    // è noto.
    expect(copy).not.toContain("Gestisci squadre");
    expect(copy).not.toContain("Modifica dati società");
  });

  it("usa il fallback autorizzato quando l'hub non è disponibile (§19)", async () => {
    const { StructureAccessError } = await import("./structure-service");

    structureMocks.fetchSocietyStructure.mockRejectedValue(
      new StructureAccessError("STRUCTURE_NOT_AUTHORIZED"),
    );

    const tree = await render();

    expect(texts(tree)).toContain("Questa sezione non è disponibile.");
    expect(texts(tree)).not.toContain("Nessuna squadra attiva");
  });
});
