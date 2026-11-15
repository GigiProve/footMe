/**
 * Store normalizzato dei commenti (HOM-08 §92–§95, §111, §128–§129, §209, §223,
 * §225–§226).
 *
 * Le entità vivono qui, per id; le LISTE (root per ordinamento, risposte per root)
 * le possiedono le infinite query (cursore, §130–§135) e rimandano solo gli id.
 * Lo store aggiunge ciò che una query non sa dire:
 *  • le entità, così una riga si abbona SOLO alla propria (§225): un Mi piace, una
 *    modifica o un invio fallito rirenderizzano una riga, non il thread (§226);
 *  • gli elementi OTTIMISTICI con id temporaneo `tmp:<operationKey>`, la loro
 *    riconciliazione sull'id del server SENZA cambiare posizione né chiave React
 *    (§94, §223, `CommentRef.key`) e lo stato `sending | failed` (§98);
 *  • gli «aggiunti da me»: il proprio commento compare in cima ai principali, la
 *    propria risposta in fondo al thread (espanso), qualunque sia l'ordinamento e
 *    anche se la pagina non lo contiene ancora;
 *  • le rimozioni (cancellazione fisica) e il segnaposto «Commento eliminato»;
 *  • lo stato di sessione che deve sopravvivere al push di un profilo (§111, §129):
 *    ordinamento scelto per contenuto, thread espansi.
 *
 * Stessa regola di freschezza di `like-store` (HOM-07): ogni entità porta `at`,
 * l'istante della conoscenza server che riflette; un seed porta l'istante in cui la
 * richiesta della sua pagina è PARTITA e, se è più vecchio, non scrive. La risposta
 * a una mutazione vale dal momento in cui è ARRIVATA.
 *
 * Privacy: logout e cambio account svuotano lo store in modo SINCRONO
 * (`resetUserInteractions`, anche le bozze del composer); `epoch` fa scartare le
 * risposte dell'utente di prima.
 *
 * Singleton di modulo (stato di runtime, non un contesto React). `createCommentStore`
 * esiste per i test.
 */

import { useSyncExternalStore } from "react";

import type {
  Comment,
  CommentEntity,
  CommentErrorKind,
  CommentRef,
  CommentSendRecord,
  CommentSort,
} from "./comment-types";

type Listener = () => void;

type EntityEntry = { comment: CommentEntity; at: number };

const EMPTY_REFS: readonly CommentRef[] = [];

function entityChannel(id: string): string {
  return `e:${id}`;
}

function expandedChannel(rootId: string): string {
  return `x:${rootId}`;
}

const STRUCTURE = "s";

/** Cosa, di un commento, cambia ciò che la riga mostra (i Mi piace stanno in `likeStore`). */
function fingerprint(comment: Comment): string {
  return [
    comment.version,
    comment.status,
    comment.repliesCount,
    comment.updatedAt,
    comment.editedAt,
    comment.body,
    comment.author?.name,
    comment.author?.avatarUrl,
    comment.author?.isVerified,
    JSON.stringify(comment.capabilities),
    comment.isContentAuthor,
    // HOM-11: un refetch che cambia Follow o «segnalato» (altro device, §295) aggiorna la riga.
    comment.viewerFollowsAuthor,
    comment.viewerHasReported,
  ].join("|");
}

export function createCommentStore() {
  const entities = new Map<string, EntityEntry>();
  const ownRoots = new Map<string, readonly CommentRef[]>();
  const ownReplies = new Map<string, readonly CommentRef[]>();
  const removed = new Set<string>();
  const expanded = new Set<string>();
  const sortByContent = new Map<string, CommentSort>();
  const listeners = new Map<string, Set<Listener>>();
  /** `operationKey` → id temporaneo: una pagina che contiene già il commento lo riconcilia (§223). */
  const tempByOperation = new Map<string, string>();
  let structureVersion = 0;
  let epoch = 0;

  function notify(channel: string) {
    listeners.get(channel)?.forEach((listener) => listener());
  }

  function bumpStructure() {
    structureVersion += 1;
    notify(STRUCTURE);
  }

  function subscribe(channel: string, listener: Listener): () => void {
    const set = listeners.get(channel) ?? new Set<Listener>();
    set.add(listener);
    listeners.set(channel, set);

    return () => {
      set.delete(listener);
      if (set.size === 0) {
        listeners.delete(channel);
      }
    };
  }

  function replaceRef(
    map: Map<string, readonly CommentRef[]>,
    from: string,
    to: string,
  ): boolean {
    let changed = false;

    for (const [owner, refs] of map) {
      if (refs.some((ref) => ref.id === from)) {
        map.set(
          owner,
          refs.map((ref) => (ref.id === from ? { id: to, key: ref.key } : ref)),
        );
        changed = true;
      }
    }

    return changed;
  }

  function dropRef(map: Map<string, readonly CommentRef[]>, id: string): boolean {
    let changed = false;

    for (const [owner, refs] of map) {
      if (refs.some((ref) => ref.id === id)) {
        map.set(
          owner,
          refs.filter((ref) => ref.id !== id),
        );
        changed = true;
      }
    }

    return changed;
  }

  function put(id: string, comment: CommentEntity, at: number) {
    entities.set(id, { at, comment });
    notify(entityChannel(id));
  }

  /** Il segnaposto: stessa riga, senza autore, testo, link, like (§165–§167). */
  function toTombstone(comment: CommentEntity): CommentEntity {
    return {
      ...comment,
      author: null,
      body: "",
      capabilities: { canDelete: false, canEdit: false, canLike: false, canOpenAuthor: false, canReply: false },
      isContentAuthor: false,
      likedAs: [],
      likesCount: 0,
      links: [],
      mentions: [],
      send: null,
      status: "deleted",
    };
  }

  /** La risposta del server a una MIA mutazione (modifica): vale dal momento in cui è arrivata. */
  function write(comment: Comment, at: number = Date.now()) {
    const entry = entities.get(comment.id);

    if (entry && at < entry.at) {
      return;
    }

    put(comment.id, { ...comment, send: null }, at);
  }

  /**
   * §94: dopo il successo l'id temporaneo diventa quello del server, nella stessa
   * posizione e con la stessa chiave React. Tollera il doppio arrivo (pagina e
   * risposta di `create_comment`): la seconda volta aggiorna soltanto.
   */
  function reconcile(tempId: string, server: Comment, at: number = Date.now()) {
    const temp = entities.get(tempId);

    if (temp?.comment.send) {
      tempByOperation.delete(temp.comment.send.operationKey);
    }

    if (server.operationKey) {
      tempByOperation.delete(server.operationKey);
    }

    if (!temp) {
      write(server, at);
      return;
    }

    const changed =
      replaceRef(ownRoots, tempId, server.id) || replaceRef(ownReplies, tempId, server.id);
    entities.delete(tempId);
    put(server.id, { ...server, send: null }, at);
    notify(entityChannel(tempId));
    if (changed) {
      bumpStructure();
    }
  }

  const store = {
    get(id: string): CommentEntity | undefined {
      return entities.get(id)?.comment;
    },

    subscribeEntity(id: string, listener: Listener): () => void {
      return subscribe(entityChannel(id), listener);
    },

    subscribeStructure(listener: Listener): () => void {
      return subscribe(STRUCTURE, listener);
    },

    /** Cambia a ogni modifica della struttura (aggiunti, rimossi, riconciliazioni). */
    structureVersion(): number {
      return structureVersion;
    },

    /**
     * Entità dalle pagine; `at` è l'istante in cui la richiesta è PARTITA. Una pagina
     * che contiene già un commento che stiamo ancora inviando (stessa operation key)
     * lo riconcilia invece di duplicarlo (§223).
     */
    seed(comments: readonly Comment[], at = 0) {
      for (const comment of comments) {
        const tempId = comment.operationKey ? tempByOperation.get(comment.operationKey) : undefined;
        if (tempId && entities.has(tempId)) {
          reconcile(tempId, comment, at || Date.now());
          continue;
        }

        const entry = entities.get(comment.id);

        if (!entry) {
          put(comment.id, { ...comment, send: null }, at);
          continue;
        }

        if (entry.comment.send || at <= entry.at) {
          continue;
        }

        const changed = fingerprint(entry.comment) !== fingerprint(comment);
        entry.at = at;
        if (changed) {
          put(comment.id, { ...comment, send: null }, at);
        }
      }
    },

    write,

    /**
     * §92–§93: l'elemento ottimistico entra SUBITO — in cima ai principali di quel
     * contenuto, oppure in fondo al thread del suo root, che si espande.
     */
    insertOptimistic(entity: CommentEntity, contentKey: string) {
      const ref: CommentRef = { id: entity.id, key: entity.id };

      entities.set(entity.id, { at: 0, comment: entity });
      if (entity.send) {
        tempByOperation.set(entity.send.operationKey, entity.id);
      }

      if (entity.replyToCommentId === null) {
        ownRoots.set(contentKey, [ref, ...(ownRoots.get(contentKey) ?? EMPTY_REFS)]);
      } else {
        ownReplies.set(entity.rootCommentId, [...(ownReplies.get(entity.rootCommentId) ?? EMPTY_REFS), ref]);
        if (!expanded.has(entity.rootCommentId)) {
          expanded.add(entity.rootCommentId);
          notify(expandedChannel(entity.rootCommentId));
        }
      }

      notify(entityChannel(entity.id));
      bumpStructure();
    },

    markSending(tempId: string) {
      const entry = entities.get(tempId);
      if (!entry?.comment.send) {
        return;
      }
      put(
        tempId,
        { ...entry.comment, send: { ...entry.comment.send, failure: null, state: "sending" } },
        entry.at,
      );
    },

    /** §97–§98: l'elemento e il testo restano; la riga dice «Invio non riuscito · Riprova». */
    markFailed(tempId: string, failure: CommentErrorKind) {
      const entry = entities.get(tempId);
      if (!entry?.comment.send) {
        return;
      }
      put(
        tempId,
        { ...entry.comment, send: { ...entry.comment.send, failure, state: "failed" } },
        entry.at,
      );
    },

    reconcile,

    /**
     * L'utente riapre il testo fallito (§101): l'elemento esce dalla lista e il suo
     * invio torna al composer, con la sua operation key.
     */
    discardOptimistic(tempId: string): CommentSendRecord | null {
      const entry = entities.get(tempId);
      const send = entry?.comment.send ?? null;

      if (send) {
        tempByOperation.delete(send.operationKey);
      }
      entities.delete(tempId);
      const changed = dropRef(ownRoots, tempId) || dropRef(ownReplies, tempId);
      notify(entityChannel(tempId));
      if (changed) {
        bumpStructure();
      }

      return send;
    },

    /** §163, §169: cancellazione fisica — nessuna riga, nessun segnaposto. */
    remove(id: string) {
      removed.add(id);
      dropRef(ownRoots, id);
      dropRef(ownReplies, id);
      bumpStructure();
    },

    isRemoved(id: string): boolean {
      return removed.has(id);
    },

    /** §164–§168: il thread resta; il commento diventa «Commento eliminato». */
    tombstone(id: string, at: number = Date.now()) {
      const entry = entities.get(id);
      if (!entry) {
        return;
      }
      put(id, toTombstone(entry.comment), Math.max(entry.at, at));
    },

    /** §87–§88, §170: una risposta in più o in meno nel root, subito. */
    adjustReplies(rootId: string, delta: number) {
      const entry = entities.get(rootId);
      if (!entry) {
        return;
      }
      put(
        rootId,
        { ...entry.comment, repliesCount: Math.max(0, entry.comment.repliesCount + delta) },
        entry.at,
      );
    },

    /** Il conteggio del server (risposta di create/delete). */
    setReplies(rootId: string, count: number) {
      const entry = entities.get(rootId);
      if (!entry || entry.comment.repliesCount === count) {
        return;
      }
      put(rootId, { ...entry.comment, repliesCount: Math.max(0, count) }, entry.at);
    },

    /** I propri commenti principali di un contenuto, il più recente per primo. */
    ownRoots(contentKey: string): readonly CommentRef[] {
      return ownRoots.get(contentKey) ?? EMPTY_REFS;
    },

    /** Le proprie risposte di un thread, dalla più vecchia. */
    ownReplies(rootId: string): readonly CommentRef[] {
      return ownReplies.get(rootId) ?? EMPTY_REFS;
    },

    isExpanded(rootId: string): boolean {
      return expanded.has(rootId);
    },

    setExpanded(rootId: string, value: boolean) {
      if (expanded.has(rootId) === value) {
        return;
      }
      if (value) {
        expanded.add(rootId);
      } else {
        expanded.delete(rootId);
      }
      notify(expandedChannel(rootId));
    },

    subscribeExpanded(rootId: string, listener: Listener): () => void {
      return subscribe(expandedChannel(rootId), listener);
    },

    /** §128–§129: l'ordinamento scelto per contenuto sopravvive al ritorno da un profilo. */
    getSort(contentKey: string): CommentSort {
      return sortByContent.get(contentKey) ?? "relevant";
    },

    setSort(contentKey: string, sort: CommentSort) {
      sortByContent.set(contentKey, sort);
    },

    epoch(): number {
      return epoch;
    },

    /** Logout, cambio account e test: store vuoto. */
    clear() {
      const channels = [...listeners.keys()];
      entities.clear();
      ownRoots.clear();
      ownReplies.clear();
      removed.clear();
      expanded.clear();
      sortByContent.clear();
      tempByOperation.clear();
      epoch += 1;
      structureVersion += 1;
      channels.forEach(notify);
    },
  };

  return store;
}

export type CommentStore = ReturnType<typeof createCommentStore>;

export const commentStore: CommentStore = createCommentStore();

/** UNA riga si abbona alla propria entità (§225): il resto della pagina non si rirenderizza. */
export function useCommentEntity(id: string): CommentEntity | undefined {
  return useSyncExternalStore(
    (listener) => commentStore.subscribeEntity(id, listener),
    () => commentStore.get(id),
    () => commentStore.get(id),
  );
}

/** Per le liste: si rirenderizzano quando cambia la struttura, non a ogni Mi piace. */
export function useCommentStructure(): number {
  return useSyncExternalStore(
    commentStore.subscribeStructure,
    commentStore.structureVersion,
    commentStore.structureVersion,
  );
}

export function useThreadExpanded(rootId: string): boolean {
  return useSyncExternalStore(
    (listener) => commentStore.subscribeExpanded(rootId, listener),
    () => commentStore.isExpanded(rootId),
    () => commentStore.isExpanded(rootId),
  );
}
