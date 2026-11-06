/**
 * I dodici master di DAS-REV-17 montati sui componenti reali (§34, §35).
 *
 * Si verifica ciò che la tavola rende osservabile e che la specifica rende
 * vincolante: una primaria sola per pagina, la CTA che dipende dalla
 * condizione della bozza **e** dalle capability, le azioni assenti — non
 * disabilitate — quando il permesso manca, i conteggi che non compaiono a
 * zero, le righe fisse senza chevron e lo sheet informativo senza comandi.
 *
 * Gli screen 01/04 e 07/11 sono la stessa Position in due momenti: i test
 * usano lo stesso ID, perché §30 vieta «route o modelli separati per ogni
 * stato fotografato».
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PositionEditScreen } from "./PositionEditScreen";
import { PositionManageDetailScreen } from "./PositionManageDetailScreen";
import type { PositionManageDetail } from "./manage-types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

/* Il picker nativo è distribuito in Flow e il bundler dei test non lo
   compila. Non è l'oggetto in prova: lo sheet disponibilità lo monta solo
   dopo una scelta «Da una data». */
vi.mock("@react-native-community/datetimepicker", () => ({ default: () => null }));

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

const connectionMocks = vi.hoisted(() => ({ useDashboardConnection: vi.fn() }));

vi.mock("../../state/use-dashboard-connection", () => ({
  useDashboardConnection: connectionMocks.useDashboardConnection,
}));

const toastMocks = vi.hoisted(() => ({ showToast: vi.fn() }));

vi.mock("../../../../ui/Toast/ToastProvider", () => ({
  useToast: () => ({ showToast: toastMocks.showToast }),
}));

const manageMocks = vi.hoisted(() => ({
  closePosition: vi.fn(),
  fetchPositionManageDetail: vi.fn(),
  updatePublishedPosition: vi.fn(),
}));

vi.mock("./manage-service", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return { ...actual, ...manageMocks };
});

const composeMocks = vi.hoisted(() => ({
  fetchCatalogs: vi.fn(),
  fetchComposerContext: vi.fn(),
  fetchEligibleTeams: vi.fn(),
  publishPositions: vi.fn(),
  updatePositionDraft: vi.fn(),
}));

vi.mock("../compose/compose-service", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return { ...actual, ...composeMocks };
});

const LIMITS = {
  ageMax: 70,
  ageMin: 5,
  customRoleName: 80,
  description: 2000,
  requirements: 1000,
  responsibilities: 1500,
  staffQualification: 300,
};

const CATALOGS = {
  categories: [],
  experiences: [
    {
      id: "youth_sector",
      isCustom: false,
      label: "Settore giovanile",
      needsContext: false,
    },
    {
      id: "society_management",
      isCustom: false,
      label: "Gestione societaria",
      needsContext: false,
    },
    {
      id: "first_team",
      isCustom: false,
      label: "Prima squadra · Calcio professionistico",
      needsContext: false,
    },
  ],
  qualifications: [],
  roles: [
    { id: "other_executive", isCustom: true, label: "Altro", needsContext: false },
    { id: "other_staff", isCustom: true, label: "Altro", needsContext: false },
    {
      id: "sporting_director",
      isCustom: false,
      label: "Direttore sportivo",
      needsContext: false,
    },
  ],
  seasons: [],
};

function detail(
  overrides: Partial<PositionManageDetail> = {},
): PositionManageDetail {
  return {
    accessVerifiedAt: 0,
    ageMax: null,
    ageMin: null,
    ageMode: "unset",
    applicationsNew: null,
    applicationsTotal: null,
    blockers: [],
    canClose: false,
    canEdit: true,
    canPublish: true,
    closeReason: null,
    closeReasonText: null,
    closedAt: null,
    clubCity: "Como",
    clubId: "club-1",
    clubIsVerified: true,
    clubLogoUrl: null,
    clubName: "AC Como",
    clubRegion: "Lombardia",
    contextLabel: "Settore giovanile",
    countsAvailable: false,
    creationBatchId: null,
    customRoleName: "Responsabile scouting",
    dataRevision: 1,
    deadlineAt: null,
    deadlineDate: null,
    deadlineTimezone: null,
    description: null,
    details: {},
    group: "drafts",
    hasDetails: false,
    id: "pos-a",
    lifecycle: "draft",
    profileType: "director",
    publishedAt: null,
    receivingClosed: false,
    resourceVersion: 3,
    roleId: "other_executive",
    roleIsCustom: true,
    roleLabel: "Altro",
    schemaVersion: 1,
    scope: "team",
    seasonLabel: null,
    secondaryTeams: [],
    status: "draft",
    teamId: "team-primavera",
    teamIsInactive: false,
    teamName: "Primavera",
    title: "Responsabile scouting",
    updatedAt: null,
    ...overrides,
  };
}

/** §29, fixture A: Dirigente pubblicabile senza dettagli. */
const DRAFT_PUBLISHABLE = detail();

/** §29, fixture A arricchita: stesso ID, ancora bozza. */
const DRAFT_READY = detail({
  details: {
    availability: { mode: "next_season" },
    experience: ["youth_sector", "society_management"],
    responsibilities:
      "Scouting del settore giovanile e valutazione dei profili per la Primavera.",
  },
  hasDetails: true,
});

/** §29, fixture B: Calciatore con età non impostata. */
const DRAFT_INCOMPLETE = detail({
  blockers: ["AGE_UNSET"],
  customRoleName: null,
  id: "pos-b",
  profileType: "player",
  roleId: "forward",
  roleIsCustom: false,
  roleLabel: "Attaccante",
  title: "Attaccante",
});

/** §29, fixture C: Staff attivo con 12 candidature e 3 nuove. */
const ACTIVE = detail({
  applicationsNew: 3,
  applicationsTotal: 12,
  canPublish: false,
  contextLabel: "Serie D",
  countsAvailable: true,
  customRoleName: "Data analyst",
  details: {
    availability: { mode: "next_season" },
    experience: ["first_team"],
    staffQualification: "Corso di data analysis sportiva o equivalente",
  },
  group: "active",
  hasDetails: true,
  id: "pos-c",
  lifecycle: "published",
  profileType: "staff",
  publishedAt: "2026-09-01T10:00:00Z",
  roleId: "other_staff",
  roleIsCustom: true,
  roleLabel: "Altro",
  secondaryTeams: [{ isInactive: false, name: "Under 15", teamId: "team-u15" }],
  status: "published",
  teamId: "team-first",
  teamName: "Prima squadra",
  title: "Data analyst",
});

/** §29, fixture D: Dirigente societario in sola consultazione. */
const READ_ONLY = detail({
  canEdit: false,
  canPublish: false,
  contextLabel: null,
  customRoleName: null,
  details: {
    availability: { mode: "immediate" },
    responsibilities:
      "Coordinamento dello scouting e supporto alla direzione sportiva.",
  },
  group: "active",
  hasDetails: true,
  id: "pos-d",
  lifecycle: "published",
  roleId: "sporting_director",
  roleIsCustom: false,
  roleLabel: "Direttore sportivo",
  scope: "society",
  status: "published",
  teamId: null,
  teamName: null,
  title: "Direttore sportivo",
});

const mounted: TestRenderer.ReactTestRenderer[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  routerMocks.params = { id: "pos-a" };
  routerMocks.canGoBack.mockReturnValue(true);

  sessionMocks.useSession.mockReturnValue({
    isLoading: false,
    profile: { id: "actor-1" },
    session: { user: { id: "actor-1" } },
  });

  identityMocks.useDashboardIdentity.mockReturnValue({
    current: { id: "club-1", isOwner: true, kind: "society" },
  });

  connectionMocks.useDashboardConnection.mockReturnValue({
    connection: "online",
  });

  composeMocks.fetchCatalogs.mockResolvedValue(CATALOGS);
  composeMocks.fetchEligibleTeams.mockResolvedValue([
    {
      canCreate: true,
      canPublish: true,
      contextLabel: "Serie D",
      teamId: "team-first",
      teamName: "Prima squadra",
    },
    {
      canCreate: true,
      canPublish: true,
      contextLabel: "Settore giovanile",
      teamId: "team-primavera",
      teamName: "Primavera",
    },
  ]);
  composeMocks.fetchComposerContext.mockResolvedValue({
    accessVerifiedAt: Date.now(),
    canCreate: true,
    canCreateSociety: true,
    canPublish: true,
    clubCity: "Como",
    clubId: "club-1",
    clubIsVerified: true,
    clubLogoUrl: null,
    clubName: "AC Como",
    clubRegion: "Lombardia",
    limits: LIMITS,
    schemaVersion: 1,
    timezoneName: "Europe/Rome",
  });
  composeMocks.publishPositions.mockResolvedValue([
    { positionId: "pos-a", publishedAt: "2026-09-12T10:00:00Z" },
  ]);
  composeMocks.updatePositionDraft.mockResolvedValue({ resourceVersion: 4 });
  manageMocks.updatePublishedPosition.mockResolvedValue({ resourceVersion: 10 });
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
function openSheets(tree: TestRenderer.ReactTestRenderer): number {
  return tree.root
    .findAll(
      (node) =>
        /* Solo i nodi host: `findAll` restituisce anche il componente
           composito `Modal`, e contarli entrambi raddoppierebbe ogni
           sheet. */
        typeof node.type === "string" &&
        node.props?.transparent === true &&
        node.props?.visible === true,
    ).length;
}

describe("screen 01 — bozza pubblicabile", () => {
  beforeEach(() => {
    manageMocks.fetchPositionManageDetail.mockResolvedValue(DRAFT_PUBLISHABLE);
  });

  it("mostra titolo, contesto, stato neutro e la guida non allarmistica", async () => {
    const tree = await render(<PositionManageDetailScreen />);
    const content = texts(tree);

    expect(content).toContain("Responsabile scouting");
    expect(content).toContain("Primavera · Settore giovanile");
    expect(content).toContain("Bozza");
    expect(content).toContain("Aggiungi dettagli per completare l'annuncio");
    expect(content).toContain(
      "Puoi pubblicare la posizione anche adesso oppure aggiungere altre informazioni utili ai candidati.",
    );
  });

  it("offre una sola primaria: Pubblica posizione", async () => {
    const tree = await render(<PositionManageDetailScreen />);

    expect(hasTestID(tree, "position-manage-publish")).toBe(true);
    expect(hasTestID(tree, "position-manage-complete")).toBe(false);
    /* §7: la bozza è già persistita, non si «salva» dal dettaglio. */
    expect(texts(tree)).not.toContain("Salva come bozza");
    expect(texts(tree)).not.toContain("Salva modifiche");
  });

  it("mostra le informazioni comuni finché non ci sono sezioni compilate", async () => {
    const tree = await render(<PositionManageDetailScreen />);
    const content = texts(tree);

    expect(hasTestID(tree, "position-manage-identity")).toBe(true);
    expect(content).toContain("Profilo");
    expect(content).toContain("Dirigente");
    expect(content).toContain("Una squadra specifica");
    /* Due righe, non quattro: ruolo e squadra sono già nel titolo e nella
       riga di contesto, e lo screen 01 non li ripete. */
    expect(content).not.toContain("Profilo ricercato");
    expect(content).not.toContain("Squadra");
    /* §7: nessun blocco «Non specificato» per i facoltativi assenti. */
    expect(content).not.toContain("Non specificato");
  });

  it("l'invito ad aggiungere dettagli non porta il check della readiness", async () => {
    const tree = await render(<PositionManageDetailScreen />);

    /* Lo screen 01 non ha spunta accanto alla guida; lo screen 04 sì. Il
       check è `Ionicons name="checkmark"`, e qui non deve esserci. */
    expect(
      tree.root.findAll((node) => node.props?.name === "checkmark"),
    ).toHaveLength(0);
  });

  it("«Aggiungi dettagli» apre lo stesso editor, ancorato ai dettagli", async () => {
    const tree = await render(<PositionManageDetailScreen />);

    act(() => {
      byTestID(tree, "position-manage-details-link").props.onPress();
    });

    expect(routerMocks.push).toHaveBeenCalledWith(
      "/position-manage/pos-a/edit?anchor=__details__",
    );
  });
});

describe("screen 04 — bozza pronta", () => {
  beforeEach(() => {
    manageMocks.fetchPositionManageDetail.mockResolvedValue(DRAFT_READY);
  });

  it("accompagna «Pronta per la pubblicazione» con il check neutro", async () => {
    const tree = await render(<PositionManageDetailScreen />);

    expect(
      tree.root.findAll((node) => node.props?.name === "checkmark").length,
    ).toBeGreaterThan(0);
  });

  it("resta Bozza e mostra le tre sezioni compilate", async () => {
    const tree = await render(<PositionManageDetailScreen />);
    const content = texts(tree);

    expect(content).toContain("Bozza");
    expect(content).toContain("Pronta per la pubblicazione");
    expect(content).toContain("Modifica dettagli");
    expect(content).toContain(
      "Scouting del settore giovanile e valutazione dei profili per la Primavera.",
    );
    expect(content).toContain("Settore giovanile · Gestione societaria");
    expect(content).toContain("Inizio prossima stagione");
  });

  it("è la stessa Position dello screen 01", async () => {
    expect(DRAFT_READY.id).toBe(DRAFT_PUBLISHABLE.id);
  });
});

describe("screen 05 — conferma di pubblicazione", () => {
  beforeEach(() => {
    manageMocks.fetchPositionManageDetail.mockResolvedValue(DRAFT_READY);
  });

  it("apre uno sheet con contesto, conseguenza, anteprima e annulla", async () => {
    const tree = await render(<PositionManageDetailScreen />);

    expect(openSheets(tree)).toBe(0);

    act(() => {
      byTestID(tree, "position-manage-publish").props.onPress();
    });

    expect(openSheets(tree)).toBe(1);

    const content = texts(tree);

    expect(content).toContain(
      "La posizione diventerà visibile su PROLINK e potrà ricevere candidature.",
    );
    expect(content).toContain("Vedi anteprima annuncio");
    expect(content).toContain("Annulla");
  });

  it("annullare non esegue nessun comando", async () => {
    const tree = await render(<PositionManageDetailScreen />);

    act(() => {
      byTestID(tree, "position-manage-publish").props.onPress();
    });

    act(() => {
      byTestID(tree, "position-publish-cancel").props.onPress();
    });

    expect(openSheets(tree)).toBe(0);
    expect(composeMocks.publishPositions).not.toHaveBeenCalled();
  });

  it("pubblica con l'ID e la versione confermati, una volta sola", async () => {
    const tree = await render(<PositionManageDetailScreen />);

    act(() => {
      byTestID(tree, "position-manage-publish").props.onPress();
    });

    await act(async () => {
      byTestID(tree, "position-publish-confirm").props.onPress();
      byTestID(tree, "position-publish-confirm").props.onPress();
    });
    await flush();

    expect(composeMocks.publishPositions).toHaveBeenCalledTimes(1);
    expect(composeMocks.publishPositions).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedVersions: [DRAFT_READY.resourceVersion],
        positionIds: [DRAFT_READY.id],
      }),
    );
  });
});

describe("screen 06 — bozza da completare", () => {
  beforeEach(() => {
    routerMocks.params = { id: "pos-b" };
    manageMocks.fetchPositionManageDetail.mockResolvedValue(DRAFT_INCOMPLETE);
  });

  it("elenca la mancanza reale con la spiegazione dell'alternativa", async () => {
    const tree = await render(<PositionManageDetailScreen />);
    const content = texts(tree);

    expect(content).toContain("Da completare");
    expect(content).toContain(
      "Completa le informazioni obbligatorie prima di pubblicare la posizione.",
    );
    expect(content).toContain("Fascia d'età");
    expect(content).toContain("Da impostare");
    expect(content).toContain(
      "Imposta un intervallo oppure scegli Nessun limite di età.",
    );
  });

  it("offre «Completa posizione» e nessun «Pubblica»", async () => {
    const tree = await render(<PositionManageDetailScreen />);

    expect(hasTestID(tree, "position-manage-complete")).toBe(true);
    expect(hasTestID(tree, "position-manage-publish")).toBe(false);
    expect(texts(tree)).not.toContain("Salva come bozza");
  });

  it("il tap sull'elemento mancante porta a quel campo", async () => {
    const tree = await render(<PositionManageDetailScreen />);

    act(() => {
      byTestID(tree, "position-manage-missing-ageRange").props.onPress();
    });

    expect(routerMocks.push).toHaveBeenCalledWith(
      "/position-manage/pos-b/edit?anchor=ageRange",
    );
  });
});

describe("screen 07 — posizione attiva", () => {
  beforeEach(() => {
    routerMocks.params = { id: "pos-c" };
    manageMocks.fetchPositionManageDetail.mockResolvedValue(ACTIVE);
  });

  it("mostra stato neutro, conteggi su una riga e accesso alle candidature", async () => {
    const tree = await render(<PositionManageDetailScreen />);
    const content = texts(tree);

    expect(content).toContain("Attiva");
    expect(content).toContain("12 candidature · 3 nuove");
    expect(content).toContain("Gestisci candidature");
    expect(content).toContain("Modifica posizione");
  });

  it("legge i dati canonici del profilo Staff", async () => {
    const tree = await render(<PositionManageDetailScreen />);
    const content = texts(tree);

    expect(content).toContain("Under 15");
    expect(content).toContain("Corso di data analysis sportiva o equivalente");
    expect(content).toContain("Prima squadra · Calcio professionistico");
  });

  it("non è un form: nessuna primaria di salvataggio o pubblicazione", async () => {
    const tree = await render(<PositionManageDetailScreen />);

    expect(hasTestID(tree, "position-manage-publish")).toBe(false);
    expect(hasTestID(tree, "position-manage-complete")).toBe(false);
    expect(texts(tree)).not.toContain("Salva modifiche");
  });
});

describe("screen 12 — sola consultazione", () => {
  beforeEach(() => {
    routerMocks.params = { id: "pos-d" };
    manageMocks.fetchPositionManageDetail.mockResolvedValue(READ_ONLY);
  });

  it("mostra i dati autorizzati e l'indicazione discreta", async () => {
    const tree = await render(<PositionManageDetailScreen />);
    const content = texts(tree);

    expect(content).toContain("Direttore sportivo");
    expect(content).toContain("Intera società");
    expect(content).toContain("Attiva");
    expect(content).toContain("Sola consultazione");
    expect(content).toContain(
      "Coordinamento dello scouting e supporto alla direzione sportiva.",
    );
  });

  it("nasconde le azioni non consentite invece di disabilitarle", async () => {
    const tree = await render(<PositionManageDetailScreen />);

    expect(hasTestID(tree, "position-manage-edit")).toBe(false);
    expect(hasTestID(tree, "position-manage-publish")).toBe(false);
    expect(hasTestID(tree, "position-manage-complete")).toBe(false);
  });

  it("non espone nessun dato Application", async () => {
    const tree = await render(<PositionManageDetailScreen />);
    const content = texts(tree);

    expect(hasTestID(tree, "position-manage-counts")).toBe(false);
    expect(hasTestID(tree, "position-manage-applications")).toBe(false);
    /* Il conteggio, non la parola: da DAS-REV-18 §12 un actor in sola
       consultazione **vede** la sezione «Scadenza candidature», che il
       testo contiene. Cercare la sottostringa qui vieterebbe una riga che
       la spec richiede. */
    expect(content.join(" ")).not.toMatch(/\d+ candidature/);
    expect(content.join(" ")).not.toContain("nuove");
    expect(content).not.toContain("0 candidature");
  });

  /* DAS-REV-18 §12: «Un actor view-only vede il valore leggibile senza
     chevron di modifica.» Il valore sì, il comando no. */
  it("mostra la scadenza ma nessun comando per cambiarla", async () => {
    const tree = await render(<PositionManageDetailScreen />);

    expect(hasTestID(tree, "position-manage-deadline")).toBe(true);
    expect(hasTestID(tree, "position-manage-deadline-edit")).toBe(false);
    expect(hasTestID(tree, "position-manage-close")).toBe(false);
  });
});

describe("screen 08 e 10 — editor di una posizione attiva", () => {
  beforeEach(() => {
    routerMocks.params = { id: "pos-c" };
    manageMocks.fetchPositionManageDetail.mockResolvedValue(ACTIVE);
  });

  it("non è un wizard: nessun passo, nessun «Continua»", async () => {
    const tree = await render(<PositionEditScreen />);
    const content = texts(tree);

    expect(content).toContain("Modifica posizione");
    expect(content).toContain("Attiva · Data analyst");
    expect(content.join(" ")).not.toContain("1 di 3");
    expect(content).not.toContain("Continua");
  });

  it("rende identificativi e squadra principale come righe fisse", async () => {
    const tree = await render(<PositionEditScreen />);

    expect(byTestID(tree, "position-edit-profile").props.onPress).toBeUndefined();
    expect(byTestID(tree, "position-edit-role").props.onPress).toBeUndefined();
    expect(byTestID(tree, "position-edit-team").props.onPress).toBeUndefined();
    expect(texts(tree)).toContain(
      "Queste informazioni restano fisse dopo la pubblicazione.",
    );
    /* La riga bloccata non finge di essere un selector: nessun chevron. */
    expect(
      byTestID(tree, "position-edit-profile").findAll(
        (node) => node.props?.name === "chevron-forward",
      ),
    ).toHaveLength(0);
  });

  it("la riga Ruolo mostra il nome identificativo, non l'opzione «Altro»", async () => {
    /* Il catalogo può non contenere più quel ruolo, o non essere ancora
       arrivato: il valore viene allora da quanto il server ha già detto
       sulla Position. */
    composeMocks.fetchCatalogs.mockResolvedValue({
      ...CATALOGS,
      roles: [],
    });

    const tree = await render(<PositionEditScreen />);

    expect(byTestID(tree, "position-edit-role").props.value).toBe("Data analyst");
  });

  it("non ripete l'ambito quando la squadra principale lo dice già", async () => {
    const tree = await render(<PositionEditScreen />);

    expect(hasTestID(tree, "position-edit-scope")).toBe(false);
    expect(hasTestID(tree, "position-edit-team")).toBe(true);
  });

  it("su un incarico societario l'ambito è l'unica riga che lo dice", async () => {
    routerMocks.params = { id: "pos-d" };
    manageMocks.fetchPositionManageDetail.mockResolvedValue({
      ...READ_ONLY,
      canEdit: true,
    });

    const tree = await render(<PositionEditScreen />);

    expect(hasTestID(tree, "position-edit-scope")).toBe(true);
    expect(byTestID(tree, "position-edit-scope").props.value).toBe(
      "Intera società",
    );
    expect(hasTestID(tree, "position-edit-team")).toBe(false);
  });

  it("lo sheet informativo spiega senza offrire una chiusura", async () => {
    const tree = await render(<PositionEditScreen />);

    act(() => {
      byTestID(tree, "position-edit-locked-info").props.onPress();
    });

    const content = texts(tree);

    expect(openSheets(tree)).toBe(1);
    expect(content).toContain("Informazioni non modificabili");
    expect(content).toContain(
      "Profilo, ruolo e squadra principale non possono essere modificati dopo la pubblicazione.",
    );
    expect(content).toContain("Ho capito");
    expect(content).not.toContain("Chiudi posizione");
  });

  it("la CTA è «Salva modifiche» e resta spenta finché nulla cambia", async () => {
    const tree = await render(<PositionEditScreen />);
    const content = texts(tree);

    expect(content).toContain("Salva modifiche");
    expect(content).not.toContain("Pubblica posizione");
    expect(content).not.toContain("Salva come bozza");
    expect(byTestID(tree, "position-edit-save").props.disabled).toBe(true);
  });

  it("salva solo i dettagli consentiti, sulla stessa Position", async () => {
    const tree = await render(<PositionEditScreen />);

    act(() => {
      byTestID(tree, "position-field-requirements").props.onChangeText(
        "Disponibilità a trasferte",
      );
    });

    await act(async () => {
      byTestID(tree, "position-edit-save").props.onPress();
    });
    await flush();

    expect(manageMocks.updatePublishedPosition).toHaveBeenCalledWith({
      expectedVersion: ACTIVE.resourceVersion,
      patch: { details: { requirements: "Disponibilità a trasferte" } },
      positionId: "pos-c",
    });
    /* §21: nessun identificativo nel payload, nemmeno invariato. */
    const payload = manageMocks.updatePublishedPosition.mock.calls[0][0].patch;

    expect(payload.profileType).toBeUndefined();
    expect(payload.roleId).toBeUndefined();
    expect(payload.teamId).toBeUndefined();
    expect(payload.scope).toBeUndefined();
  });
});

describe("screen 02 e 03 — editor di una bozza", () => {
  beforeEach(() => {
    routerMocks.params = { id: "pos-a" };
    manageMocks.fetchPositionManageDetail.mockResolvedValue(DRAFT_PUBLISHABLE);
  });

  it("rende modificabili i dati comuni e non mostra l'azione informativa", async () => {
    const tree = await render(<PositionEditScreen />);

    expect(byTestID(tree, "position-edit-profile").props.onPress).toBeTypeOf(
      "function",
    );
    expect(byTestID(tree, "position-edit-team").props.onPress).toBeTypeOf(
      "function",
    );
    expect(hasTestID(tree, "position-edit-locked-info")).toBe(false);
    expect(texts(tree)).toContain("Bozza · Responsabile scouting");
  });

  it("usa il comando di bozza, non quello della pubblicata", async () => {
    const tree = await render(<PositionEditScreen />);

    act(() => {
      byTestID(tree, "position-field-responsibilities").props.onChangeText(
        "Scouting del settore giovanile",
      );
    });

    await act(async () => {
      byTestID(tree, "position-edit-save").props.onPress();
    });
    await flush();

    expect(composeMocks.updatePositionDraft).toHaveBeenCalledWith({
      expectedVersion: DRAFT_PUBLISHABLE.resourceVersion,
      patch: { details: { responsibilities: "Scouting del settore giovanile" } },
      positionId: "pos-a",
    });
    expect(manageMocks.updatePublishedPosition).not.toHaveBeenCalled();
  });
});

/**
 * DAS-REV-18 — scadenza, chiusura e storico, sugli stessi componenti.
 *
 * Gli screen 03, 04, 07 e 10 del nuovo master sono **la stessa Position**
 * in quattro momenti: attiva con ricezione aperta, attiva con termine
 * superato, in chiusura, chiusa. Da qui un solo ID per tutti, come §42
 * chiede («Gli screen rappresentano alternative temporali; non creare
 * dodici Position duplicate»).
 */
describe("DAS-REV-18 screen 03 — attiva, ricezione aperta", () => {
  const ATTIVA = detail({
    ...ACTIVE,
    canClose: true,
    deadlineAt: "2026-09-30T22:00:00.000Z",
    deadlineDate: "2026-09-30",
    deadlineTimezone: "Europe/Rome",
    receivingClosed: false,
  });

  beforeEach(() => {
    routerMocks.params = { id: ATTIVA.id };
    manageMocks.fetchPositionManageDetail.mockResolvedValue(ATTIVA);
  });

  it("mostra Chiudi posizione immediatamente sotto Modifica posizione", async () => {
    const tree = await render(<PositionManageDetailScreen />);

    /* §12: «Non inserire dati, divider di sezione o altre CTA fra le due.»
       L'ordine si verifica sull'albero, non sulla copy: due testID
       adiacenti nello stesso contenitore. */
    /* `findAll` restituisce sia il componente composito sia il nodo host,
       quindi ogni testID compare più volte: si tiene la prima occorrenza,
       che è l'ordine di montaggio. */
    const seen = new Set<string>();
    const order = tree.root
      .findAll((node) => typeof node.props?.testID === "string")
      .map((node) => node.props.testID as string)
      .filter(
        (id) => id === "position-manage-edit" || id === "position-manage-close",
      )
      .filter((id) => !seen.has(id) && seen.add(id) !== undefined);

    expect(order).toEqual(["position-manage-edit", "position-manage-close"]);
  });

  it("mostra la scadenza reale e il comando per cambiarla", async () => {
    const tree = await render(<PositionManageDetailScreen />);

    expect(texts(tree)).toContain("30 settembre 2026");
    expect(hasTestID(tree, "position-manage-deadline-edit")).toBe(true);
  });

  it("non annuncia Candidature chiuse finché il termine non è superato", async () => {
    const tree = await render(<PositionManageDetailScreen />);

    expect(hasTestID(tree, "position-manage-receiving")).toBe(false);
    expect(texts(tree)).toContain("Attiva");
  });

  it("non mostra la Cronologia su una posizione ancora attiva", async () => {
    const tree = await render(<PositionManageDetailScreen />);

    expect(hasTestID(tree, "position-manage-history")).toBe(false);
  });
});

describe("DAS-REV-18 screen 04 — attiva, termine superato", () => {
  const SCADUTA = detail({
    ...ACTIVE,
    canClose: true,
    deadlineAt: "2026-09-23T22:00:00.000Z",
    deadlineDate: "2026-09-23",
    deadlineTimezone: "Europe/Rome",
    receivingClosed: true,
  });

  beforeEach(() => {
    routerMocks.params = { id: SCADUTA.id };
    manageMocks.fetchPositionManageDetail.mockResolvedValue(SCADUTA);
  });

  it("tiene Attiva e Candidature chiuse come due condizioni separate", async () => {
    const tree = await render(<PositionManageDetailScreen />);
    const content = texts(tree);

    /* §14: «la Position resta PUBLISHED e nella tab Attive» — lo stato non
       diventa «Scaduta», e la ricezione interrotta è una riga in più. */
    expect(content).toContain("Attiva");
    expect(content).toContain("Candidature chiuse");
    expect(content).toContain("Scadenza superata il 23 settembre 2026");
  });

  it("conserva l'accesso alle candidature già ricevute", async () => {
    const tree = await render(<PositionManageDetailScreen />);

    /* §14: «Mantieni accessibili le candidature ricevute». La scadenza non
       le ritira e non le azzera. */
    expect(texts(tree)).toContain("12 candidature · 3 nuove");
    expect(hasTestID(tree, "position-manage-applications")).toBe(true);
  });

  it("spiega come riaprire la ricezione", async () => {
    const tree = await render(<PositionManageDetailScreen />);

    expect(texts(tree)).toContain(
      "Estendi o rimuovi la scadenza per ricevere nuove candidature.",
    );
  });

  it("adatta la prima conseguenza nello sheet di chiusura", async () => {
    const tree = await render(<PositionManageDetailScreen />);

    await act(async () => {
      byTestID(tree, "position-manage-close").props.onPress();
    });

    const content = texts(tree);

    /* §19: annunciare che «non accetterà più candidature» a una posizione
       che ha già smesso di riceverne non informa di niente. */
    expect(content).toContain(
      "La posizione verrà chiusa definitivamente e spostata tra le posizioni Chiuse.",
    );
    expect(content).not.toContain(
      "La posizione non accetterà più candidature e verrà spostata tra le posizioni Chiuse.",
    );
    expect(content).toContain("Le candidature già ricevute resteranno disponibili.");
    expect(content).toContain("Questa operazione non può essere annullata.");
  });
});

describe("DAS-REV-18 screen 07 — conferma di chiusura", () => {
  const ATTIVA = detail({ ...ACTIVE, canClose: true });

  beforeEach(() => {
    routerMocks.params = { id: ATTIVA.id };
    manageMocks.fetchPositionManageDetail.mockResolvedValue(ATTIVA);
  });

  it("il tap sull'azione non chiude nulla: apre lo sheet", async () => {
    const tree = await render(<PositionManageDetailScreen />);

    await act(async () => {
      byTestID(tree, "position-manage-close").props.onPress();
    });

    expect(openSheets(tree)).toBe(1);
    expect(manageMocks.closePosition).not.toHaveBeenCalled();
  });

  it("parte senza motivo selezionato", async () => {
    const tree = await render(<PositionManageDetailScreen />);

    await act(async () => {
      byTestID(tree, "position-manage-close").props.onPress();
    });

    /* §20: «L'iniziale è nessuna selezione. Lo screen 08 mostra un momento
       successivo alla scelta di Profilo trovato; non è una preselezione
       obbligatoria.» */
    expect(texts(tree)).toContain("Nessun motivo");
    expect(texts(tree)).not.toContain("Profilo trovato");
  });

  it("annullare non chiude e non lascia lo sheet aperto", async () => {
    const tree = await render(<PositionManageDetailScreen />);

    await act(async () => {
      byTestID(tree, "position-manage-close").props.onPress();
    });
    await act(async () => {
      byTestID(tree, "position-close-cancel").props.onPress();
    });

    expect(openSheets(tree)).toBe(0);
    expect(manageMocks.closePosition).not.toHaveBeenCalled();
  });

  it("invia il comando una sola volta anche con due tap nello stesso frame", async () => {
    manageMocks.closePosition.mockResolvedValue({
      closeReason: null,
      closeReasonText: null,
      closedAt: "2026-09-24T10:00:00Z",
      lifecycle: "closed",
      positionId: ATTIVA.id,
      resourceVersion: ATTIVA.resourceVersion + 1,
    });

    const tree = await render(<PositionManageDetailScreen />);

    await act(async () => {
      byTestID(tree, "position-manage-close").props.onPress();
    });

    await act(async () => {
      byTestID(tree, "position-close-confirm").props.onPress();
      byTestID(tree, "position-close-confirm").props.onPress();
    });
    await flush();

    /* §22: «Disabilita doppi submit.» L'idempotenza del server è la
       seconda rete, non la prima. */
    expect(manageMocks.closePosition).toHaveBeenCalledTimes(1);
    expect(manageMocks.closePosition.mock.calls[0][0]).toMatchObject({
      expectedVersion: ATTIVA.resourceVersion,
      positionId: ATTIVA.id,
      reason: null,
      reasonText: null,
    });
    expect(
      manageMocks.closePosition.mock.calls[0][0].operationKey.length,
    ).toBeGreaterThanOrEqual(8);
  });
});

describe("DAS-REV-18 screen 10 — dettaglio storico", () => {
  const CHIUSA = detail({
    ...ACTIVE,
    canClose: false,
    canEdit: false,
    canPublish: false,
    closeReason: "filled",
    closeReasonText: null,
    closedAt: "2026-09-24T10:00:00Z",
    deadlineAt: "2026-09-30T22:00:00.000Z",
    deadlineDate: "2026-09-30",
    deadlineTimezone: "Europe/Rome",
    group: "closed",
    lifecycle: "closed",
    publishedAt: "2026-09-01T08:00:00Z",
    receivingClosed: false,
    status: "closed",
  });

  beforeEach(() => {
    routerMocks.params = { id: CHIUSA.id };
    manageMocks.fetchPositionManageDetail.mockResolvedValue(CHIUSA);
  });

  it("mostra la Cronologia con le sole tre voci previste", async () => {
    const tree = await render(<PositionManageDetailScreen />);
    const content = texts(tree);

    expect(content).toContain("Chiusa");
    expect(content).toContain("Cronologia");
    expect(content).toContain("Pubblicata il");
    expect(content).toContain("1 settembre 2026");
    expect(content).toContain("Chiusa il");
    expect(content).toContain("24 settembre 2026");
    expect(content).toContain("Motivo di chiusura");
    expect(content).toContain("Profilo trovato");
    expect(content).toContain("Visibile solo alla società");
  });

  it("non espone nessun comando di modifica, chiusura o riapertura", async () => {
    const tree = await render(<PositionManageDetailScreen />);
    const content = texts(tree);

    /* §25: «Non presentare comandi disabled come falso catalogo di
       funzionalità.» Assenti, non disattivati. */
    expect(hasTestID(tree, "position-manage-edit")).toBe(false);
    expect(hasTestID(tree, "position-manage-close")).toBe(false);
    expect(hasTestID(tree, "position-manage-deadline-edit")).toBe(false);
    expect(hasTestID(tree, "position-manage-publish")).toBe(false);
    expect(content).not.toContain("Riapri posizione");
    expect(content).not.toContain("Duplica");
    expect(content).not.toContain("Elimina");
  });

  it("conserva la scadenza storica senza riscriverla con la data di chiusura", async () => {
    const tree = await render(<PositionManageDetailScreen />);

    /* §28: «Il termine può essere precedente o successivo a closed_at: non
       riscriverlo con la data di chiusura.» Qui è successivo. */
    expect(texts(tree)).toContain("30 settembre 2026");
  });

  it("porta le candidature nella sezione dello storico", async () => {
    const tree = await render(<PositionManageDetailScreen />);
    const content = texts(tree);

    expect(content).toContain("Candidature ricevute");
    expect(hasTestID(tree, "position-manage-view-applications")).toBe(true);
    /* La riga in testa con «3 nuove» appartiene alla gestione di una
       posizione attiva: §26 vieta di enfatizzare le nuove nello storico. */
    expect(hasTestID(tree, "position-manage-counts")).toBe(false);
  });

  it("non enfatizza le nuove candidature nello storico", async () => {
    const tree = await render(<PositionManageDetailScreen />);
    const content = texts(tree);

    /* §26: «Nelle Chiuse non enfatizzare nuove candidature, urgenze o
       countdown.» Il totale resta, il richiamo operativo no. Trovato solo
       dal confronto con il master: i test di dominio passavano. */
    expect(content).toContain("12 candidature");
    expect(content.join(" ")).not.toContain("nuove");
  });

  it("non ripete identità e «Sola consultazione» su una chiusa", async () => {
    const tree = await render(<PositionManageDetailScreen />);
    const content = texts(tree);

    /* §28 la vuole leggibile «come documento»: su una chiusa `canEdit` è
       falso per lifecycle, non per capability, e spiegare una modifica che
       nessuno sta cercando aggiunge righe che il master non ha. */
    expect(hasTestID(tree, "position-manage-identity")).toBe(false);
    expect(hasTestID(tree, "position-manage-readonly")).toBe(false);
    expect(content).not.toContain("Sola consultazione");
  });

  it("omette il motivo quando non c'è, senza «Non specificato»", async () => {
    manageMocks.fetchPositionManageDetail.mockResolvedValue({
      ...CHIUSA,
      closeReason: null,
    });

    const tree = await render(<PositionManageDetailScreen />);
    const content = texts(tree);

    expect(content).toContain("Cronologia");
    expect(content).not.toContain("Motivo di chiusura");
    expect(content).not.toContain("Non specificato");
  });
});
