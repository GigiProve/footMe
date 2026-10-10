/**
 * I dieci stati della tavola DAS-REV-11, montati sui componenti reali.
 *
 * Non sono dieci schermate: sono gli esiti di sei componenti con fixture
 * diverse (§33: «Gli screen mostrano stati diversi del percorso, non dieci
 * scritture consecutive»). Qui si verificano le differenze che la task rende
 * osservabili — tab presenti, conteggi reali, azioni mostrate e **omesse**,
 * assenza di Accetta nella landing pubblica, frase direzionale che cambia con
 * il ruolo, storico read-only.
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NetworkHistoryScreen } from "./NetworkHistoryScreen";
import { RelationshipDetailScreen } from "./RelationshipDetailScreen";
import { SocietyNetworkScreen } from "./SocietyNetworkScreen";
import { LinkConfigureScreen } from "./link/LinkConfigureScreen";
import { LinkSearchScreen } from "./link/LinkSearchScreen";
import { RequestReviewScreen } from "./link/RequestReviewScreen";
import { SocietyInviteScreen } from "./invite/SocietyInviteScreen";
import type {
  NetworkHeader,
  RelationshipType,
  RelationshipView,
  SocietySummary,
} from "./network-types";

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

vi.mock("../auth/use-session", () => ({ useSession: sessionMocks.useSession }));

const identityMocks = vi.hoisted(() => ({ useDashboardIdentity: vi.fn() }));

vi.mock("../dashboard/identity/use-dashboard-identity", () => ({
  useDashboardIdentity: identityMocks.useDashboardIdentity,
}));

const toastMocks = vi.hoisted(() => ({ showToast: vi.fn() }));

const serviceMocks = vi.hoisted(() => ({
  createRelationshipRequest: vi.fn(),
  decideRelationship: vi.fn(),
  fetchInvitePublicContext: vi.fn(),
  fetchInviteResolveContext: vi.fn(),
  fetchLinkEligibility: vi.fn(),
  fetchNetworkHeader: vi.fn(),
  fetchNetworkHistoryPage: vi.fn(),
  fetchNetworkPage: vi.fn(),
  fetchNetworkRequests: vi.fn(),
  fetchRelationshipDetail: vi.fn(),
  fetchRelationshipTypes: vi.fn(),
  issueSocietyInvite: vi.fn(),
  resolveSocietyInvite: vi.fn(),
  revokeSocietyInvite: vi.fn(),
}));

/*
  Il servizio vero importa il client supabase, che in vitest non si
  inizializza. Si sostituiscono soltanto le chiamate di rete: tipi, chiavi e
  mapping degli errori restano quelli veri.
*/
vi.mock("./network-service", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return { ...actual, ...serviceMocks };
});

const searchMocks = vi.hoisted(() => ({ searchClubsPage: vi.fn() }));

vi.mock("../search/search-service", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return { ...actual, ...searchMocks };
});

vi.mock("../../ui", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return { ...actual, useToast: () => ({ showToast: toastMocks.showToast }) };
});

const COMO: SocietySummary = {
  city: "Como",
  clubId: "club-1",
  isVerified: true,
  logoUrl: null,
  name: "AC Como",
  province: "CO",
  region: "Lombardia",
};

const ACADEMY: SocietySummary = {
  city: "Cantù",
  clubId: "club-2",
  isVerified: true,
  logoUrl: null,
  name: "Academy Como SSD",
  province: "CO",
  region: "Lombardia",
};

const LUGANO: SocietySummary = {
  city: "Lugano",
  clubId: "club-3",
  isVerified: true,
  logoUrl: null,
  name: "FC Lugano",
  province: null,
  region: "CH",
};

const LARIO: SocietySummary = {
  city: "Lecco",
  clubId: "club-4",
  isVerified: false,
  logoUrl: null,
  name: "Lario Academy",
  province: "LC",
  region: "Lombardia",
};

const ALL_CAPABILITIES: NetworkHeader["capabilities"] = [
  "network_view",
  "network_requests_view",
  "network_request_send",
  "network_request_manage",
  "network_request_cancel",
  "network_invite_create",
  "network_terminate",
  "network_history_view",
];

function header(overrides: Partial<NetworkHeader> = {}): NetworkHeader {
  return {
    accessVerifiedAt: Date.now(),
    activeRelationshipCount: 2,
    capabilities: ALL_CAPABILITIES,
    city: COMO.city,
    clubId: COMO.clubId,
    dataRevision: 1,
    distinctSocietyCount: 2,
    historyCount: 2,
    isVerified: true,
    logoUrl: null,
    name: COMO.name,
    openInvitesCount: 0,
    province: COMO.province,
    region: COMO.region,
    requestsReceivedCount: 1,
    requestsSentCount: 1,
    ...overrides,
  };
}

function affiliation(overrides: Partial<RelationshipView> = {}): RelationshipView {
  return {
    acceptedAt: "2026-03-12T10:00:00Z",
    activeSentence: "Academy Como SSD è affiliata ad AC Como.",
    allowedActions: [],
    cancelledAt: null,
    clubA: COMO,
    clubB: ACADEMY,
    counterpart: ACADEMY,
    counterpartRoleId: "affiliate",
    counterpartRoleLabel: "Società affiliata",
    draftSentence: "Academy Como SSD sarà affiliata ad AC Como.",
    endedAt: null,
    endedByClubId: null,
    groupLabel: "Società affiliate",
    groupSort: 10,
    isDirectional: true,
    isPublic: true,
    isRequester: true,
    proposalSentence: "AC Como propone un'affiliazione ad Academy Como SSD.",
    recipientClubId: ACADEMY.clubId,
    rejectedAt: null,
    relationshipId: "rel-affiliation",
    requestedAt: "2026-03-01T10:00:00Z",
    requesterClubId: COMO.clubId,
    rowLabel: "Affiliata ad AC Como",
    status: "active",
    typeDescription: null,
    typeId: "affiliation",
    typeLabel: "Affiliazione",
    version: 1,
    viewerClubId: COMO.clubId,
    viewerRoleId: "reference",
    viewerRoleLabel: "Società di riferimento",
    viewerSide: "a",
    ...overrides,
  };
}

function partnership(overrides: Partial<RelationshipView> = {}): RelationshipView {
  return affiliation({
    activeSentence: "Partnership tra AC Como e FC Lugano.",
    clubB: LUGANO,
    counterpart: LUGANO,
    counterpartRoleId: null,
    counterpartRoleLabel: null,
    draftSentence: "Partnership tra AC Como e FC Lugano.",
    groupLabel: "Partnership",
    groupSort: 20,
    isDirectional: false,
    relationshipId: "rel-partnership",
    rowLabel: "Partnership",
    typeId: "partnership",
    typeLabel: "Partnership",
    viewerRoleId: null,
    viewerRoleLabel: null,
    ...overrides,
  });
}

const TYPES: RelationshipType[] = [
  {
    activeTemplate: "{b} è affiliata {to_a}.",
    description: "Una società di riferimento e una società affiliata.",
    draftTemplate: "{b} sarà affiliata {to_a}.",
    exclusivityGroup: "structural",
    id: "affiliation",
    isDirectional: true,
    isSelectable: true,
    label: "Affiliazione",
    proposalTemplate: "{a} propone un'affiliazione {to_b}.",
    roleAId: "reference",
    roleALabel: "Società di riferimento",
    roleASection: "Società affiliate",
    roleBId: "affiliate",
    roleBLabel: "Società affiliata",
    roleBSection: "Società di riferimento",
    rowTemplateA: "Affiliata {to_a}",
    rowTemplateB: "Società di riferimento",
    rowTemplateSymmetric: null,
    sortOrder: 10,
    symmetricSection: null,
  },
  {
    activeTemplate: "Partnership tra {a} e {b}.",
    description: null,
    draftTemplate: "Partnership tra {a} e {b}.",
    exclusivityGroup: null,
    id: "partnership",
    isDirectional: false,
    isSelectable: true,
    label: "Partnership",
    proposalTemplate: "{a} propone una partnership con {b}.",
    roleAId: null,
    roleALabel: null,
    roleASection: null,
    roleBId: null,
    roleBLabel: null,
    roleBSection: null,
    rowTemplateA: null,
    rowTemplateB: null,
    rowTemplateSymmetric: "Partnership",
    sortOrder: 20,
    symmetricSection: "Partnership",
  },
];

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
    current: { id: COMO.clubId, isOwner: true, kind: "society" },
  });

  serviceMocks.fetchNetworkHeader.mockResolvedValue(header());
  serviceMocks.fetchNetworkPage.mockResolvedValue({
    items: [affiliation(), partnership()],
    nextCursor: null,
  });
  serviceMocks.fetchNetworkRequests.mockResolvedValue({
    items: [
      {
        kind: "received",
        relationship: partnership({
          clubA: LARIO,
          counterpart: LARIO,
          proposalSentence: "Lario Academy propone una partnership con AC Como.",
          recipientClubId: COMO.clubId,
          relationshipId: "rel-in",
          requesterClubId: LARIO.clubId,
          status: "pending",
        }),
      },
      {
        kind: "sent",
        relationship: affiliation({
          counterpart: { ...ACADEMY, clubId: "club-5", name: "Academy Brianza" },
          relationshipId: "rel-out",
          status: "pending",
        }),
      },
    ],
    nextCursor: null,
  });
  serviceMocks.fetchNetworkHistoryPage.mockResolvedValue({
    items: [
      affiliation({
        acceptedAt: "2026-03-12T10:00:00Z",
        endedAt: "2026-09-11T10:00:00Z",
        status: "ended",
      }),
    ],
    nextCursor: null,
  });
  serviceMocks.fetchRelationshipTypes.mockResolvedValue(TYPES);
  serviceMocks.fetchLinkEligibility.mockResolvedValue([
    {
      availableTypeIds: ["affiliation", "partnership"],
      blockingTypeIds: [],
      relationshipId: null,
      society: { ...ACADEMY, clubId: "club-6", name: "Como Academy ASD", city: "Como" },
      state: "eligible",
      targetClubId: "club-6",
    },
    {
      availableTypeIds: [],
      blockingTypeIds: ["affiliation"],
      relationshipId: "rel-affiliation",
      society: ACADEMY,
      state: "linked",
      targetClubId: ACADEMY.clubId,
    },
    {
      availableTypeIds: [],
      blockingTypeIds: ["affiliation"],
      relationshipId: "rel-out",
      society: { ...ACADEMY, clubId: "club-5", name: "Academy Brianza", city: "Monza", province: "MB" },
      state: "pending",
      targetClubId: "club-5",
    },
  ]);
  searchMocks.searchClubsPage.mockResolvedValue({
    rows: [
      { entity_id: "club-6", name: "Como Academy ASD", city: "Como", region: "Lombardia", logo_url: null },
      { entity_id: ACADEMY.clubId, name: ACADEMY.name, city: ACADEMY.city, region: ACADEMY.region, logo_url: null },
      { entity_id: "club-5", name: "Academy Brianza", city: "Monza", region: "Lombardia", logo_url: null },
    ],
    totalCount: 3,
  });
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

/** Il nodo tappabile con quel testID, qualunque componente lo renda. */
function pressable(tree: TestRenderer.ReactTestRenderer, id: string) {
  return tree.root.find(
    (node) => node.props?.testID === id && typeof node.props?.onPress === "function",
  );
}

/** Il nodo con `accessibilityState`, cioè il Pressable di un Button. */
function button(tree: TestRenderer.ReactTestRenderer, id: string) {
  return tree.root.find(
    (node) => node.props?.testID === id && !!node.props?.accessibilityState,
  );
}

async function press(tree: TestRenderer.ReactTestRenderer, id: string) {
  await act(async () => {
    pressable(tree, id).props.onPress();
  });
  await flush();
}

describe("screen 01 — Centro rete", () => {
  it("mostra conteggio, gruppi, relazioni e accesso allo storico", async () => {
    const tree = await render(<SocietyNetworkScreen />);
    const copy = texts(tree);

    expect(copy).toContain("AC Como");
    expect(copy).toContain("2 collegamenti attivi");
    expect(copy).toContain("Società affiliate");
    expect(copy).toContain("Academy Como SSD");
    expect(copy).toContain("Affiliata ad AC Como");
    expect(copy).toContain("Partnership");
    expect(copy).toContain("FC Lugano");
    expect(copy).toContain("Storico collegamenti");
    expect(copy).toContain("Collega una società");
  });

  it("non converte un conteggio non consultabile in zero (§8)", async () => {
    serviceMocks.fetchNetworkHeader.mockResolvedValue(
      header({ activeRelationshipCount: null }),
    );

    const copy = texts(await render(<SocietyNetworkScreen />));

    expect(copy.some((line) => line.includes("collegamenti attivi"))).toBe(false);
  });

  it("omette la CTA a chi può solo consultare (§5)", async () => {
    serviceMocks.fetchNetworkHeader.mockResolvedValue(
      header({ capabilities: ["network_view"] }),
    );

    const tree = await render(<SocietyNetworkScreen />);

    // §5: «Omettere le azioni non autorizzate; non rappresentarle come
    // pulsanti disabled.»
    expect(hasTestId(tree, "network-link-cta")).toBe(false);
    expect(hasTestId(tree, "network-tabs")).toBe(false);
  });

  it("non espone lo storico a chi non può consultarlo", async () => {
    serviceMocks.fetchNetworkHeader.mockResolvedValue(
      header({ capabilities: ["network_view", "network_request_send"] }),
    );

    const copy = texts(await render(<SocietyNetworkScreen />));

    expect(copy).not.toContain("Storico collegamenti");
  });
});

describe("screen 02 — Richieste", () => {
  it("separa Ricevute e Inviate con lo stato esplicito", async () => {
    const tree = await render(<SocietyNetworkScreen />);

    await act(async () => {
      tree.root
        .find(
          (node) =>
            node.props?.accessibilityRole === "tab" &&
            node.props?.accessibilityLabel === "Richieste",
        )
        .props.onPress();
    });
    await flush();

    const copy = texts(tree);

    expect(copy).toContain("Ricevute");
    expect(copy).toContain("Inviate");
    expect(copy).toContain("Lario Academy");
    expect(copy).toContain("Partnership · Richiesta ricevuta");
    expect(copy).toContain("Academy Brianza");
    expect(copy).toContain("Affiliazione · In attesa");
    expect(copy).toContain("Il collegamento si attiva dopo l'accettazione.");
  });

  it("mostra solo la tab leggibile quando manca l'accesso alle richieste", async () => {
    serviceMocks.fetchNetworkHeader.mockResolvedValue(
      header({ capabilities: ["network_view", "network_request_send"] }),
    );

    const tree = await render(<SocietyNetworkScreen />);

    expect(hasTestId(tree, "network-tabs")).toBe(false);
    expect(serviceMocks.fetchNetworkRequests).not.toHaveBeenCalled();
  });
});

describe("screen 03 — Cerca una società", () => {
  it("non elenca nulla prima di due lettere (§10)", async () => {
    const copy = texts(await render(<LinkSearchScreen clubId={COMO.clubId} />));

    expect(copy).toContain("Digita almeno due lettere per cercare una società.");
    expect(searchMocks.searchClubsPage).not.toHaveBeenCalled();
  });
});

describe("screen 04 — Configura la richiesta", () => {
  it("offre solo i tipi realmente proponibili e chiede il ruolo", async () => {
    routerMocks.params = { clubId: COMO.clubId, targetClubId: "club-6" };

    const tree = await render(
      <LinkConfigureScreen clubId={COMO.clubId} targetClubId="club-6" />,
    );
    const copy = texts(tree);

    expect(copy).toContain("AC Como");
    expect(copy).toContain("Como Academy ASD");
    expect(copy).toContain("Tipo di collegamento");
    expect(copy).toContain(
      "Il collegamento si attiva dopo l'accettazione della società.",
    );
    // Senza tipo non si può inviare: §11 «Attiva solo con dati coerenti».
    expect(button(tree, "network-primary-cta").props.accessibilityState.disabled).toBe(
      true,
    );
  });

  it("scrive la frase direzionale solo dopo il ruolo, e la cambia con esso", async () => {
    const tree = await render(
      <LinkConfigureScreen clubId={COMO.clubId} targetClubId="club-6" />,
    );

    await press(tree, "network-configure-type");
    await press(tree, "network-option-affiliation");

    // Tipo scelto, ruolo no: la frase non esiste ancora e il submit è chiuso.
    expect(texts(tree)).not.toContain(
      "Como Academy ASD sarà affiliata ad AC Como.",
    );

    await press(tree, "network-configure-role");
    await press(tree, "network-option-reference");

    expect(texts(tree)).toContain("Como Academy ASD sarà affiliata ad AC Como.");

    await press(tree, "network-configure-role");
    await press(tree, "network-option-affiliate");

    // §7: invertire la direzione riscrive i lati, non solo le etichette.
    expect(texts(tree)).toContain("AC Como sarà affiliata a Como Academy ASD.");
  });

  it("toglie i metadata direzionali passando a un tipo simmetrico (§7)", async () => {
    serviceMocks.createRelationshipRequest.mockResolvedValue(affiliation());

    const tree = await render(
      <LinkConfigureScreen clubId={COMO.clubId} targetClubId="club-6" />,
    );

    await press(tree, "network-configure-type");
    await press(tree, "network-option-affiliation");
    await press(tree, "network-configure-role");
    await press(tree, "network-option-reference");

    await press(tree, "network-configure-type");
    await press(tree, "network-option-partnership");

    expect(hasTestId(tree, "network-configure-role")).toBe(false);

    await press(tree, "network-primary-cta");

    expect(serviceMocks.createRelationshipRequest).toHaveBeenCalledWith(
      expect.objectContaining({ roleId: null, typeId: "partnership" }),
    );
  });

  it("conserva la bozza quando l'invio fallisce (§28)", async () => {
    serviceMocks.createRelationshipRequest.mockRejectedValue(
      new Error("boom"),
    );

    const tree = await render(
      <LinkConfigureScreen clubId={COMO.clubId} targetClubId="club-6" />,
    );

    await press(tree, "network-configure-type");
    await press(tree, "network-option-partnership");
    await press(tree, "network-primary-cta");

    const copy = texts(tree);

    expect(copy).toContain("Non è stato possibile inviare la richiesta. Riprova.");
    expect(copy).toContain("Partnership tra AC Como e Como Academy ASD.");
  });
});

describe("screen 05 — Valuta una richiesta", () => {
  it("mostra proposta, tipo read-only e le due azioni del destinatario", async () => {
    serviceMocks.fetchRelationshipDetail.mockResolvedValue(
      partnership({
        allowedActions: ["accept", "reject"],
        clubA: LARIO,
        counterpart: LARIO,
        isRequester: false,
        proposalSentence: "Lario Academy propone una partnership con AC Como.",
        recipientClubId: COMO.clubId,
        relationshipId: "rel-in",
        requesterClubId: LARIO.clubId,
        status: "pending",
        viewerSide: "b",
      }),
    );

    const tree = await render(
      <RequestReviewScreen clubId={COMO.clubId} relationshipId="rel-in" />,
    );
    const copy = texts(tree);

    expect(copy).toContain("Lario Academy propone una partnership con AC Como.");
    expect(copy).toContain("Partnership");
    expect(copy).toContain("Ogni società mantiene i propri amministratori e dati.");
    expect(copy).toContain("Accetta");
    expect(copy).toContain("Rifiuta");
    expect(hasTestId(tree, "network-review-cancel")).toBe(false);
  });

  it("accetta portando con sé la versione letta (§14)", async () => {
    serviceMocks.fetchRelationshipDetail.mockResolvedValue(
      partnership({
        allowedActions: ["accept", "reject"],
        recipientClubId: COMO.clubId,
        relationshipId: "rel-in",
        status: "pending",
        version: 7,
      }),
    );
    serviceMocks.decideRelationship.mockResolvedValue(
      partnership({ status: "active" }),
    );

    const tree = await render(
      <RequestReviewScreen clubId={COMO.clubId} relationshipId="rel-in" />,
    );

    await press(tree, "network-primary-cta");

    expect(serviceMocks.decideRelationship).toHaveBeenCalledWith(
      expect.objectContaining({ decision: "accept", version: 7 }),
    );
    expect(toastMocks.showToast).toHaveBeenCalledWith({
      message: "Collegamento attivato",
    });
  });

  it("su una richiesta inviata offre Annulla e non Accetta/Rifiuta (§9)", async () => {
    serviceMocks.fetchRelationshipDetail.mockResolvedValue(
      affiliation({
        allowedActions: ["cancel"],
        relationshipId: "rel-out",
        status: "pending",
      }),
    );

    const tree = await render(
      <RequestReviewScreen clubId={COMO.clubId} relationshipId="rel-out" />,
    );

    expect(hasTestId(tree, "network-review-cancel")).toBe(true);
    expect(hasTestId(tree, "network-review-reject")).toBe(false);
    expect(hasTestId(tree, "network-primary-cta")).toBe(false);
  });

  it("non annulla senza conferma esplicita (§15)", async () => {
    serviceMocks.fetchRelationshipDetail.mockResolvedValue(
      affiliation({
        allowedActions: ["cancel"],
        relationshipId: "rel-out",
        status: "pending",
      }),
    );

    const tree = await render(
      <RequestReviewScreen clubId={COMO.clubId} relationshipId="rel-out" />,
    );

    await press(tree, "network-review-cancel");

    expect(serviceMocks.decideRelationship).not.toHaveBeenCalled();
    expect(texts(tree)).toContain("Annullare la richiesta di collegamento?");
    expect(texts(tree)).toContain("Mantieni richiesta");
  });

  it("mostra lo stato reale quando la richiesta è già stata gestita", async () => {
    serviceMocks.fetchRelationshipDetail.mockResolvedValue(
      partnership({
        allowedActions: ["accept"],
        recipientClubId: COMO.clubId,
        status: "pending",
      }),
    );
    serviceMocks.decideRelationship.mockRejectedValue(
      new Error("REQUEST_ALREADY_HANDLED"),
    );

    const tree = await render(
      <RequestReviewScreen clubId={COMO.clubId} relationshipId="rel-in" />,
    );

    await press(tree, "network-primary-cta");

    expect(texts(tree)).toContain(
      "La richiesta è già stata gestita. I dati sono stati aggiornati.",
    );
  });
});

describe("screen 07 — Apertura del link", () => {
  it("pre-auth mostra invitante e proposta, mai Accetta (§18)", async () => {
    sessionMocks.useSession.mockReturnValue({
      isLoading: false,
      profile: null,
      session: null,
    });
    serviceMocks.fetchInvitePublicContext.mockResolvedValue({
      inviter: { ...COMO, clubId: "" },
      state: "valid",
      typeId: "affiliation",
      typeLabel: "Affiliazione",
    });

    const tree = await render(<SocietyInviteScreen token={"t".repeat(64)} />);
    const copy = texts(tree);

    expect(copy).toContain("PROLINK");
    expect(copy).toContain("AC Como ti invita su PROLINK");
    expect(copy).toContain("AC Como vuole collegare la tua società alla propria rete.");
    expect(copy).toContain("Affiliazione");
    expect(copy).toContain("Continua su PROLINK");
    expect(copy).toContain("Hai già un account? Accedi");
    expect(copy).not.toContain("Accetta");
    expect(copy).not.toContain("Rifiuta");
  });

  it("non espone dati dell'invitante per un token non valido (§20)", async () => {
    sessionMocks.useSession.mockReturnValue({
      isLoading: false,
      profile: null,
      session: null,
    });
    serviceMocks.fetchInvitePublicContext.mockResolvedValue({ state: "expired" });

    const copy = texts(await render(<SocietyInviteScreen token={"t".repeat(64)} />));

    expect(copy).toContain(
      "Questo invito è scaduto. Chiedi alla società un nuovo link.",
    );
    expect(copy).not.toContain("AC Como");
  });

  it("autenticato chiede la scelta esplicita fra più società (§19)", async () => {
    serviceMocks.fetchInviteResolveContext.mockResolvedValue({
      descriptiveName: "Centro Lago ASD",
      eligibleSocieties: [
        { ...ACADEMY, blocked: false, isSelf: false },
        { ...LARIO, blocked: false, isSelf: false },
      ],
      inviter: COMO,
      isDirectional: true,
      state: "valid",
      typeId: "affiliation",
      typeLabel: "Affiliazione",
    });

    const tree = await render(<SocietyInviteScreen token={"t".repeat(64)} />);
    const copy = texts(tree);

    expect(copy).toContain("Scegli la società destinataria");
    expect(hasTestId(tree, `society-invite-choice-${ACADEMY.clubId}`)).toBe(true);
    expect(hasTestId(tree, `society-invite-choice-${LARIO.clubId}`)).toBe(true);
    // Nessuna risoluzione automatica: la scelta è un gesto dell'utente.
    expect(serviceMocks.resolveSocietyInvite).not.toHaveBeenCalled();
  });

  it("risolvere non attiva: porta alla revisione (§19)", async () => {
    serviceMocks.fetchInviteResolveContext.mockResolvedValue({
      descriptiveName: null,
      eligibleSocieties: [{ ...ACADEMY, blocked: false, isSelf: false }],
      inviter: COMO,
      isDirectional: true,
      state: "valid",
      typeId: "affiliation",
      typeLabel: "Affiliazione",
    });
    serviceMocks.resolveSocietyInvite.mockResolvedValue(
      affiliation({
        relationshipId: "rel-resolved",
        status: "pending",
        viewerClubId: ACADEMY.clubId,
      }),
    );

    const tree = await render(<SocietyInviteScreen token={"t".repeat(64)} />);

    await act(async () => {
      tree.root
        .find((node) => node.props?.testID === `society-invite-choice-${ACADEMY.clubId}`)
        .props.onPress();
    });
    await flush();

    expect(routerMocks.replace).toHaveBeenCalledWith(
      expect.stringContaining("/society-link/review"),
    );
    expect(routerMocks.replace).toHaveBeenCalledWith(
      expect.stringContaining("rel-resolved"),
    );
  });

  it("non offre una società quando nessuna è gestibile (§19)", async () => {
    serviceMocks.fetchInviteResolveContext.mockResolvedValue({
      descriptiveName: null,
      eligibleSocieties: [{ ...COMO, blocked: false, isSelf: true }],
      inviter: COMO,
      isDirectional: true,
      state: "valid",
      typeId: "affiliation",
      typeLabel: "Affiliazione",
    });

    const copy = texts(await render(<SocietyInviteScreen token={"t".repeat(64)} />));

    expect(copy).toContain(
      "Non gestisci nessuna società che possa accettare questo collegamento.",
    );
  });
});

describe("screen 08 e 09 — Dettaglio e terminazione", () => {
  it("mostra tipo read-only, data reale e le due azioni", async () => {
    serviceMocks.fetchRelationshipDetail.mockResolvedValue(
      affiliation({ allowedActions: ["end"] }),
    );

    const tree = await render(
      <RelationshipDetailScreen clubId={COMO.clubId} relationshipId="rel-affiliation" />,
    );
    const copy = texts(tree);

    expect(copy).toContain("AC Como");
    expect(copy).toContain("Academy Como SSD");
    expect(copy).toContain("Affiliazione");
    expect(copy).toContain("Academy Como SSD è affiliata ad AC Como.");
    expect(copy).toContain("Collegamento attivo dal");
    expect(copy).toContain("12 marzo 2026");
    expect(copy).toContain("Vedi profilo società");
    expect(copy).toContain("Termina collegamento");
  });

  it("usa lo stesso renderer per una Partnership (§21)", async () => {
    serviceMocks.fetchRelationshipDetail.mockResolvedValue(
      partnership({ allowedActions: ["end"] }),
    );

    const copy = texts(
      await render(
        <RelationshipDetailScreen clubId={COMO.clubId} relationshipId="rel-partnership" />,
      ),
    );

    expect(copy).toContain("Partnership tra AC Como e FC Lugano.");
    expect(copy).toContain("Collegamento attivo dal");
  });

  it("omette Termina a chi non ha la capability (§5)", async () => {
    serviceMocks.fetchRelationshipDetail.mockResolvedValue(affiliation());

    const tree = await render(
      <RelationshipDetailScreen clubId={COMO.clubId} relationshipId="rel-affiliation" />,
    );

    expect(hasTestId(tree, "relationship-terminate")).toBe(false);
    expect(hasTestId(tree, "relationship-open-profile")).toBe(true);
  });

  it("apre il profilo pubblico, non la Dashboard della controparte (§21)", async () => {
    serviceMocks.fetchRelationshipDetail.mockResolvedValue(affiliation());

    const tree = await render(
      <RelationshipDetailScreen clubId={COMO.clubId} relationshipId="rel-affiliation" />,
    );

    await press(tree, "relationship-open-profile");

    expect(routerMocks.push).toHaveBeenCalledWith(`/club/${ACADEMY.clubId}`);
  });

  it("Mantieni collegamento non muta nulla (§22)", async () => {
    serviceMocks.fetchRelationshipDetail.mockResolvedValue(
      affiliation({ allowedActions: ["end"] }),
    );

    const tree = await render(
      <RelationshipDetailScreen clubId={COMO.clubId} relationshipId="rel-affiliation" />,
    );

    await act(async () => {
      tree.root
        .find((node) => node.props?.testID === "relationship-terminate")
        .props.onPress();
    });
    await flush();

    const copy = texts(tree);
    expect(copy).toContain("Terminare il collegamento con Academy Como SSD?");
    expect(copy).toContain(
      "La relazione passerà nello storico. Le società, le squadre e i dati rimarranno invariati.",
    );

    await act(async () => {
      tree.root
        .find((node) => node.props?.testID === "relationship-terminate-keep")
        .props.onPress();
    });
    await flush();

    expect(serviceMocks.decideRelationship).not.toHaveBeenCalled();
  });

  it("termina con la versione letta e torna indietro (§22)", async () => {
    serviceMocks.fetchRelationshipDetail.mockResolvedValue(
      affiliation({ allowedActions: ["end"], version: 4 }),
    );
    serviceMocks.decideRelationship.mockResolvedValue(
      affiliation({ status: "ended" }),
    );

    const tree = await render(
      <RelationshipDetailScreen clubId={COMO.clubId} relationshipId="rel-affiliation" />,
    );

    await act(async () => {
      tree.root
        .find((node) => node.props?.testID === "relationship-terminate")
        .props.onPress();
    });
    await flush();
    await press(tree, "relationship-terminate-confirm");

    expect(serviceMocks.decideRelationship).toHaveBeenCalledWith(
      expect.objectContaining({ decision: "end", version: 4 }),
    );
    expect(toastMocks.showToast).toHaveBeenCalledWith({
      message: "Collegamento terminato",
    });
  });

  it("il dettaglio storico è read-only (§23)", async () => {
    serviceMocks.fetchRelationshipDetail.mockResolvedValue(
      affiliation({
        allowedActions: [],
        endedAt: "2026-09-11T10:00:00Z",
        status: "ended",
      }),
    );

    const tree = await render(
      <RelationshipDetailScreen clubId={COMO.clubId} relationshipId="rel-affiliation" />,
    );
    const copy = texts(tree);

    expect(copy).toContain("Dettaglio storico");
    expect(copy).toContain("Periodo");
    expect(copy).toContain("12 mar – 11 set 2026");
    expect(hasTestId(tree, "relationship-terminate")).toBe(false);
    expect(copy).not.toContain("Riattiva");
  });
});

describe("screen 10 — Storico collegamenti", () => {
  it("mostra tipo e periodo senza ripetere Terminata (§23)", async () => {
    const copy = texts(await render(<NetworkHistoryScreen />));

    expect(copy).toContain("Storico collegamenti");
    expect(copy).toContain("I collegamenti conclusi restano consultabili.");
    expect(copy).toContain("Academy Como SSD");
    expect(copy).toContain("Affiliazione · 12 mar – 11 set 2026");
    expect(copy).not.toContain("Terminata");
  });

  it("ha un empty state proprio", async () => {
    serviceMocks.fetchNetworkHistoryPage.mockResolvedValue({
      items: [],
      nextCursor: null,
    });

    const copy = texts(await render(<NetworkHistoryScreen />));

    expect(copy).toContain("Nessun collegamento nello storico");
    expect(copy).toContain("I collegamenti conclusi resteranno consultabili qui.");
  });
});

describe("screen 02 — invito esterno (§17, §20)", () => {
  function withInvite(state: "valid" | "expired") {
    serviceMocks.fetchNetworkRequests.mockResolvedValue({
      items: [
        {
          invite: {
            createdAt: "2026-03-01T10:00:00Z",
            descriptiveName: "Centro Lago ASD",
            expiresAt: "2026-03-08T10:00:00Z",
            inviteId: "inv-1",
            inviterRoleId: "reference",
            isDirectional: true,
            state,
            typeId: "affiliation",
            typeLabel: "Affiliazione",
            version: 1,
          },
          kind: "invite",
        },
      ],
      nextCursor: null,
    });
  }

  async function openRequestsTab(tree: TestRenderer.ReactTestRenderer) {
    await act(async () => {
      tree.root
        .find(
          (node) =>
            node.props?.accessibilityRole === "tab" &&
            node.props?.accessibilityLabel === "Richieste",
        )
        .props.onPress();
    });
    await flush();
  }

  it("non presenta il nome descrittivo come una società registrata", async () => {
    withInvite("valid");

    const tree = await render(<SocietyNetworkScreen />);
    await openRequestsTab(tree);
    const copy = texts(tree);

    expect(copy).toContain("Centro Lago ASD");
    expect(copy).toContain("Invito esterno · Link disponibile");
    // Nessuno stemma e nessun check **sulla riga**: non è una Society
    // (§16, §17). Il check in testata appartiene alla Società corrente.
    const row = tree.root.find((node) => node.props?.testID === "network-invite-inv-1");

    expect(
      row.findAll((node) => node.props?.accessibilityLabel === "Società verificata"),
    ).toHaveLength(0);
    expect(row.findAll((node) => String(node.type) === "Image")).toHaveLength(0);
  });

  it("offre Revoca invito con conferma, non una revoca immediata (§20)", async () => {
    withInvite("valid");

    const tree = await render(<SocietyNetworkScreen />);
    await openRequestsTab(tree);
    await press(tree, "network-invite-inv-1");

    expect(hasTestId(tree, "network-invite-revoke")).toBe(true);
    expect(hasTestId(tree, "network-invite-regenerate")).toBe(false);

    await press(tree, "network-invite-revoke");

    expect(texts(tree)).toContain("Revocare questo invito?");
    expect(serviceMocks.revokeSocietyInvite).not.toHaveBeenCalled();

    await press(tree, "network-invite-revoke-confirm");

    expect(serviceMocks.revokeSocietyInvite).toHaveBeenCalledWith(
      "inv-1",
      expect.any(String),
    );
  });

  it("su un invito scaduto offre Genera nuovo link (§20)", async () => {
    withInvite("expired");

    const tree = await render(<SocietyNetworkScreen />);
    await openRequestsTab(tree);
    await press(tree, "network-invite-inv-1");

    expect(texts(tree)).toContain("Invito esterno · Scaduto");
    expect(hasTestId(tree, "network-invite-regenerate")).toBe(true);
    expect(hasTestId(tree, "network-invite-revoke")).toBe(false);
  });

  it("omette le azioni a chi non può gestire gli inviti (§5)", async () => {
    withInvite("valid");
    serviceMocks.fetchNetworkHeader.mockResolvedValue(
      header({
        capabilities: ["network_view", "network_requests_view"],
      }),
    );

    const tree = await render(<SocietyNetworkScreen />);
    await openRequestsTab(tree);
    await press(tree, "network-invite-inv-1");

    expect(hasTestId(tree, "network-invite-revoke")).toBe(false);
    expect(hasTestId(tree, "network-invite-regenerate")).toBe(false);
    expect(texts(tree)).toContain("Non puoi gestire questo invito.");
  });
});
