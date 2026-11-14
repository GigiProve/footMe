/**
 * «↑ Nuovi commenti»: il watermark è l'`as_of` del SERVER, la pill non inserisce niente
 * e torna da sola a una nuova lettura (HOM-08 §141–§145, §311).
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { likeItemKey } from "../interactions/like-store";
import { commentCountStore } from "./comment-count-store";
import { loadCommentUpdates, useCommentUpdates } from "./use-comment-updates";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ fetchCommentUpdates: vi.fn() }));

vi.mock("expo-router", async () => {
  const react = await import("react");
  return { useFocusEffect: (callback: () => void) => react.useEffect(callback, [callback]) };
});
vi.mock("../../lib/supabase", () => ({ supabase: { rpc: vi.fn() } }));
vi.mock("./comment-service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./comment-service")>()),
  fetchCommentUpdates: mocks.fetchCommentUpdates,
}));

const KEY = likeItemKey("profile_post", "post-1");
const WATERMARK = "2026-11-14T10:00:00.123456+00:00";

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/*
  Focus → query abilitata → risposta → render. TanStack Query consegna i risultati
  con il proprio notifyManager su un task del loop: servono più `act` distinti, non
  più attese dentro lo stesso `act` (stesso schema di teams-screens.test.tsx).
*/
async function settle() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await act(async () => {
      await flush();
    });
  }
}

type Props = { watermark: string | null; enabled?: boolean };
type Updates = ReturnType<typeof useCommentUpdates>;
const probe = { current: null as unknown as Updates };

function record(value: Updates) {
  probe.current = value;
}

function Harness({ watermark, enabled = true, onResult }: Props & { onResult: (value: Updates) => void }) {
  onResult(
    useCommentUpdates({
      contentId: "post-1",
      contentType: "profile_post",
      enabled,
      viewerId: "viewer-1",
      watermark,
    }),
  );
  return null;
}

async function mount(props: Props) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree!: TestRenderer.ReactTestRenderer;
  const wrap = (next: Props) => (
    <QueryClientProvider client={client}>
      <Harness {...next} onResult={record} />
    </QueryClientProvider>
  );

  await act(async () => {
    tree = TestRenderer.create(wrap(props));
  });
  await settle();

  return {
    rerender: async (next: Props) => {
      await act(async () => {
        tree.update(wrap(next));
      });
      await settle();
    },
    unmount: () => act(() => tree.unmount()),
  };
}

beforeEach(() => {
  mocks.fetchCommentUpdates.mockReset();
  commentCountStore.clear();
  commentCountStore.seed(KEY, 18, 1);
});

describe("useCommentUpdates — watermark del server (§141–§145)", () => {
  it("interroga con l'as_of del server così com'è, senza passare dall'orologio locale", async () => {
    mocks.fetchCommentUpdates.mockResolvedValue({ commentsCount: 20, newCount: 2 });

    const view = await mount({ watermark: WATERMARK });

    expect(mocks.fetchCommentUpdates).toHaveBeenCalledWith("profile_post", "post-1", WATERMARK);
    view.unmount();
  });

  it("senza watermark (lista non ancora caricata) o disabilitato non interroga", async () => {
    mocks.fetchCommentUpdates.mockResolvedValue({ commentsCount: 20, newCount: 2 });

    const without = await mount({ watermark: null });
    without.unmount();
    const disabled = await mount({ enabled: false, watermark: WATERMARK });
    disabled.unmount();

    expect(mocks.fetchCommentUpdates).not.toHaveBeenCalled();
  });
});

describe("useCommentUpdates — la pill (§143–§145)", () => {
  it("compare con N nuovi commenti e si può chiudere", async () => {
    mocks.fetchCommentUpdates.mockResolvedValue({ commentsCount: 20, newCount: 2 });
    const view = await mount({ watermark: WATERMARK });

    expect(probe.current.count).toBe(2);
    expect(probe.current.isVisible).toBe(true);

    await act(async () => {
      probe.current.dismiss();
      await flush();
    });

    expect(probe.current.isVisible).toBe(false);
    view.unmount();
  });

  it("nessun nuovo commento: nessuna pill", async () => {
    mocks.fetchCommentUpdates.mockResolvedValue({ commentsCount: 18, newCount: 0 });
    const view = await mount({ watermark: WATERMARK });

    expect(probe.current.isVisible).toBe(false);
    view.unmount();
  });

  it("dopo una nuova lettura della lista (nuovo watermark) la pill chiusa torna disponibile", async () => {
    mocks.fetchCommentUpdates.mockResolvedValue({ commentsCount: 20, newCount: 2 });
    const view = await mount({ watermark: WATERMARK });
    await act(async () => {
      probe.current.dismiss();
      await flush();
    });
    expect(probe.current.isVisible).toBe(false);

    await view.rerender({ watermark: "2026-11-14T10:10:00+00:00" });

    expect(mocks.fetchCommentUpdates).toHaveBeenLastCalledWith(
      "profile_post",
      "post-1",
      "2026-11-14T10:10:00+00:00",
    );
    expect(probe.current.isVisible).toBe(true);
    view.unmount();
  });

  it("un errore è silenzioso: nessuna pill", async () => {
    mocks.fetchCommentUpdates.mockRejectedValue(new Error("offline"));
    const view = await mount({ watermark: WATERMARK });

    expect(probe.current.isVisible).toBe(false);
    view.unmount();
  });
});

describe("loadCommentUpdates — conteggio condiviso (§214)", () => {
  it("semina la cella con l'istante di partenza: non cancella un dato più nuovo", async () => {
    mocks.fetchCommentUpdates.mockResolvedValue({ commentsCount: 25, newCount: 1 });
    commentCountStore.apply(KEY, 19, Date.now() + 60_000);

    await loadCommentUpdates("profile_post", "post-1", WATERMARK);

    expect(commentCountStore.get(KEY)).toBe(19);
  });

  it("aggiorna la cella se il dato è più recente", async () => {
    mocks.fetchCommentUpdates.mockResolvedValue({ commentsCount: 25, newCount: 1 });

    await loadCommentUpdates("profile_post", "post-1", WATERMARK);

    expect(commentCountStore.get(KEY)).toBe(25);
  });

  it("un cambio account a richiesta in volo non semina il conteggio dell'utente di prima", async () => {
    let resolve!: (value: unknown) => void;
    mocks.fetchCommentUpdates.mockReturnValue(new Promise((res) => (resolve = res)));

    const pending = loadCommentUpdates("profile_post", "post-1", WATERMARK);
    commentCountStore.clear();
    resolve({ commentsCount: 25, newCount: 1 });
    await pending;

    expect(commentCountStore.get(KEY)).toBeUndefined();
  });
});
