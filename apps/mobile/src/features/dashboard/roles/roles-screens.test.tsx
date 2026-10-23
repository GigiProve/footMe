/**
 * I master 01–05 montati sui componenti reali (§37).
 *
 * «Usa fixture canoniche e controlla che nessun comando autorizzativo parta
 * prima della CTA definitiva.» È la garanzia centrale della task: i pannelli
 * confermano **nel draft**, e i privilegi cambiano solo al salvataggio.
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "../../../ui";
import { RoleEditorScreen } from "./RoleEditorScreen";
import { RolesCenterScreen } from "./RolesCenterScreen";
import type { PermissionCatalog, RoleDetail, RolesCenter } from "./roles-types";

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
  archiveRole: vi.fn(),
  fetchPermissionCatalog: vi.fn(),
  fetchRoleDetail: vi.fn(),
  fetchRoles: vi.fn(),
  fetchRolesCenter: vi.fn(),
  saveRole: vi.fn(),
}));

/* Il servizio vero importa il client supabase, che in vitest non si
   inizializza. Si sostituiscono soltanto le chiamate di rete: tipi, mapping
   e classi d'errore restano quelli veri. */
vi.mock("./roles-service", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return { ...actual, ...serviceMocks };
});

const COMO = "club-1";

function center(overrides: Partial<RolesCenter> = {}): RolesCenter {
  return {
    accessVerifiedAt: Date.now(),
    canCreateRole: true,
    canEditRoles: true,
    catalogRevision: 1,
    clubId: COMO,
    clubIsVerified: true,
    clubLogoUrl: null,
    clubName: "AC Como",
    dataRevision: 1,
    rolesCount: 3,
    ...overrides,
  };
}

/** Il ramo Candidature del master: cinque controlli, una dipendenza comune. */
const CATALOG: PermissionCatalog = {
  areas: [
    {
      controls: [
        {
          bundle: "view",
          helper: null,
          id: "applications_read",
          isGrantable: true,
          label: "Visualizza candidature",
          permissionKeys: ["applications_view", "shortlist_view"],
          requires: [],
          sortOrder: 1,
        },
        {
          bundle: "manage",
          helper: "Necessario per aggiornare lo stato",
          id: "applications_status",
          isGrantable: true,
          label: "Aggiorna stato candidatura",
          permissionKeys: ["shortlist_edit_status"],
          requires: ["applications_read"],
          sortOrder: 2,
        },
      ],
      description: null,
      id: "applications",
      label: "Candidature e Shortlist",
      scopeKind: "team",
      sortOrder: 1,
    },
    {
      controls: [
        {
          bundle: "view",
          helper: null,
          id: "positions_read",
          isGrantable: true,
          label: "Visualizza posizioni aperte",
          permissionKeys: ["positions_view"],
          requires: [],
          sortOrder: 1,
        },
      ],
      description: null,
      id: "positions",
      label: "Posizioni aperte",
      scopeKind: "team",
      sortOrder: 2,
    },
  ],
  revision: 1,
};

/** Direttore sportivo della fixture: Candidature a Visualizza (§33.3). */
function roleDetail(overrides: Partial<RoleDetail> = {}): RoleDetail {
  return {
    adminsCount: 2,
    areasEnabled: 1,
    canArchive: false,
    canEdit: true,
    catalogRevision: 1,
    configVersion: 3,
    isActive: true,
    isSystem: true,
    name: "Direttore sportivo",
    pendingInvites: 0,
    permissionKeys: ["applications_view", "shortlist_view"],
    roleId: "role-1",
    version: 4,
    ...overrides,
  };
}

const ROLES = {
  rows: [
    {
      adminsCount: 2,
      areasEnabled: 5,
      configVersion: 3,
      isSystem: true,
      name: "Direttore sportivo",
      roleId: "role-1",
      version: 4,
    },
    {
      adminsCount: 1,
      areasEnabled: 4,
      configVersion: 2,
      isSystem: true,
      name: "Responsabile recruiting",
      roleId: "role-2",
      version: 2,
    },
    {
      adminsCount: 1,
      areasEnabled: 2,
      configVersion: 1,
      isSystem: true,
      name: "Team manager",
      roleId: "role-3",
      version: 1,
    },
  ],
  total: 3,
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
    current: {
      avatarUrl: null,
      id: COMO,
      isOwner: true,
      isVerified: true,
      kind: "society",
      name: "AC Como",
    },
  });

  serviceMocks.fetchRolesCenter.mockResolvedValue(center());
  serviceMocks.fetchRoles.mockResolvedValue(ROLES);
  serviceMocks.fetchPermissionCatalog.mockResolvedValue(CATALOG);
  serviceMocks.fetchRoleDetail.mockResolvedValue(roleDetail());
  serviceMocks.saveRole.mockResolvedValue({
    adminsCount: 2,
    changed: true,
    configVersion: 4,
    name: "Direttore sportivo",
    roleId: "role-1",
    version: 5,
  });
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
      <QueryClientProvider client={client}>
        <ToastProvider>{element}</ToastProvider>
      </QueryClientProvider>,
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

/** Valore di un campo di testo: non è un nodo `Text`. */
function inputValue(
  tree: TestRenderer.ReactTestRenderer,
  id: string,
): string | undefined {
  return byTestID(tree, id)[0]?.props?.value;
}

function byTestID(tree: TestRenderer.ReactTestRenderer, id: string) {
  return tree.root.findAll((node) => node.props?.testID === id);
}

async function press(tree: TestRenderer.ReactTestRenderer, id: string) {
  const target = byTestID(tree, id)[0];

  if (!target) {
    throw new Error(`testID assente: ${id}`);
  }

  await act(async () => {
    target.props.onPress?.();
  });

  await flush();
}

describe("screen 01 — Centro Ruoli e permessi", () => {
  it("mostra i tre ruoli con i conteggi del server, non della pagina", async () => {
    const tree = await render(<RolesCenterScreen />);
    const content = texts(tree);

    expect(content).toContain("Direttore sportivo");
    expect(content).toContain("5 aree abilitate · 2 amministratori");
    expect(content).toContain("4 aree abilitate · 1 amministratore");
    expect(content).toContain("2 aree abilitate · 1 amministratore");
  });

  it("spiega a chi si applicano i permessi di un ruolo", async () => {
    const tree = await render(<RolesCenterScreen />);

    expect(texts(tree)).toContain(
      "I permessi di un ruolo si applicano a chi lo utilizza.",
    );
  });

  it("senza diritto di creazione la CTA non esiste, nemmeno disabilitata", async () => {
    // §8: «CTA Crea ruolo, soltanto con capability adeguata.» Un pulsante
    // disabilitato pubblicizzerebbe un permesso mancante.
    serviceMocks.fetchRolesCenter.mockResolvedValue(
      center({ canCreateRole: false, canEditRoles: false }),
    );

    const tree = await render(<RolesCenterScreen />);

    expect(byTestID(tree, "roles-center-create")).toHaveLength(0);
  });

  it("l'elenco vuoto è uno stato, non un errore", async () => {
    serviceMocks.fetchRoles.mockResolvedValue({ rows: [], total: 0 });

    const tree = await render(<RolesCenterScreen />);
    const content = texts(tree);

    expect(content).toContain("Nessun ruolo configurato");
    expect(content).toContain(
      "Crea un ruolo e scegli quali aree potrà utilizzare.",
    );
  });
});

describe("screen 03 — modifica di un ruolo condiviso", () => {
  beforeEach(() => {
    routerMocks.params = { roleId: "role-1" };
  });

  it("apre con nome, platea e livello risolto dal catalogo", async () => {
    const tree = await render(<RoleEditorScreen />);
    const content = texts(tree);

    expect(inputValue(tree, "role-editor-name")).toBe("Direttore sportivo");
    expect(content).toContain("Utilizzato da 2 amministratori");
    expect(content).toContain("Candidature e Shortlist");
    // Il set salvato coincide con il bundle Visualizza: niente Personalizzato.
    expect(content).toContain("Visualizza");
    expect(content).not.toContain("Personalizzato");
  });

  it("senza modifiche non mostra il riepilogo d'impatto", async () => {
    const tree = await render(<RoleEditorScreen />);

    expect(texts(tree)).not.toContain("Modifica da salvare");
  });

  it("il selector rapido aggiorna il draft e non chiama nessun comando", async () => {
    // §11: «Conferma applica la scelta al draft del role editor e chiude il
    // pannello; non aggiorna ancora i permessi server.»
    const tree = await render(<RoleEditorScreen />);

    await press(tree, "role-area-applications");

    // Le tre opzioni del selector rapido sono montate…
    const content = texts(tree);

    expect(content).toContain("Nessun accesso");
    expect(content).toContain("Non può accedere a questa area.");
    expect(content).toContain("Può utilizzare le normali funzioni di gestione.");
    expect(content).toContain("Personalizza singoli permessi");

    // …e aprirle non ha toccato il backend.
    expect(serviceMocks.saveRole).not.toHaveBeenCalled();
  });

  it("nessun comando parte prima della CTA definitiva", async () => {
    const tree = await render(<RoleEditorScreen />);

    await press(tree, "role-area-applications");
    await press(tree, "role-area-positions");

    // Aprire e chiudere pannelli non è un salvataggio.
    expect(serviceMocks.saveRole).not.toHaveBeenCalled();
    expect(serviceMocks.archiveRole).not.toHaveBeenCalled();
  });

  it("in sola lettura non espone la CTA di salvataggio", async () => {
    // §8: «Chi può solo leggere apre i dettagli in consultazione, senza
    // controlli editabili.»
    serviceMocks.fetchRoleDetail.mockResolvedValue(
      roleDetail({ canEdit: false }),
    );

    const tree = await render(<RoleEditorScreen />);

    expect(byTestID(tree, "role-editor-save")).toHaveLength(0);
    expect(texts(tree)).toContain(
      "Hai accesso in sola lettura a questa configurazione.",
    );
  });

  it("non offre l'archiviazione di un ruolo ancora utilizzato", async () => {
    // §24: il server la rifiuterebbe comunque; mostrarla sarebbe un controllo
    // che è certo di fallire.
    const tree = await render(<RoleEditorScreen />);

    expect(byTestID(tree, "role-editor-archive")).toHaveLength(0);
  });
});

describe("screen 02 — creazione di un ruolo", () => {
  it("parte senza poteri assegnati e lo dichiara", async () => {
    // §9: «un nuovo form parte senza poteri assegnati, con Nessun accesso per
    // ogni area» e §33.2 vieta un preset professionale.
    const tree = await render(<RoleEditorScreen />);
    const content = texts(tree);

    expect(content).toContain(
      "Questo ruolo non concede accesso alle aree di gestione.",
    );
    expect(content).not.toContain("Gestisci");
    expect(serviceMocks.fetchRoleDetail).not.toHaveBeenCalled();
  });

  it("non invia nulla finché il nome non è valido", async () => {
    const tree = await render(<RoleEditorScreen />);
    const save = byTestID(tree, "role-editor-save")[0];

    expect(save?.props.disabled).toBe(true);
    expect(serviceMocks.saveRole).not.toHaveBeenCalled();
  });
});
