/**
 * HOM-03 §62–66, §121: i video ancora in elaborazione diventano pronti senza
 * ricostruire il Feed.
 *
 * Funzioni pure; il timer e le cache stanno in use-feed-media-processing.ts.
 *
 *  • §66 niente polling aggressivo: un solo poll centrale, con backoff, solo
 *    per gli elementi visibili, al massimo 20 per chiamata;
 *  • §65 la risposta sostituisce SOLO la media collection dell'elemento;
 *    se nulla è cambiato l'elemento resta lo stesso oggetto (nessun render);
 *  • §64 `uploaded` vale come `processing`.
 */

import { CONTENT_MEDIA_STATES_LIMIT } from "./feed-service";
import {
  isContentItem,
  type FeedContentType,
  type FeedItem,
  type FeedMediaItem,
  type FeedMediaProcessingState,
} from "./feed-types";

/** Ritardi successivi del poll; dopo l'ultimo si resta a 60 s. */
export const PROCESSING_POLL_DELAYS_MS = [5000, 10000, 20000, 40000, 60000];
/** Oltre questi tentativi senza novità il poll si ferma fino a nuovi target. */
export const PROCESSING_MAX_ATTEMPTS = 10;
/** Coppie per chiamata (lo stesso tetto della RPC). */
export const PROCESSING_MAX_TARGETS = CONTENT_MEDIA_STATES_LIMIT;

export type ProcessingTarget = {
  contentType: FeedContentType;
  postId: string;
  itemId: string;
};

/** §64: `uploaded` e `processing` sono lo stesso stato per l'utente. */
export function isProcessingState(state: FeedMediaProcessingState): boolean {
  return state === "uploaded" || state === "processing";
}

export function hasProcessingMedia(media: readonly FeedMediaItem[]): boolean {
  return media.some((entry) => entry.type === "video" && isProcessingState(entry.processingState));
}

/** Ritardo prima del tentativo `attempt` (0-based). */
export function processingPollDelay(attempt: number): number {
  return (
    PROCESSING_POLL_DELAYS_MS[Math.max(0, attempt)] ??
    PROCESSING_POLL_DELAYS_MS[PROCESSING_POLL_DELAYS_MS.length - 1]
  );
}

/** Gli elementi visibili con almeno un video in elaborazione, senza doppioni, al massimo 20. */
export function collectProcessingTargets(
  items: readonly FeedItem[],
): ProcessingTarget[] {
  const seen = new Set<string>();
  const targets: ProcessingTarget[] = [];

  for (const item of items) {
    if (!isContentItem(item) || seen.has(item.id) || !hasProcessingMedia(item.payload.media)) {
      continue;
    }
    seen.add(item.id);
    targets.push({
      contentType: item.payload.contentType,
      itemId: item.id,
      postId: item.payload.postId,
    });
    if (targets.length === PROCESSING_MAX_TARGETS) {
      break;
    }
  }

  return targets;
}

function sameMedia(a: readonly FeedMediaItem[], b: readonly FeedMediaItem[]): boolean {
  return (
    a.length === b.length &&
    a.every((entry, index) => {
      const other = b[index];
      return (
        entry.id === other.id &&
        entry.type === other.type &&
        entry.processingState === other.processingState &&
        entry.availability === other.availability &&
        entry.url === other.url &&
        entry.thumbnailUrl === other.thumbnailUrl &&
        entry.durationSeconds === other.durationSeconds &&
        entry.width === other.width &&
        entry.height === other.height &&
        entry.variants.length === other.variants.length &&
        entry.captions.length === other.captions.length
      );
    })
  );
}

/**
 * §65: la nuova media collection al posto della vecchia, nient'altro.
 * Restituisce lo stesso oggetto quando non cambia nulla.
 */
export function applyMediaStates(item: FeedItem, media: FeedMediaItem[]): FeedItem {
  if (!isContentItem(item) || sameMedia(item.payload.media, media)) {
    return item;
  }
  return { ...item, payload: { ...item.payload, media } } as FeedItem;
}

/**
 * Applica gli aggiornamenti (per id elemento) a una lista di pagine. Le pagine
 * e le liste non toccate restano gli stessi oggetti.
 */
export function patchPagesMedia<TPage extends { items: FeedItem[] }>(
  pages: readonly TPage[],
  updates: ReadonlyMap<string, FeedMediaItem[]>,
): TPage[] | null {
  let changed = false;
  const next = pages.map((page) => {
    let pageChanged = false;
    const items = page.items.map((item) => {
      const media = updates.get(item.id);
      if (!media) {
        return item;
      }
      const patched = applyMediaStates(item, media);
      if (patched !== item) {
        pageChanged = true;
      }
      return patched;
    });
    if (!pageChanged) {
      return page;
    }
    changed = true;
    return { ...page, items };
  });
  return changed ? next : null;
}
