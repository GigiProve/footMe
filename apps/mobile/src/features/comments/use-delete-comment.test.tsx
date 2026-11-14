/**
 * Eliminazione di un proprio commento o risposta: conferma, esito del server
 * (`removed` / `tombstoned`), conteggi e segnaposto (HOM-08 §160–§170, §213, §302–§303).
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { likeItemKey } from "../interactions/like-store";
import { commentCountStore } from "./comment-count-store";
import { COMMENT_DELETE_ERROR, COMMENT_TARGET_UNAVAILABLE } from "./comment-labels";
import { commentStore } from "./comment-store";
import type { Comment } from "./comment-types";
import { useDeleteComment } from "./use-delete-comment";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ deleteComment: vi.fn() }));

vi.mock("../../lib/supabase", () => ({ supabase: { rpc: vi.fn() } }));
vi.mock("./comment-service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./comment-service")>()),
  deleteComment: mocks.deleteComment,
}));

const KEY = likeItemKey("profile_post", "post-1");

function comment(overrides: Partial<Comment> = {}): Comment {
  return {
    author: {
      avatarUrl: null,
      clubCategory: null,
      clubName: null,
      identityId: "p-1",
      identityType: "person",
      isVerified: false,
      mediaKind: null,
      name: "Matteo Rossi",
      primaryPosition: null,
      role: null,
      teamLabel: null,
    },
    body: "Ottimo progetto.",
    capabilities: { canDelete: true, canEdit: true, canLike: true, canOpenAuthor: true, canReply: true },
    contentId: "post-1",
    contentType: "profile_post",
    createdAt: "2026-11-14T10:00:00.000Z",
    editedAt: null,
    id: "c-1",
    isContentAuthor: false,
    likedAs: [],
    likesCount: 0,
    links: [],
    mentions: [],
    operationKey: null,
    repliesCount: 0,
    replyTo: null,
    replyToCommentId: null,
    rootCommentId: "c-1",
    status: "active",
    updatedAt: "2026-11-14T10:00:00.000Z",
    version: 1,
    ...overrides,
  };
}

function setup() {
  const onMessage = vi.fn();
  let api!: ReturnType<typeof useDeleteComment>;

  function Harness() {
    api = useDeleteComment({ contentId: "post-1", contentKey: KEY, contentType: "profile_post", onMessage });
    return null;
  }

  act(() => {
    TestRenderer.create(<Harness />);
  });

  return { api: () => api, onMessage };
}

beforeEach(() => {
  mocks.deleteComment.mockReset();
  commentStore.clear();
  commentCountStore.clear();
  commentCountStore.seed(KEY, 18, 1);
  commentStore.seed([comment()], 1);
});

describe("useDeleteComment — conferma (§160–§162)", () => {
  it("«Elimina» dal menu apre la conferma, non elimina", () => {
    const { api } = setup();

    act(() => api().request(comment()));

    expect(api().target).toMatchObject({ id: "c-1" });
    expect(mocks.deleteComment).not.toHaveBeenCalled();
  });

  it("«Annulla» chiude senza chiamare il server", () => {
    const { api } = setup();
    act(() => api().request(comment()));

    act(() => api().cancel());

    expect(api().target).toBeNull();
    expect(mocks.deleteComment).not.toHaveBeenCalled();
  });
});

describe("useDeleteComment — esito del server (§163–§170)", () => {
  it("senza risposte: la riga sparisce e il conteggio è quello del server (§163, §213)", async () => {
    mocks.deleteComment.mockResolvedValueOnce({
      commentId: "c-1",
      commentsCount: 17,
      outcome: "removed",
      rootCommentId: "c-1",
      rootRepliesCount: 0,
    });
    const { api } = setup();
    act(() => api().request(comment()));

    await act(async () => {
      await api().confirm();
    });

    expect(commentStore.isRemoved("c-1")).toBe(true);
    expect(commentCountStore.get(KEY)).toBe(17);
    expect(api().target).toBeNull();
    expect(api().isBusy).toBe(false);
  });

  it("con risposte: «Commento eliminato», le risposte restano, il segnaposto non si conta (§164–§168, §302)", async () => {
    commentStore.seed([comment({ repliesCount: 2 })], 2);
    mocks.deleteComment.mockResolvedValueOnce({
      commentId: "c-1",
      commentsCount: 19,
      outcome: "tombstoned",
      rootCommentId: "c-1",
      rootRepliesCount: 2,
    });
    const { api } = setup();
    act(() => api().request(comment({ repliesCount: 2 })));

    await act(async () => {
      await api().confirm();
    });

    expect(commentStore.get("c-1")).toMatchObject({ author: null, body: "", repliesCount: 2, status: "deleted" });
    expect(commentStore.isRemoved("c-1")).toBe(false);
    expect(commentCountStore.get(KEY)).toBe(19);
  });

  it("una risposta: sparisce la sola risposta, conteggi del root e globale aggiornati (§169–§170, §303)", async () => {
    commentStore.seed([comment({ repliesCount: 3 })], 2);
    commentStore.seed([comment({ id: "c-2", replyToCommentId: "c-1", rootCommentId: "c-1" })], 2);
    mocks.deleteComment.mockResolvedValueOnce({
      commentId: "c-2",
      commentsCount: 17,
      outcome: "removed",
      rootCommentId: "c-1",
      rootRepliesCount: 2,
    });
    const { api } = setup();
    act(() => api().request(comment({ id: "c-2", replyToCommentId: "c-1", rootCommentId: "c-1" })));

    await act(async () => {
      await api().confirm();
    });

    expect(commentStore.isRemoved("c-2")).toBe(true);
    expect(commentStore.isRemoved("c-1")).toBe(false);
    expect(commentStore.get("c-1")?.repliesCount).toBe(2);
    expect(commentCountStore.get(KEY)).toBe(17);
  });

  it("l'ultima risposta di un root già «eliminato» toglie anche il segnaposto", async () => {
    commentStore.tombstone("c-1", 5);
    commentStore.seed([comment({ id: "c-2", replyToCommentId: "c-1", rootCommentId: "c-1" })], 2);
    mocks.deleteComment.mockResolvedValueOnce({
      commentId: "c-2",
      commentsCount: 16,
      outcome: "removed",
      rootCommentId: "c-1",
      rootRepliesCount: 0,
    });
    const { api } = setup();
    act(() => api().request(comment({ id: "c-2", replyToCommentId: "c-1", rootCommentId: "c-1" })));

    await act(async () => {
      await api().confirm();
    });

    expect(commentStore.isRemoved("c-2")).toBe(true);
    expect(commentStore.isRemoved("c-1")).toBe(true);
  });
});

describe("useDeleteComment — errori", () => {
  it("un guasto: messaggio leggero, il commento resta", async () => {
    mocks.deleteComment.mockRejectedValueOnce(new Error("Network request failed"));
    const { api, onMessage } = setup();
    act(() => api().request(comment()));

    await act(async () => {
      await api().confirm();
    });

    expect(onMessage).toHaveBeenCalledWith(COMMENT_DELETE_ERROR);
    expect(commentStore.isRemoved("c-1")).toBe(false);
    expect(commentStore.get("c-1")?.status).toBe("active");
    expect(api().target).toBeNull();
  });

  it("già eliminato altrove: la riga esce con il messaggio dedicato", async () => {
    mocks.deleteComment.mockRejectedValueOnce(new Error("comment_unavailable"));
    const { api, onMessage } = setup();
    act(() => api().request(comment()));

    await act(async () => {
      await api().confirm();
    });

    expect(onMessage).toHaveBeenCalledWith(COMMENT_TARGET_UNAVAILABLE);
    expect(commentStore.isRemoved("c-1")).toBe(true);
  });

  it("un secondo «Elimina» mentre il server risponde non produce una seconda richiesta", async () => {
    let resolve!: (value: unknown) => void;
    mocks.deleteComment.mockReturnValueOnce(new Promise((res) => (resolve = res)));
    const { api } = setup();
    act(() => api().request(comment()));

    await act(async () => {
      void api().confirm();
    });
    expect(api().isBusy).toBe(true);
    await act(async () => {
      await api().confirm();
    });

    expect(mocks.deleteComment).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolve({ commentId: "c-1", commentsCount: 17, outcome: "removed", rootCommentId: "c-1", rootRepliesCount: 0 });
    });
    expect(api().isBusy).toBe(false);
  });

  it("«Annulla» non chiude il dialogo mentre il server risponde", async () => {
    mocks.deleteComment.mockReturnValueOnce(new Promise(() => undefined));
    const { api } = setup();
    act(() => api().request(comment()));
    await act(async () => {
      void api().confirm();
    });

    act(() => api().cancel());

    expect(api().target).not.toBeNull();
  });
});
