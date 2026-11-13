/**
 * HOM-03 §65–66: il poll centrale dei video in elaborazione.
 *
 * Uno per tab del Feed (FeedPane). La lista riporta gli elementi visibili;
 * il poller interroga `fetch_content_media_states` solo per quelli con un video
 * in elaborazione, con backoff 5 → 10 → 20 → 40 → 60 s e al massimo 10
 * tentativi, e si ferma quando non resta nulla in elaborazione. Un nuovo
 * elemento in elaborazione che entra a schermo azzera il backoff.
 *
 * La risposta patcha la media collection nelle cache delle due tab e nel
 * dettaglio post: mai un refetch del Feed (§65 "senza ricostruire").
 *
 * Sospeso con `enabled=false` (tab non attiva) e quando l'app non è attiva.
 */

import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { useQueryClient, type InfiniteData, type QueryClient } from "@tanstack/react-query";

import { FEED_QK } from "./feed-keys";
import {
  applyMediaStates,
  collectProcessingTargets,
  hasProcessingMedia,
  patchPagesMedia,
  PROCESSING_MAX_ATTEMPTS,
  processingPollDelay,
  type ProcessingTarget,
} from "./feed-media-processing";
import { fetchContentMediaStates, type ContentMediaStates } from "./feed-service";
import type {
  FeedItem,
  FeedMediaItem,
  FeedPage,
  FeedPageParam,
  FeedPostItem,
  FeedScope,
} from "./feed-types";

const SCOPES: readonly FeedScope[] = ["per_te", "seguiti"];

type Updates = ReadonlyMap<string, FeedMediaItem[]>;

export type ProcessingPoller = {
  /** Gli elementi visibili in elaborazione (già filtrati e limitati). */
  setTargets(targets: ProcessingTarget[]): void;
  setActive(active: boolean): void;
  /** Dove scrivere le risposte (cambia con queryClient/profileId). */
  setApply(apply: (updates: Updates, states: ContentMediaStates[]) => void): void;
  dispose(): void;
};

/**
 * Il motore del poll, senza React: timer, backoff e target. Esportato per i
 * test con timer finti.
 */
export function createProcessingPoller(deps: {
  fetchStates: (targets: ProcessingTarget[]) => Promise<ContentMediaStates[]>;
  apply: (updates: Updates, states: ContentMediaStates[]) => void;
}): ProcessingPoller {
  let apply = deps.apply;
  let targets: ProcessingTarget[] = [];
  let attempt = 0;
  let active = false;
  let inFlight = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  // Elementi che la RPC non ha restituito: non più leggibili (HOM-04). Non si
  // interrogano più finché restano a schermo con lo stato vecchio.
  const retired = new Set<string>();

  const clear = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const schedule = () => {
    clear();
    if (!active || inFlight || targets.length === 0 || attempt >= PROCESSING_MAX_ATTEMPTS) {
      return;
    }
    timer = setTimeout(() => void tick(), processingPollDelay(attempt));
  };

  const tick = async () => {
    timer = null;
    const batch = targets;
    inFlight = true;
    try {
      const states = await deps.fetchStates(batch);
      const updates = new Map<string, FeedMediaItem[]>();
      for (const state of states) {
        const target = batch.find(
          (entry) => entry.contentType === state.contentType && entry.postId === state.postId,
        );
        if (target) {
          updates.set(target.itemId, state.media);
        }
      }
      if (updates.size > 0) {
        apply(updates, states);
      }
      const asked = new Set(batch.map((entry) => entry.itemId));
      for (const id of asked) {
        if (!updates.has(id)) {
          retired.add(id);
        }
      }
      targets = targets.filter((entry) => {
        if (!asked.has(entry.itemId)) {
          return true;
        }
        const media = updates.get(entry.itemId);
        return media !== undefined && hasProcessingMedia(media);
      });
    } catch {
      // Errore di rete: si riprova al prossimo giro, con il backoff.
    } finally {
      inFlight = false;
      attempt += 1;
      schedule();
    }
  };

  return {
    setTargets(next) {
      const fresh = next.filter((entry) => !retired.has(entry.itemId));
      const known = new Set(targets.map((entry) => entry.itemId));
      const hasNew = fresh.some((entry) => !known.has(entry.itemId));
      targets = fresh;
      if (fresh.length === 0) {
        clear();
        return;
      }
      if (hasNew) {
        attempt = 0;
        schedule();
      } else if (timer === null) {
        schedule();
      }
    },
    setActive(value) {
      active = value;
      if (value) {
        schedule();
      } else {
        clear();
      }
    },
    setApply(next) {
      apply = next;
    },
    // Non definitivo: con StrictMode gli effetti si smontano e rimontano, e il
    // poller deve poter ripartire con `setActive(true)`.
    dispose() {
      active = false;
      clear();
    },
  };
}

type FeedData = InfiniteData<FeedPage, FeedPageParam>;

/** §65: patch delle cache, nessun refetch. Esportata per i test. */
export function applyProcessingUpdates(
  queryClient: QueryClient,
  profileId: string,
  updates: Updates,
  states: readonly ContentMediaStates[],
): void {
  for (const scope of SCOPES) {
    queryClient.setQueryData<FeedData>(FEED_QK.feed(scope, profileId), (data) => {
      if (!data) {
        return data;
      }
      const pages = patchPagesMedia(data.pages, updates);
      return pages ? { ...data, pages } : data;
    });
  }

  for (const state of states) {
    if (state.contentType !== "profile_post") {
      continue;
    }
    queryClient.setQueryData<FeedPostItem | null>(FEED_QK.postDetail(state.postId), (detail) =>
      detail ? (applyMediaStates(detail, state.media) as FeedPostItem) : detail,
    );
  }
}

export function useFeedMediaProcessing({
  profileId,
  enabled,
}: {
  profileId: string;
  enabled: boolean;
}): { reportVisibleItems(items: readonly FeedItem[]): void } {
  const queryClient = useQueryClient();
  const [appActive, setAppActive] = useState(() => AppState?.currentState !== "background");

  // Il poller vive quanto il componente (identità stabile di
  // `reportVisibleItems` per i callback di viewability); la destinazione delle
  // patch segue queryClient e profileId correnti.
  const [api] = useState(() => {
    const poller = createProcessingPoller({ apply: () => undefined, fetchStates: fetchContentMediaStates });
    return {
      poller,
      reportVisibleItems: (items: readonly FeedItem[]) =>
        poller.setTargets(collectProcessingTargets(items)),
    };
  });

  useEffect(() => {
    api.poller.setApply((updates, states) =>
      applyProcessingUpdates(queryClient, profileId, updates, states),
    );
  }, [api, queryClient, profileId]);

  useEffect(() => {
    const subscription = AppState?.addEventListener?.("change", (state) => {
      setAppActive(state === "active");
    });
    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    api.poller.setActive(enabled && appActive && profileId.length > 0);
  }, [api, enabled, appActive, profileId]);

  useEffect(() => () => api.poller.dispose(), [api]);

  return { reportVisibleItems: api.reportVisibleItems };
}
