/**
 * «Non seguire <nome>» dal menu di un contenuto o di un commento (HOM-11 §54–§68,
 * §145, §172, §178, §187, §200, §246–§253, §284).
 *
 * Cambia ESCLUSIVAMENTE la relazione Follow, nel sistema globale: riusa
 * `toggleFollowSource` (`profile_follows` per persone e Media, `club_follows` per le
 * Società, §55) e non ha tabelle né RPC proprie. Nessuna cascata: non crea un
 * «Non mi interessa» (§67) né una segnalazione (§66), e non notifica l'autore (§68).
 *
 *  • tap → nessuna conferma (§58) e aggiornamento OTTIMISTICO: la fonte entra
 *    nell'insieme di sessione, le pagine del Feed in cache si ritoccano (Per te
 *    mantiene il contenuto, §63; Seguiti ne perde gli elementi della fonte, §64:
 *    vedi `createFollowFeedCache`). L'insieme di sessione non è la verità: lo smentisce
 *    un dato server più nuovo (`reconcile-follow.ts`, §173);
 *  • confermato dal server → snackbar «Non segui più <nome> · Annulla» col nome
 *    dell'identità davvero lasciata (§59, §224); Annulla ripristina il Follow (§61);
 *  • errore → rollback completo e messaggio (stesso copy di §52);
 *  • un solo Follow per fonte per volta (§178): la guardia è un set, non lo stato.
 *
 * La logica sta in `createUnfollowActions`, senza React e con le dipendenze iniettate,
 * così si prova senza renderizzare niente; `useUnfollowFromContent` la lega al Follow
 * reale, alla cache e al Toast.
 */

import { useRef } from "react";
import { useQueryClient, type InfiniteData, type QueryClient } from "@tanstack/react-query";

import { useToast, type ToastOptions } from "../../ui";
import { useSession } from "../auth/use-session";
import type { ContentOrigin } from "../feed/content-routes";
import { FEED_QK } from "../feed/feed-keys";
import { patchAuthorFollowing, removeSourceItems } from "../feed/feed-signal-cache";
import type { FeedPage, FeedPageParam, FeedScope } from "../feed/feed-types";
import { toggleFollowSource } from "../search/media/media-search-service";
import { trackFollow, type FollowAnalyticsEvent, type FollowEventSurface } from "./following-analytics";
import { followSourceKey, type FollowSource } from "./follow-source";
import { invalidateFollowQueries, type FollowChange } from "./invalidate-follow-queries";
import { unfollowedSourcesStore, type UnfollowedSourcesStore } from "./unfollowed-sources-store";

type FeedData = InfiniteData<FeedPage, FeedPageParam>;
type FeedSnapshots = Partial<Record<FeedScope, FeedData | undefined>>;

const SCOPES: readonly FeedScope[] = ["per_te", "seguiti"];

/** §59: «Non segui più Marco Bianchi». */
export function unfollowMessage(name: string): string {
  return `Non segui più ${name}`;
}

export const UNFOLLOW_UNDO_LABEL = "Annulla";
/** Lo stesso copy dell'errore di «Non mi interessa» (§52): nessun testo tecnico. */
export const FOLLOW_CHANGE_ERROR = "Non è stato possibile completare l'operazione.";

export type UnfollowRequest = {
  source: FollowSource;
  origin: ContentOrigin | null;
  surface: FollowEventSurface;
};

export type FollowCache = {
  /** Ritocca le pagine in cache e ritorna com'erano, per il rollback e per Annulla. */
  applyUnfollow: (source: FollowSource) => FeedSnapshots;
  /** Rimette le pagine com'erano (errore, o Annulla). */
  restoreFollow: (source: FollowSource, snapshots: FeedSnapshots) => void;
  /** §62, §172, HOM-15 §179: la lista unica di `invalidate-follow-queries`. */
  invalidateFollowQueries: (change: FollowChange) => void;
};

type Deps = {
  setFollow: (source: FollowSource, shouldFollow: boolean) => Promise<void>;
  store: UnfollowedSourcesStore;
  cache: FollowCache;
  notify: (options: ToastOptions) => void;
  track: (event: FollowAnalyticsEvent) => void;
};

export type UnfollowActions = {
  unfollow: (request: UnfollowRequest) => Promise<void>;
};

/**
 * `inFlight` è iniettabile: l'hook ricrea le azioni a ogni render, ma la guardia del
 * doppio tap (§178) deve sopravvivere ai render.
 */
export function createUnfollowActions(
  deps: Deps,
  inFlight: Set<string> = new Set<string>(),
): UnfollowActions {
  const { cache, notify, setFollow, store, track } = deps;

  function base(request: UnfollowRequest) {
    return {
      origin: request.origin,
      source: "content_action_sheet" as const,
      sourceKind: request.source.kind,
      surface: request.surface,
    };
  }

  async function restore(request: UnfollowRequest, snapshots: FeedSnapshots): Promise<void> {
    const key = followSourceKey(request.source);
    if (inFlight.has(key)) {
      return;
    }
    inFlight.add(key);

    // §61: il Follow torna subito nella UI; il server segue.
    store.remove(key);
    cache.restoreFollow(request.source, snapshots);

    try {
      await setFollow(request.source, true);
      track({ ...base(request), name: "follow_restore_success" });
      cache.invalidateFollowQueries({ following: true, source: request.source });
    } catch {
      // Il server non l'ha rimesso: si torna a «non seguita» (rimozione già confermata prima).
      store.add(key, Date.now());
      cache.applyUnfollow(request.source);
      track({ ...base(request), name: "follow_restore_failure" });
      notify({ id: "unfollow-error", message: FOLLOW_CHANGE_ERROR });
    } finally {
      inFlight.delete(key);
    }
  }

  async function unfollow(request: UnfollowRequest): Promise<void> {
    const key = followSourceKey(request.source);
    // Doppio tap: nessuna seconda richiesta (§178). NON si esce su `store.has`: lo store vale
    // solo finché il server non lo smentisce (§173), e se il viewer ha ri-seguito la fonte da
    // un'altra superficie la richiesta deve partire. Una cancellazione ripetuta è idempotente.
    if (inFlight.has(key)) {
      return;
    }
    inFlight.add(key);

    track({ ...base(request), name: "follow_remove_selected" });
    // §58: aggiornamento ottimistico della relazione. Con la scrittura in volo nessun dato
    // server può smentirla (`at = Infinity`); la fissa `settle` alla risposta.
    store.add(key);
    const snapshots = cache.applyUnfollow(request.source);

    try {
      await setFollow(request.source, false);
      store.settle(key, Date.now());
      track({ ...base(request), name: "follow_remove_success" });
      cache.invalidateFollowQueries({ following: false, source: request.source });
      // §59, §61: la snackbar col nome reale e Annulla.
      notify({
        action: { label: UNFOLLOW_UNDO_LABEL, onPress: () => void restore(request, snapshots) },
        id: "unfollow",
        message: unfollowMessage(request.source.name),
      });
    } catch {
      store.remove(key);
      cache.restoreFollow(request.source, snapshots);
      track({ ...base(request), name: "follow_remove_failure" });
      notify({ id: "unfollow-error", message: FOLLOW_CHANGE_ERROR });
    } finally {
      inFlight.delete(key);
    }
  }

  return { unfollow };
}

/**
 * La cache del Feed dopo «Non seguire», con la regola per tab:
 *  • Per te (§63): il contenuto RESTA. Si ritocca solo `isFollowingAuthor`, così il menu non
 *    offre più «Non seguire»; nessun elemento esce, nessun salto di scroll;
 *  • Seguiti (§64–§65): la fonte non appartiene più alle identità seguite, quindi i suoi
 *    elementi escono dalle pagine in cache (il filtro di sessione copre le pagine successive).
 */
export function createFollowFeedCache(queryClient: QueryClient, viewerId: string): FollowCache {
  return {
    applyUnfollow: (source) => {
      const snapshots: FeedSnapshots = {};
      for (const scope of SCOPES) {
        const queryKey = FEED_QK.feed(scope, viewerId);
        snapshots[scope] = queryClient.getQueryData<FeedData>(queryKey);
        queryClient.setQueryData<FeedData>(queryKey, (data) => {
          const patched = patchAuthorFollowing(data, source, false);
          return scope === "seguiti" ? removeSourceItems(patched, source) : patched;
        });
      }
      return snapshots;
    },
    invalidateFollowQueries: (change) => invalidateFollowQueries(queryClient, viewerId, change),
    restoreFollow: (source, snapshots) => {
      for (const scope of SCOPES) {
        const queryKey = FEED_QK.feed(scope, viewerId);
        const before = snapshots[scope];
        const current = queryClient.getQueryData<FeedData>(queryKey);

        // Per te non ha perso nulla: basta rimettere il flag.
        // Seguiti, nessuna pagina nuova nel frattempo: si rimette la cache com'era, elementi
        // della fonte inclusi, senza salti. Altrimenti si corregge solo il flag e si marca la
        // lista da rileggere al prossimo refresh.
        if (scope === "seguiti" && before && current && current.pages.length <= before.pages.length) {
          queryClient.setQueryData<FeedData>(queryKey, before);
        } else {
          queryClient.setQueryData<FeedData>(queryKey, (data) => patchAuthorFollowing(data, source, true));
          if (scope === "seguiti") {
            void queryClient.invalidateQueries({ queryKey, refetchType: "none" });
          }
        }
      }
    },
  };
}

/** Le azioni legate al Follow globale reale, alla cache del Feed e al Toast. */
export function useUnfollowFromContent(): UnfollowActions {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const viewerId = profile?.id ?? "";
  const inFlightRef = useRef(new Set<string>());

  const cache = createFollowFeedCache(queryClient, viewerId);

  return createUnfollowActions(
    {
      cache,
      notify: showToast,
      setFollow: (source, shouldFollow) =>
        toggleFollowSource(viewerId, source.kind === "club" ? "club" : "media_profile", source.id, shouldFollow),
      store: unfollowedSourcesStore,
      track: trackFollow,
    },
    inFlightRef.current,
  );
}
