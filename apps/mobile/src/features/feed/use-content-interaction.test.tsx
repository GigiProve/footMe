import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FEED_QK } from "./feed-keys";
import { makeEditorialItem } from "./feed-post-fixtures";
import type { FeedItem, FeedPage } from "./feed-types";
import { useContentInteraction, type ContentInteraction } from "./use-content-interaction";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  fetchContentInteractionState: vi.fn(),
  setPostLike: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("../../ui", () => ({ useToast: () => ({ showToast: mocks.showToast }) }));
vi.mock("./feed-service", () => ({
  fetchContentInteractionState: mocks.fetchContentInteractionState,
  setPostLike: mocks.setPostLike,
}));

const trees: TestRenderer.ReactTestRenderer[] = [];

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

function feedWith(items: FeedItem[]) {
  const page: FeedPage = { asOf: "x", isLastPage: true, items, nextCursor: null, pageIndex: 0 };
  return { pageParams: [{ cursor: null, pageIndex: 0 }], pages: [page] };
}

describe("useContentInteraction", () => {
  it("legge lo stato del dettaglio dalla RPC", async () => {
    mocks.fetchContentInteractionState.mockResolvedValue({
      canLike: true,
      commentsCount: 4,
      isLiked: false,
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

  it("disabilitato non interroga e non è in caricamento", async () => {
    const ref = await mount(new QueryClient(), false);

    expect(mocks.fetchContentInteractionState).not.toHaveBeenCalled();
    expect(ref.current).toMatchObject({ canLike: false, isLoading: false, likesCount: 0 });
  });

  it("§104 il Like dal dettaglio aggiorna anche il Feed, stessa chiave", async () => {
    mocks.fetchContentInteractionState.mockResolvedValue({
      canLike: true,
      commentsCount: 0,
      isLiked: false,
      likesCount: 9,
    });
    mocks.setPostLike.mockResolvedValue({ isLiked: true, likesCount: 10 });
    const client = new QueryClient();
    client.setQueryData(
      FEED_QK.feed("seguiti", "me"),
      feedWith([makeEditorialItem("media_profile:a-1", "article", { likesCount: 9, postId: "a-1" })]),
    );

    const ref = await mount(client);
    await act(async () => {
      ref.current?.toggleLike();
    });

    expect(mocks.setPostLike).toHaveBeenCalledWith("media_profile", "a-1", true);
    expect(ref.current).toMatchObject({ isLiked: true, likesCount: 10 });
    const feed = client.getQueryData<ReturnType<typeof feedWith>>(FEED_QK.feed("seguiti", "me"));
    const item = feed?.pages[0].items[0];
    expect(item?.type === "article" ? item.payload : null).toMatchObject({ isLiked: true, likesCount: 10 });
  });

  it("contenuto non leggibile: nessun toggle", async () => {
    mocks.fetchContentInteractionState.mockResolvedValue(null);

    const ref = await mount(new QueryClient());
    await act(async () => {
      ref.current?.toggleLike();
    });

    expect(mocks.setPostLike).not.toHaveBeenCalled();
  });
});
