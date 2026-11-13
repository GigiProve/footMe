import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FEED_QK } from "./feed-keys";
import { makeEditorialItem } from "./feed-post-fixtures";
import type { FeedItem, FeedPage } from "./feed-types";
import { useToggleSavedFeedItem } from "./use-feed-item-actions";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  toggleSavedContent: vi.fn(),
}));

vi.mock("../../ui", () => ({ useToast: () => ({ showToast: mocks.showToast }) }));
vi.mock("../search/media/media-search-service", () => ({
  toggleFollowSource: vi.fn(),
  toggleSavedContent: mocks.toggleSavedContent,
}));

const trees: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  trees.splice(0).forEach((tree) => act(() => tree.unmount()));
  vi.clearAllMocks();
});

function feedWith(items: FeedItem[]) {
  const page: FeedPage = { asOf: "x", isLastPage: true, items, nextCursor: null, pageIndex: 0 };
  return { pageParams: [{ cursor: null, pageIndex: 0 }], pages: [page] };
}

async function mount(client: QueryClient) {
  const ref: { current: ReturnType<typeof useToggleSavedFeedItem> | null } = { current: null };
  function Probe() {
    ref.current = useToggleSavedFeedItem({ profileId: "me", scope: "per_te" });
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
  return ref;
}

const target = { contentType: "media_profile" as const, isSaved: false, itemId: "media_profile:a-1", postId: "a-1" };

function savedIn(client: QueryClient, scope: "per_te" | "seguiti") {
  return client.getQueryData<ReturnType<typeof feedWith>>(FEED_QK.feed(scope, "me"))?.pages[0].items[0]
    .isSaved;
}

describe("useToggleSavedFeedItem — HOM-03 §95", () => {
  it("salva in entrambe le tab e invalida liste e contatori dei Salvati", async () => {
    mocks.toggleSavedContent.mockResolvedValue(undefined);
    const client = new QueryClient();
    const item = makeEditorialItem("media_profile:a-1", "article", { postId: "a-1" });
    client.setQueryData(FEED_QK.feed("per_te", "me"), feedWith([item]));
    client.setQueryData(FEED_QK.feed("seguiti", "me"), feedWith([item]));
    const invalidate = vi.spyOn(client, "invalidateQueries");

    const ref = await mount(client);
    await act(async () => {
      await ref.current?.mutateAsync(target);
    });

    expect(mocks.toggleSavedContent).toHaveBeenCalledWith("me", "media_profile", "a-1", true);
    expect(savedIn(client, "per_te")).toBe(true);
    expect(savedIn(client, "seguiti")).toBe(true);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["saved-items"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["saved-counts"] });
  });

  it("su errore torna allo stato precedente e invalida comunque", async () => {
    mocks.toggleSavedContent.mockRejectedValue(new Error("offline"));
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    client.setQueryData(
      FEED_QK.feed("per_te", "me"),
      feedWith([makeEditorialItem("media_profile:a-1", "article", { postId: "a-1" })]),
    );
    const invalidate = vi.spyOn(client, "invalidateQueries");

    const ref = await mount(client);
    await act(async () => {
      await ref.current?.mutateAsync(target).catch(() => undefined);
    });

    expect(savedIn(client, "per_te")).toBe(false);
    expect(mocks.showToast).toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["saved-items"] });
  });
});
