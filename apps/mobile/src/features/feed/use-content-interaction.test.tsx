import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { likeItemKey, likeStore } from "../interactions/like-store";
import { makeEditorialItem } from "./feed-post-fixtures";
import { useContentInteraction, type ContentInteraction } from "./use-content-interaction";
import { seedLikesFromItems } from "./use-feed-post-like";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  fetchContentInteractionState: vi.fn(),
  loadInteractionIdentity: vi.fn(),
  setContentLike: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("../../ui", () => ({ useToast: () => ({ showToast: mocks.showToast }) }));
vi.mock("./feed-service", () => ({
  fetchContentInteractionState: mocks.fetchContentInteractionState,
}));
vi.mock("../interactions/interaction-service", () => ({
  loadInteractionIdentity: mocks.loadInteractionIdentity,
  setContentLike: mocks.setContentLike,
}));

const PERSON = {
  avatarUrl: null,
  id: "me",
  isVerified: false,
  name: "Io",
  rank: 0,
  type: "person" as const,
};

const KEY = likeItemKey("media_profile", "a-1");
const trees: TestRenderer.ReactTestRenderer[] = [];

beforeEach(() => {
  likeStore.clear();
  mocks.loadInteractionIdentity.mockResolvedValue(PERSON);
});

afterEach(() => {
  trees.splice(0).forEach((tree) => act(() => tree.unmount()));
  vi.clearAllMocks();
});

async function mount(client: QueryClient, enabled = true) {
  const ref: { current: ContentInteraction | null } = { current: null };
  function Probe() {
    ref.current = useContentInteraction("media_profile", "a-1", { enabled, profileId: "me" });
    return null;
  }
  await act(async () => {
    trees.push(
      TestRenderer.create(
        <QueryClientProvider client={client}>
          <Probe />
        </QueryClientProvider>,
      ),
    );
  });
  // La query risolve in un microtask successivo al montaggio.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return ref;
}

describe("useContentInteraction", () => {
  it("legge lo stato del dettaglio dalla RPC", async () => {
    mocks.fetchContentInteractionState.mockResolvedValue({
      canLike: true,
      commentsCount: 4,
      isLiked: false,
      likedAs: [],
      likesCount: 9,
    });

    const ref = await mount(new QueryClient());

    expect(mocks.fetchContentInteractionState).toHaveBeenCalledWith("media_profile", "a-1");
    expect(ref.current).toMatchObject({
      canLike: true,
      commentsCount: 4,
      isLiked: false,
      isLoading: false,
      likesCount: 9,
    });
  });

  it("l'identità corrente decide se il Mi piace è messo: quello di un'altra identità non conta", async () => {
    mocks.fetchContentInteractionState.mockResolvedValue({
      canLike: true,
      commentsCount: 0,
      isLiked: true,
      likedAs: [{ id: "club-1", type: "society" }],
      likesCount: 9,
    });

    const ref = await mount(new QueryClient());

    expect(ref.current).toMatchObject({ isLiked: false, likesCount: 9 });
  });

  it("disabilitato non interroga e non è in caricamento", async () => {
    const ref = await mount(new QueryClient(), false);

    expect(mocks.fetchContentInteractionState).not.toHaveBeenCalled();
    expect(ref.current).toMatchObject({ canLike: false, isLoading: false, likesCount: 0 });
  });

  it("§104 il Like dal dettaglio aggiorna la stessa cella del Feed, stessa chiave", async () => {
    mocks.fetchContentInteractionState.mockResolvedValue({
      canLike: true,
      commentsCount: 0,
      isLiked: false,
      likedAs: [],
      likesCount: 9,
    });
    mocks.setContentLike.mockResolvedValue({ isLiked: true, likesCount: 10 });
    seedLikesFromItems([
      makeEditorialItem("media_profile:a-1", "article", { likesCount: 9, postId: "a-1" }),
    ]);

    const ref = await mount(new QueryClient());
    await act(async () => {
      ref.current?.toggleLike();
    });

    await vi.waitFor(() =>
      expect(mocks.setContentLike).toHaveBeenCalledWith("media_profile", "a-1", true, PERSON),
    );
    await vi.waitFor(() => expect(ref.current).toMatchObject({ isLiked: true, likesCount: 10 }));
    // La cella che il Feed legge è la stessa: nessuna pagina patchata.
    expect(likeStore.get(KEY)).toEqual({
      likedAs: [{ id: "me", type: "person" }],
      likesCount: 10,
    });
  });

  it("contenuto non leggibile: nessun toggle", async () => {
    mocks.fetchContentInteractionState.mockResolvedValue(null);

    const ref = await mount(new QueryClient());
    await act(async () => {
      ref.current?.toggleLike();
    });

    expect(mocks.setContentLike).not.toHaveBeenCalled();
  });
});
