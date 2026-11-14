/**
 * Bozza del composer commenti (HOM-08 §18–§25, §40, §44, §46, §81–§86, §101, §149–§152).
 *
 * Il testo che si digita NON passa dal controller: vive in uno store esterno, e solo
 * le componenti che lo mostrano (barra del composer, modale di modifica) si
 * abbonano. Così scrivere non rirenderizza il thread, e la barra e la modale di
 * modifica usano lo stesso editor (§152) su due bozze diverse della stessa struttura.
 *
 * Cosa NON si cancella mai (§40, §44, §46, §191, §194): il testo, le mention, lo stato
 * di risposta. Cambiare identità, perdere il permesso, un errore o un contenuto che
 * diventa non disponibile aggiornano `identity`/`notice` e basta.
 *
 * Le bozze sono stato di runtime per utente: `resetUserInteractions` le azzera al
 * logout e al cambio account (§ privacy), tramite il registro di modulo.
 */

import { useSyncExternalStore } from "react";

import { newCommentOperationKey } from "./comment-operation-key";
import type { CommentIdentity, CommentMentionRef } from "./comment-types";

/** Il commento a cui si risponde (§49, §82): root del thread e target preciso. */
export type CommentReplyDraft = {
  commentId: string;
  rootCommentId: string;
  name: string;
  identityType: CommentIdentity["type"];
  identityId: string;
};

export type CommentEditDraft = {
  commentId: string;
  /** La versione letta all'apertura (§154); un conflitto la aggiorna a quella corrente. */
  expectedVersion: number;
  body: string;
  mentions: CommentMentionRef[];
  /** Il testo all'apertura: serve a sapere se ci sono modifiche da perdere (conferma di uscita). */
  originalBody: string;
  /**
   * `failed` conserva il nuovo testo (§158) e mostra «messaggio leggero + Riprova» (§159);
   * `conflict` = il commento è cambiato nel frattempo (§155): il testo dell'utente resta
   * e accanto c'è quello ATTUALE; si salva sopra solo con un nuovo «Salva» esplicito.
   */
  status: "idle" | "saving" | "failed" | "conflict";
  notice: string | null;
  /** Il testo attuale sul server dopo un conflitto; `null` se non si è potuto rileggere. */
  serverBody: string | null;
};

export type CommentDraft = {
  /** Composer espanso (§20–§21); inattivo è la riga compatta (§18–§19). */
  active: boolean;
  body: string;
  mentions: CommentMentionRef[];
  replyTo: CommentReplyDraft | null;
  /** L'identità scelta; `null` = quella di default (§35–§39). */
  identity: CommentIdentity | null;
  /** Una chiave per commento in composizione, riusata al Riprova (§95, §99). */
  operationKey: string;
  /** Ultimo errore d'invio: permessi persi, commento non più disponibile… Il testo resta (§44, §194). */
  notice: string | null;
  edit: CommentEditDraft | null;
  /** Cresce per chiedere il focus all'input quando è già attivo (es. «Rispondi»). */
  focusToken: number;
};

type Listener = () => void;

export function initialCommentDraft(): CommentDraft {
  return {
    active: false,
    body: "",
    edit: null,
    focusToken: 0,
    identity: null,
    mentions: [],
    notice: null,
    operationKey: newCommentOperationKey(),
    replyTo: null,
  };
}

export function createCommentDraftStore(initial: CommentDraft = initialCommentDraft()) {
  let state = initial;
  const listeners = new Set<Listener>();

  function emit() {
    listeners.forEach((listener) => listener());
  }

  return {
    getState(): CommentDraft {
      return state;
    },

    subscribe(listener: Listener): () => void {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },

    /** Unisce un patch (o il risultato di una funzione) e notifica solo se qualcosa cambia. */
    set(patch: Partial<CommentDraft> | ((current: CommentDraft) => Partial<CommentDraft>)) {
      const partial = typeof patch === "function" ? patch(state) : patch;
      const next = { ...state, ...partial };
      const changed = (Object.keys(next) as (keyof CommentDraft)[]).some((key) => next[key] !== state[key]);

      if (changed) {
        state = next;
        emit();
      }
    },

    /** Dopo un invio riuscito o un annullamento: composer vuoto, nuova chiave (§94). */
    clearComposer() {
      state = {
        ...state,
        body: "",
        mentions: [],
        notice: null,
        operationKey: newCommentOperationKey(),
        replyTo: null,
      };
      emit();
    },

    /** Logout, cambio account: nessuna traccia del testo dell'utente di prima. */
    reset() {
      state = initialCommentDraft();
      emit();
    },
  };
}

export type CommentDraftStore = ReturnType<typeof createCommentDraftStore>;

/** I composer montati: `resetCommentDrafts` li raggiunge senza conoscerli. */
const mounted = new Set<CommentDraftStore>();

export function registerCommentDraft(store: CommentDraftStore): () => void {
  mounted.add(store);

  return () => {
    mounted.delete(store);
  };
}

export function resetCommentDrafts(): void {
  mounted.forEach((store) => store.reset());
}

export function useCommentDraft(store: CommentDraftStore): CommentDraft {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

/**
 * Una parte della bozza: la componente si rirenderizza solo quando cambia ciò che il
 * selettore restituisce (un primitivo o un riferimento stabile, mai un oggetto nuovo
 * a ogni chiamata). Serve ai fogli e alla modale, che non devono seguire ogni tasto.
 */
export function useCommentDraftSelect<T>(store: CommentDraftStore, select: (draft: CommentDraft) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => select(store.getState()),
    () => select(store.getState()),
  );
}
