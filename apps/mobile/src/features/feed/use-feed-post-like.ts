/**
 * Mi piace sui Post del Feed (HOM-02 §52–53, §83).
 *
 * Luigi (2026-11-11): il toggle scrive davvero già in HOM-02, sulle sorgenti
 * che hanno una tabella dei Mi piace (Società, media dei tifosi, post persona).
 * Dove la sorgente non lo supporta (`capabilities.canLike = false`) il tap
 * risponde con il messaggio "in arrivo", come gli altri controlli non ancora
 * attivi: nessun tap morto, nessuna scrittura.
 *
 * HOM-03 §104 (Luigi 2026-11-12): anche Articoli e video editoriali
 * (`media_profile`) hanno il Like reale. Stessa entità ovunque: il toggle del
 * Feed e quello del dettaglio `/content/[type]/[id]` (use-content-interaction)
 * passano dalla stessa coda e dallo stesso tracker, e scrivono nelle stesse
 * cache — le due tab, il dettaglio post, lo stato interazioni del dettaglio.
 *
 * Tre regole, tutte per §83 (niente doppi eventi):
 *  • si invia lo stato desiderato (`liked`), mai "inverti": la RPC è idempotente;
 *  • le richieste sullo stesso contenuto sono serializzate, così l'ultima
 *    scelta dell'utente è anche l'ultima ad arrivare al server;
 *  • la patch ottimistica tocca solo quel contenuto; le risposte arrivano alla
 *    UI solo quando non ci sono altre richieste in volo (`createLikeTracker`).
 */

import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";

import { useToast } from "../../ui";
import { trackFeed } from "./feed-analytics";
import { FEED_QK } from "./feed-keys";
import { FEED_SOON_MESSAGES } from "./feed-labels";
import { setPostLike, type ContentInteractionState } from "./feed-service";
import {
  isContentItem,
  type FeedContentItem,
  type FeedContentType,
  type FeedItem,
  type FeedPage,
  type FeedPageParam,
  type FeedPostItem,
  type FeedScope,
} from "./feed-types";

type FeedData = InfiniteData<FeedPage, FeedPageParam>;

export type LikeState = { likesCount: number; isLiked: boolean };

const SCOPES: readonly FeedScope[] = ["per_te", "seguiti"];

/** Una coda per contenuto: la richiesta successiva parte quando la precedente è finita. */
const queues = new Map<string, Promise<unknown>>();

function enqueue<T>(key: string, run: () => Promise<T>): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(run);
  queues.set(key, next);
  void next.finally(() => {
    if (queues.get(key) === next) {
      queues.delete(key);
    }
  });
  return next;
}

/**
 * Richieste in volo per contenuto. Finché ce n’è più d’una, nessuna risposta
 * tocca la UI: resta lo stato ottimistico dell’ultimo tap. Quando l’ultima
 * si chiude si scrive l’ultimo stato CONFERMATO dal server — o, se nessuna
 * è andata a buon fine, quello di prima del primo tap. Così un Mi piace
 * seguito subito da un "togli" non rimbalza su "piace", e due tap offline non
 * lasciano un Mi piace che il server non ha mai registrato.
 */
export function createLikeTracker() {
  const entries = new Map<string, { pending: number; confirmed: LikeState }>();

  return {
    begin(key: string, before: LikeState) {
      const entry = entries.get(key);
      if (entry) {
        entry.pending += 1;
      } else {
        entries.set(key, { confirmed: before, pending: 1 });
      }
    },
    /** Lo stato da scrivere, o `null` se altre richieste sono ancora in volo. */
    settle(key: string, server: LikeState | null): LikeState | null {
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

const tracker = createLikeTracker();

/**
 * Scrive lo stato Like di UN contenuto (Post, Articolo o video editoriale) in
 * una pagina di Feed. Pura, testata.
 */
export function patchPostLike(
  data: FeedData | undefined,
  itemId: string,
  state: LikeState,
): FeedData | undefined {
  if (!data) {
    return data;
  }

  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((item): FeedItem =>
        item.id === itemId && isContentItem(item)
          ? ({ ...item, payload: { ...item.payload, ...state } } as FeedItem)
          : item,
      ),
    })),
  };
}

/** Lo stato ottimistico dopo un tap: il conteggio non scende mai sotto zero. */
export function nextLikeState(current: LikeState): LikeState {
  const isLiked = !current.isLiked;
  return {
    isLiked,
    likesCount: Math.max(0, current.likesCount + (isLiked ? 1 : -1)),
  };
}

/**
 * Il contenuto da mettere (o togliere) Mi piace, indipendente dalla superficie.
 * `itemId` è la chiave globale `<content_type>:<post_id>` del Feed.
 */
export type LikeTarget = {
  itemId: string;
  contentType: FeedContentType;
  postId: string;
  current: LikeState;
  canLike: boolean;
};

export function likeItemId(contentType: FeedContentType, postId: string): string {
  return `${contentType}:${postId}`;
}

/**
 * Il motore condiviso da Feed e dettaglio: coda, tracker, patch ovunque.
 * Restituisce il toggle per un `LikeTarget`.
 */
export function useContentLikeToggle({ profileId }: { profileId: string }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  // HOM-02 §38, HOM-03 §104: Feed e dettaglio mostrano lo stesso stato, senza reload.
  const writeEverywhere = (target: LikeTarget, state: LikeState) => {
    for (const scope of SCOPES) {
      queryClient.setQueryData<FeedData>(FEED_QK.feed(scope, profileId), (data) =>
        patchPostLike(data, target.itemId, state),
      );
    }
    queryClient.setQueryData<FeedPostItem | null>(
      FEED_QK.postDetail(target.postId),
      (detail) =>
        detail && detail.id === target.itemId
          ? { ...detail, payload: { ...detail.payload, ...state } }
          : detail,
    );
    queryClient.setQueryData<ContentInteractionState | null>(
      FEED_QK.interaction(target.contentType, target.postId),
      (interaction) => (interaction ? { ...interaction, ...state } : interaction),
    );
  };

  const mutation = useMutation({
    mutationFn: ({ target, next }: { target: LikeTarget; next: LikeState }) =>
      enqueue(target.itemId, () => setPostLike(target.contentType, target.postId, next.isLiked)),
    onMutate: ({ target, next }) => {
      writeEverywhere(target, next);
    },
    onError: (_error, { target }) => {
      const settled = tracker.settle(target.itemId, null);
      if (settled) {
        writeEverywhere(target, settled);
      }
      showToast({ message: "Non è stato possibile aggiornare il Mi piace." });
    },
    onSuccess: (server, { target }) => {
      const settled = tracker.settle(target.itemId, server);
      if (settled) {
        writeEverywhere(target, settled);
      }
    },
  });

  return (target: LikeTarget) => {
    if (!target.canLike) {
      showToast({ message: FEED_SOON_MESSAGES.like });
      return;
    }

    const next = nextLikeState(target.current);
    trackFeed({ itemId: target.itemId, liked: next.isLiked, name: "feed_post_like_tap" });
    tracker.begin(target.itemId, target.current);
    mutation.mutate({ next, target });
  };
}

/** Il toggle del Feed: Post, Articolo o video editoriale (HOM-03 §104). */
export function useToggleFeedPostLike({ profileId }: { profileId: string }) {
  const toggle = useContentLikeToggle({ profileId });

  return (item: FeedContentItem) =>
    toggle({
      canLike: item.payload.capabilities.canLike,
      contentType: item.payload.contentType,
      current: { isLiked: item.payload.isLiked, likesCount: item.payload.likesCount },
      itemId: item.id,
      postId: item.payload.postId,
    });
}
