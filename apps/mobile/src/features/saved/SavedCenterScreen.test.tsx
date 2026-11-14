/**
 * Saved Center (HOM-07 §102–§128, §152–§161): categorie, righe, rimozione con
 * Annulla, stati vuoti e d'errore, cache che sopravvive all'errore.
 */

import type { ReactNode } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setAnalyticsSink, type AnalyticsEvent } from "../../lib/analytics";
import { SavedCenterScreen } from "./SavedCenterScreen";
import { parseSavedPage } from "./saved-presentation";
import { resetSavedStore } from "./saved-store";
import type { SavedListRowWire, SavedPage } from "./saved-types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  back: vi.fn(),
  fetchSavedPage: vi.fn(),
  push: vi.fn(),
  setSavedRemote: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("expo-router", () => ({
  useRouter: () => ({ back: mocks.back, push: mocks.push }),
}));
vi.mock("../auth/use-session", () => ({
  useSession: () => ({ profile: { id: "me" } }),
}));
vi.mock("./saved-service", () => ({
  fetchSavedPage: mocks.fetchSavedPage,
  setSavedRemote: mocks.setSavedRemote,
}));
vi.mock("../../ui/Toast/ToastProvider", () => ({
  ToastProvider: ({ children }: { children: ReactNode }) => children,
  useToast: () => ({ showToast: mocks.showToast }),
}));

const trees: TestRenderer.ReactTestRenderer[] = [];
const events: AnalyticsEvent[] = [];

beforeEach(() => {
  resetSavedStore();
  setAnalyticsSink((event) => events.push(event));
});

afterEach(() => {
  trees.splice(0).forEach((tree) => act(() => tree.unmount()));
  events.length = 0;
  setAnalyticsSink(null);
  vi.clearAllMocks();
});

const article: SavedListRowWire = {
  content_type: "club_media",
  next_cursor: null,
  payload: {
    author: { id: "c1", is_verified: true, name: "AC Como", type: "society" },
    duration_seconds: null,
    excerpt: "Sommario",
    item_kind: "article",
    published_at: "2026-01-02T08:00:00Z",
    thumbnail_url: "https://x/a.jpg",
    title: "Il nuovo progetto tecnico",
  },
  saved_at: "2026-11-14T10:00:00Z",
  target_id: "p1",
  target_type: "content",
};

const textPost: SavedListRowWire = {
  content_type: "profile_post",
  next_cursor: { k: "content:profile_post:p2", ts: "2026-11-14T09:00:00Z" },
  payload: {
    author: { id: "u9", is_verified: false, name: "Marco Rossi", type: "person" },
    duration_seconds: null,
    excerpt: "Allenamento di questa mattina",
    item_kind: "post",
    published_at: "2026-01-02T08:00:00Z",
    thumbnail_url: null,
    title: null,
  },
  saved_at: "2026-11-14T09:00:00Z",
  target_id: "p2",
  target_type: "content",
};

function page(rows: SavedListRowWire[]): SavedPage {
  return parseSavedPage(rows);
}

function renderScreen(filter?: string) {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });
  let tree!: TestRenderer.ReactTestRenderer;

  act(() => {
    tree = TestRenderer.create(
      <QueryClientProvider client={client}>
        <SavedCenterScreen initialFilter={filter} />
      </QueryClientProvider>,
    );
  });
  trees.push(tree);

  return { client, tree };
}

function textOf(tree: TestRenderer.ReactTestRenderer): string {
  return JSON.stringify(tree.toJSON());
}

function pressLabel(tree: TestRenderer.ReactTestRenderer, label: string | RegExp) {
  const node = tree.root
    .findAll(
      (entry) =>
        typeof entry.type === "string" &&
        typeof entry.props.onPress === "function" &&
        typeof entry.props.accessibilityLabel === "string" &&
        (typeof label === "string"
          ? entry.props.accessibilityLabel === label
          : label.test(entry.props.accessibilityLabel)),
    )
    .at(0);

  if (!node) {
    throw new Error(`Nessun elemento premibile con label ${String(label)}`);
  }

  act(() => {
    node.props.onPress();
  });
}

function pressText(tree: TestRenderer.ReactTestRenderer, text: string) {
  const node = tree.root
    .findAll(
      (entry) =>
        typeof entry.type === "string" &&
        typeof entry.props.onPress === "function" &&
        entry.findAll((child) => child.props?.children === text).length > 0,
    )
    .at(0);

  if (!node) {
    throw new Error(`Nessun elemento premibile con testo ${text}`);
  }

  act(() => {
    node.props.onPress();
  });
}

describe("categorie (§105–§106, §182)", () => {
  it("quattro categorie come navigazione locale, Contenuti attiva; nessuna «Squadre»", async () => {
    mocks.fetchSavedPage.mockResolvedValue(page([article]));
    const { tree } = renderScreen();

    await vi.waitFor(() => expect(textOf(tree)).toContain("Il nuovo progetto tecnico"));

    const json = textOf(tree);
    for (const label of ["Contenuti", "Profili", "Società", "Posizioni"]) {
      expect(json).toContain(`"${label}"`);
    }
    expect(json).not.toContain("Squadre");

    const tabs = tree.root.findAll(
      (node) => typeof node.type === "string" && node.props.accessibilityRole === "tab",
    );
    expect(tabs).toHaveLength(4);
    expect(tabs.map((tab) => tab.props.accessibilityState.selected)).toEqual([
      true,
      false,
      false,
      false,
    ]);
    expect(mocks.fetchSavedPage).toHaveBeenCalledWith("content", null);
  });

  it("?filter=club apre Società; un filtro sconosciuto apre Contenuti", async () => {
    mocks.fetchSavedPage.mockResolvedValue(page([]));

    renderScreen("club");
    await vi.waitFor(() => expect(mocks.fetchSavedPage).toHaveBeenCalledWith("society", null));

    renderScreen("boh");
    await vi.waitFor(() => expect(mocks.fetchSavedPage).toHaveBeenCalledWith("content", null));
  });

  it("cambiare tab carica la categoria e registra saved_category_changed", async () => {
    mocks.fetchSavedPage.mockResolvedValue(page([]));
    const { tree } = renderScreen();
    await vi.waitFor(() => expect(mocks.fetchSavedPage).toHaveBeenCalledTimes(1));

    pressLabel(tree, "Profili");

    await vi.waitFor(() => expect(mocks.fetchSavedPage).toHaveBeenCalledWith("profile", null));
    expect(events.map((event) => event.name)).toEqual(
      expect.arrayContaining(["saved_center_open", "saved_category_changed"]),
    );
    expect(events.find((event) => event.name === "saved_category_changed")?.props).toEqual({
      from: "content",
      to: "profile",
    });
  });
});

describe("righe contenuto (§109–§113)", () => {
  it("etichetta POST/ARTICOLO, titolo o prime righe, autore e tempo; nessun placeholder per il text-only", async () => {
    mocks.fetchSavedPage.mockResolvedValue(page([article, textPost]));
    const { tree } = renderScreen();

    await vi.waitFor(() => expect(textOf(tree)).toContain("Allenamento di questa mattina"));

    const json = textOf(tree);
    expect(json).toContain('"ARTICOLO"');
    expect(json).toContain('"POST"');
    expect(json).toContain("Il nuovo progetto tecnico");
    expect(json).toContain("AC Como");
    // Una sola immagine: quella dell'Articolo. Il Post text-only non ne ha.
    expect(tree.root.findAll((node) => (node.type as unknown) === "Image")).toHaveLength(1);
  });

  it("il tap sulla riga apre il contenuto canonico con la provenienza Salvati (§114)", async () => {
    mocks.fetchSavedPage.mockResolvedValue(page([article]));
    const { tree } = renderScreen();
    await vi.waitFor(() => expect(textOf(tree)).toContain("Il nuovo progetto tecnico"));

    pressLabel(tree, /^Articolo, Il nuovo progetto tecnico/);

    expect(mocks.push).toHaveBeenCalledWith("/content/club_media/p1?origin=SAVED");
    expect(events.find((event) => event.name === "saved_target_open")?.props).toEqual({
      category: "content",
      targetType: "content",
    });
  });
});

describe("rimozione e Annulla (§116–§119)", () => {
  it("il bookmark toglie la riga subito e offre «Rimosso dai salvati · Annulla»", async () => {
    mocks.fetchSavedPage.mockResolvedValue(page([article, textPost]));
    mocks.setSavedRemote.mockResolvedValue(false);
    const { tree } = renderScreen();
    await vi.waitFor(() => expect(textOf(tree)).toContain("Allenamento di questa mattina"));

    pressLabel(tree, "Rimuovi dai salvati");

    // Subito, prima della risposta del server: la riga non c'è più.
    expect(textOf(tree)).not.toContain("Il nuovo progetto tecnico");
    expect(textOf(tree)).toContain("Allenamento di questa mattina");

    await vi.waitFor(() => expect(mocks.showToast).toHaveBeenCalled());
    expect(mocks.setSavedRemote).toHaveBeenCalledWith(
      { contentType: "club_media", id: "p1", type: "content" },
      false,
    );
    const toast = mocks.showToast.mock.calls.at(-1)?.[0];
    expect(toast.message).toBe("Rimosso dai salvati");
    expect(toast.action.label).toBe("Annulla");
  });

  it("Annulla riporta la riga al suo posto e riscrive il salvataggio", async () => {
    mocks.fetchSavedPage.mockResolvedValue(page([article, textPost]));
    mocks.setSavedRemote.mockResolvedValue(true);
    const { tree } = renderScreen();
    await vi.waitFor(() => expect(textOf(tree)).toContain("Il nuovo progetto tecnico"));

    pressLabel(tree, "Rimuovi dai salvati");
    await vi.waitFor(() => expect(mocks.showToast).toHaveBeenCalled());
    const toast = mocks.showToast.mock.calls.at(-1)?.[0];

    act(() => {
      toast.action.onPress();
    });

    expect(textOf(tree)).toContain("Il nuovo progetto tecnico");
    await vi.waitFor(() => expect(mocks.setSavedRemote).toHaveBeenCalledTimes(2));
    expect(mocks.setSavedRemote).toHaveBeenLastCalledWith(
      { contentType: "club_media", id: "p1", type: "content" },
      true,
    );
    // Il Saved Center non ricarica la lista mentre si può annullare: la riga non salta (§117).
    expect(mocks.fetchSavedPage).toHaveBeenCalledTimes(1);
    expect(events.map((event) => event.name)).toEqual(
      expect.arrayContaining(["unsave_attempt", "saved_target_removed", "saved_remove_undo"]),
    );
  });

  it("se la rimozione fallisce la riga torna, con il copy del §98", async () => {
    mocks.fetchSavedPage.mockResolvedValue(page([article]));
    mocks.setSavedRemote.mockRejectedValue(new Error("offline"));
    const { tree } = renderScreen();
    await vi.waitFor(() => expect(textOf(tree)).toContain("Il nuovo progetto tecnico"));

    pressLabel(tree, "Rimuovi dai salvati");

    await vi.waitFor(() =>
      expect(mocks.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Non è stato possibile completare l'operazione." }),
      ),
    );
    expect(textOf(tree)).toContain("Il nuovo progetto tecnico");
  });
});

describe("stati vuoti, caricamento ed errore (§152–§159)", () => {
  it("skeleton righe durante il primo caricamento", () => {
    mocks.fetchSavedPage.mockReturnValue(new Promise(() => undefined));
    const { tree } = renderScreen();

    expect(tree.root.findAll((node) => node.props.testID === "saved-skeleton").length).toBeGreaterThan(0);
  });

  it("empty compatto per categoria, senza CTA", async () => {
    mocks.fetchSavedPage.mockResolvedValue(page([]));
    const { tree } = renderScreen();

    await vi.waitFor(() => expect(textOf(tree)).toContain("Nessun contenuto salvato"));
    expect(textOf(tree)).toContain("I contenuti che salvi su PROLINK compariranno qui.");

    pressLabel(tree, "Posizioni");
    await vi.waitFor(() => expect(textOf(tree)).toContain("Nessuna posizione salvata"));
  });

  it("errore senza dati: messaggio e «Riprova», che ricarica", async () => {
    mocks.fetchSavedPage.mockRejectedValueOnce(new Error("rete")).mockResolvedValue(page([article]));
    const { tree } = renderScreen();

    await vi.waitFor(() =>
      expect(textOf(tree)).toContain("Non è stato possibile caricare i salvati."),
    );

    pressText(tree, "Riprova");

    await vi.waitFor(() => expect(textOf(tree)).toContain("Il nuovo progetto tecnico"));
    expect(textOf(tree)).not.toContain("Non è stato possibile caricare i salvati.");
  });

  it("un errore temporaneo non cancella ciò che è in cache (§159)", async () => {
    mocks.fetchSavedPage.mockResolvedValueOnce(page([article]));
    const { client, tree } = renderScreen();
    await vi.waitFor(() => expect(textOf(tree)).toContain("Il nuovo progetto tecnico"));

    mocks.fetchSavedPage.mockRejectedValue(new Error("rete"));
    await act(async () => {
      await client.invalidateQueries({ queryKey: ["saved-items"] });
    });

    await vi.waitFor(() =>
      expect(textOf(tree)).toContain("Non è stato possibile caricare i salvati."),
    );
    expect(textOf(tree)).toContain("Il nuovo progetto tecnico");
  });
});
