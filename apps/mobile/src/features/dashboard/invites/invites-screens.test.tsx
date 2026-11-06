/**
 * I master di DAS-REV-19 montati sui componenti reali.
 *
 * Si verifica ciò che la tavola rende osservabile e che la specifica rende
 * vincolante: due tab e non tre, la CTA assente per chi non può invitare,
 * «Nuova» accanto a «In attesa» senza diventare uno stato, il ruolo statico
 * senza chevron, l'ambito societario senza riga Squadra, la proposta
 * ricevuta senza controlli e l'annullamento solo su un pending autorizzato.
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InvitesCenterScreen } from "./InvitesCenterScreen";
import { InviteConfigureScreen } from "./compose/InviteConfigureScreen";
import { ReceivedInviteScreen } from "./detail/ReceivedInviteScreen";
import { SentInviteDetailScreen } from "./detail/SentInviteDetailScreen";
import type {
  AssignmentRoleCatalog,
  InviteCandidate,
  InviteRow,
  InvitesCenter,
  InvitesPage,
  MyInvite,
  SentInviteDetail,
} from "./invites-types";

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

const composeMocks = vi.hoisted(() => ({ useInviteCompose: vi.fn() }));

vi.mock("./compose/InviteComposeProvider", () => ({
  InviteComposeProvider: ({ children }: { children: React.ReactNode }) =>
    children,
  useInviteCompose: composeMocks.useInviteCompose,
}));

const serviceMocks = vi.hoisted(() => ({
  cancelMemberInvite: vi.fn(),
  fetchAssignableTeams: vi.fn(),
  fetchAssignmentRoles: vi.fn(),
  fetchInviteFilterTeams: vi.fn(),
  fetchInvitesCenter: vi.fn(),
  fetchInvitesPage: vi.fn(),
  fetchMyInvite: vi.fn(),
  fetchSentInvite: vi.fn(),
  respondToMemberInvite: vi.fn(),
}));

/* Il servizio vero importa il client supabase, che in vitest non si
   inizializza. Si sostituiscono soltanto le chiamate di rete: tipi, mapping
   e classi d'errore restano quelli veri. */
vi.mock("./invites-service", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return { ...actual, ...serviceMocks };
});

const COMO = "club-1";

function center(overrides: Partial<InvitesCenter> = {}): InvitesCenter {
  return {
    accessVerifiedAt: Date.now(),
    canCancel: true,
    canInvite: true,
    canViewRequests: true,
    canViewSent: true,
    clubId: COMO,
    clubIsVerified: true,
    clubLogoUrl: null,
    clubName: "AC Como",
    dataRevision: 1,
    requestsPendingCount: 2,
    scopeLabel: null,
    sentPendingCount: 2,
    ...overrides,
  };
}

function row(overrides: Partial<InviteRow> = {}): InviteRow {
  return {
    avatarUrl: null,
    contextLabel: "Prima squadra",
    id: "inv-1",
    isUnread: false,
    kind: "invite",
    personName: "Mario Rossi",
    personProfileId: "p1",
    roleLabel: "Calciatore",
    scopeType: "team",
    state: "pending",
    stateAt: "2026-09-24T09:00:00+02:00",
    teamId: "t1",
    teamIsInactive: false,
    ...overrides,
  };
}

function page(rows: InviteRow[]): InvitesPage {
  return { hasMore: false, nextCursor: null, rows };
}

const ROLES: AssignmentRoleCatalog = {
  customRoleMax: 60,
  roles: [
    { isCustom: false, label: "Calciatore", profileType: "player", roleId: "player" },
    { isCustom: false, label: "Allenatore", profileType: "coach", roleId: "coach" },
    {
      isCustom: false,
      label: "Preparatore atletico",
      profileType: "staff",
      roleId: "staff_fitness_coach",
    },
    {
      isCustom: true,
      label: "Altro ruolo staff",
      profileType: "staff",
      roleId: "staff_other",
    },
    {
      isCustom: false,
      label: "Direttore sportivo",
      profileType: "director",
      roleId: "director_sporting",
    },
  ],
};

const TEAMS = [
  { category: "Serie D", label: "Prima squadra", teamId: "t1" },
  { category: null, label: "Primavera", teamId: "t2" },
];

function candidate(overrides: Partial<InviteCandidate> = {}): InviteCandidate {
  return {
    avatarUrl: null,
    city: "Milano",
    fullName: "Mario Rossi",
    profileId: "p1",
    profileType: "player",
    specialty: null,
    ...overrides,
  };
}

function draftFor(person: InviteCandidate, overrides: Record<string, unknown> = {}) {
  return {
    draft: {
      customRole: "",
      person,
      roleId: null,
      scopeType: "team",
      teamId: "t1",
      teamLabel: "Prima squadra",
      ...overrides,
    },
    isDirty: false,
    operationKey: "key",
    reset: vi.fn(),
    setCustomRole: vi.fn(),
    setPerson: vi.fn(),
    setRole: vi.fn(),
    setScope: vi.fn(),
    setTeam: vi.fn(),
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

  serviceMocks.fetchInvitesCenter.mockResolvedValue(center());
  serviceMocks.fetchInviteFilterTeams.mockResolvedValue([
    { isInactive: false, label: "Prima squadra", teamId: "t1" },
    { isInactive: false, label: "Under 15", teamId: "t3" },
  ]);
  serviceMocks.fetchInvitesPage.mockResolvedValue(page([]));
  serviceMocks.fetchAssignmentRoles.mockResolvedValue(ROLES);
  serviceMocks.fetchAssignableTeams.mockResolvedValue(TEAMS);
});

afterEach(() => {
  mounted.splice(0).forEach((tree) => {
    act(() => tree.unmount());
  });
});

async function flush(): Promise<void> {
  for (let index = 0; index < 6; index += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
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
    .flatMap((node) =>
      node.props.children == null
        ? []
        : [
            Array.isArray(node.props.children)
              ? node.props.children.filter((part: unknown) => typeof part === "string").join("")
              : String(node.props.children),
          ],
    )
    .filter(Boolean);
}

function hasTestID(tree: TestRenderer.ReactTestRenderer, id: string): boolean {
  return tree.root.findAll((node) => node.props?.testID === id).length > 0;
}

function byTestID(tree: TestRenderer.ReactTestRenderer, id: string) {
  return tree.root.findAll(
    (node) => typeof node.type === "string" && node.props?.testID === id,
  )[0];
}

// ── Centro ─────────────────────────────────────────────────────────────────

describe("screen 01 e 02 — Centro Inviti e richieste", () => {
  it("ha esattamente due tab, e non una terza", async () => {
    const tree = await render(<InvitesCenterScreen />);
    const labels = texts(tree);

    expect(labels).toContain("Inviti inviati");
    expect(labels).toContain("Richieste ricevute");
    /* §12: «Non aggiungere tab Accettati, Rifiutati, Storico, Nuove, In
       attesa o Link.» */
    expect(labels).not.toContain("Accettati");
    expect(labels).not.toContain("Storico");
    expect(labels).not.toContain("Link");
  });

  it("senza permesso di invitare la CTA non esiste, nemmeno disabilitata", async () => {
    serviceMocks.fetchInvitesCenter.mockResolvedValue(
      center({ canInvite: false }),
    );

    const tree = await render(<InvitesCenterScreen />);

    expect(hasTestID(tree, "invites-compose")).toBe(false);
    expect(texts(tree)).not.toContain("Invita persona");
  });

  it("mostra le sezioni In attesa e Recenti con le righe reali", async () => {
    serviceMocks.fetchInvitesPage.mockImplementation(
      async ({ section }: { section: string }) =>
        section === "pending"
          ? page([row()])
          : page([
              row({
                contextLabel: "Primavera",
                id: "inv-2",
                personName: "Luca Verdi",
                roleLabel: "Allenatore",
                state: "accepted",
                stateAt: "2026-09-23T09:00:00+02:00",
              }),
            ]),
    );

    const tree = await render(<InvitesCenterScreen />);
    const labels = texts(tree);

    expect(labels).toContain("In attesa");
    expect(labels).toContain("Recenti");
    expect(labels).toContain("Mario Rossi");
    expect(labels).toContain("Calciatore · Prima squadra");
    expect(labels).toContain("Luca Verdi");
    expect(labels).toContain("Allenatore · Primavera");
  });

  /**
   * §15: «La riga PENDING può mostrare Nuova insieme a In attesa: il primo è
   * un indicatore di lettura, il secondo è lo stato operativo.»
   */
  it("mostra Nuova accanto a In attesa senza sostituirla", async () => {
    serviceMocks.fetchInvitesPage.mockImplementation(
      async ({ section }: { section: string }) =>
        section === "pending"
          ? page([
              row({
                id: "req-1",
                isUnread: true,
                kind: "request",
                personName: "Giovanni Romano",
              }),
            ])
          : page([]),
    );

    const tree = await render(<InvitesCenterScreen />);
    const labels = texts(tree);

    expect(labels).toContain("Nuova");
    expect(labels.some((label) => label.startsWith("In attesa"))).toBe(true);
  });

  /** §12: il tap apre il record, e non esistono azioni inline nella lista. */
  it("non mostra azioni inline nella riga", async () => {
    serviceMocks.fetchInvitesPage.mockImplementation(
      async ({ section }: { section: string }) =>
        section === "pending" ? page([row()]) : page([]),
    );

    const tree = await render(<InvitesCenterScreen />);
    const labels = texts(tree);

    expect(labels).not.toContain("Accetta");
    expect(labels).not.toContain("Rifiuta");
    expect(labels).not.toContain("Annulla invito");
    expect(labels).not.toContain("Reinvia");
  });

  it("il filtro parte da Tutti gli ambiti", async () => {
    const tree = await render(<InvitesCenterScreen />);

    expect(texts(tree)).toContain("Tutti gli ambiti");
    expect(hasTestID(tree, "invites-scope-row")).toBe(true);
  });

  /**
   * §14: «La selezione di un checkbox non chiude lo sheet.» Con le caselle
   * che chiudono al tap, una multiselezione sarebbe raggiungibile solo per
   * tentativi.
   */
  it("lo sheet del filtro resta aperto dopo aver scelto una squadra", async () => {
    const tree = await render(<InvitesCenterScreen />);

    await act(async () => {
      byTestID(tree, "invites-scope-row").props.onPress();
    });
    await flush();

    expect(hasTestID(tree, "invites-filter-apply")).toBe(true);

    await act(async () => {
      byTestID(tree, "invites-filter-t3").props.onPress();
    });
    await flush();

    // La casella risulta spuntata e quella generale si è spenta…
    expect(
      byTestID(tree, "invites-filter-t3").props.accessibilityState.checked,
    ).toBe(true);
    expect(
      byTestID(tree, "invites-filter-all").props.accessibilityState.checked,
    ).toBe(false);

    // …ma la scelta non è ancora applicata: la riga del Centro è invariata,
    // e solo Applica la conferma (§14).
    expect(texts(tree)).toContain("Tutti gli ambiti");

    await act(async () => {
      byTestID(tree, "invites-filter-apply").props.onPress();
    });
    await flush();

    expect(texts(tree)).toContain("Under 15");
  });

  /**
   * §14: «Chiudere con X, swipe o back senza Applica conserva il filtro
   * precedentemente applicato.»
   */
  it("chiudere il filtro senza Applica non cambia niente", async () => {
    const tree = await render(<InvitesCenterScreen />);

    await act(async () => {
      byTestID(tree, "invites-scope-row").props.onPress();
    });
    await flush();

    await act(async () => {
      byTestID(tree, "invites-filter-t3").props.onPress();
    });
    await flush();

    // Riapertura dopo una chiusura senza conferma: lo sheet riparte dal
    // filtro applicato, non dalla selezione abbandonata.
    await act(async () => {
      byTestID(tree, "invites-scope-row").props.onPress();
    });
    await flush();

    expect(texts(tree)).toContain("Tutti gli ambiti");
  });
});

// ── Composer, passo 2 ──────────────────────────────────────────────────────

describe("screen 05, 06, 07 — Collegamento", () => {
  it("Calciatore: ruolo statico senza chevron e squadra obbligatoria", async () => {
    composeMocks.useInviteCompose.mockReturnValue(draftFor(candidate()));

    const tree = await render(<InviteConfigureScreen />);
    const labels = texts(tree);

    expect(labels).toContain("Ruolo nella struttura");
    expect(labels).toContain("Calciatore");
    expect(labels).toContain("Squadra");

    /* §19: «Non mostrare un chevron sul ruolo statico, né trattarlo come un
       input disabled.» Senza `onPress` la riga non è un controllo. */
    expect(byTestID(tree, "invite-role-field").props.onPress).toBeUndefined();
    expect(byTestID(tree, "invite-team-field").props.onPress).toBeTypeOf(
      "function",
    );
  });

  /** §19: «Non chiedere Attaccante, Difensore, Portiere o altra posizione.» */
  it("Calciatore: nessun campo di posizione in campo", async () => {
    composeMocks.useInviteCompose.mockReturnValue(draftFor(candidate()));

    const tree = await render(<InviteConfigureScreen />);
    const labels = texts(tree);

    expect(labels).not.toContain("Posizione");
    expect(labels).not.toContain("Attaccante");
  });

  it("Staff con Altro ruolo: compare Specifica il ruolo", async () => {
    composeMocks.useInviteCompose.mockReturnValue(
      draftFor(candidate({ profileType: "staff" }), {
        customRole: "Data analyst",
        roleId: "staff_other",
      }),
    );

    const tree = await render(<InviteConfigureScreen />);

    expect(texts(tree)).toContain("Specifica il ruolo");
    expect(hasTestID(tree, "invite-custom-role")).toBe(true);
  });

  it("Staff con ruolo noto: nessun campo di testo libero", async () => {
    composeMocks.useInviteCompose.mockReturnValue(
      draftFor(candidate({ profileType: "staff" }), {
        roleId: "staff_fitness_coach",
      }),
    );

    const tree = await render(<InviteConfigureScreen />);

    expect(hasTestID(tree, "invite-custom-role")).toBe(false);
  });

  /**
   * §21: «Con Intera società non mostrare Squadra: Nessuna, una riga vuota o
   * una Team fittizia.»
   */
  it("Dirigente con ambito societario: nessuna riga Squadra", async () => {
    composeMocks.useInviteCompose.mockReturnValue(
      draftFor(candidate({ profileType: "director" }), {
        roleId: "director_sporting",
        scopeType: "society",
        teamId: null,
        teamLabel: null,
      }),
    );

    const tree = await render(<InviteConfigureScreen />);
    const labels = texts(tree);

    expect(labels).toContain("Ambito");
    expect(labels).toContain("Intera società");
    expect(hasTestID(tree, "invite-team-field")).toBe(false);
  });

  it("Dirigente con una squadra specifica: la riga Squadra esiste", async () => {
    composeMocks.useInviteCompose.mockReturnValue(
      draftFor(candidate({ profileType: "director" }), {
        roleId: "director_sporting",
        scopeType: "team",
      }),
    );

    const tree = await render(<InviteConfigureScreen />);

    expect(hasTestID(tree, "invite-team-field")).toBe(true);
  });

  /** §22: nessuna squadra utilizzabile ⇒ stato locale, non un invio invalido. */
  it("senza squadre assegnabili non si può proseguire", async () => {
    serviceMocks.fetchAssignableTeams.mockResolvedValue([]);
    composeMocks.useInviteCompose.mockReturnValue(
      draftFor(candidate(), { teamId: null, teamLabel: null }),
    );

    const tree = await render(<InviteConfigureScreen />);

    expect(texts(tree)).toContain("Nessuna squadra disponibile");
    /* §22: «Mantieni il contesto, impedisci un invio TEAM invalido.» La
       primaria è disabilitata, e la riga Squadra non apre nessuno sheet —
       non si crea una squadra per far passare il form. */
    expect(
      byTestID(tree, "invite-configure-continue").props.accessibilityState
        .disabled,
    ).toBe(true);
    expect(byTestID(tree, "invite-team-field").props.onPress).toBeUndefined();
  });
});

// ── Destinatario ───────────────────────────────────────────────────────────

function myInvite(overrides: Partial<MyInvite> = {}): MyInvite {
  return {
    assignmentActive: false,
    canRespond: true,
    clubCity: "Como",
    clubId: COMO,
    clubIsVerified: true,
    clubLogoUrl: null,
    clubName: "AC Como",
    contextLabel: "Prima squadra",
    createdAt: "2026-09-24T09:00:00+02:00",
    inviteId: "inv-1",
    profileType: "player",
    resolvedAt: null,
    revision: 1,
    roleLabel: "Calciatore",
    scopeType: "team",
    state: "pending",
    teamId: "t1",
    teamName: "Prima squadra",
    ...overrides,
  };
}

describe("screen 10-14, 16 — invito ricevuto", () => {
  beforeEach(() => {
    routerMocks.params = { inviteId: "inv-1" };
  });

  it("mostra la proposta in sola lettura con Accetta e Rifiuta", async () => {
    serviceMocks.fetchMyInvite.mockResolvedValue(myInvite());

    const tree = await render(<ReceivedInviteScreen />);
    const labels = texts(tree);

    expect(labels).toContain("AC Como ti invita a collegarti alla società.");
    expect(labels).toContain("Collegamento proposto");
    expect(labels).toContain("Calciatore");
    expect(labels).toContain("Prima squadra");
    expect(hasTestID(tree, "invite-accept")).toBe(true);
    expect(hasTestID(tree, "invite-decline")).toBe(true);
  });

  /** §28: «niente chevron di modifica, selector, cambio di Team». */
  it("le righe della proposta non sono controlli", async () => {
    serviceMocks.fetchMyInvite.mockResolvedValue(myInvite());

    const tree = await render(<ReceivedInviteScreen />);
    const pressables = tree.root.findAll(
      (node) =>
        typeof node.type === "string" &&
        node.props?.accessibilityRole === "button" &&
        typeof node.props?.accessibilityLabel === "string" &&
        node.props.accessibilityLabel.startsWith("Ruolo:"),
    );

    expect(pressables).toHaveLength(0);
  });

  it("la conferma di accettazione nomina società, ruolo e squadra", async () => {
    serviceMocks.fetchMyInvite.mockResolvedValue(myInvite());

    const tree = await render(<ReceivedInviteScreen />);

    await act(async () => {
      byTestID(tree, "invite-accept").props.onPress();
    });
    await flush();

    expect(texts(tree)).toContain(
      "Verrai collegato ad AC Como come Calciatore della prima squadra.",
    );
  });

  it("l'esito accettato mostra il collegamento confermato e Vai al profilo", async () => {
    serviceMocks.fetchMyInvite.mockResolvedValue(
      myInvite({
        assignmentActive: true,
        canRespond: false,
        resolvedAt: "2026-09-24T09:00:00+02:00",
        state: "accepted",
      }),
    );

    const tree = await render(<ReceivedInviteScreen />);
    const labels = texts(tree);

    expect(labels).toContain("Collegamento confermato");
    expect(labels).toContain(
      "Sei collegato ad AC Como come Calciatore della prima squadra.",
    );
    expect(labels).toContain("Accettato il 24 settembre 2026");
    expect(hasTestID(tree, "invite-go-profile")).toBe(true);
    /* §33: «nessuna nuova risposta». */
    expect(hasTestID(tree, "invite-accept")).toBe(false);
  });

  /**
   * §33: «ACCEPTED, incarico successivamente terminato o modificato:
   * decisione storica preservata; testo storico, senza affermare che il
   * vecchio incarico sia ancora attivo.»
   */
  it("un accept storico non afferma che il rapporto sia ancora attivo", async () => {
    serviceMocks.fetchMyInvite.mockResolvedValue(
      myInvite({
        assignmentActive: false,
        canRespond: false,
        resolvedAt: "2026-09-24T09:00:00+02:00",
        state: "accepted",
      }),
    );

    const tree = await render(<ReceivedInviteScreen />);
    const labels = texts(tree);

    expect(labels).toContain("Questo collegamento non è più attivo.");
    expect(labels).not.toContain(
      "Sei collegato ad AC Como come Calciatore della prima squadra.",
    );
  });

  it("l'invito annullato dalla società lo dice, e chiude", async () => {
    serviceMocks.fetchMyInvite.mockResolvedValue(
      myInvite({
        canRespond: false,
        resolvedAt: "2026-09-25T09:00:00+02:00",
        state: "cancelled",
      }),
    );

    const tree = await render(<ReceivedInviteScreen />);
    const labels = texts(tree);

    expect(labels).toContain("Invito non più disponibile");
    expect(labels).toContain("AC Como ha annullato questo invito.");
    expect(hasTestID(tree, "invite-close")).toBe(true);
    expect(hasTestID(tree, "invite-accept")).toBe(false);
  });

  /**
   * §33: un pending non più azionabile **non** è un annullamento della
   * Società, e la copy non glielo attribuisce.
   */
  it("un contesto decaduto non diventa un annullamento", async () => {
    serviceMocks.fetchMyInvite.mockResolvedValue(
      myInvite({ canRespond: false }),
    );

    const tree = await render(<ReceivedInviteScreen />);
    const labels = texts(tree);

    expect(labels).toContain(
      "Questo invito non può più essere accettato. La società potrà inviartene uno nuovo.",
    );
    expect(labels).not.toContain("AC Como ha annullato questo invito.");
  });

  it("il rifiuto mostra l'esito senza offrire Accetta ora", async () => {
    serviceMocks.fetchMyInvite.mockResolvedValue(
      myInvite({
        canRespond: false,
        resolvedAt: "2026-09-24T09:00:00+02:00",
        state: "declined",
      }),
    );

    const tree = await render(<ReceivedInviteScreen />);
    const labels = texts(tree);

    expect(labels).toContain("Invito rifiutato");
    expect(labels).toContain(
      "Non verrà creato alcun collegamento per questo incarico.",
    );
    expect(hasTestID(tree, "invite-accept")).toBe(false);
  });
});

// ── Dettaglio dell'invito inviato ──────────────────────────────────────────

function sent(overrides: Partial<SentInviteDetail> = {}): SentInviteDetail {
  return {
    canCancel: true,
    clubId: COMO,
    clubIsVerified: true,
    clubLogoUrl: null,
    clubName: "AC Como",
    contextLabel: "Prima squadra",
    createdAt: "2026-09-24T09:00:00+02:00",
    inviteId: "inv-1",
    personAvatarUrl: null,
    personName: "Mario Rossi",
    personProfileId: "p1",
    profileType: "player",
    resolvedAt: null,
    revision: 1,
    roleLabel: "Calciatore",
    scopeType: "team",
    state: "pending",
    teamId: "t1",
    teamIsInactive: false,
    ...overrides,
  };
}

describe("screen 15 — annullamento del pending", () => {
  beforeEach(() => {
    routerMocks.params = { inviteId: "inv-1" };
  });

  it("la conferma nomina la persona e offre Mantieni invito", async () => {
    serviceMocks.fetchSentInvite.mockResolvedValue(sent());

    const tree = await render(<SentInviteDetailScreen />);

    await act(async () => {
      byTestID(tree, "invite-cancel").props.onPress();
    });
    await flush();

    const labels = texts(tree);

    expect(labels).toContain("Annullare l'invito a Mario Rossi?");
    expect(labels).toContain("L'invito non potrà più essere accettato.");
    expect(labels).toContain("Mantieni invito");
  });

  /** §26: Annulla solo su un pending e solo con la capacità sull'ambito. */
  it("senza la capacità di annullare il pulsante non esiste", async () => {
    serviceMocks.fetchSentInvite.mockResolvedValue(sent({ canCancel: false }));

    const tree = await render(<SentInviteDetailScreen />);

    expect(hasTestID(tree, "invite-cancel")).toBe(false);
  });

  it("su un invito già risolto il pulsante non esiste", async () => {
    serviceMocks.fetchSentInvite.mockResolvedValue(
      sent({
        canCancel: false,
        resolvedAt: "2026-09-25T09:00:00+02:00",
        state: "accepted",
      }),
    );

    const tree = await render(<SentInviteDetailScreen />);

    expect(hasTestID(tree, "invite-cancel")).toBe(false);
    expect(texts(tree).some((label) => label.startsWith("Accettato"))).toBe(
      true,
    );
  });
});
