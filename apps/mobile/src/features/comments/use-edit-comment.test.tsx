/**
 * Modifica di un proprio commento: precarica testo e versione, aggiorna solo quel
 * commento, e al conflitto di versione NON sovrascrive mai in silenzio (HOM-08
 * §149–§159, §220).
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createCommentDraftStore } from "./comment-draft-store";
import { COMMENT_EDIT_CONFLICT } from "./comment-labels";
import { commentStore } from "./comment-store";
import type { Comment } from "./comment-types";
import { useEditComment, type EditCommentDeps } from "./use-edit-comment";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ updateComment: vi.fn() }));

vi.mock("../../lib/supabase", () => ({ supabase: { rpc: vi.fn() } }));
vi.mock("./comment-service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./comment-service")>()),
  updateComment: mocks.updateComment,
}));

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

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function setup(reloadComment: EditCommentDeps["reloadComment"] = vi.fn(async () => undefined)) {
  const draftStore = createCommentDraftStore();
  const deps: EditCommentDeps = {
    contentId: "post-1",
    contentType: "profile_post",
    draftStore,
    getLimits: () => ({ maxBodyLength: 1000, maxLinks: 10, maxMentions: 20 }),
    onContentUnavailable: vi.fn(),
    reloadComment,
  };
  let api!: ReturnType<typeof useEditComment>;

  function Harness() {
    api = useEditComment(deps);
    return null;
  }

  act(() => {
    TestRenderer.create(<Harness />);
  });

  return { api: () => api, deps, draftStore };
}

function conflict(version: number) {
  return Object.assign(new Error("comment_version_conflict"), { details: `current_version=${version}` });
}

beforeEach(() => {
  mocks.updateComment.mockReset();
  commentStore.clear();
  commentStore.seed([comment()], 1);
});

describe("useEditComment — apertura e salvataggio (§149–§156)", () => {
  it("precarica testo, mention e versione; il testo originale serve a sapere se c'è da perdere qualcosa", () => {
    const { api, draftStore } = setup();

    act(() => api().start(comment({ version: 3 })));

    expect(draftStore.getState().edit).toMatchObject({
      body: "Ottimo progetto.",
      commentId: "c-1",
      expectedVersion: 3,
      originalBody: "Ottimo progetto.",
      serverBody: null,
      status: "idle",
    });
  });

  it("salva con la versione letta, aggiorna SOLO quel commento nello store e chiude l'editor", async () => {
    commentStore.seed([comment({ id: "c-2", rootCommentId: "c-2" })], 1);
    mocks.updateComment.mockResolvedValueOnce(
      comment({ body: "Ottimo progetto, davvero.", editedAt: "2026-11-14T11:00:00.000Z", version: 2 }),
    );
    const { api, draftStore } = setup();
    act(() => api().start(comment()));
    act(() => api().change("Ottimo progetto, davvero.", []));

    await act(async () => {
      await api().save();
    });

    expect(mocks.updateComment).toHaveBeenCalledWith(
      expect.objectContaining({ body: "Ottimo progetto, davvero.", commentId: "c-1", expectedVersion: 1 }),
    );
    expect(commentStore.get("c-1")).toMatchObject({ body: "Ottimo progetto, davvero.", version: 2 });
    expect(commentStore.get("c-2")?.body).toBe("Ottimo progetto.");
    expect(draftStore.getState().edit).toBeNull();
  });

  it("un testo vuoto non parte", async () => {
    const { api } = setup();
    act(() => api().start(comment()));
    act(() => api().change("   ", []));

    await act(async () => {
      await api().save();
    });

    expect(mocks.updateComment).not.toHaveBeenCalled();
  });

  it("un errore di rete: il nuovo testo resta, messaggio leggero e Riprova (§158–§159)", async () => {
    mocks.updateComment.mockRejectedValueOnce(new Error("Network request failed"));
    const { api, draftStore } = setup();
    act(() => api().start(comment()));
    act(() => api().change("Nuova versione", []));

    await act(async () => {
      await api().save();
      await flush();
    });

    expect(draftStore.getState().edit).toMatchObject({ body: "Nuova versione", status: "failed" });
    expect(draftStore.getState().edit?.notice).toBeTruthy();
    expect(commentStore.get("c-1")?.body).toBe("Ottimo progetto.");
  });
});

describe("useEditComment — conflitto di versione (§155)", () => {
  it("rilegge il commento, mostra il testo ATTUALE accanto al proprio e NON riprova da solo", async () => {
    mocks.updateComment.mockRejectedValueOnce(conflict(2));
    // Il server ha già un'altra versione: la rilettura la porta nello store.
    const reloadComment = vi.fn(async () => {
      commentStore.seed(
        [comment({ body: "Testo di un altro device", updatedAt: "2026-11-14T10:30:00.000Z", version: 2 })],
        Date.now() + 1000,
      );
    });
    const { api, draftStore } = setup(reloadComment);
    act(() => api().start(comment()));
    act(() => api().change("La mia modifica", []));

    await act(async () => {
      await api().save();
      await flush();
    });

    expect(reloadComment).toHaveBeenCalledTimes(1);
    expect(mocks.updateComment).toHaveBeenCalledTimes(1);
    expect(draftStore.getState().edit).toMatchObject({
      body: "La mia modifica",
      expectedVersion: 2,
      notice: COMMENT_EDIT_CONFLICT,
      serverBody: "Testo di un altro device",
      status: "conflict",
    });
    // Il commento del server non è stato toccato.
    expect(commentStore.get("c-1")?.body).toBe("Testo di un altro device");
  });

  it("sovrascrive solo con un nuovo «Salva» esplicito, e sulla versione nuova", async () => {
    mocks.updateComment.mockRejectedValueOnce(conflict(2));
    const reloadComment = vi.fn(async () => {
      commentStore.seed([comment({ body: "Testo di un altro device", version: 2, updatedAt: "2026-11-14T10:30:00.000Z" })], Date.now() + 1000);
    });
    const { api, draftStore } = setup(reloadComment);
    act(() => api().start(comment()));
    act(() => api().change("La mia modifica", []));
    await act(async () => {
      await api().save();
      await flush();
    });

    mocks.updateComment.mockResolvedValueOnce(comment({ body: "La mia modifica", version: 3 }));
    await act(async () => {
      await api().save();
    });

    expect(mocks.updateComment).toHaveBeenCalledTimes(2);
    expect(mocks.updateComment.mock.calls[1][0]).toMatchObject({ body: "La mia modifica", expectedVersion: 2 });
    expect(draftStore.getState().edit).toBeNull();
  });

  it("digitare dopo un conflitto non lo nasconde", async () => {
    mocks.updateComment.mockRejectedValueOnce(conflict(2));
    const { api, draftStore } = setup();
    act(() => api().start(comment()));
    act(() => api().change("La mia modifica", []));
    await act(async () => {
      await api().save();
      await flush();
    });

    act(() => api().change("La mia modifica, rivista", []));

    expect(draftStore.getState().edit).toMatchObject({ body: "La mia modifica, rivista", status: "conflict" });
    expect(draftStore.getState().edit?.notice).toBe(COMMENT_EDIT_CONFLICT);
  });

  it("se la rilettura non riesce resta il messaggio, con la versione dal dettaglio dell'errore", async () => {
    mocks.updateComment.mockRejectedValueOnce(conflict(5));
    const { api, draftStore } = setup(vi.fn(async () => Promise.reject(new Error("offline"))));
    act(() => api().start(comment()));
    act(() => api().change("La mia modifica", []));

    await act(async () => {
      await api().save();
      await flush();
    });

    expect(draftStore.getState().edit).toMatchObject({ expectedVersion: 5, serverBody: null, status: "conflict" });
  });
});

describe("useEditComment — annulla (§199)", () => {
  it("chiude l'editor", () => {
    const { api, draftStore } = setup();
    act(() => api().start(comment()));

    act(() => api().cancel());

    expect(draftStore.getState().edit).toBeNull();
  });
});
