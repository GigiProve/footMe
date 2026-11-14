/**
 * Bozza del composer commenti: il testo non si perde (HOM-08 §40, §44, §46, §194),
 * si svuota a invio riuscito con una chiave nuova (§94) e sparisce al cambio utente.
 */
import { describe, expect, it, vi } from "vitest";

import {
  createCommentDraftStore,
  registerCommentDraft,
  resetCommentDrafts,
} from "./comment-draft-store";
import type { CommentIdentity } from "./comment-types";

const SOCIETY: CommentIdentity = {
  avatarUrl: null,
  canComment: true,
  clubCategory: "Serie D",
  clubName: null,
  mediaKind: null,
  primaryPosition: null,
  teamLabel: null,
  id: "c-1",
  isVerified: true,
  name: "AC Como",
  rank: 1,
  role: null,
  type: "society",
};

describe("createCommentDraftStore", () => {
  it("parte vuoto, inattivo, con una chiave di invio", () => {
    const state = createCommentDraftStore().getState();

    expect(state).toMatchObject({ active: false, body: "", edit: null, mentions: [], notice: null, replyTo: null });
    expect(state.operationKey.length).toBeGreaterThan(8);
  });

  it("cambiare identità non cancella testo, mention né risposta (§40)", () => {
    const store = createCommentDraftStore();
    const mention = { displayName: "Marco", end: 6, identityId: "p-2", identityType: "profile" as const, start: 0 };
    store.set({
      body: "@Marco ciao",
      mentions: [mention],
      replyTo: { commentId: "c-9", identityId: "p-2", identityType: "person", name: "Marco", rootCommentId: "c-1" },
    });

    store.set({ identity: SOCIETY });

    expect(store.getState()).toMatchObject({ body: "@Marco ciao", identity: SOCIETY, mentions: [mention] });
    expect(store.getState().replyTo?.commentId).toBe("c-9");
  });

  it("un errore aggiunge solo un messaggio: il testo resta (§44, §194)", () => {
    const store = createCommentDraftStore();
    store.set({ body: "Il mio commento" });

    store.set({ notice: "Questo commento non è più disponibile." });

    expect(store.getState().body).toBe("Il mio commento");
  });

  it("un patch uguale non notifica", () => {
    const store = createCommentDraftStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.set({ body: "" });
    expect(listener).not.toHaveBeenCalled();

    store.set({ body: "x" });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("clearComposer: testo, mention, risposta e avviso vuoti; chiave nuova; identità scelta resta (§94)", () => {
    const store = createCommentDraftStore();
    store.set({ body: "x", identity: SOCIETY, notice: "boh" });
    const before = store.getState().operationKey;

    store.clearComposer();

    const state = store.getState();
    expect(state).toMatchObject({ body: "", mentions: [], notice: null, replyTo: null });
    expect(state.identity).toBe(SOCIETY);
    expect(state.operationKey).not.toBe(before);
  });

  it("l'aggiornamento accetta una funzione dello stato corrente", () => {
    const store = createCommentDraftStore();

    store.set((draft) => ({ focusToken: draft.focusToken + 1 }));
    store.set((draft) => ({ focusToken: draft.focusToken + 1 }));

    expect(store.getState().focusToken).toBe(2);
  });
});

describe("registro delle bozze montate", () => {
  it("resetCommentDrafts azzera le bozze registrate, non quelle tolte dal registro", () => {
    const mounted = createCommentDraftStore();
    const gone = createCommentDraftStore();
    const unregisterMounted = registerCommentDraft(mounted);
    const unregisterGone = registerCommentDraft(gone);
    mounted.set({ active: true, body: "testo A" });
    gone.set({ body: "testo B" });
    unregisterGone();

    resetCommentDrafts();
    unregisterMounted();

    expect(mounted.getState()).toMatchObject({ active: false, body: "" });
    expect(gone.getState().body).toBe("testo B");
  });
});
