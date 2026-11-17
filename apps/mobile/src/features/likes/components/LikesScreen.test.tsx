/**
 * La lista Mi piace montata sui componenti reali (HOM-07 §45–§69, mockup 3).
 *
 * Si verifica ciò che la specifica rende osservabile: pagina detail senza chrome
 * Home, righe PERSON / SOCIETY / MEDIA con metadata sintetici e «Procuratore»,
 * nessuna CTA sull'identità del viewer, Follow globale, paginazione senza
 * duplicati, stati vuoto / errore / contenuto non disponibile.
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "../../../ui";
import { countTestId, hostByTestId, press, pressTestId, textOf } from "../../feed/components/feed-test-helpers";
import type { LikeActor, LikesPage } from "../likes-types";
import { LikesScreen } from "./LikesScreen";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  back: vi.fn(),
  canGoBack: vi.fn(() => true),
  fetchContentLikers: vi.fn(),
  params: { id: "post-1", type: "club_media" } as Record<string, string>,
  push: vi.fn(),
  replace: vi.fn(),
  toggleFollowSource: vi.fn(),
}));

vi.mock("expo-router", () => ({
  useFocusEffect: () => {},
  useLocalSearchParams: () => mocks.params,
  useRouter: () => ({
    back: mocks.back,
    canGoBack: mocks.canGoBack,
    push: mocks.push,
    replace: mocks.replace,
  }),
}));
vi.mock("../../auth/use-session", () => ({
  useSession: () => ({ profile: { id: "viewer-1" }, session: null }),
}));
vi.mock("../likes-service", () => ({ fetchContentLikers: mocks.fetchContentLikers }));
vi.mock("../../search/media/media-search-service", () => ({
  toggleFollowSource: mocks.toggleFollowSource,
}));

function actor(overrides: Partial<LikeActor> = {}): LikeActor {
  const merged = {
    actorId: "p-1",
    actorType: "person" as const,
    avatarUrl: null,
    clubCategory: null,
    clubName: null,
    isFollowing: false,
    isSelf: false,
    isVerified: false,
    mediaKind: null,
    name: "Marco Bianchi",
    primaryPosition: null,
    role: null,
    teamLabel: null,
    ...overrides,
  };
  return { ...merged, key: `${merged.actorType}:${merged.actorId}` };
}

function page(items: LikeActor[], nextCursor: LikesPage["nextCursor"] = null): LikesPage {
  return { items, nextCursor };
}

const MARCO = actor({ clubName: "AC Como", isVerified: true, role: "coach" });
const VARESE = actor({
  actorId: "c-1",
  actorType: "society",
  clubCategory: "Serie D",
  isVerified: true,
  name: "Varese Calcio",
});
const ALESSIO = actor({ actorId: "p-2", name: "Alessio Conti", role: "agent" });
const COMO_NEWS = actor({
  actorId: "m-1",
  actorType: "media",
  isFollowing: true,
  isVerified: true,
  mediaKind: "testata",
  name: "Como Football News",
});
const ME = actor({ actorId: "viewer-1", isSelf: true, name: "Io", role: "player" });

async function mount() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(
      <QueryClientProvider client={client}>
        <ToastProvider>
          <LikesScreen />
        </ToastProvider>
      </QueryClientProvider>,
    );
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return tree;
}

beforeEach(() => {
  mocks.back.mockClear();
  mocks.push.mockClear();
  mocks.replace.mockClear();
  mocks.fetchContentLikers.mockReset();
  mocks.toggleFollowSource.mockReset();
  mocks.toggleFollowSource.mockResolvedValue(undefined);
  mocks.params = { id: "post-1", type: "club_media" };
});

describe("LikesScreen — struttura", () => {
  it("«← Mi piace»: pagina detail, nessun chrome Home (§45–§46)", async () => {
    mocks.fetchContentLikers.mockResolvedValue(page([MARCO]));

    const tree = await mount();
    const json = textOf(tree);

    expect(json).toContain("Mi piace");
    expect(countTestId(tree, "likes-back")).toBe(1);
    for (const chrome of ["PROLINK", "Per te", "Seguiti", "Notifiche", "Cerca", "Dashboard"]) {
      expect(json).not.toContain(chrome);
    }

    pressTestId(tree, "likes-back");
    expect(mocks.back).toHaveBeenCalledTimes(1);
  });

  it("legge la lista del contenuto della route, con il cursore iniziale nullo", async () => {
    mocks.fetchContentLikers.mockResolvedValue(page([MARCO]));

    await mount();

    expect(mocks.fetchContentLikers).toHaveBeenCalledWith("club_media", "post-1", null);
  });
});

describe("LikesScreen — righe", () => {
  it("PERSON, SOCIETY e MEDIA con metadata sintetici e «Procuratore» (§47–§52)", async () => {
    mocks.fetchContentLikers.mockResolvedValue(page([MARCO, VARESE, ALESSIO, COMO_NEWS]));

    const json = textOf(await mount());

    expect(json).toContain("Marco Bianchi");
    expect(json).toContain("Allenatore · AC Como");
    expect(json).toContain("Varese Calcio");
    expect(json).toContain("Società · Serie D");
    expect(json).toContain("Procuratore");
    expect(json).not.toMatch(/Agente/i);
    expect(json).toContain("Como Football News");
    expect(json).toContain("Media · Testata sportiva");
  });

  it("ogni riga è un'unità semantica con nome, verifica e metadata (§179)", async () => {
    mocks.fetchContentLikers.mockResolvedValue(page([MARCO]));

    const tree = await mount();
    const [row] = hostByTestId(tree, "like-actor-open-person:p-1");

    expect(row.props.accessibilityLabel).toBe(
      "Marco Bianchi, profilo verificato, Allenatore · AC Como",
    );
  });

  it("Follow col copy del sistema globale: «Segui» e «Seguito» (§55–§56)", async () => {
    mocks.fetchContentLikers.mockResolvedValue(page([MARCO, COMO_NEWS]));

    const json = textOf(await mount());

    expect(json).toContain('"Segui"');
    expect(json).toContain('"Seguito"');
  });

  it("nessuna CTA sull'identità del viewer (§57)", async () => {
    mocks.fetchContentLikers.mockResolvedValue(page([ME, MARCO]));

    const tree = await mount();

    expect(countTestId(tree, "like-actor-person:viewer-1")).toBe(1);
    const mine = hostByTestId(tree, "like-actor-person:viewer-1")[0];
    expect(mine.findAll((node) => String(node.type) === "Pressable").length).toBe(1);
    const others = hostByTestId(tree, "like-actor-person:p-1")[0];
    expect(others.findAll((node) => String(node.type) === "Pressable").length).toBeGreaterThan(1);
  });
});

describe("LikesScreen — navigazione e Follow", () => {
  it("tap su una riga apre profilo o Società per id (§53)", async () => {
    mocks.fetchContentLikers.mockResolvedValue(page([MARCO, VARESE, COMO_NEWS]));

    const tree = await mount();
    pressTestId(tree, "like-actor-open-person:p-1");
    pressTestId(tree, "like-actor-open-society:c-1");
    pressTestId(tree, "like-actor-open-media:m-1");

    expect(mocks.push.mock.calls.map((call) => call[0])).toEqual([
      "/profile/p-1",
      "/club/c-1",
      "/profile/m-1",
    ]);
  });

  it("Segui passa dal Follow globale e aggiorna subito quella riga (§55)", async () => {
    // HOM-15 §179: dopo la conferma la lista unica del Follow rilegge anche i Mi piace
    // (HOM-11 §62); il server risponde con lo stato già scritto dalla patch.
    mocks.fetchContentLikers
      .mockResolvedValueOnce(page([MARCO, VARESE]))
      .mockResolvedValue(page([MARCO, { ...VARESE, isFollowing: true }]));

    const tree = await mount();
    await act(async () => {
      press(tree, "Segui Varese Calcio");
    });

    expect(mocks.toggleFollowSource).toHaveBeenCalledWith("viewer-1", "club", "c-1", true);
    expect(textOf(tree)).toContain("Smetti di seguire Varese Calcio");
    // L'altra riga non cambia, e nessuna riga si duplica.
    expect(textOf(tree)).toContain("Segui Marco Bianchi");
    expect(countTestId(tree, "like-actor-society:c-1")).toBe(1);
  });

  it("Segui fallito: la riga torna com'era", async () => {
    mocks.fetchContentLikers.mockResolvedValue(page([MARCO]));
    mocks.toggleFollowSource.mockRejectedValue(new Error("boom"));

    const tree = await mount();
    await act(async () => {
      press(tree, "Segui Marco Bianchi");
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(textOf(tree)).toContain("Segui Marco Bianchi");
    expect(textOf(tree)).not.toContain("Smetti di seguire Marco Bianchi");
  });
});

describe("LikesScreen — paginazione (§60, §229)", () => {
  it("carica la pagina successiva col cursore ricevuto, senza duplicati", async () => {
    const cursor = { b: 1, id: "c-1", t: "society", ts: "2026-11-14T09:00:00Z" };
    mocks.fetchContentLikers
      .mockResolvedValueOnce(page([MARCO, VARESE], cursor))
      .mockResolvedValueOnce(page([VARESE, ALESSIO]));

    const tree = await mount();
    const [list] = hostByTestId(tree, "likes-list");
    await act(async () => {
      list.props.onEndReached();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mocks.fetchContentLikers).toHaveBeenNthCalledWith(2, "club_media", "post-1", cursor);
    expect(countTestId(tree, "like-actor-society:c-1")).toBe(1);
    expect(countTestId(tree, "like-actor-person:p-2")).toBe(1);
  });

  it("a lista finita non chiede altre pagine", async () => {
    mocks.fetchContentLikers.mockResolvedValue(page([MARCO]));

    const tree = await mount();
    const [list] = hostByTestId(tree, "likes-list");
    await act(async () => {
      list.props.onEndReached();
    });

    expect(mocks.fetchContentLikers).toHaveBeenCalledTimes(1);
  });
});

describe("LikesScreen — stati (§65–§67, §62)", () => {
  it("caricamento: skeleton di righe", async () => {
    mocks.fetchContentLikers.mockReturnValue(new Promise(() => undefined));

    const tree = await mount();

    expect(countTestId(tree, "likes-skeleton")).toBe(1);
  });

  it("nessun Mi piace: stato compatto", async () => {
    mocks.fetchContentLikers.mockResolvedValue(page([]));

    const tree = await mount();

    expect(countTestId(tree, "likes-empty")).toBe(1);
    expect(textOf(tree)).toContain("Nessun Mi piace");
  });

  it("errore: messaggio e Riprova che rilegge", async () => {
    mocks.fetchContentLikers
      .mockRejectedValueOnce(new Error("Network request failed"))
      .mockResolvedValueOnce(page([MARCO]));

    const tree = await mount();

    expect(textOf(tree)).toContain("Non è stato possibile caricare i Mi piace.");

    await act(async () => {
      press(tree, "Riprova");
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(textOf(tree)).toContain("Marco Bianchi");
  });

  it("contenuto non più leggibile: «Contenuto non disponibile», nessun Riprova", async () => {
    mocks.fetchContentLikers.mockRejectedValue({ message: "content_unavailable" });

    const tree = await mount();

    expect(countTestId(tree, "likes-unavailable")).toBe(1);
    expect(textOf(tree)).toContain("Contenuto non disponibile");
    expect(textOf(tree)).not.toContain("Riprova");
  });

  it("route senza tipo o id: nessuna lista, nessuna richiesta", async () => {
    mocks.params = { type: "club_media" };

    const tree = await mount();

    expect(mocks.fetchContentLikers).not.toHaveBeenCalled();
    expect(textOf(tree)).toContain("Contenuto non disponibile");
  });
});
