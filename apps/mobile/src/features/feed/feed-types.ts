/**
 * Tipi della Home/Feed (Blocco 1).
 *
 * Due livelli distinti, volutamente separati:
 *
 *  1. `Feed*Row` — forme grezze che rispecchiano 1:1 le colonne delle RPC in
 *     snake_case. Non esistono tipi Supabase generati in questo progetto,
 *     quindi queste dichiarazioni *sono* il contratto con
 *     `fetch_home_feed_page` / `fetch_home_feed_updates` /
 *     `fetch_home_following_state` / `fetch_home_suggested_profiles` /
 *     `fetch_home_suggested_clubs` / `fetch_my_feed_intro`
 *     (20260727120000 e 20260727130000).
 *  2. `FeedItem` — union discriminata in camelCase su cui lavorano i
 *     componenti. `mapFeedRow` in feed-service.ts è l'unico ponte tra i due,
 *     come `buildMediaFilterPayload` lo è per CER-05.
 *
 * `FeedPositionPayload` NON contiene requisiti, descrizione, scadenza né
 * percentuali di compatibilità: il §9 li vieta nel contenitore del Feed, e
 * tenerli fuori dal *tipo* rende la UI vietata non rappresentabile invece di
 * affidarsi alla disciplina di chi scrive il componente.
 */

import type { MediaContentType } from "../search/media/media-search-types";

export type { MediaContentType };

/** Le due tab della Home (§3). Nessuna terza tab in questo blocco. */
export type FeedScope = "per_te" | "seguiti";

/** I sei tipi di componente che la spina può emettere (§26). */
export type FeedItemType =
  | "suggested_position"
  | "post"
  | "suggested_profiles"
  | "article"
  | "video"
  | "suggested_clubs";

/**
 * Elenco esplicito: guida il test di esaustività del renderer, che è ciò che
 * garantisce che un tipo aggiunto in futuro non passi inosservato.
 */
export const FEED_ITEM_TYPES: readonly FeedItemType[] = [
  "suggested_position",
  "post",
  "suggested_profiles",
  "article",
  "video",
  "suggested_clubs",
];

/** Segnale server per evitare che tutti gli elementi abbiano la stessa altezza (§8). */
export type FeedLayoutHint = "compact" | "standard" | "tall" | "carousel";

/** Chiavi di motivo prodotte da `footme_feed_reason_label`. */
export type FeedReasonKey =
  | "followed_club_publisher"
  | "followed_profile_publisher"
  | "followed_club_position"
  | "same_region"
  | "preferred_source"
  | "open_position_match"
  | "popular_now"
  | "not_followed_yet";

export type FeedNavKind = "content" | "position";

// ────────────────────────────────────────────────────────────────
// Righe grezze delle RPC
// ────────────────────────────────────────────────────────────────

export type FeedItemRow = {
  item_uid: string;
  item_type: string;
  rank_position: number;
  rank_bucket: number;
  layout_hint: string;
  component_version: number;
  title: string | null;
  excerpt: string | null;
  thumbnail_url: string | null;
  published_at: string | null;
  author_kind: "club" | "profile" | null;
  author_id: string | null;
  author_name: string | null;
  author_avatar_url: string | null;
  author_source_kind: string | null;
  author_is_verified: boolean;
  is_seen: boolean;
  is_saved: boolean;
  is_following_author: boolean;
  suggestion_reason_key: string | null;
  suggestion_reason_label: string | null;
  nav_kind: string | null;
  nav_params: Record<string, string | null> | null;
  data: Record<string, unknown> | null;
  as_of: string;
  next_cursor_bucket: number | null;
  next_cursor_published_at: string | null;
  next_cursor_uid: string | null;
  is_last_page: boolean;
};

export type FeedUpdatesRow = {
  new_items_count: number;
  newest_published_at: string | null;
  preview_avatar_urls: string[] | null;
};

export type FeedFollowingStateRow = {
  followed_profiles_count: number;
  followed_clubs_count: number;
  has_published_content: boolean;
  newest_published_at: string | null;
};

export type FeedSuggestedProfileRow = {
  item_uid: string;
  entity_id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  region: string | null;
  city: string | null;
  primary_position: string | null;
  current_club_name: string | null;
  is_following: boolean;
  is_saved: boolean;
  suggestion_reason_key: string | null;
  suggestion_reason_label: string | null;
  component_version: number;
};

export type FeedSuggestedClubRow = {
  item_uid: string;
  entity_id: string;
  name: string;
  logo_url: string | null;
  city: string | null;
  province: string | null;
  region: string | null;
  category: string | null;
  open_positions_count: number;
  is_following: boolean;
  is_saved: boolean;
  suggestion_reason_key: string | null;
  suggestion_reason_label: string | null;
  component_version: number;
};

/** Chiavi delle 4 opzioni del modulo di primo accesso (§6). */
export type FeedPreferenceKey =
  | "wants_players"
  | "wants_clubs"
  | "wants_positions"
  | "wants_local_media";

export type FeedIntroRow = {
  pref_key: string;
  label: string;
  prefill: boolean;
  is_derivable: boolean;
  intro_state: string;
  should_show: boolean;
};

export type FeedIntroOption = {
  key: FeedPreferenceKey;
  label: string;
  prefill: boolean;
  isDerivable: boolean;
};

export type FeedIntro = {
  shouldShow: boolean;
  state: "pending" | "completed" | "skipped";
  options: FeedIntroOption[];
};

// ────────────────────────────────────────────────────────────────
// Cursore e pagina
// ────────────────────────────────────────────────────────────────

/**
 * `asOf` è la parte portante: la spina rifiuta un cursore senza di esso
 * proprio perché ricalcolare il bucket su un istante diverso produrrebbe
 * duplicati o salti silenziosi.
 */
export type FeedCursor = {
  asOf: string;
  bucket: number;
  publishedAt: string;
  uid: string;
};

/** `pageParam` di useInfiniteQuery: la pagina 0 non ha cursore ma può avere un asOf. */
export type FeedPageParam = {
  cursor: FeedCursor | null;
  pageIndex: number;
};

export type FeedPage = {
  items: FeedItem[];
  pageIndex: number;
  asOf: string;
  nextCursor: FeedCursor | null;
  isLastPage: boolean;
};

// ────────────────────────────────────────────────────────────────
// Payload per tipo
// ────────────────────────────────────────────────────────────────

export type FeedPostPayload = {
  contentType: MediaContentType;
  postId: string;
  kindLabel: string | null;
  text: string | null;
  isTruncated: boolean;
  imageUrl: string | null;
  mediaType: "image" | "video" | null;
};

export type FeedEditorialPayload = {
  contentType: MediaContentType;
  postId: string;
  kindLabel: string | null;
  intro: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
};

export type FeedPositionPayload = {
  adId: string;
  clubId: string;
  clubName: string | null;
  clubLogoUrl: string | null;
  teamName: string | null;
  teamType: string | null;
  roleRequired: string | null;
  category: string | null;
  city: string | null;
  province: string | null;
  region: string | null;
  targetRole: string | null;
  isSecondaryMatch: boolean;
};

export type FeedDiscoveryPayload = {
  moduleKey: "suggested_profiles" | "suggested_clubs";
  moduleLimit: number;
};

// ────────────────────────────────────────────────────────────────
// Union discriminata
// ────────────────────────────────────────────────────────────────

type FeedAuthor = {
  kind: "club" | "profile";
  id: string;
  name: string;
  avatarUrl: string | null;
  sourceKind: string | null;
  /** §10: "eventuale verifica". Società e profili Media verificati. */
  isVerified: boolean;
};

type FeedEnvelope<TType extends FeedItemType, TPayload> = {
  /** Chiave globale stabile (`<content_type>:<uuid>`), base di ogni dedup. */
  id: string;
  type: TType;
  rank: number;
  version: number;
  layoutHint: FeedLayoutHint;
  publishedAt: string | null;
  author: FeedAuthor | null;
  reasonKey: FeedReasonKey | null;
  reasonLabel: string | null;
  isSeen: boolean;
  isSaved: boolean;
  isFollowingAuthor: boolean;
  nav: { kind: FeedNavKind; params: Record<string, string> } | null;
  payload: TPayload;
};

export type FeedPostItem = FeedEnvelope<"post", FeedPostPayload> & {
  title: string | null;
};
export type FeedArticleItem = FeedEnvelope<"article", FeedEditorialPayload> & {
  title: string | null;
};
export type FeedVideoItem = FeedEnvelope<"video", FeedEditorialPayload> & {
  title: string | null;
};
export type FeedPositionItem = FeedEnvelope<
  "suggested_position",
  FeedPositionPayload
>;
export type FeedSuggestedProfilesItem = FeedEnvelope<
  "suggested_profiles",
  FeedDiscoveryPayload
>;
export type FeedSuggestedClubsItem = FeedEnvelope<
  "suggested_clubs",
  FeedDiscoveryPayload
>;

export type FeedItem =
  | FeedPostItem
  | FeedArticleItem
  | FeedVideoItem
  | FeedPositionItem
  | FeedSuggestedProfilesItem
  | FeedSuggestedClubsItem;

export type FeedEditorialItem = FeedArticleItem | FeedVideoItem;

export function isDiscoveryItem(
  item: FeedItem,
): item is FeedSuggestedProfilesItem | FeedSuggestedClubsItem {
  return item.type === "suggested_profiles" || item.type === "suggested_clubs";
}

export function isEditorialItem(item: FeedItem): item is FeedEditorialItem {
  return item.type === "article" || item.type === "video";
}

/**
 * Chiave d'autore per la regola §8 "lo stesso autore non deve dominare".
 * I moduli discovery non hanno autore e non partecipano alla regola.
 */
export function authorKeyOf(item: FeedItem): string | null {
  return item.author?.id ?? null;
}
