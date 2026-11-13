/**
 * Cache locale del Feed (§27): contenuti caricati, tab attiva, posizione di
 * scroll per tab, pagina di paginazione, timestamp ultimo aggiornamento, stato
 * del modulo di primo accesso, contenuti già visualizzati nella sessione.
 *
 * Segue il template di `features/search/recent-searches.ts`: prefisso +
 * profileId, type guard scritti a mano, e ogni accesso avvolto in try/catch che
 * ingoia l'errore. La cache è best-effort per definizione — se AsyncStorage
 * fallisce, il Feed deve caricare da rete, non rompersi.
 *
 * Un record per profilo, così il ritorno alla Home costa UNA lettura sola.
 *
 * `isFeedItem` scarta i `type` sconosciuti: un client vecchio che trova in cache
 * un payload scritto da una versione più nuova lo ignora invece di renderlo.
 * Qualsiasi errore di validazione fa cadere tutto il record (`null`), cioè un
 * caricamento fresco: una cache parzialmente valida è peggio di nessuna cache.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

import { FEED_ITEM_TYPES, type FeedItem, type FeedItemType, type FeedScope } from "./feed-types";

const PREFIX = "@footme/feed/v1/";

/** Quanti elementi si conservano per tab: basta per riempire la prima schermata. */
export const FEED_CACHE_ITEM_CAP = 30;
/** Quanti id "già visti" si ricordano tra le sessioni. */
export const FEED_CACHE_SEEN_CAP = 200;
/** Oltre questa età gli id visti non servono più: il Feed è cambiato. */
const SEEN_TTL_MS = 24 * 60 * 60 * 1000;

export type FeedScrollState = {
  offset: number;
  itemCount: number;
  savedAt: string;
};

export type CachedFeedScope = {
  items: FeedItem[];
  pageCount: number;
  updatedAt: string;
  scroll: FeedScrollState | null;
  seenIds: string[];
};

export type CachedFeedFirstAccess = {
  personalizeCompletedAt: string | null;
  personalizeDismissedAt: string | null;
  /** Non più letto né scritto da HOM-01.1 §24 (helper Seguiti rimosso). Resta per non cambiare lo schema v1. */
  followingHintShownCount: number;
};

export type CachedFeed = {
  version: 1;
  activeScope: FeedScope;
  scopes: Record<FeedScope, CachedFeedScope>;
  firstAccess: CachedFeedFirstAccess;
  /** Non più letto né scritto da HOM-01.1 §45 (banner rimosso). Resta per non cambiare lo schema v1. */
  resumeBannerShownAt: string | null;
};

const SCOPES: readonly FeedScope[] = ["per_te", "seguiti"];

function emptyScope(): CachedFeedScope {
  return {
    items: [],
    pageCount: 0,
    updatedAt: new Date(0).toISOString(),
    scroll: null,
    seenIds: [],
  };
}

export function emptyFeedCache(): CachedFeed {
  return {
    version: 1,
    activeScope: "per_te",
    scopes: { per_te: emptyScope(), seguiti: emptyScope() },
    firstAccess: {
      personalizeCompletedAt: null,
      personalizeDismissedAt: null,
      followingHintShownCount: 0,
    },
    resumeBannerShownAt: null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** I tipi che portano media collection e capability (Post, Articolo, video editoriale). */
const CONTENT_TYPES_WITH_MEDIA: readonly string[] = ["post", "article", "video"];

function isFeedItem(value: unknown): value is FeedItem {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.type === "string" &&
    FEED_ITEM_TYPES.includes(value.type as FeedItemType) &&
    typeof value.rank === "number" &&
    isRecord(value.payload) &&
    // HOM-02: un Post salvato da un client pre-HOM-02 non ha la media
    // collection né le capability. Si scarta quel solo elemento (il Feed lo
    // ricarica dalla rete) invece di renderizzarlo a metà. HOM-03: la stessa
    // regola vale per Articolo e video editoriale, che ora hanno lo stesso
    // payload del Post.
    (!CONTENT_TYPES_WITH_MEDIA.includes(value.type) ||
      (Array.isArray(value.payload.media) && isRecord(value.payload.capabilities)))
  );
}

/**
 * HOM-03 §71, §84: un media scritto in cache da HOM-02 non ha `createdAt`,
 * `variants` e `captions`. Mancano solo campi additivi, quindi si completano
 * con i default invece di scartare il Post: il Feed resta pieno al primo avvio
 * dopo l'aggiornamento.
 */
function withMediaDefaults(item: FeedItem): FeedItem {
  if (item.type !== "post" && item.type !== "article" && item.type !== "video") {
    return item;
  }

  const media = item.payload.media.map((entry) => {
    const raw = entry as Partial<typeof entry>;
    return {
      ...entry,
      createdAt: typeof raw.createdAt === "string" ? raw.createdAt : null,
      variants: Array.isArray(raw.variants) ? raw.variants : [],
      captions: Array.isArray(raw.captions) ? raw.captions : [],
    };
  });

  return { ...item, payload: { ...item.payload, media } } as FeedItem;
}

function isScrollState(value: unknown): value is FeedScrollState {
  return (
    isRecord(value) &&
    typeof value.offset === "number" &&
    Number.isFinite(value.offset) &&
    typeof value.itemCount === "number" &&
    typeof value.savedAt === "string"
  );
}

function parseScope(value: unknown): CachedFeedScope {
  if (!isRecord(value)) {
    return emptyScope();
  }

  const items = Array.isArray(value.items)
    ? value.items.filter(isFeedItem).slice(0, FEED_CACHE_ITEM_CAP).map(withMediaDefaults)
    : [];
  const updatedAt =
    typeof value.updatedAt === "string" ? value.updatedAt : new Date(0).toISOString();
  const seenFresh = Date.now() - new Date(updatedAt).getTime() < SEEN_TTL_MS;

  return {
    items,
    pageCount: typeof value.pageCount === "number" ? value.pageCount : 0,
    updatedAt,
    scroll: isScrollState(value.scroll) ? value.scroll : null,
    seenIds:
      seenFresh && Array.isArray(value.seenIds)
        ? value.seenIds
            .filter((id): id is string => typeof id === "string")
            .slice(0, FEED_CACHE_SEEN_CAP)
        : [],
  };
}

function parseCache(raw: string): CachedFeed | null {
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed) || parsed.version !== 1) {
    return null;
  }

  const scopes = isRecord(parsed.scopes) ? parsed.scopes : {};
  const firstAccess = isRecord(parsed.firstAccess) ? parsed.firstAccess : {};

  return {
    version: 1,
    activeScope:
      parsed.activeScope === "seguiti" || parsed.activeScope === "per_te"
        ? parsed.activeScope
        : "per_te",
    scopes: {
      per_te: parseScope(scopes.per_te),
      seguiti: parseScope(scopes.seguiti),
    },
    firstAccess: {
      personalizeCompletedAt:
        typeof firstAccess.personalizeCompletedAt === "string"
          ? firstAccess.personalizeCompletedAt
          : null,
      personalizeDismissedAt:
        typeof firstAccess.personalizeDismissedAt === "string"
          ? firstAccess.personalizeDismissedAt
          : null,
      followingHintShownCount:
        typeof firstAccess.followingHintShownCount === "number"
          ? firstAccess.followingHintShownCount
          : 0,
    },
    resumeBannerShownAt:
      typeof parsed.resumeBannerShownAt === "string" ? parsed.resumeBannerShownAt : null,
  };
}

export async function loadFeedCache(profileId: string): Promise<CachedFeed | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + profileId);
    return raw ? parseCache(raw) : null;
  } catch {
    return null;
  }
}

async function writeCache(profileId: string, next: CachedFeed): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFIX + profileId, JSON.stringify(next));
  } catch {
    // Best-effort: la cache non deve mai bloccare il Feed.
  }
}

async function currentCache(profileId: string): Promise<CachedFeed> {
  return (await loadFeedCache(profileId)) ?? emptyFeedCache();
}

export async function saveFeedCacheScope(
  profileId: string,
  scope: FeedScope,
  patch: Partial<CachedFeedScope>,
): Promise<void> {
  const cache = await currentCache(profileId);
  const previous = cache.scopes[scope];

  const merged: CachedFeedScope = {
    ...previous,
    ...patch,
    items: (patch.items ?? previous.items).slice(0, FEED_CACHE_ITEM_CAP),
    seenIds: (patch.seenIds ?? previous.seenIds).slice(0, FEED_CACHE_SEEN_CAP),
  };

  await writeCache(profileId, {
    ...cache,
    scopes: { ...cache.scopes, [scope]: merged },
  });
}

/**
 * `firstAccess` si aggiorna per chiavi: chi chiude il modulo di primo accesso
 * conosce solo il proprio campo, non lo stato completo.
 */
export async function saveFeedCacheMeta(
  profileId: string,
  patch: {
    activeScope?: FeedScope;
    firstAccess?: Partial<CachedFeedFirstAccess>;
    resumeBannerShownAt?: string | null;
  },
): Promise<void> {
  const cache = await currentCache(profileId);

  await writeCache(profileId, {
    ...cache,
    activeScope: patch.activeScope ?? cache.activeScope,
    resumeBannerShownAt:
      patch.resumeBannerShownAt !== undefined
        ? patch.resumeBannerShownAt
        : cache.resumeBannerShownAt,
    firstAccess: patch.firstAccess
      ? { ...cache.firstAccess, ...patch.firstAccess }
      : cache.firstAccess,
  });
}

export async function clearFeedCache(profileId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(PREFIX + profileId);
  } catch {
    // Best-effort.
  }
}

export { SCOPES as FEED_CACHE_SCOPES };
