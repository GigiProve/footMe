/**
 * Pubblicazione di un commento: ottimistico, riconciliazione, rollback del conteggio,
 * Riprova con la stessa chiave, errori definitivi che restituiscono il testo al
 * composer (HOM-08 §42–§46, §92–§101, §189–§194, §211–§212, §223).
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { likeItemKey } from "../interactions/like-store";
import { commentCountStore } from "./comment-count-store";
import { createCommentDraftStore } from "./comment-draft-store";
import { COMMENT_PERMISSION_LOST, COMMENT_TARGET_UNAVAILABLE } from "./comment-labels";
import { commentStore } from "./comment-store";
import type { Comment, CommentContext, CommentIdentity } from "./comment-types";
import { usePublishComment, type PublishCommentDeps } from "./use-publish-comment";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ createComment: vi.fn() }));

vi.mock("../../lib/supabase", () => ({ supabase: { rpc: vi.fn() } }));
vi.mock("./comment-service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./comment-service")>()),
  createComment: mocks.createComment,
}));

const KEY = likeItemKey("profile_post", "post-1");

const PERSON: CommentIdentity = {
  avatarUrl: null,
  canComment: true,
  clubCategory: null,
  clubName: "AC Como",
  mediaKind: null,
  primaryPosition: "striker",
  teamLabel: null,
  id: "p-1",
  isVerified: false,
  name: "Matteo Rossi",
  rank: 0,
  role: "player",
  type: "person",
};

const CONTEXT: CommentContext = {
  asOf: "2026-11-14T10:00:00.000Z",
  commentsCount: 18,
  commentsEnabled: true,
  commentsVisible: true,
  contentAuthor: null,
  identities: [PERSON],
  limits: { maxBodyLength: 1000, maxLinks: 10, maxMentions: 20 },
};

function serverComment(overrides: Partial<Comment> = {}): Comment {
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
    createdAt: new Date().toISOString(),
    editedAt: null,
    id: "c-77",
    isContentAuthor: false,
    likedAs: [],
    likesCount: 0,
    links: [],
    mentions: [],
    operationKey: null,
    repliesCount: 0,
    replyTo: null,
    replyToCommentId: null,
    rootCommentId: "c-77",
    status: "active",
    updatedAt: new Date().toISOString(),
    version: 1,
    ...overrides,
  };
}

/** Lascia girare le promesse già risolte (la risposta del servizio simulato). */
function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, reject, resolve };
}

function setup() {
  const draftStore = createCommentDraftStore();
  const deps: PublishCommentDeps = {
    contentId: "post-1",
    contentKey: KEY,
    contentType: "profile_post",
    draftStore,
    getContext: () => CONTEXT,
    onContentUnavailable: vi.fn(),
    onNotice: vi.fn(),
    onPermissionLost: vi.fn(),
  };
  let api!: ReturnType<typeof usePublishComment>;

  function Harness() {
    api = usePublishComment(deps);
    return null;
  }

  act(() => {
    TestRenderer.create(<Harness />);
  });

  return { api: () => api, deps, draftStore };
}

beforeEach(() => {
  mocks.createComment.mockReset();
  commentStore.clear();
  commentCountStore.clear();
  commentCountStore.seed(KEY, 18, 1);
});

describe("usePublishComment — ottimistico e riconciliazione (§92–§94)", () => {
  it("il commento compare subito, il conteggio sale; a successo l'id e il conteggio sono quelli del server", async () => {
    const pending = deferred<{ comment: Comment; commentsCount: number; rootRepliesCount: number }>();
    mocks.createComment.mockReturnValueOnce(pending.promise);
    const { api, draftStore } = setup();
    draftStore.set({ active: true, body: "Ottimo progetto." });
    const key = draftStore.getState().operationKey;

    act(() => {
      api().publish();
    });

    // prima della risposta: elemento ottimistico, +1, composer svuotato e richiuso
    expect(commentStore.ownRoots(KEY).map((ref) => ref.id)).toEqual([`tmp:${key}`]);
    expect(commentStore.get(`tmp:${key}`)?.send?.state).toBe("sending");
    // La riga meta ottimistica ha gli stessi campi dell'identità del server: non «salta» alla riconciliazione.
    expect(commentStore.get(`tmp:${key}`)?.author).toMatchObject({
      clubName: "AC Como",
      primaryPosition: "striker",
      role: "player",
    });
    expect(commentCountStore.get(KEY)).toBe(19);
    expect(draftStore.getState()).toMatchObject({ active: false, body: "" });
    expect(draftStore.getState().operationKey).not.toBe(key);

    await act(async () => {
      pending.resolve({ comment: serverComment({ operationKey: key }), commentsCount: 20, rootRepliesCount: 0 });
      await pending.promise;
    });

    expect(commentStore.ownRoots(KEY).map((ref) => ref.id)).toEqual(["c-77"]);
    expect(commentStore.ownRoots(KEY)[0].key).toBe(`tmp:${key}`);
    expect(commentStore.get("c-77")?.send).toBeNull();
    expect(commentCountStore.get(KEY)).toBe(20);
    expect(mocks.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        body: "Ottimo progetto.",
        contentId: "post-1",
        identity: { id: "p-1", type: "person" },
        operationKey: key,
        replyToCommentId: null,
      }),
    );
  });

  it("§24: con il testo vuoto non parte nulla", async () => {
    const { api, draftStore } = setup();
    draftStore.set({ active: true, body: "   " });

    await act(async () => {
      api().publish();
    });

    expect(mocks.createComment).not.toHaveBeenCalled();
    expect(commentStore.ownRoots(KEY)).toEqual([]);
  });

  it("§95: un secondo Pubblica prima della risposta non produce un secondo invio", async () => {
    mocks.createComment.mockReturnValue(deferred<never>().promise);
    const { api, draftStore } = setup();
    draftStore.set({ active: true, body: "Ottimo progetto." });

    await act(async () => {
      api().publish();
      api().publish();
    });

    expect(mocks.createComment).toHaveBeenCalledTimes(1);
    expect(commentStore.ownRoots(KEY)).toHaveLength(1);
  });

  it("una risposta porta il root e il target preciso, e alza le risposte del root (§49, §88)", async () => {
    commentStore.seed([serverComment({ id: "c-1", repliesCount: 3, rootCommentId: "c-1" })], 5);
    mocks.createComment.mockResolvedValueOnce({
      comment: serverComment({ id: "c-90", replyToCommentId: "c-2", rootCommentId: "c-1" }),
      commentsCount: 19,
      rootRepliesCount: 4,
    });
    const { api, draftStore } = setup();
    draftStore.set({
      active: true,
      body: "@Luca Ferri concordo",
      replyTo: { commentId: "c-2", identityId: "p-3", identityType: "person", name: "Luca Ferri", rootCommentId: "c-1" },
    });

    await act(async () => {
      api().publish();
      await flush();
    });

    expect(mocks.createComment).toHaveBeenCalledWith(expect.objectContaining({ replyToCommentId: "c-2" }));
    expect(commentStore.ownReplies("c-1").map((ref) => ref.id)).toEqual(["c-90"]);
    expect(commentStore.get("c-1")?.repliesCount).toBe(4);
    expect(commentStore.isExpanded("c-1")).toBe(true);
    expect(commentCountStore.get(KEY)).toBe(19);
  });
});

describe("usePublishComment — errore di rete (§97–§101)", () => {
  it("l'elemento resta «fallito», il conteggio ottimistico si ritira, Riprova usa la STESSA chiave", async () => {
    mocks.createComment.mockRejectedValueOnce(new Error("Network request failed"));
    const { api, draftStore } = setup();
    draftStore.set({ active: true, body: "Ottimo progetto." });
    const key = draftStore.getState().operationKey;

    await act(async () => {
      api().publish();
      await flush();
    });

    expect(commentStore.get(`tmp:${key}`)?.send).toMatchObject({ failure: "network", state: "failed" });
    expect(commentStore.get(`tmp:${key}`)?.body).toBe("Ottimo progetto.");
    expect(commentCountStore.get(KEY)).toBe(18);

    mocks.createComment.mockResolvedValueOnce({
      comment: serverComment({ operationKey: key }),
      commentsCount: 19,
      rootRepliesCount: 0,
    });
    await act(async () => {
      api().retry(`tmp:${key}`);
      await flush();
    });

    expect(mocks.createComment).toHaveBeenCalledTimes(2);
    expect(mocks.createComment.mock.calls[1][0].operationKey).toBe(key);
    expect(commentStore.ownRoots(KEY).map((ref) => ref.id)).toEqual(["c-77"]);
    expect(commentCountStore.get(KEY)).toBe(19);
  });

  it("§101: il testo fallito si riapre nel composer per correggerlo, con la sua chiave", async () => {
    mocks.createComment.mockRejectedValueOnce(new Error("Network request failed"));
    const { api, draftStore } = setup();
    draftStore.set({ active: true, body: "Ottimo progetto." });
    const key = draftStore.getState().operationKey;

    await act(async () => {
      api().publish();
      await flush();
    });
    act(() => {
      api().reopen(`tmp:${key}`);
    });

    expect(commentStore.ownRoots(KEY)).toEqual([]);
    expect(draftStore.getState()).toMatchObject({ active: true, body: "Ottimo progetto.", operationKey: key });
  });
});

describe("usePublishComment — errori definitivi: il testo torna nel composer (§43–§44, §193–§194)", () => {
  it("permesso perso: l'elemento esce, il testo e l'identità tornano, si rilegge il contesto", async () => {
    mocks.createComment.mockRejectedValueOnce({ message: "comment_identity_forbidden" });
    const { api, deps, draftStore } = setup();
    draftStore.set({ active: true, body: "Ottimo progetto." });

    await act(async () => {
      api().publish();
      await flush();
    });

    expect(commentStore.ownRoots(KEY)).toEqual([]);
    expect(draftStore.getState()).toMatchObject({
      active: true,
      body: "Ottimo progetto.",
      notice: COMMENT_PERMISSION_LOST,
    });
    expect(draftStore.getState().identity).toMatchObject({ id: "p-1", type: "person" });
    expect(deps.onPermissionLost).toHaveBeenCalledTimes(1);
    expect(commentCountStore.get(KEY)).toBe(18);
  });

  it("risposta a un commento sparito: testo preservato, il target si toglie, messaggio dedicato", async () => {
    mocks.createComment.mockRejectedValueOnce({ message: "comment_target_unavailable" });
    const { api, draftStore } = setup();
    draftStore.set({
      active: true,
      body: "@Luca Ferri concordo",
      replyTo: { commentId: "c-2", identityId: "p-3", identityType: "person", name: "Luca Ferri", rootCommentId: "c-1" },
    });

    await act(async () => {
      api().publish();
      await flush();
    });

    expect(draftStore.getState()).toMatchObject({
      body: "@Luca Ferri concordo",
      notice: COMMENT_TARGET_UNAVAILABLE,
      replyTo: null,
    });
  });

  it("contenuto non più disponibile: si avvisa chi monta, il testo resta (§191)", async () => {
    mocks.createComment.mockRejectedValueOnce({ message: "content_unavailable" });
    const { api, deps, draftStore } = setup();
    draftStore.set({ active: true, body: "Ottimo progetto." });

    await act(async () => {
      api().publish();
      await flush();
    });

    expect(deps.onContentUnavailable).toHaveBeenCalledTimes(1);
    expect(draftStore.getState().body).toBe("Ottimo progetto.");
  });

  it("se nel frattempo si è scritto altro, l'elemento fallito resta in lista: nessun testo perso", async () => {
    const { api, draftStore } = setup();
    mocks.createComment.mockImplementationOnce(async () => {
      draftStore.set({ body: "Un altro commento" });
      throw new Error("comment_identity_forbidden");
    });
    draftStore.set({ active: true, body: "Ottimo progetto." });
    const key = draftStore.getState().operationKey;

    await act(async () => {
      api().publish();
      await flush();
    });

    expect(commentStore.get(`tmp:${key}`)?.send?.state).toBe("failed");
    expect(draftStore.getState().body).toBe("Un altro commento");
  });

  it("commenti disattivati: il contesto si rilegge (il composer sparirà) e il testo resta recuperabile (§177–§179)", async () => {
    mocks.createComment.mockRejectedValueOnce(new Error("comments_disabled"));
    const { api, deps, draftStore } = setup();
    draftStore.set({ active: true, body: "Ottimo progetto." });

    await act(async () => {
      api().publish();
      await flush();
    });

    expect(deps.onPermissionLost).toHaveBeenCalledTimes(1);
    expect(draftStore.getState().body).toBe("Ottimo progetto.");
  });

  it("riaprire un elemento fallito con altro testo nel composer avvisa invece di non fare nulla", async () => {
    mocks.createComment.mockRejectedValueOnce(new Error("Network request failed"));
    const { api, deps, draftStore } = setup();
    draftStore.set({ active: true, body: "Primo" });
    const key = draftStore.getState().operationKey;

    await act(async () => {
      api().publish();
      await flush();
    });
    draftStore.set({ body: "Altro testo in corso" });

    act(() => {
      api().reopen(`tmp:${key}`);
    });

    expect(deps.onNotice).toHaveBeenCalledWith("Completa o svuota il commento in corso per riaprire questo.");
    expect(commentStore.get(`tmp:${key}`)?.send?.state).toBe("failed");
    expect(draftStore.getState().body).toBe("Altro testo in corso");
  });
});
