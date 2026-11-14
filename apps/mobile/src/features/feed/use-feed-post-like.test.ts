import { createElement } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { InteractionIdentity } from "../interactions/interaction-types";
import { likeItemKey, likeStore } from "../interactions/like-store";
import { makeEditorialItem, makeEditorialPayload, makePostItem } from "./feed-post-fixtures";
import type { FeedContentItem, FeedEditorialPayload, FeedItem } from "./feed-types";
import {
  createLikeTracker,
  likeSnapshotOf,
  resetLikeEngine,
  seedLikesFromItems,
  useToggleFeedPostLike,
} from "./use-feed-post-like";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const likeMocks = vi.hoisted(() => ({
  loadInteractionIdentity: vi.fn(),
  setContentLike: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("../../ui", () => ({ useToast: () => ({ showToast: likeMocks.showToast }) }));
vi.mock("../interactions/interaction-service", () => ({
  loadInteractionIdentity: likeMocks.loadInteractionIdentity,
  setContentLike: likeMocks.setContentLike,
}));

const PERSON: InteractionIdentity = {
  avatarUrl: null,
  id: "me",
  isVerified: false,
  name: "Io",
  rank: 0,
  type: "person",
};

const SOCIETY: InteractionIdentity = {
  avatarUrl: null,
  id: "club-1",
  isVerified: true,
  name: "Como 1907",
  rank: 1,
  type: "society",
};

const KEY = likeItemKey("media_profile", "v-1");

function video(likesCount = 5, extra: Partial<FeedEditorialPayload> = {}): FeedContentItem {
  return makeEditorialItem("media_profile:v-1", "video", {
    likesCount,
    postId: "v-1",
    ...extra,
  }) as FeedContentItem;
}

function mount(client: QueryClient) {
  let toggle: ((item: FeedContentItem) => void) | null = null;
  function Probe() {
    toggle = useToggleFeedPostLike({ profileId: "me" });
    return null;
  }
  act(() => {
    TestRenderer.create(createElement(QueryClientProvider, { client }, createElement(Probe)));
  });
  return (item: FeedContentItem) => toggle!(item);
}

function newClient() {
  return new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
}

beforeEach(() => {
  likeStore.clear();
  resetLikeEngine();
  likeMocks.loadInteractionIdentity.mockReset();
  likeMocks.setContentLike.mockReset();
  likeMocks.showToast.mockReset();
  likeMocks.loadInteractionIdentity.mockResolvedValue(PERSON);
});

describe("createLikeTracker", () => {
  const unliked = { isLiked: false, likesCount: 146 };
  const liked = { isLiked: true, likesCount: 147 };

  it("con una sola richiesta scrive la risposta del server", () => {
    const tracker = createLikeTracker<typeof liked>();
    tracker.begin("a", unliked);

    expect(tracker.settle("a", liked)).toEqual(liked);
  });

  it("Mi piace e subito 'togli': la prima risposta non fa rimbalzare la UI", () => {
    const tracker = createLikeTracker<typeof liked>();
    tracker.begin("a", unliked);
    tracker.begin("a", liked);

    expect(tracker.settle("a", liked)).toBeNull();
    expect(tracker.settle("a", unliked)).toEqual(unliked);
  });

  it("due tap offline tornano allo stato di prima del primo tap", () => {
    const tracker = createLikeTracker<typeof liked>();
    tracker.begin("a", unliked);
    tracker.begin("a", liked);

    expect(tracker.settle("a", null)).toBeNull();
    expect(tracker.settle("a", null)).toEqual(unliked);
  });

  it("se l'ultima fallisce resta l'ultimo stato confermato", () => {
    const tracker = createLikeTracker<typeof liked>();
    tracker.begin("a", unliked);
    tracker.begin("a", liked);

    expect(tracker.settle("a", liked)).toBeNull();
    expect(tracker.settle("a", null)).toEqual(liked);
  });

  it("tiene separati Post diversi", () => {
    const tracker = createLikeTracker<typeof liked>();
    tracker.begin("a", unliked);
    tracker.begin("b", unliked);

    expect(tracker.settle("a", liked)).toEqual(liked);
    expect(tracker.settle("b", null)).toEqual(unliked);
  });
});

describe("seedLikesFromItems — HOM-07 §135", () => {
  it("riempie la cella di ogni contenuto con conteggio e identità del viewer", () => {
    const items: FeedItem[] = [
      video(5, { isLiked: true }),
      makePostItem("club_media:p-1", { likesCount: 2, postId: "p-1" }) as FeedItem,
    ];

    seedLikesFromItems(items);

    expect(likeStore.get(KEY)).toEqual({
      likedAs: [{ id: "viewer-1", type: "person" }],
      likesCount: 5,
    });
    expect(likeStore.get(likeItemKey("club_media", "p-1"))).toEqual({ likedAs: [], likesCount: 2 });
  });

  it("usa l'istante della pagina: una pagina più vecchia non sovrascrive una più nuova (§141)", () => {
    seedLikesFromItems([{ ...video(7), fetchedAt: 300 } as FeedItem]);
    seedLikesFromItems([{ ...video(5), fetchedAt: 100 } as FeedItem]);
    expect(likeStore.get(KEY)?.likesCount).toBe(7);

    seedLikesFromItems([{ ...video(9), fetchedAt: 400 } as FeedItem]);
    expect(likeStore.get(KEY)?.likesCount).toBe(9);
  });

  it("likeSnapshotOf prende solo conteggio e identità", () => {
    expect(
      likeSnapshotOf({ ...makeEditorialPayload({ likesCount: 4 }), likedAs: [] }),
    ).toEqual({ likedAs: [], likesCount: 4 });
  });
});

describe("useToggleFeedPostLike — HOM-03 §104, HOM-07 §13–§19", () => {
  it("Mi piace: UI subito aggiornata, poi il conteggio del server prevale", async () => {
    let resolveServer: (value: { isLiked: boolean; likesCount: number }) => void = () => undefined;
    likeMocks.setContentLike.mockReturnValue(
      new Promise((resolve) => {
        resolveServer = resolve;
      }),
    );
    const item = video(5);
    likeStore.seed(KEY, likeSnapshotOf(item.payload));

    const toggle = mount(newClient());
    await act(async () => {
      toggle(item);
    });

    // Ottimistico: +1 e identità corrente fra quelle che hanno messo Mi piace.
    await vi.waitFor(() =>
      expect(likeStore.get(KEY)).toEqual({
        likedAs: [{ id: "me", type: "person" }],
        likesCount: 6,
      }),
    );
    await vi.waitFor(() =>
      expect(likeMocks.setContentLike).toHaveBeenCalledWith("media_profile", "v-1", true, PERSON),
    );

    await act(async () => {
      resolveServer({ isLiked: true, likesCount: 9 });
    });

    await vi.waitFor(() =>
      expect(likeStore.get(KEY)).toEqual({
        likedAs: [{ id: "me", type: "person" }],
        likesCount: 9,
      }),
    );
  });

  it("una pagina partita mentre la richiesta era in volo non annulla il Mi piace confermato (§141)", async () => {
    let resolveServer: (value: { isLiked: boolean; likesCount: number }) => void = () => undefined;
    likeMocks.setContentLike.mockReturnValue(
      new Promise((resolve) => {
        resolveServer = resolve;
      }),
    );
    const item = video(5);

    const toggle = mount(newClient());
    await act(async () => {
      toggle(item);
    });
    await vi.waitFor(() => expect(likeMocks.setContentLike).toHaveBeenCalled());

    // Refetch partito DOPO il tap ma prima che il server registrasse il Like.
    likeStore.seed(KEY, { likedAs: [], likesCount: 5 }, Date.now());

    await act(async () => {
      resolveServer({ isLiked: true, likesCount: 6 });
    });

    await vi.waitFor(() =>
      expect(likeStore.get(KEY)).toEqual({ likedAs: [{ id: "me", type: "person" }], likesCount: 6 }),
    );
  });

  it("una risposta arrivata dopo il logout non scrive nello store del prossimo utente", async () => {
    let resolveServer: (value: { isLiked: boolean; likesCount: number }) => void = () => undefined;
    likeMocks.setContentLike.mockReturnValue(
      new Promise((resolve) => {
        resolveServer = resolve;
      }),
    );
    const item = video(5);

    const toggle = mount(newClient());
    await act(async () => {
      toggle(item);
    });
    await vi.waitFor(() => expect(likeMocks.setContentLike).toHaveBeenCalled());

    // Il logout svuota store e motore (resetUserInteractions).
    act(() => {
      likeStore.clear();
      resetLikeEngine();
    });
    await act(async () => {
      resolveServer({ isLiked: true, likesCount: 6 });
    });

    expect(likeStore.get(KEY)).toBeUndefined();
  });

  it("errore: ripristina stato e conteggio di prima e avvisa (§16)", async () => {
    likeMocks.setContentLike.mockRejectedValue(new Error("boom"));
    const item = video(5);
    likeStore.seed(KEY, likeSnapshotOf(item.payload));

    const toggle = mount(newClient());
    await act(async () => {
      toggle(item);
    });

    await vi.waitFor(() => expect(likeMocks.showToast).toHaveBeenCalled());
    expect(likeStore.get(KEY)).toEqual({ likedAs: [], likesCount: 5 });
    expect(likeMocks.showToast).toHaveBeenCalledWith({
      message: "Non è stato possibile completare l'operazione.",
    });
  });

  it("doppio tap: due richieste in ordine, nessun conteggio +2 (§17)", async () => {
    likeMocks.setContentLike.mockImplementation(
      async (_type: string, _id: string, liked: boolean) => ({
        isLiked: liked,
        likesCount: liked ? 6 : 5,
      }),
    );
    const item = video(5);
    likeStore.seed(KEY, likeSnapshotOf(item.payload));

    const toggle = mount(newClient());
    await act(async () => {
      toggle(item);
      toggle(item);
    });

    await vi.waitFor(() => expect(likeMocks.setContentLike).toHaveBeenCalledTimes(2));
    expect(likeMocks.setContentLike.mock.calls.map((call) => call[2])).toEqual([true, false]);
    await vi.waitFor(() => expect(likeStore.get(KEY)).toEqual({ likedAs: [], likesCount: 5 }));
  });

  it("il Mi piace appartiene all'identità corrente: una Società può averlo già messo e la persona no", async () => {
    likeMocks.loadInteractionIdentity.mockResolvedValue(PERSON);
    likeMocks.setContentLike.mockResolvedValue({ isLiked: true, likesCount: 7 });
    const item = video(6, {
      likedAs: [{ id: SOCIETY.id, type: SOCIETY.type }],
    });
    likeStore.seed(KEY, likeSnapshotOf(item.payload));

    const toggle = mount(newClient());
    await act(async () => {
      toggle(item);
    });

    // La persona NON aveva messo Mi piace: il tap lo aggiunge, non lo toglie.
    await vi.waitFor(() =>
      expect(likeMocks.setContentLike).toHaveBeenCalledWith("media_profile", "v-1", true, PERSON),
    );
    await vi.waitFor(() =>
      expect(likeStore.get(KEY)?.likedAs).toEqual([
        { id: SOCIETY.id, type: SOCIETY.type },
        { id: PERSON.id, type: PERSON.type },
      ]),
    );
  });

  it("senza identità di interazione non parte nessun Mi piace", async () => {
    likeMocks.loadInteractionIdentity.mockResolvedValue(null);
    const item = video(5);
    likeStore.seed(KEY, likeSnapshotOf(item.payload));

    const toggle = mount(newClient());
    await act(async () => {
      toggle(item);
    });

    await vi.waitFor(() => expect(likeMocks.showToast).toHaveBeenCalled());
    expect(likeMocks.setContentLike).not.toHaveBeenCalled();
    expect(likeStore.get(KEY)).toEqual({ likedAs: [], likesCount: 5 });
  });

  it("senza capability non scrive e mostra il messaggio", async () => {
    const client = newClient();
    const article = makeEditorialItem("media_tribuna:a-1", "article", {
      capabilities: { ...makeEditorialPayload().capabilities, canLike: false },
      contentType: "media_tribuna",
    }) as FeedContentItem;

    const toggle = mount(client);
    await act(async () => {
      toggle(article);
    });

    expect(likeMocks.setContentLike).not.toHaveBeenCalled();
    expect(likeMocks.showToast).toHaveBeenCalled();
  });
});
