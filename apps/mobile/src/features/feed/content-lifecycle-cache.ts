/**
 * Cache dopo un cambio di ciclo di vita del contenuto (HOM-04 §47, §50–53,
 * §72, §105–107).
 *
 * Tutte pure, sul modello di `patchPostLike`: lavorano sulle pagine già caricate
 * della infinite query, senza refetch. Rimuovere l'elemento dalle pagine (e non
 * ricaricare) è ciò che mantiene tab, scroll e contenuti caricati (§107), e non
 * lascia tombstone nel punto dove era il Post (§49).
 */

import type { InfiniteData } from "@tanstack/react-query";

import type { ContentManageCapabilities } from "./content-actions-presentation";
import {
  isContentItem,
  type FeedItem,
  type FeedPage,
  type FeedPageParam,
} from "./feed-types";

type FeedData = InfiniteData<FeedPage, FeedPageParam>;

/** Toglie un contenuto da tutte le pagine caricate. Stessa identità se non c'è. */
export function removeContentFromFeed(
  data: FeedData | undefined,
  itemId: string,
): FeedData | undefined {
  if (!data || !data.pages.some((page) => page.items.some((item) => item.id === itemId))) {
    return data;
  }

  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.filter((item) => item.id !== itemId),
    })),
  };
}

/** §72: scrive le capability di gestione di UN contenuto, lasciando identici gli altri. */
export function patchContentCapabilities(
  data: FeedData | undefined,
  itemId: string,
  patch: ContentManageCapabilities,
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
          ? ({
              ...item,
              payload: { ...item.payload, capabilities: { ...item.payload.capabilities, ...patch } },
            } as FeedItem)
          : item,
      ),
    })),
  };
}

/**
 * Query che mostrano il contenuto fuori dal Feed: Salvati (§51), contenuti
 * taggati nel Profilo (§53), Cerca → Media e contenuti (§52). Si invalidano per
 * prefisso, così ogni variante di filtro si ricarica alla prossima lettura.
 */
export const CONTENT_DELETE_INVALIDATIONS: readonly (readonly string[])[] = [
  ["saved-items"],
  ["saved-counts"],
  ["tagged-content"],
  ["tagged-content-target"],
  ["media-for-you"],
  ["media-sources-discover"],
  ["media-suggestions"],
  ["search-media-content"],
  ["search-media-sources"],
  ["search-media-count"],
];
