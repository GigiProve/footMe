/**
 * Mi piace sui Post del Feed (HOM-02 §52–53, §83).
 *
 * Luigi (2026-11-11): il toggle scrive davvero già in HOM-02, sulle sorgenti
 * che hanno una tabella dei Mi piace (Società, media dei tifosi, post persona).
 * Dove la sorgente non lo supporta (`capabilities.canLike = false`) il tap
 * risponde con il messaggio "in arrivo", come gli altri controlli non ancora
 * attivi: nessun tap morto, nessuna scrittura.
 *
 * Tre regole, tutte per §83 (niente doppi eventi):
 *  • si invia lo stato desiderato (`liked`), mai "inverti": la RPC è idempotente;
 *  • le richieste sullo stesso Post sono serializzate, così l'ultima scelta
 *    dell'utente è anche l'ultima ad arrivare al server;
 *  • la patch ottimistica tocca solo quel Post, in entrambe le tab e nel
 *    dettaglio; le risposte arrivano alla UI solo quando non ci sono altre
 *    richieste in volo (vedi `createLikeTracker`).
 */

import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";

import { useToast } from "../../ui";
import { trackFeed } from "./feed-analytics";
import { FEED_QK } from "./feed-keys";
import { FEED_SOON_MESSAGES } from "./feed-labels";
import { setPostLike } from "./feed-service";
import type { FeedItem, FeedPage, FeedPageParam, FeedPostItem, FeedScope } from "./feed-types";

type FeedData = InfiniteData<FeedPage, FeedPageParam>;

type LikeState = { likesCount: number; isLiked: boolean };

const SCOPES: readonly FeedScope[] = ["per_te", "seguiti"];

/** Una coda per Post: la richiesta successiva parte quando la precedente è finita. */
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
 * Richieste in volo per Post. Finché ce n’è più d’una, nessuna risposta
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

/** Scrive lo stato Like di UN Post in una pagina di Feed. Pura, testata. */
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
        item.id === itemId && item.type === "post"
          ? { ...item, payload: { ...item.payload, ...state } }
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

type LikeTarget = { item: FeedPostItem; next: LikeState };

export function useToggleFeedPostLike({ profileId }: { profileId: string }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  // §38: Feed e dettaglio mostrano lo stesso stato al ritorno, senza reload.
  const writeEverywhere = (item: FeedPostItem, state: LikeState) => {
    for (const scope of SCOPES) {
      queryClient.setQueryData<FeedData>(FEED_QK.feed(scope, profileId), (data) =>
        patchPostLike(data, item.id, state),
      );
    }
    queryClient.setQueryData<FeedPostItem | null>(
      FEED_QK.postDetail(item.payload.postId),
      (detail) => (detail ? { ...detail, payload: { ...detail.payload, ...state } } : detail),
    );
  };

  const mutation = useMutation({
    mutationFn: ({ item, next }: LikeTarget) =>
      enqueue(item.id, () =>
        setPostLike(item.payload.contentType, item.payload.postId, next.isLiked),
      ),
    onMutate: ({ item, next }) => {
      writeEverywhere(item, next);
    },
    onError: (_error, { item }) => {
      const settled = tracker.settle(item.id, null);
      if (settled) {
        writeEverywhere(item, settled);
      }
      showToast({ message: "Non è stato possibile aggiornare il Mi piace." });
    },
    onSuccess: (server, { item }) => {
      const settled = tracker.settle(item.id, server);
      if (settled) {
        writeEverywhere(item, settled);
      }
    },
  });

  return (item: FeedPostItem) => {
    if (!item.payload.capabilities.canLike) {
      showToast({ message: FEED_SOON_MESSAGES.like });
      return;
    }

    const current = { isLiked: item.payload.isLiked, likesCount: item.payload.likesCount };
    const next = nextLikeState(current);
    trackFeed({ itemId: item.id, liked: next.isLiked, name: "feed_post_like_tap" });
    tracker.begin(item.id, current);
    mutation.mutate({ item, next });
  };
}
