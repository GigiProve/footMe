import { createElement } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PostOrEditorialDetail } from "./PostOrEditorialDetail";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ fetchPostDetail: vi.fn() }));

vi.mock("../feed-service", () => ({ fetchPostDetail: mocks.fetchPostDetail }));
vi.mock("./ProfilePostDetail", () => ({
  ProfilePostDetail: (props: Record<string, unknown>) => createElement("mock-post-detail", props),
}));
vi.mock("./ContentUnavailableState", () => ({
  ContentLoadErrorState: (props: Record<string, unknown>) =>
    createElement("mock-load-error", props),
}));
vi.mock("./detail/ContentDetailFrame", () => ({
  ContentDetailFrame: ({ children }: { children: unknown }) =>
    createElement("mock-frame", null, children as never),
}));

const trees: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  trees.splice(0).forEach((tree) => act(() => tree.unmount()));
  vi.clearAllMocks();
});

beforeEach(() => {
  mocks.fetchPostDetail.mockReset();
});

async function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const editorial = vi.fn(() => createElement("mock-editorial"));
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(
      <QueryClientProvider client={client}>
        <PostOrEditorialDetail
          contentType="club_media"
          focus="comments"
          initialMediaIndex={null}
          origin="PROFILE"
          postId="p-1"
          renderEditorial={editorial}
        />
      </QueryClientProvider>,
    );
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  trees.push(tree);
  return { editorial, tree };
}

describe("PostOrEditorialDetail (HOM-08 §8, §11)", () => {
  it("un Post apre il dettaglio «← Post» con tipo, focus e provenienza", async () => {
    mocks.fetchPostDetail.mockResolvedValue({ id: "club_media:p-1" });

    const { editorial, tree } = await mount();

    expect(mocks.fetchPostDetail).toHaveBeenCalledWith("club_media", "p-1");
    const post = tree.root.findByType("mock-post-detail" as never);
    expect(post.props).toMatchObject({
      contentType: "club_media",
      focus: "comments",
      origin: "PROFILE",
      postId: "p-1",
    });
    expect(editorial).not.toHaveBeenCalled();
  });

  it("null (Articolo, video o non leggibile) apre il dettaglio editoriale", async () => {
    mocks.fetchPostDetail.mockResolvedValue(null);

    const { editorial, tree } = await mount();

    expect(editorial).toHaveBeenCalled();
    expect(tree.root.findAllByType("mock-editorial" as never)).toHaveLength(1);
    expect(tree.root.findAllByType("mock-post-detail" as never)).toHaveLength(0);
  });

  it("un errore della sonda mostra l'errore con «Riprova», che riesegue la sonda", async () => {
    mocks.fetchPostDetail.mockRejectedValueOnce(new Error("rete"));

    const { editorial, tree } = await mount();

    // Non è «non è un Post»: né il dettaglio Post né quello editoriale.
    expect(tree.root.findAllByType("mock-post-detail" as never)).toHaveLength(0);
    expect(editorial).not.toHaveBeenCalled();
    const error = tree.root.findByType("mock-load-error" as never);

    mocks.fetchPostDetail.mockResolvedValue(null);
    await act(async () => {
      (error.props.onRetry as () => void)();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mocks.fetchPostDetail).toHaveBeenCalledTimes(2);
    expect(editorial).toHaveBeenCalled();
  });
});
