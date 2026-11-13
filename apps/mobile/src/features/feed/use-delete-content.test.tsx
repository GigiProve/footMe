import { createElement } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setAnalyticsSink, type AnalyticsEvent } from "../../lib/analytics";
import { buildManageTarget } from "./content-actions-presentation";
import { FEED_QK } from "./feed-keys";
import { makeEditorialItem, makePostItem } from "./feed-post-fixtures";
import type { FeedContentItem, FeedItem } from "./feed-types";
import { useDeleteContent, type DeleteContentOutcome, type DeleteContentTarget } from "./use-delete-content";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => {
  class PermissionError extends Error {}
  return {
    PermissionError,
    deleteContent: vi.fn(),
    showToast: vi.fn(),
  };
});

vi.mock("../../ui", () => ({ useToast: () => ({ showToast: mocks.showToast }) }));
vi.mock("./content-manage-service", () => ({
  deleteContent: mocks.deleteContent,
  isContentPermissionError: (error: unknown) => error instanceof mocks.PermissionError,
}));

afterEach(() => {
  setAnalyticsSink(null);
  mocks.deleteContent.mockReset();
  mocks.showToast.mockReset();
});

const ALL = { canDelete: true, canEdit: true, canViewInsights: true };

function feedData(items: FeedItem[]) {
  return {
    pageParams: [{ cursor: null, pageIndex: 0 }],
    pages: [{ asOf: "x", isLastPage: true, items, nextCursor: null, pageIndex: 0 }],
  };
}

function setup(items: FeedItem[]) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  client.setQueryData(FEED_QK.feed("per_te", "me"), feedData(items));
  client.setQueryData(FEED_QK.feed("seguiti", "me"), feedData(items));

  let run!: (target: DeleteContentTarget) => Promise<DeleteContentOutcome | null>;
  function Probe() {
    run = useDeleteContent({ profileId: "me" }).deleteContent;
    return null;
  }
  act(() => {
    TestRenderer.create(createElement(QueryClientProvider, { client }, createElement(Probe)));
  });

  return { client, run: (target: DeleteContentTarget) => run(target) };
}

const postWith = (id: string, caps = ALL) =>
  makePostItem(`club_media:${id}`, {
    capabilities: {
      canComment: true,
      canLike: true,
      canReport: true,
      canSave: true,
      canShare: true,
      ...caps,
    },
    contentType: "club_media",
    postId: id,
  });

const targetOf = (item: FeedItem) => buildManageTarget(item as FeedContentItem, "HOME_PER_TE");

const idsIn = (client: QueryClient, scope: "per_te" | "seguiti") =>
  client
    .getQueryData<ReturnType<typeof feedData>>(FEED_QK.feed(scope, "me"))
    ?.pages[0].items.map((item) => item.id);

describe("useDeleteContent", () => {
  it("successo: toglie il contenuto da entrambe le tab senza toccare gli altri e mostra «Post eliminato»", async () => {
    mocks.deleteContent.mockResolvedValue({ status: "deleted" });
    const a = postWith("a");
    const b = postWith("b");
    const { client, run } = setup([a, b]);
    const invalidate = vi.spyOn(client, "invalidateQueries");

    let outcome: DeleteContentOutcome | null = null;
    await act(async () => {
      outcome = await run(targetOf(a));
    });

    expect(outcome).toBe("removed");
    expect(mocks.deleteContent).toHaveBeenCalledWith("club_media", "a");
    expect(idsIn(client, "per_te")).toEqual(["club_media:b"]);
    expect(idsIn(client, "seguiti")).toEqual(["club_media:b"]);
    expect(mocks.showToast).toHaveBeenCalledWith({ message: "Post eliminato", tone: "success" });
    // Salvati, Profilo e Cerca si invalidano (§50–53).
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["saved-items"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["tagged-content"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["search-media-content"] });
  });

  it("il dettaglio in cache diventa «non disponibile» (null), l'interazione sparisce", async () => {
    mocks.deleteContent.mockResolvedValue({ status: "deleted" });
    const a = postWith("a");
    const { client, run } = setup([a]);
    client.setQueryData(FEED_QK.postDetail("a"), a);
    client.setQueryData(FEED_QK.interaction("club_media", "a"), { isLiked: false });

    await act(async () => {
      await run(targetOf(a));
    });

    expect(client.getQueryData(FEED_QK.postDetail("a"))).toBeNull();
    expect(client.getQueryData(FEED_QK.interaction("club_media", "a"))).toBeUndefined();
  });

  it("copy per tipo: Articolo e video editoriale", async () => {
    mocks.deleteContent.mockResolvedValue({ status: "deleted" });
    const article = makeEditorialItem("media_profile:a1", "article", { postId: "a1" });
    const video = makeEditorialItem("media_profile:v1", "video", { postId: "v1" });
    const { run } = setup([article, video]);

    await act(async () => {
      await run(targetOf(article));
      await run(targetOf(video));
    });

    expect(mocks.showToast).toHaveBeenNthCalledWith(1, { message: "Articolo eliminato", tone: "success" });
    expect(mocks.showToast).toHaveBeenNthCalledWith(2, { message: "Contenuto eliminato", tone: "success" });
  });

  it.each(["already_deleted", "unavailable"])(
    "%s: stessa conseguenza, il contenuto non c'è più (§75)",
    async (status) => {
      mocks.deleteContent.mockResolvedValue({ status });
      const a = postWith("a");
      const { client, run } = setup([a]);

      let outcome: DeleteContentOutcome | null = null;
      await act(async () => {
        outcome = await run(targetOf(a));
      });

      expect(outcome).toBe("removed");
      expect(idsIn(client, "per_te")).toEqual([]);
      expect(mocks.showToast).toHaveBeenCalledWith(
        status === "unavailable"
          ? { message: "Questo contenuto non è più disponibile." }
          : { message: "Post eliminato", tone: "success" },
      );
    },
  );

  it("doppio tap: una sola chiamata al server (§45, §145)", async () => {
    let resolve!: (value: { status: string }) => void;
    mocks.deleteContent.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const a = postWith("a");
    const { run } = setup([a]);

    const results: (DeleteContentOutcome | null)[] = [];
    await act(async () => {
      const first = run(targetOf(a));
      const second = run(targetOf(a));
      resolve({ status: "deleted" });
      results.push(await first, await second);
    });

    expect(mocks.deleteContent).toHaveBeenCalledTimes(1);
    expect(results).toEqual(["removed", null]);
  });

  it("fallimento: il contenuto resta, errore per tipo, niente rimozione (§46, §69, §144)", async () => {
    mocks.deleteContent.mockRejectedValue(new Error("network"));
    const a = postWith("a");
    const { client, run } = setup([a]);

    let outcome: DeleteContentOutcome | null = null;
    await act(async () => {
      outcome = await run(targetOf(a));
    });

    expect(outcome).toBe("failed");
    expect(idsIn(client, "per_te")).toEqual(["club_media:a"]);
    expect(mocks.showToast).toHaveBeenCalledWith({
      message: "Non è stato possibile eliminare il post. Riprova.",
    });
  });

  it("dopo un fallimento si può riprovare (la guardia si rilascia)", async () => {
    mocks.deleteContent.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce({ status: "deleted" });
    const a = postWith("a");
    const { run } = setup([a]);

    await act(async () => {
      await run(targetOf(a));
      await run(targetOf(a));
    });

    expect(mocks.deleteContent).toHaveBeenCalledTimes(2);
  });

  it("permesso revocato: messaggio e capability a falso subito, contenuto che resta (§70–72, §146)", async () => {
    mocks.deleteContent.mockRejectedValue(new mocks.PermissionError());
    const a = postWith("a");
    const { client, run } = setup([a]);

    let outcome: DeleteContentOutcome | null = null;
    await act(async () => {
      outcome = await run(targetOf(a));
    });

    expect(outcome).toBe("permission_denied");
    expect(mocks.showToast).toHaveBeenCalledWith({
      message: "Non hai più i permessi per eseguire questa operazione.",
    });
    for (const scope of ["per_te", "seguiti"] as const) {
      const [item] = client.getQueryData<ReturnType<typeof feedData>>(FEED_QK.feed(scope, "me"))!.pages[0].items;
      expect(item.type === "post" ? item.payload.capabilities : null).toMatchObject({
        canDelete: false,
        canEdit: false,
        canViewInsights: false,
        // Le altre capability non si toccano.
        canLike: true,
        canSave: true,
      });
    }
  });

  it("analytics: delete_confirmed + delete_success, solo id, tipo, identità e origine (§134–135)", async () => {
    const events: AnalyticsEvent[] = [];
    setAnalyticsSink((event) => events.push(event));
    mocks.deleteContent.mockResolvedValue({ status: "deleted" });
    const a = postWith("a");
    const { run } = setup([a]);

    await act(async () => {
      await run(targetOf(a));
    });

    expect(events.map((event) => event.name)).toEqual(["delete_confirmed", "delete_success"]);
    expect(events[0].props).toEqual({
      authorIdentityType: "society",
      contentId: "a",
      contentType: "club_media",
      origin: "HOME_PER_TE",
    });
  });

  it("analytics: delete_failed su errore", async () => {
    const events: AnalyticsEvent[] = [];
    setAnalyticsSink((event) => events.push(event));
    mocks.deleteContent.mockRejectedValue(new Error("x"));
    const a = postWith("a");
    const { run } = setup([a]);

    await act(async () => {
      await run(targetOf(a));
    });

    expect(events.map((event) => event.name)).toEqual(["delete_confirmed", "delete_failed"]);
  });
});
