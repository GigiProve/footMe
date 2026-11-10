/**
 * Info gruppo e successione DAS-REV-33 montati sui componenti reali: ciò che la
 * tavola rende osservabile (azioni nascoste per variante, contatore, CTA).
 * Le capability arrivano dal server: qui si verifica che il client nasconda ciò
 * che non è concesso, non che lo calcoli.
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GroupHandoverScreen } from "./manage/GroupHandoverScreen";
import { GroupInfoScreen } from "./manage/GroupInfoScreen";
import {
  DEFAULT_GROUP_LIMITS,
  NO_GROUP_CAPABILITIES,
  type GroupCapabilities,
  type GroupManagement,
  type HandoverCandidatesPage,
} from "./groups-types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const routerMocks = vi.hoisted(() => ({
  back: vi.fn(),
  canDismiss: vi.fn(() => false),
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
  /* Il guard delle modifiche non salvate si aggancia a «beforeRemove». */
  useNavigation: () => ({ addListener: () => () => {}, dispatch: () => {}, isFocused: () => true }),
  useRouter: () => routerMocks,
}));

vi.mock("../../auth/use-session", () => ({
  useSession: () => ({ profile: { id: "actor-1" } }),
}));

const toast = vi.hoisted(() => ({ showToast: vi.fn() }));
vi.mock("../../../ui/Toast/ToastProvider", () => ({ useToast: () => toast }));

/* Nessun canale realtime né purge della chat nei test di schermata. */
vi.mock("../../messaging/messaging-service", () => ({
  subscribeToMyGroupPeriods: () => ({}),
  unsubscribeFromConversation: async () => {},
}));
vi.mock("../../messaging/use-group-chat-access", () => ({ purgeConversationCache: async () => {} }));

const serviceMocks = vi.hoisted(() => ({
  fetchGroupAvatarUrl: vi.fn(),
  fetchGroupManagement: vi.fn(),
  fetchGroupTeamOptions: vi.fn(),
  fetchHandoverCandidatesPage: vi.fn(),
}));

vi.mock("./groups-service", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return { ...actual, ...serviceMocks };
});

const caps = (patch: Partial<GroupCapabilities>): GroupCapabilities => ({ ...NO_GROUP_CAPABILITIES, ...patch });

const MEMBER = caps({ canAccessConversation: true, canLeave: true, canViewInfo: true, canViewPeople: true });
const ADMIN = caps({
  ...MEMBER,
  canArchive: true,
  canEditAvatar: true,
  canEditName: true,
  canManageAdmins: true,
  canManagePeople: true,
});
const MANAGER = caps({
  canArchive: true,
  canDelete: true,
  canEditAvatar: true,
  canEditName: true,
  canEditTeam: true,
  canManageAdmins: true,
  canManagePeople: true,
  canViewInfo: true,
  canViewPeople: true,
});

/** Fixture §8: Staff Primavera, AC Como, Primavera, quattro persone, un ADMIN. */
const management = (patch: Partial<GroupManagement> = {}): GroupManagement => ({
  adminCount: 1,
  archivedAt: null,
  avatarPath: null,
  capabilities: MEMBER,
  clubId: "club-1",
  clubIsVerified: true,
  clubName: "AC Como",
  conversationId: "g1",
  createdAt: new Date(2026, 8, 13, 12).toISOString(),
  leavePath: "ordinary",
  limits: DEFAULT_GROUP_LIMITS,
  myPeriodId: "period-1",
  myPeriodVersion: 1,
  myRole: "member",
  name: "Staff Primavera",
  peopleCount: 4,
  status: "active",
  teamId: "t1",
  teamName: "Primavera",
  version: 3,
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

const hasTestID = (tree: TestRenderer.ReactTestRenderer, id: string) =>
  tree.root.findAll((node) => node.props?.testID === id).length > 0;
const pressable = (tree: TestRenderer.ReactTestRenderer, id: string) =>
  tree.root.findAll((node) => node.props?.testID === id && typeof node.props?.onPress === "function")[0];

beforeEach(() => {
  routerMocks.params = { conversationId: "g1" };
  serviceMocks.fetchGroupAvatarUrl.mockResolvedValue(null);
  serviceMocks.fetchGroupManagement.mockResolvedValue(management());
});

afterEach(() => {
  mounted.splice(0).forEach((tree) => act(() => tree.unmount()));
  vi.clearAllMocks();
});

describe("Info gruppo: stessa struttura, azioni per capability (§5, §9)", () => {
  it("screen 01 — MEMBER: dati e Persone, Lascia gruppo, nessuna affordance di modifica", async () => {
    const tree = await render(<GroupInfoScreen origin="messages" />);
    const content = texts(tree);

    expect(content).toEqual(
      expect.arrayContaining(["Info gruppo", "Staff Primavera", "AC Como", "Primavera", "4 persone · 1 amministratore", "Lascia gruppo"]),
    );
    expect(content).toContain("Creato il 13 set 2026 · Attivo");

    expect(hasTestID(tree, "group-name-edit")).toBe(false);
    expect(hasTestID(tree, "group-info-avatar")).toBe(false);
    expect(hasTestID(tree, "group-action-archive")).toBe(false);
    expect(hasTestID(tree, "group-action-delete")).toBe(false);
    /* Squadra: valore semplice, nessun chevron né tap (§11). */
    expect(pressable(tree, "group-info-team")).toBeUndefined();
    expect(pressable(tree, "group-info-people")).toBeDefined();
  });

  it("screen 02 — ADMIN: matita, avatar, Archivia; Squadra resta un valore, nessun Elimina", async () => {
    serviceMocks.fetchGroupManagement.mockResolvedValue(management({ capabilities: ADMIN, myRole: "admin" }));
    const tree = await render(<GroupInfoScreen origin="messages" />);

    expect(hasTestID(tree, "group-name-edit")).toBe(true);
    expect(hasTestID(tree, "group-info-avatar")).toBe(true);
    expect(hasTestID(tree, "group-action-archive")).toBe(true);
    expect(hasTestID(tree, "group-action-leave")).toBe(true);
    expect(pressable(tree, "group-info-team")).toBeUndefined();
    expect(hasTestID(tree, "group-action-delete")).toBe(false);
  });

  it("screen 03 — manager non membro: Squadra modificabile, Archivia ed Elimina, mai Lascia", async () => {
    serviceMocks.fetchGroupManagement.mockResolvedValue(
      management({ capabilities: MANAGER, leavePath: null, myPeriodId: null, myPeriodVersion: null, myRole: null }),
    );
    const tree = await render(<GroupInfoScreen origin="dashboard" />);

    expect(texts(tree)).toContain("Gestisci gruppo");
    expect(pressable(tree, "group-info-team")).toBeDefined();
    expect(hasTestID(tree, "group-action-archive")).toBe(true);
    expect(hasTestID(tree, "group-action-delete")).toBe(true);
    expect(hasTestID(tree, "group-action-leave")).toBe(false);
  });

  it("screen 14 — unica persona: nessun Lascia diretto, Aggiungi persone primaria e il suo avviso", async () => {
    serviceMocks.fetchGroupManagement.mockResolvedValue(
      management({ capabilities: ADMIN, leavePath: "add_people_first", myRole: "admin", peopleCount: 1 }),
    );
    const tree = await render(<GroupInfoScreen origin="messages" />);

    expect(hasTestID(tree, "group-action-leave")).toBe(false);
    expect(hasTestID(tree, "group-action-add_people")).toBe(true);
    expect(texts(tree)).toContain("Aggiungi almeno una persona al gruppo prima di lasciare.");
  });

  it("screen 19 — archiviato senza ADMIN: Gestisci persone e avviso, nessuna Riattiva", async () => {
    serviceMocks.fetchGroupManagement.mockResolvedValue(
      management({
        adminCount: 0,
        capabilities: caps({ ...MANAGER, canArchive: false, canEditName: false, canRecover: true }),
        leavePath: null,
        myPeriodId: null,
        myRole: null,
        status: "archived",
      }),
    );
    const tree = await render(<GroupInfoScreen origin="dashboard" />);

    expect(hasTestID(tree, "group-action-manage_people")).toBe(true);
    expect(hasTestID(tree, "group-action-reactivate")).toBe(false);
    expect(texts(tree)).toContain("Serve un amministratore per riattivare il gruppo.");
    expect(texts(tree)).toContain("Creato il 13 set 2026 · Archiviato");
  });

  it("screen 16 — archiviato con ADMIN: Riattiva senza conferma, nessun Archivia", async () => {
    serviceMocks.fetchGroupManagement.mockResolvedValue(
      management({ capabilities: caps({ ...MEMBER, canReactivate: true }), status: "archived" }),
    );
    const tree = await render(<GroupInfoScreen origin="messages" />);

    expect(hasTestID(tree, "group-action-reactivate")).toBe(true);
    expect(hasTestID(tree, "group-action-archive")).toBe(false);
  });

  it("il check verificato sta sulla Società, non sul nome del gruppo", async () => {
    const tree = await render(<GroupInfoScreen origin="messages" />);

    expect(tree.root.findAll((node) => node.props?.accessibilityLabel === "Società verificata")).not.toHaveLength(0);
  });

  it("errore di caricamento: messaggio locale e Riprova, non una pagina vuota", async () => {
    serviceMocks.fetchGroupManagement.mockRejectedValue(new Error("boom"));
    const tree = await render(<GroupInfoScreen origin="messages" />);

    expect(texts(tree)).toContain("Non è stato possibile caricare il gruppo. Riprova.");
    expect(texts(tree)).toContain("Riprova");
  });
});

describe("Successione dell'ultimo ADMIN (§19, screen 13)", () => {
  const candidates: HandoverCandidatesPage = {
    items: [
      { avatarUrl: null, fullName: "Mister Bianchi", periodId: "pb", profileId: "mb", roleLabel: "Allenatore" },
      { avatarUrl: null, fullName: "Andrea Neri", periodId: "pn", profileId: "an", roleLabel: "Preparatore atletico" },
      { avatarUrl: null, fullName: "Riccardo Riva", periodId: "pr", profileId: "rr", roleLabel: "Match analyst" },
    ],
    nextCursor: null,
  };

  beforeEach(() => {
    routerMocks.params = { conversationId: "g1", origin: "messages" };
    serviceMocks.fetchGroupManagement.mockResolvedValue(
      management({ capabilities: ADMIN, leavePath: "handover", myRole: "admin" }),
    );
    serviceMocks.fetchHandoverCandidatesPage.mockResolvedValue(candidates);
  });

  /** La CTA è un `Button`: la prop `disabled` sta sul componente col testID. */
  const submitDisabled = (tree: TestRenderer.ReactTestRenderer) =>
    tree.root.findAll((node) => node.props?.testID === "group-handover-submit")[0].props.disabled === true;

  it("zero selezioni: «0 selezionati» e «Nomina amministratori e lascia» disabilitata", async () => {
    const tree = await render(<GroupHandoverScreen />);
    const content = texts(tree);

    expect(content).toEqual(
      expect.arrayContaining(["Prima di lasciare il gruppo", "Nomina amministratori e lascia", "0 selezionati", "Mister Bianchi"]),
    );
    expect(submitDisabled(tree)).toBe(true);
  });

  it("due selezioni su tre candidati: «2 selezionati», non il totale; la CTA si abilita", async () => {
    const tree = await render(<GroupHandoverScreen />);

    await act(async () => pressable(tree, "group-person-mb").props.onPress());
    expect(texts(tree)).toContain("1 selezionato");

    await act(async () => pressable(tree, "group-person-an").props.onPress());
    expect(texts(tree)).toContain("2 selezionati");
    expect(submitDisabled(tree)).toBe(false);
  });

  it("deselezionando si torna a zero e la CTA si disabilita", async () => {
    const tree = await render(<GroupHandoverScreen />);

    await act(async () => pressable(tree, "group-person-mb").props.onPress());
    await act(async () => pressable(tree, "group-person-mb").props.onPress());

    expect(texts(tree)).toContain("0 selezionati");
    expect(submitDisabled(tree)).toBe(true);
  });
});
