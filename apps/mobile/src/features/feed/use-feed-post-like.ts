/**
 * Mi piace sui contenuti: Post, Articolo, video editoriale e, da HOM-08 (§68–§76),
 * i commenti (`contentType: "comment"`, stessa coda/store/RPC; un commento
 * eliminato risponde `content_unavailable`, già classificato) (HOM-02 §52–53, §83;
 * HOM-03 §104; HOM-07 §10–§19, §135–§137, §170, §172, §189).
 *
 * Dominio unico (HOM-07 §1): lo stesso motore serve Feed, dettaglio Post e
 * dettaglio `/content/[type]/[id]`. Lo stato vive nello store normalizzato
 * (`interactions/like-store.ts`): il toggle scrive UNA cella e rirenderizza solo
 * l'action row interessata, non le pagine del Feed (§136, §256).
 *
 * Il Like appartiene all'identità di interazione (§10–§11): derivata dal
 * contesto già usato dall'app (ultima identità Dashboard, altrimenti la
 * personale), mai scelta qui. «Messo» = quell'identità compare in `likedAs`.
 *
 * Quattro regole, tutte per §17–§19 (niente doppi eventi):
 *  • si invia lo stato desiderato (`liked`), mai «inverti»: la RPC è idempotente;
 *  • le richieste sullo stesso contenuto sono serializzate, così l'ultima
 *    scelta dell'utente è anche l'ultima ad arrivare al server;
 *  • lo stato ottimistico tocca solo quella cella; le risposte arrivano alla UI
 *    solo quando non ci sono altre richieste in volo (`createLikeTracker`);
 *  • un errore ripristina stato e conteggio di prima del tap (§16) e dice
 *    «Non è stato possibile completare l'operazione.»
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { useToast } from "../../ui";
import { commentCountStore } from "../comments/comment-count-store";
import {
  isLikedBy,
  nextLikeSnapshot,
  withLikeIdentity,
} from "../interactions/interaction-identity";
import { setContentLike } from "../interactions/interaction-service";
import type { InteractionIdentity, LikeSnapshot } from "../interactions/interaction-types";
import {
  classifyLikeFailure,
  trackLike,
  type LikeFailureReason,
} from "../interactions/like-analytics";
import { likeItemKey, likeStore } from "../interactions/like-store";
import {
  interactionIdentityQuery,
  useInteractionIdentity,
} from "../interactions/use-interaction-identity";
import { trackFeed } from "./feed-analytics";
import { FEED_SOON_MESSAGES } from "./feed-labels";
import {
  isContentItem,
  type FeedContentItem,
  type FeedContentType,
  type FeedItem,
} from "./feed-types";

/** §16: il copy dell'errore, lo stesso per Like e Salvati in rimozione. */
export const LIKE_ERROR_MESSAGE = "Non è stato possibile completare l'operazione.";

/** Una coda per contenuto: la richiesta successiva parte quando la precedente è finita. */
const queues = new Map<string, Promise<unknown>>();

function enqueue<T>(key: string, run: () => Promise<T>): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(run);
  queues.set(key, next);
  // L'errore lo gestisce chi attende `next`; la catena di pulizia non deve
  // produrre un secondo rifiuto non gestito.
  next
    .finally(() => {
      if (queues.get(key) === next) {
        queues.delete(key);
      }
    })
    .catch(() => undefined);
  return next;
}

/**
 * Richieste in volo per contenuto. Finché ce n'è più d'una, nessuna risposta
 * tocca la UI: resta lo stato ottimistico dell'ultimo tap. Quando l'ultima
 * si chiude si scrive l'ultimo stato CONFERMATO dal server — o, se nessuna
 * è andata a buon fine, quello di prima del primo tap. Così un Mi piace
 * seguito subito da un «togli» non rimbalza su «piace», e due tap offline non
 * lasciano un Mi piace che il server non ha mai registrato.
 */
export function createLikeTracker<T>() {
  const entries = new Map<string, { pending: number; confirmed: T }>();

  return {
    begin(key: string, before: T) {
      const entry = entries.get(key);
      if (entry) {
        entry.pending += 1;
      } else {
        entries.set(key, { confirmed: before, pending: 1 });
      }
    },
    /** Logout o cambio utente: nessun conteggio di richieste dell'utente di prima. */
    clear() {
      entries.clear();
    },
    /** Lo stato da scrivere, o `null` se altre richieste sono ancora in volo. */
    settle(key: string, server: T | null): T | null {
      const entry = entries.get(key);
      if (!entry) {
        return server;
      }
      if (server) {
        entry.confirmed = server;
      }
      entry.pending -= 1;
      if (entry.pending > 0) {
        return null;
      }
      entries.delete(key);
      return entry.confirmed;
    },
  };
}

const tracker = createLikeTracker<LikeSnapshot>();

/**
 * Logout o cambio account (chiamato da `resetUserInteractions`): coda e
 * tracker sono stato di modulo dell'utente che esce. Le richieste già in volo
 * finiscono, ma la loro risposta non tocca più lo store (vedi `epoch`).
 */
export function resetLikeEngine(): void {
  tracker.clear();
  queues.clear();
}

/**
 * Il contenuto da mettere (o togliere) Mi piace, indipendente dalla superficie.
 * `seed` è lo stato del payload che l'ha mostrato: serve solo se lo store non
 * conosce ancora il contenuto.
 */
export type LikeTarget = {
  /**
   * HOM-08 §68, §221: anche `comment` (stessa entità `content_likes`).
   * HOM-15 §174–§175: anche `career_media`, i media di carriera del profilo.
   */
  contentType: FeedContentType | "comment" | "career_media";
  postId: string;
  seed: LikeSnapshot;
  canLike: boolean;
};

/** Lo stato Mi piace di un payload: ciò che lo store riceve come seed (§135). */
export function likeSnapshotOf(payload: {
  likesCount: number;
  likedAs: LikeSnapshot["likedAs"];
}): LikeSnapshot {
  return { likedAs: payload.likedAs, likesCount: payload.likesCount };
}

/**
 * Riempie lo store dai contenuti caricati (§135, §141): prevale solo un dato
 * richiesto dopo ciò che lo store sa già (`fetchedAt` della pagina), quindi una
 * pagina in cache non cancella ciò che l'utente ha fatto dopo.
 */
export function seedLikesFromItems(items: readonly FeedItem[]): void {
  for (const item of items) {
    if (isContentItem(item)) {
      const key = likeItemKey(item.payload.contentType, item.payload.postId);
      const fetchedAt = item.fetchedAt ?? 0;
      likeStore.seed(key, likeSnapshotOf(item.payload), fetchedAt);
      // HOM-08 §210–§214: stessa chiave e stesso `fetchedAt` anche per il
      // conteggio dei commenti, così Feed e dettaglio non divergono.
      commentCountStore.seed(key, item.payload.commentsCount, fetchedAt);
    }
  }
}

type LikeVariables = {
  target: LikeTarget;
  identity: InteractionIdentity;
  adding: boolean;
  next: LikeSnapshot;
  /** Generazione dello store al tap: se cambia (logout, altro utente) la risposta è scartata. */
  epoch: number;
};

/**
 * Il motore condiviso da Feed e dettagli: coda, tracker, store. Restituisce il
 * toggle per un `LikeTarget`.
 */
export function useContentLikeToggle({ profileId }: { profileId: string }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  // Pubblica nello store identità e proprietario; qui serve solo a tenerli vivi.
  useInteractionIdentity(profileId);

  function fail(
    target: LikeTarget,
    identity: InteractionIdentity | null,
    adding: boolean,
    reason: LikeFailureReason,
  ) {
    trackLike({
      action: adding ? "add" : "remove",
      contentId: target.postId,
      contentType: target.contentType,
      identityType: identity?.type ?? null,
      name: "like_failure",
      reason,
    });
    showToast({ message: LIKE_ERROR_MESSAGE });
  }

  const mutation = useMutation({
    mutationFn: ({ target, identity, adding }: LikeVariables) =>
      enqueue(likeItemKey(target.contentType, target.postId), () =>
        setContentLike(target.contentType, target.postId, adding, identity),
      ),
    onError: (error, { target, identity, adding, epoch }) => {
      if (likeStore.epoch() !== epoch) {
        return;
      }
      const key = likeItemKey(target.contentType, target.postId);
      const settled = tracker.settle(key, null);
      likeStore.release(key);
      if (settled) {
        likeStore.write(key, settled);
      }
      fail(target, identity, adding, classifyLikeFailure(error));
    },
    onSuccess: (server, { target, identity, adding, next, epoch }) => {
      if (likeStore.epoch() !== epoch) {
        return;
      }
      const key = likeItemKey(target.contentType, target.postId);
      // Il server prevale (§19): conteggio suo; l'identità resta messa o tolta come ha risposto.
      const settled = tracker.settle(key, {
        likedAs: withLikeIdentity(next.likedAs, identity, server.isLiked),
        likesCount: server.likesCount,
      });
      likeStore.release(key);
      if (settled) {
        // Dato server dell'istante della risposta (§19, §141): un fetch partito
        // prima — anche mentre la richiesta era in volo — non lo sovrascrive.
        likeStore.write(key, settled, Date.now());
      }
      trackLike({
        contentId: target.postId,
        contentType: target.contentType,
        identityType: identity.type,
        name: adding ? "like_add_success" : "like_remove_success",
      });
    },
  });

  // Identità non ancora in store (query in corso o fallita): si risolve qui e il
  // tap prosegue; nessun Like inventato se il server non ne dà nessuna.
  async function resolveIdentity(): Promise<InteractionIdentity | null> {
    try {
      return await queryClient.fetchQuery(interactionIdentityQuery(profileId));
    } catch {
      return null;
    }
  }

  async function start(target: LikeTarget) {
    const identity =
      likeStore.getIdentity() ?? (profileId ? await resolveIdentity() : null);

    if (!identity) {
      fail(target, null, !isLikedBy(target.seed.likedAs, null), "no_identity");
      return;
    }

    const key = likeItemKey(target.contentType, target.postId);
    const before = likeStore.get(key) ?? target.seed;
    const next = nextLikeSnapshot(before, identity);
    const adding = isLikedBy(next.likedAs, identity);

    trackFeed({ itemId: key, liked: adding, name: "feed_post_like_tap" });
    trackLike({
      contentId: target.postId,
      contentType: target.contentType,
      identityType: identity.type,
      name: adding ? "like_add_attempt" : "like_remove_attempt",
    });

    tracker.begin(key, before);
    // `before` crea la cella se la superficie mostrava ancora il fallback.
    likeStore.hold(key, before);
    likeStore.write(key, next);
    mutation.mutate({ adding, epoch: likeStore.epoch(), identity, next, target });
  }

  return (target: LikeTarget) => {
    if (!target.canLike) {
      showToast({ message: FEED_SOON_MESSAGES.like });
      return;
    }

    void start(target);
  };
}

/** Il toggle del Feed: Post, Articolo o video editoriale (HOM-03 §104). */
export function useToggleFeedPostLike({ profileId }: { profileId: string }) {
  const toggle = useContentLikeToggle({ profileId });

  return (item: FeedContentItem) =>
    toggle({
      canLike: item.payload.capabilities.canLike,
      contentType: item.payload.contentType,
      postId: item.payload.postId,
      seed: likeSnapshotOf(item.payload),
    });
}

/** Semina lo store dai contenuti del Feed a ogni cambio di `items` (§135). */
export function useSeedLikes(items: readonly FeedItem[]) {
  useEffect(() => {
    seedLikesFromItems(items);
  }, [items]);
}
