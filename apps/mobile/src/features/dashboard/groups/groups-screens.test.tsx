/**
 * Centro Gruppi e dettaglio amministrativo DAS-REV-32 montati sui componenti
 * reali: ciò che la tavola rende osservabile e la specifica rende vincolante.
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GroupDetailScreen } from "./GroupDetailScreen";
import { GroupsCenterScreen } from "./GroupsCenterScreen";
import { GroupsError } from "./groups-service";
import type { SocietyGroupDetail, SocietyGroupRow, SocietyGroupsPage } from "./groups-types";
import { DEFAULT_GROUP_LIMITS } from "./groups-types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
  useRouter: () => routerMocks,
}));

vi.mock("../../auth/use-session", () => ({
  useSession: () => ({ profile: { id: "actor-1" } }),
}));

vi.mock("../identity/use-dashboard-identity", () => ({
  useDashboardIdentity: () => ({
    current: { avatarUrl: null, id: "club-1", isVerified: true, kind: "society", name: "AC Como" },
  }),
}));

const toast = vi.hoisted(() => ({ showToast: vi.fn() }));
vi.mock("../../../ui/Toast/ToastProvider", () => ({ useToast: () => toast }));

const serviceMocks = vi.hoisted(() => ({
  fetchGroupAvatarUrl: vi.fn(),
  fetchSocietyGroupDetail: vi.fn(),
  fetchSocietyGroupsPage: vi.fn(),
}));

vi.mock("./groups-service", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, ...serviceMocks };
});

const row = (patch: Partial<SocietyGroupRow> & { conversationId: string; name: string }): SocietyGroupRow => ({
  avatarPath: null,
  peopleCount: 0,
  teamId: null,
  teamName: null,
  ...patch,
});

/** Fixture §7. */
const FIXTURE = [
  row({ conversationId: "g1", name: "Prima squadra", peopleCount: 24, teamId: "t1", teamName: "Prima squadra" }),
  row({ conversationId: "g2", name: "Staff tecnico", peopleCount: 8, teamId: "t1", teamName: "Prima squadra" }),
  row({ conversationId: "g3", name: "Dirigenza", peopleCount: 6 }),
];

const page = (items: SocietyGroupRow[], canCreate = true): SocietyGroupsPage => ({
  canCreate,
  items,
  limits: DEFAULT_GROUP_LIMITS,
  nextCursor: null,
});

const detail = (patch: Partial<SocietyGroupDetail> = {}): SocietyGroupDetail => ({
  adminCount: 3,
  avatarPath: null,
  canManage: false,
  canOpenConversation: true,
  clubId: "club-1",
  clubName: "AC Como",
  conversationId: "g1",
  name: "Prima squadra",
  peopleCount: 24,
  status: "active",
  teamId: "t1",
  teamName: "Prima squadra",
  ...patch,
});

const mounted: TestRenderer.ReactTestRenderer[] = [];

async function flush() {
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

async function render(element: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false, retryDelay: 0 } } });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
  });
  mounted.push(tree);
  await flush();
  return tree;
}

function texts(tree: TestRenderer.ReactTestRenderer): string[] {
  return tree.root
    .findAll((node) => String(node.type) === "Text", { deep: true })
    .map((node) => node.children.filter((child): child is string => typeof child === "string").join(""))
    .filter((value) => value.length > 0);
}

const pressable = (tree: TestRenderer.ReactTestRenderer, id: string) =>
  tree.root.findAll((node) => node.props?.testID === id && typeof node.props?.onPress === "function")[0];
const hasTestID = (tree: TestRenderer.ReactTestRenderer, id: string) =>
  tree.root.findAll((node) => node.props?.testID === id).length > 0;

beforeEach(() => {
  routerMocks.params = {};
  serviceMocks.fetchSocietyGroupsPage.mockResolvedValue(page(FIXTURE));
  serviceMocks.fetchSocietyGroupDetail.mockResolvedValue(detail());
  serviceMocks.fetchGroupAvatarUrl.mockResolvedValue(null);
});

afterEach(() => {
  mounted.splice(0).forEach((tree) => act(() => tree.unmount()));
  vi.clearAllMocks();
});

describe("Centro Gruppi (screen 02, 16)", () => {
  it("titolo, CTA, ricerca e righe amministrative con contesto e persone (QA-011)", async () => {
    const tree = await render(<GroupsCenterScreen />);
    const content = texts(tree);

    expect(content).toContain("Gruppi");
    expect(content).toContain("Gestisci i gruppi della Società.");
    expect(content).toContain("+ Crea gruppo");
    expect(content).toContain("Prima squadra · 24 persone");
    expect(content).toContain("Società · 6 persone");
    expect(hasTestID(tree, "groups-search")).toBe(true);
  });

  it("la riga apre il dettaglio amministrativo, non la chat (QA-003)", async () => {
    const tree = await render(<GroupsCenterScreen />);
    await act(async () => pressable(tree, "groups-row-g1").props.onPress());
    expect(routerMocks.push).toHaveBeenCalledWith("/(tabs)/dashboard/groups/g1");
  });

  it("Crea gruppo apre il wizard con la Società della Dashboard (QA-041)", async () => {
    const tree = await render(<GroupsCenterScreen />);
    await act(async () => pressable(tree, "groups-create").props.onPress());
    expect(routerMocks.push).toHaveBeenCalledWith("/group-compose?origin=dashboard&clubId=club-1");
  });

  it("sola lettura: nessuna CTA Crea gruppo (QA-026)", async () => {
    serviceMocks.fetchSocietyGroupsPage.mockResolvedValue(page(FIXTURE, false));
    const tree = await render(<GroupsCenterScreen />);
    expect(hasTestID(tree, "groups-create")).toBe(false);
  });

  it("vuoto: Nessun gruppo con una sola CTA nel corpo (screen 16)", async () => {
    serviceMocks.fetchSocietyGroupsPage.mockResolvedValue(page([]));
    const content = texts(await render(<GroupsCenterScreen />));
    expect(content).toContain("Nessun gruppo");
    expect(content).toContain("Crea un gruppo per coordinare squadra, staff o altre attività della Società.");
    expect(content.filter((text) => text.includes("Crea gruppo"))).toHaveLength(1);
  });

  it("vuoto in sola lettura: nessuna CTA e testo che non ordina di creare", async () => {
    serviceMocks.fetchSocietyGroupsPage.mockResolvedValue(page([], false));
    const content = texts(await render(<GroupsCenterScreen />));
    expect(content).toContain("La Società non ha ancora gruppi operativi.");
    expect(content.some((text) => text.includes("Crea gruppo"))).toBe(false);
  });

  it("errore senza dati non diventa «Nessun gruppo» (§27)", async () => {
    serviceMocks.fetchSocietyGroupsPage.mockRejectedValue(new GroupsError("UNKNOWN"));
    const content = texts(await render(<GroupsCenterScreen />));
    expect(content).toContain("Non è stato possibile caricare i gruppi. Riprova.");
    expect(content).not.toContain("Nessun gruppo");
  });

  it("revoca: nessun dato amministrativo, stato non autorizzato (QA-027)", async () => {
    serviceMocks.fetchSocietyGroupsPage.mockRejectedValue(new GroupsError("SOCIETY_GROUPS_NOT_AUTHORIZED"));
    const content = texts(await render(<GroupsCenterScreen />));
    expect(content).toContain("Gruppi non disponibili");
    expect(content).not.toContain("Prima squadra · 24 persone");
  });

  it("nessuna preview, unread o mittente nelle righe (QA-012)", async () => {
    const content = texts(await render(<GroupsCenterScreen />)).join(" | ");
    expect(content).not.toMatch(/non lett|:\s|ultimo messaggio/i);
  });
});

describe("Dettaglio amministrativo (screen 03, 04)", () => {
  beforeEach(() => {
    routerMocks.params = { conversationId: "g1" };
  });

  it("membro: metadata e Apri conversazione (QA-021)", async () => {
    const tree = await render(<GroupDetailScreen />);
    const content = texts(tree);
    expect(content).toEqual(expect.arrayContaining(["Prima squadra", "Gruppo operativo · AC Como", "Squadra", "Persone", "24", "Amministratori", "3", "Stato", "Attivo"]));
    expect(hasTestID(tree, "group-open-conversation")).toBe(true);
  });

  it("Apri conversazione rivalida e apre la chat canonica (QA-028)", async () => {
    const tree = await render(<GroupDetailScreen />);
    await act(async () => pressable(tree, "group-open-conversation").props.onPress());
    await flush();
    expect(serviceMocks.fetchSocietyGroupDetail).toHaveBeenCalledTimes(2);
    expect(routerMocks.push).toHaveBeenCalledWith("/messages/g1?otherName=Prima%20squadra");
  });

  it("accesso perso fra render e tap: nessuna navigazione", async () => {
    const tree = await render(<GroupDetailScreen />);
    serviceMocks.fetchSocietyGroupDetail.mockResolvedValue(detail({ canOpenConversation: false }));
    await act(async () => pressable(tree, "group-open-conversation").props.onPress());
    await flush();
    expect(routerMocks.push).not.toHaveBeenCalled();
    expect(toast.showToast).toHaveBeenCalled();
  });

  it("manager non membro: nessuna CTA, nessun avviso allarmistico (QA-022)", async () => {
    serviceMocks.fetchSocietyGroupDetail.mockResolvedValue(detail({ canOpenConversation: false }));
    const tree = await render(<GroupDetailScreen />);
    expect(hasTestID(tree, "group-open-conversation")).toBe(false);
    expect(texts(tree)).toContain("Prima squadra");
  });

  it("Gestisci gruppo assente (QA-010)", async () => {
    const content = texts(await render(<GroupDetailScreen />));
    expect(content.some((text) => /Gestisci gruppo|archiviat|Comunicazioni/i.test(text))).toBe(false);
  });

  it("gruppo societario: Squadra mostra «Società», nessuna squadra inventata (QA-005)", async () => {
    serviceMocks.fetchSocietyGroupDetail.mockResolvedValue(detail({ name: "Dirigenza", teamId: null, teamName: null }));
    const content = texts(await render(<GroupDetailScreen />));
    expect(content).toContain("Società");
  });

  it("non trovato e non autorizzato sono la stessa pagina (QA-029)", async () => {
    serviceMocks.fetchSocietyGroupDetail.mockRejectedValue(new GroupsError("SOCIETY_GROUP_NOT_FOUND"));
    const content = texts(await render(<GroupDetailScreen />));
    expect(content).toContain("Gruppo non disponibile");
  });
});
