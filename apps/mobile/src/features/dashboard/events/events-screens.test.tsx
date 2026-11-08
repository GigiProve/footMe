/**
 * Centro e wizard DAS-REV-28 montati sui componenti reali.
 *
 * Si verifica ciò che la tavola rende osservabile e la specifica rende
 * vincolante: sezioni nell'ordine fisso senza tab, nessuna CTA per la sola
 * lettura, errore che non diventa «Nessun evento», bozza che riapre il
 * wizard, eventi pubblicati senza tap verso un dettaglio che non esiste,
 * «3 di 3» in ogni variante e i campi di Solo su invito assenti dall'albero.
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SelectionEventsCenterScreen } from "./SelectionEventsCenterScreen";
import { EventComposeScreen } from "./compose/EventComposeScreen";
import type {
  SelectionEventEditor,
  SelectionEventRow,
  SelectionEventsCenter,
  SelectionEventsPage,
} from "./events-types";

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
  useNavigation: () => ({ addListener: () => () => {}, dispatch: () => {} }),
  useRouter: () => routerMocks,
}));

vi.mock("../../auth/use-session", () => ({
  useSession: () => ({ profile: { id: "actor-1" } }),
}));

const identity = { current: { id: "club-1", kind: "society" } };

vi.mock("../identity/use-dashboard-identity", () => ({
  useDashboardIdentity: () => identity,
}));

vi.mock("../../../ui/Toast/ToastProvider", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

const serviceMocks = vi.hoisted(() => ({
  fetchSelectionEventEditor: vi.fn(),
  fetchSelectionEventTeams: vi.fn(),
  fetchSelectionEventsCenter: vi.fn(),
  fetchSelectionEventsPage: vi.fn(),
  publishSelectionEvent: vi.fn(),
  saveSelectionEventDraft: vi.fn(),
}));

vi.mock("./events-service", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return { ...actual, ...serviceMocks };
});

const LIMITS = {
  birthYearMax: 2026,
  birthYearMin: 1900,
  description: 2000,
  maxParticipants: 10000,
  requirements: 1000,
  title: 120,
  venueAddress: 200,
  venueName: 120,
};

function center(patch: Partial<SelectionEventsCenter> = {}): SelectionEventsCenter {
  return {
    accessVerifiedAt: Date.now(),
    canCreate: true,
    clubId: "club-1",
    clubIsVerified: true,
    clubLogoUrl: null,
    clubName: "AC Como",
    limits: LIMITS,
    scopeLabel: null,
    timezone: "Europe/Rome",
    ...patch,
  };
}

function row(patch: Partial<SelectionEventRow> & { id: string }): SelectionEventRow {
  return {
    canEdit: true,
    confirmedCount: 0,
    countsAvailable: true,
    eventType: "open_day",
    isFull: false,
    maxParticipants: 50,
    pendingRequestsCount: 0,
    startDate: "2026-09-25",
    startTime: "15:00",
    status: "published",
    teamId: "t1",
    teamName: "Under 16",
    timezone: "Europe/Rome",
    title: "Evento",
    updatedAt: null,
    ...patch,
  };
}

const page = (rows: SelectionEventRow[]): SelectionEventsPage => ({ hasMore: false, nextCursor: null, rows });

/** Fixture §6, ridotta alle righe che lo screen 01/02 mostra. */
const SECTIONS: Record<string, SelectionEventRow[]> = {
  drafts: [
    row({ confirmedCount: null, id: "d1", status: "draft", title: "Provino Juniores", eventType: "tryout", teamName: "Juniores" }),
  ],
  history: [
    row({ confirmedCount: 47, id: "h1", startDate: "2026-07-18", status: "completed", title: "Open day Primavera", teamName: "Primavera" }),
  ],
  upcoming: [
    row({ confirmedCount: 32, id: "u1", pendingRequestsCount: 8, title: "Open day 2010–2011" }),
    row({ confirmedCount: 30, id: "u2", isFull: true, maxParticipants: 30, title: "Stage Portieri" }),
  ],
};

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

const byTestID = (tree: TestRenderer.ReactTestRenderer, id: string) =>
  tree.root.findAll((node) => node.props?.testID === id && typeof node.props?.onPress === "function")[0];
const hasTestID = (tree: TestRenderer.ReactTestRenderer, id: string) =>
  tree.root.findAll((node) => node.props?.testID === id).length > 0;

beforeEach(() => {
  routerMocks.params = {};
  serviceMocks.fetchSelectionEventsCenter.mockResolvedValue(center());
  serviceMocks.fetchSelectionEventsPage.mockImplementation(({ section }: { section: string }) =>
    Promise.resolve(page(SECTIONS[section] ?? [])),
  );
  serviceMocks.fetchSelectionEventTeams.mockResolvedValue([
    { canCreate: true, canEdit: true, contextLabel: null, id: "t-prim", name: "Primavera" },
  ]);
});

afterEach(() => {
  mounted.splice(0).forEach((tree) => act(() => tree.unmount()));
  vi.clearAllMocks();
});

describe("Centro (screen 01, 02, 03, 15, 16)", () => {
  it("titolo, supporting, CTA e sezioni nell'ordine fisso", async () => {
    const content = texts(await render(<SelectionEventsCenterScreen />));
    const order = ["In programma", "Bozze", "Storico"].map((title) => content.indexOf(title));

    expect(content).toContain("Centro Provini, stage e open day");
    expect(content).toContain("Organizza e gestisci gli eventi di selezione della Società.");
    expect(content).toContain("+ Crea evento");
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("righe con conteggi derivati, posti esauriti testuale, storico concluso", async () => {
    const content = texts(await render(<SelectionEventsCenterScreen />));

    expect(content).toContain("32 / 50 confermati · 8 in attesa");
    expect(content).toContain("Posti esauriti");
    expect(content).toContain("47 partecipanti");
    expect(content).toContain("Concluso");
    expect(content.some((text) => /0 in attesa/.test(text) && !/8 in attesa/.test(text))).toBe(false);
  });

  it("§23: la bozza riapre il wizard, l'evento pubblicato non porta a un dettaglio inesistente", async () => {
    const tree = await render(<SelectionEventsCenterScreen />);

    expect(byTestID(tree, "event-row-u1")).toBeUndefined();
    await act(async () => byTestID(tree, "event-row-d1").props.onPress());
    expect(routerMocks.push).toHaveBeenCalledWith("/event-compose?eventId=d1");
  });

  it("QA-003: Centro vuoto con CTA nel corpo", async () => {
    serviceMocks.fetchSelectionEventsPage.mockResolvedValue(page([]));
    const content = texts(await render(<SelectionEventsCenterScreen />));

    expect(content).toContain("Nessun evento");
    expect(content.filter((text) => text.includes("Crea evento"))).toHaveLength(1);
    expect(content).not.toContain("In programma");
  });

  it("QA-004/016: sola lettura con ambito, nessuna CTA", async () => {
    serviceMocks.fetchSelectionEventsCenter.mockResolvedValue(center({ canCreate: false, scopeLabel: "Primavera" }));
    const tree = await render(<SelectionEventsCenterScreen />);

    expect(hasTestID(tree, "events-create")).toBe(false);
    expect(texts(tree)).toContain("Primavera");
  });

  it("QA-107: errore senza dati non diventa «Nessun evento»", async () => {
    serviceMocks.fetchSelectionEventsPage.mockRejectedValue(new Error("boom"));
    const content = texts(await render(<SelectionEventsCenterScreen />));

    expect(content).toContain("Impossibile caricare gli eventi");
    expect(content).not.toContain("Nessun evento");
  });
});

function editor(patch: Partial<SelectionEventEditor["values"]> = {}): SelectionEventEditor {
  return {
    canEdit: true,
    canPublish: true,
    clubId: "club-1",
    hasActivity: false,
    id: "e4",
    status: "draft",
    teamIsArchived: false,
    teamName: "Primavera",
    timezone: "Europe/Rome",
    values: {
      birthYearFrom: "2008",
      birthYearTo: "2009",
      confirmationMode: "manual",
      deadlineDate: "2027-09-28",
      deadlineTime: "23:59",
      description: "",
      endTime: "18:00",
      eventType: "open_day",
      maxParticipants: "50",
      participationMode: "open_registration",
      requirements: "",
      startDate: "2027-09-30",
      startTime: "15:00",
      teamId: "t-prim",
      title: "Open day Primavera",
      venueAddress: "Via Roma 22, Como",
      venueName: "Centro Sportivo Comunale",
      ...patch,
    },
    version: 3,
  };
}

describe("wizard (screen 04–12)", () => {
  it("QA-031: l'apertura vuota non crea nulla e mostra 1 di 3", async () => {
    const tree = await render(<EventComposeScreen />);

    expect(texts(tree)).toContain("1 di 3");
    expect(texts(tree)).toContain("Informazioni evento");
    expect(serviceMocks.saveSelectionEventDraft).not.toHaveBeenCalled();
  });

  it("QA-082: Salva bozza senza squadra chiede la squadra e non chiama il server", async () => {
    const tree = await render(<EventComposeScreen />);

    await act(async () => byTestID(tree, "event-save-draft").props.onPress());
    expect(texts(tree)).toContain("Seleziona una squadra.");
    expect(serviceMocks.saveSelectionEventDraft).not.toHaveBeenCalled();
  });

  it("riapertura: ripristina la bozza e riprende dal 3 di 3, con riepilogo", async () => {
    routerMocks.params = { eventId: "e4" };
    serviceMocks.fetchSelectionEventEditor.mockResolvedValue(editor());
    const content = texts(await render(<EventComposeScreen />));

    expect(content).toContain("3 di 3");
    expect(content).toContain("Iscrizioni aperte");
    expect(content).toContain("Manuale");
    expect(content).toContain("Open day Primavera");
  });

  it("QA-063/117: Solo su invito rimuove conferma e termine dall'albero", async () => {
    routerMocks.params = { eventId: "e4" };
    serviceMocks.fetchSelectionEventEditor.mockResolvedValue(editor());
    const tree = await render(<EventComposeScreen />);

    expect(hasTestID(tree, "event-open-config")).toBe(true);
    await act(async () => byTestID(tree, "event-mode-invite_only").props.onPress());
    expect(hasTestID(tree, "event-open-config")).toBe(false);
    expect(texts(tree)).not.toContain("Conferma delle iscrizioni");
    expect(texts(tree)).toContain("3 di 3");
  });

  it("QA-086: Pubblica salva le modifiche sullo stesso ID e poi pubblica la versione salvata", async () => {
    routerMocks.params = { eventId: "e4" };
    serviceMocks.fetchSelectionEventEditor.mockResolvedValue(editor());
    serviceMocks.saveSelectionEventDraft.mockResolvedValue({ eventId: "e4", replayed: false, status: "draft", version: 4 });
    serviceMocks.publishSelectionEvent.mockResolvedValue({ eventId: "e4", replayed: false, status: "published", version: 5 });
    const tree = await render(<EventComposeScreen />);

    await act(async () => byTestID(tree, "event-confirmation-automatic").props.onPress());
    await act(async () => byTestID(tree, "event-publish").props.onPress());
    await flush();

    expect(serviceMocks.saveSelectionEventDraft).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: "e4", expectedVersion: 3, patch: { registration_confirmation_mode: "automatic" } }),
    );
    expect(serviceMocks.publishSelectionEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: "e4", expectedVersion: 4 }),
    );
  });

  it("§13: create ripetuto dopo esito perso ritrova la bozza e manda solo il resto", async () => {
    serviceMocks.saveSelectionEventDraft
      .mockResolvedValueOnce({ eventId: "e4", replayed: true, status: "draft", version: 1 })
      .mockResolvedValueOnce({ eventId: "e4", replayed: false, status: "draft", version: 2 });
    serviceMocks.fetchSelectionEventEditor.mockResolvedValue(
      editor({ title: "Vecchio", venueAddress: "", venueName: "" }),
    );
    const tree = await render(<EventComposeScreen />);

    await act(async () => byTestID(tree, "event-field-team").props.onPress());
    await act(async () => byTestID(tree, "event-team-t-prim").props.onPress());
    await act(async () => byTestID(tree, "event-team-confirm").props.onPress());
    await act(async () => byTestID(tree, "event-save-draft").props.onPress());
    await flush();

    const calls = serviceMocks.saveSelectionEventDraft.mock.calls.map((call) => call[0]);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({ eventId: null, expectedVersion: null });
    expect(calls[1]).toMatchObject({ eventId: "e4", expectedVersion: 3 });
    expect(Object.keys(calls[1].patch)).not.toContain("team_id");
  });

  it("QA-109: errore di pubblicazione conserva i dati e non dichiara successo", async () => {
    routerMocks.params = { eventId: "e4" };
    serviceMocks.fetchSelectionEventEditor.mockResolvedValue(editor());
    serviceMocks.publishSelectionEvent.mockRejectedValue(new Error("server down"));
    const tree = await render(<EventComposeScreen />);

    await act(async () => byTestID(tree, "event-publish").props.onPress());
    await flush();

    expect(texts(tree)).toContain("Impossibile pubblicare l'evento. Riprova.");
    expect(texts(tree)).toContain("Open day Primavera");
    expect(routerMocks.back).not.toHaveBeenCalled();
  });
});
