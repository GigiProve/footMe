import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider, type InfiniteData } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FEED_QK } from "./feed-keys";
import { makeFeedMedia, makePostItem } from "./feed-post-fixtures";
import type { FeedItem, FeedPage, FeedPageParam } from "./feed-types";
import { useFeedMediaProcessing } from "./use-feed-media-processing";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ fetchContentMediaStates: vi.fn() }));

vi.mock("./feed-service", () => ({
  CONTENT_MEDIA_STATES_LIMIT: 20,
  fetchContentMediaStates: mocks.fetchContentMediaStates,
}));

const trees: TestRenderer.ReactTestRenderer[] = [];

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  trees.splice(0).forEach((tree) => act(() => tree.unmount()));
  vi.useRealTimers();
  vi.clearAllMocks();
});

type FeedData = InfiniteData<FeedPage, FeedPageParam>;

function feedWith(items: FeedItem[]): FeedData {
  return {
    pageParams: [{ cursor: null, pageIndex: 0 }],
    pages: [{ asOf: "x", isLastPage: true, items, nextCursor: null, pageIndex: 0 }],
  };
}

function mount(client: QueryClient, enabled: boolean) {
  const ref: { current: ReturnType<typeof useFeedMediaProcessing> | null } = { current: null };
  function Pane({ active }: { active: boolean }) {
    ref.current = useFeedMediaProcessing({ enabled: active, profileId: "me" });
    return null;
  }
  let tree: TestRenderer.ReactTestRenderer | null = null;
  act(() => {
    tree = TestRenderer.create(
      <QueryClientProvider client={client}>
        <Pane active={enabled} />
      </QueryClientProvider>,
    );
  });
  trees.push(tree!);
  const rerender = (active: boolean) =>
    act(() =>
      tree!.update(
        <QueryClientProvider client={client}>
          <Pane active={active} />
        </QueryClientProvider>,
      ),
    );
  return { ref, rerender };
}

describe("useFeedMediaProcessing", () => {
  it("§65 il video pronto patcha la cache senza refetch del Feed", async () => {
    const client = new QueryClient();
    const post = makePostItem("club_media:p-1", {
      media: [makeFeedMedia({ processingState: "processing" })],
      postId: "p-1",
    });
    client.setQueryData(FEED_QK.feed("per_te", "me"), feedWith([post]));
    mocks.fetchContentMediaStates.mockResolvedValue([
      { contentType: "club_media", media: [makeFeedMedia({ processingState: "ready" })], postId: "p-1" },
    ]);
    const invalidate = vi.spyOn(client, "invalidateQueries");

    const { ref } = mount(client, true);
    act(() => ref.current?.reportVisibleItems([post]));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(mocks.fetchContentMediaStates).toHaveBeenCalledWith([
      { contentType: "club_media", itemId: "club_media:p-1", postId: "p-1" },
    ]);
    const item = client.getQueryData<FeedData>(FEED_QK.feed("per_te", "me"))?.pages[0].items[0];
    expect(item?.type === "post" ? item.payload.media[0].processingState : null).toBe("ready");
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("una tab non attiva non interroga finché non torna attiva", async () => {
    const client = new QueryClient();
    const post = makePostItem("club_media:p-1", {
      media: [makeFeedMedia({ processingState: "uploaded" })],
      postId: "p-1",
    });
    mocks.fetchContentMediaStates.mockResolvedValue([]);

    const { ref, rerender } = mount(client, false);
    act(() => ref.current?.reportVisibleItems([post]));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(mocks.fetchContentMediaStates).not.toHaveBeenCalled();

    rerender(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(mocks.fetchContentMediaStates).toHaveBeenCalledTimes(1);
  });

  it("reportVisibleItems ha identità stabile tra i render", () => {
    const { ref, rerender } = mount(new QueryClient(), true);
    const first = ref.current?.reportVisibleItems;

    rerender(false);

    expect(ref.current?.reportVisibleItems).toBe(first);
  });
});
