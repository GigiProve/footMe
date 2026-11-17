/**
 * Cache del Feed dopo i segnali del viewer: Segnala e Non seguire (HOM-11 §62–§65,
 * §125, §168–§172, §292–§294).
 *
 * Tutte pure, sul modello di `content-lifecycle-cache`: lavorano sulle pagine già
 * caricate della infinite query, senza refetch. Rimuovere o ritoccare gli elementi
 * nelle pagine (e non ricaricare) mantiene tab, scroll e contenuti caricati; il
 * server, al prossimo caricamento, esclude comunque ciò che il viewer ha segnalato
 * (D3) e ripropone solo le fonti ancora seguite.
 *
 * Il target di un elemento è SEMPRE il contenuto canonico (`payload.contentType` +
 * `payload.postId`), mai `item.id`: un Simple Repost ha `id = repost:<tipo>:<id>`
 * (HOM-10 §73) ma il suo target è l'originale (D4).
 */

import type { InfiniteData } from "@tanstack/react-query";

import {
  followKindOfIdentity,
  sameFollowSource,
  type FollowSource,
} from "../following/follow-source";
import {
  isContentItem,
  type FeedContentType,
  type FeedItem,
  type FeedPage,
  type FeedPageParam,
} from "./feed-types";

type FeedData = InfiniteData<FeedPage, FeedPageParam>;

function mapItems(data: FeedData, change: (items: FeedItem[]) => FeedItem[]): FeedData {
  return { ...data, pages: data.pages.map((page) => ({ ...page, items: change(page.items) })) };
}

/** Il contenuto canonico di un elemento, o `null` per i moduli discovery e le posizioni. */
export function canonicalTargetOf(
  item: FeedItem,
): { contentType: FeedContentType; contentId: string } | null {
  return isContentItem(item)
    ? { contentId: item.payload.postId, contentType: item.payload.contentType }
    : null;
}

export function isCanonicalTarget(
  item: FeedItem,
  contentType: FeedContentType,
  contentId: string,
): boolean {
  const target = canonicalTargetOf(item);
  return target !== null && target.contentType === contentType && target.contentId === contentId;
}

/**
 * §125, §171, §293: toglie dalle pagine ogni elemento che porta quel contenuto —
 * compresi i Simple Repost dell'originale segnalato (D3). Stessa identità se non c'è.
 */
export function removeCanonicalContent(
  data: FeedData | undefined,
  contentType: FeedContentType,
  contentId: string,
): FeedData | undefined {
  if (
    !data ||
    !data.pages.some((page) => page.items.some((item) => isCanonicalTarget(item, contentType, contentId)))
  ) {
    return data;
  }

  return mapItems(data, (items) =>
    items.filter((item) => !isCanonicalTarget(item, contentType, contentId)),
  );
}

/** Il Post con testo che incorpora quel contenuto con una reference ancora «disponibile». */
function hasLiveReferenceTo(item: FeedItem, contentType: FeedContentType, contentId: string): boolean {
  const reference = item.type === "post" ? item.payload.reference : null;
  return (
    !!reference &&
    reference.available &&
    reference.contentType === contentType &&
    reference.contentId === contentId
  );
}

/**
 * HOM-15 §118, §182–§183, §341: un contenuto ELIMINATO esce dalle liste — l'elemento canonico
 * e i suoi Simple Repost (`removeCanonicalContent`) — e ogni Post con testo che lo incorpora
 * resta, ma con la reference «non disponibile» (HOM-10 §173–§175: la stessa forma che il
 * mapper dà a una reference senza snapshot). Sugli array, così vale per le pagine in memoria
 * e per la copia su disco. Stessa identità se non c'è nulla da cambiare.
 */
export function forgetDeletedContentInItems(
  items: FeedItem[],
  contentType: FeedContentType,
  contentId: string,
): FeedItem[] {
  if (
    !items.some(
      (item) => isCanonicalTarget(item, contentType, contentId) || hasLiveReferenceTo(item, contentType, contentId),
    )
  ) {
    return items;
  }

  return items
    .filter((item) => !isCanonicalTarget(item, contentType, contentId))
    .map((item): FeedItem =>
      item.type === "post" && item.payload.reference && hasLiveReferenceTo(item, contentType, contentId)
        ? {
            ...item,
            payload: { ...item.payload, reference: { ...item.payload.reference, available: false, snapshot: null } },
          }
        : item,
    );
}

/** `forgetDeletedContentInItems` sulle pagine della infinite query, senza refetch. */
export function forgetDeletedContent(
  data: FeedData | undefined,
  contentType: FeedContentType,
  contentId: string,
): FeedData | undefined {
  if (!data) {
    return data;
  }
  const pages = data.pages.map((page) => {
    const items = forgetDeletedContentInItems(page.items, contentType, contentId);
    return items === page.items ? page : { ...page, items };
  });
  return pages.every((page, index) => page === data.pages[index]) ? data : { ...data, pages };
}

/**
 * La fonte che un elemento rappresenta per il Follow (D4, §145, §284): per un Simple
 * Repost il reposter rappresentativo, altrimenti l'autore del contenuto.
 */
export function followSourceOfItem(item: FeedItem): FollowSource | null {
  if (!isContentItem(item)) {
    return null;
  }
  if (item.repost) {
    const { identityId, identityType, name } = item.repost.reposter;
    return { id: identityId, kind: followKindOfIdentity(identityType), name };
  }
  return item.author ? { id: item.author.id, kind: item.author.kind, name: item.author.name } : null;
}

/** L'autore del contenuto come fonte (anche per un wrapper: è l'autore dell'originale). */
export function authorSourceOfItem(item: FeedItem): FollowSource | null {
  return isContentItem(item) && item.author
    ? { id: item.author.id, kind: item.author.kind, name: item.author.name }
    : null;
}

/**
 * §62, §172: scrive `isFollowingAuthor` su ogni elemento di quell'autore, lasciando
 * identici gli altri. Per te mantiene l'elemento (§63): cambia solo che il menu non
 * offre più «Non seguire».
 */
export function patchAuthorFollowing(
  data: FeedData | undefined,
  source: Pick<FollowSource, "kind" | "id">,
  following: boolean,
): FeedData | undefined {
  if (!data) {
    return data;
  }

  const touches = (item: FeedItem) => {
    const author = authorSourceOfItem(item);
    return author !== null && sameFollowSource(author, source) && item.isFollowingAuthor !== following;
  };
  if (!data.pages.some((page) => page.items.some(touches))) {
    return data;
  }

  return mapItems(data, (items) =>
    items.map((item): FeedItem => (touches(item) ? ({ ...item, isFollowingAuthor: following } as FeedItem) : item)),
  );
}

/**
 * §64: in Seguiti la fonte non appartiene più alle identità seguite: ne escono gli
 * elementi (per un wrapper vale il reposter, §145). Stessa identità se non ce ne sono.
 */
export function removeSourceItems(
  data: FeedData | undefined,
  source: Pick<FollowSource, "kind" | "id">,
): FeedData | undefined {
  if (!data) {
    return data;
  }

  const fromSource = (item: FeedItem) => {
    const itemSource = followSourceOfItem(item);
    return itemSource !== null && sameFollowSource(itemSource, source);
  };
  if (!data.pages.some((page) => page.items.some(fromSource))) {
    return data;
  }

  return mapItems(data, (items) => items.filter((item) => !fromSource(item)));
}

/**
 * §65, §125, §169, §171: filtro di LETTURA applicato a ogni render della lista, per le
 * pagine che arrivano dopo un segnale nella stessa sessione e per le pagine in cache
 * non ancora ripulite.
 *
 *  • segnalato dal viewer (payload `viewer_has_reported` o insieme di sessione): fuori da
 *    entrambe le tab, compresi i Simple Repost dell'originale (D3);
 *  • fonte lasciata in sessione: fuori da Seguiti (§64–§65), mai da Per te (§63). Solo
 *    se `isUnfollowed` è dato: Per te non lo passa.
 *
 * Nessun elemento viene mai scartato per altro motivo: Per te e Seguiti restano
 * ciò che il server ha deciso.
 */
export function filterViewerSignals(
  items: readonly FeedItem[],
  signals: {
    isReported: (contentType: FeedContentType, contentId: string) => boolean;
    isUnfollowed?: (source: FollowSource) => boolean;
  },
): FeedItem[] {
  return items.filter((item) => {
    if (!isContentItem(item)) {
      return true;
    }
    if (item.viewerHasReported === true || signals.isReported(item.payload.contentType, item.payload.postId)) {
      return false;
    }
    if (signals.isUnfollowed) {
      const source = followSourceOfItem(item);
      return source === null || !signals.isUnfollowed(source);
    }
    return true;
  });
}
