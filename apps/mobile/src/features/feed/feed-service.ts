/**
 * Accesso alla spina del Feed (`fetch_home_feed_page`).
 *
 * `mapFeedRow` è l'unico ponte tra le righe snake_case dell'RPC e la union
 * discriminata che i componenti consumano. Scarta (restituendo null) le righe
 * di tipo sconosciuto invece di sollevare: un client vecchio davanti a un
 * server nuovo deve degradare, non crashare.
 *
 * HOM-03: Articolo e video editoriale passano dagli stessi lettori del Post
 * (§38, §104), più due letture leggere: lo stato dei media in elaborazione
 * (§65–66) e lo stato Mi piace del dettaglio legacy (§104).
 */

import { supabase } from "../../lib/supabase";
import { contentDetailHref, type ContentOrigin } from "./content-routes";
import {
  asFeedContentType,
  readAuthorMeta,
  readCapabilities,
  readCount,
  readIdentityType,
  readLinkPreview,
  readMedia,
  readMentions,
  readTagged,
} from "./feed-post-mapper";
import {
  FEED_ITEM_TYPES,
  type FeedContentItem,
  type FeedContentType,
  type FeedCursor,
  type FeedItem,
  type FeedItemRow,
  type FeedItemType,
  type FeedLayoutHint,
  type FeedMediaItem,
  type FeedNavKind,
  type FeedPage,
  type FeedPageParam,
  type FeedPostItem,
  type FeedReasonKey,
  type FeedScope,
  type MediaContentType,
} from "./feed-types";

/** 10 e non 20: ogni riga porta un payload jsonb (vedi header dell'RPC). */
export const FEED_PAGE_SIZE = 10;

const LAYOUT_HINTS: readonly FeedLayoutHint[] = [
  "compact",
  "standard",
  "tall",
  "carousel",
];

const REASON_KEYS: readonly FeedReasonKey[] = [
  "followed_club_publisher",
  "followed_profile_publisher",
  "followed_club_position",
  "same_region",
  "preferred_source",
  "open_position_match",
  "popular_now",
  "not_followed_yet",
];

const CONTENT_TYPES: readonly MediaContentType[] = [
  "club_media",
  "media_profile",
  "media_tribuna",
  "fan_tribuna",
  "fan_media",
];

function asItemType(value: string): FeedItemType | null {
  return FEED_ITEM_TYPES.includes(value as FeedItemType)
    ? (value as FeedItemType)
    : null;
}

function asLayoutHint(value: string | null): FeedLayoutHint {
  return LAYOUT_HINTS.includes(value as FeedLayoutHint)
    ? (value as FeedLayoutHint)
    : "standard";
}

function asReasonKey(value: string | null): FeedReasonKey | null {
  return value && REASON_KEYS.includes(value as FeedReasonKey)
    ? (value as FeedReasonKey)
    : null;
}

function asContentType(value: unknown): MediaContentType | null {
  return typeof value === "string" &&
    CONTENT_TYPES.includes(value as MediaContentType)
    ? (value as MediaContentType)
    : null;
}

function readString(data: Record<string, unknown> | null, key: string): string | null {
  const value = data?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readNumber(data: Record<string, unknown> | null, key: string): number | null {
  const value = data?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readBoolean(data: Record<string, unknown> | null, key: string): boolean {
  return data?.[key] === true;
}

function buildNav(
  row: FeedItemRow,
): { kind: FeedNavKind; params: Record<string, string> } | null {
  if (row.nav_kind !== "content" && row.nav_kind !== "position") {
    return null;
  }

  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(row.nav_params ?? {})) {
    if (typeof value === "string" && value.length > 0) {
      params[key] = value;
    }
  }

  return { kind: row.nav_kind, params };
}

function buildAuthor(row: FeedItemRow) {
  if (!row.author_id || !row.author_kind || !row.author_name) {
    return null;
  }

  return {
    kind: row.author_kind,
    id: row.author_id,
    name: row.author_name,
    avatarUrl: row.author_avatar_url,
    sourceKind: row.author_source_kind,
    isVerified: row.author_is_verified === true,
  };
}

/**
 * Riga RPC -> elemento del Feed. `null` quando la riga non è renderizzabile:
 * tipo sconosciuto, oppure payload incompleto per quel tipo (un post senza
 * post_id non è apribile e non deve occupare uno slot).
 */
export function mapFeedRow(row: FeedItemRow): FeedItem | null {
  const type = asItemType(row.item_type);
  if (!type) {
    return null;
  }

  const envelope = {
    id: row.item_uid,
    rank: row.rank_position,
    version: row.component_version,
    layoutHint: asLayoutHint(row.layout_hint),
    publishedAt: row.published_at,
    author: buildAuthor(row),
    reasonKey: asReasonKey(row.suggestion_reason_key),
    reasonLabel: row.suggestion_reason_label,
    isSeen: row.is_seen === true,
    isSaved: row.is_saved === true,
    isFollowingAuthor: row.is_following_author === true,
    nav: buildNav(row),
  };

  if (type === "suggested_profiles" || type === "suggested_clubs") {
    return {
      ...envelope,
      type,
      payload: {
        moduleKey: type,
        moduleLimit: readNumber(row.data, "module_limit") ?? 6,
      },
    };
  }

  if (type === "suggested_position") {
    const adId = readString(row.data, "ad_id");
    const clubId = readString(row.data, "club_id");
    if (!adId || !clubId) {
      return null;
    }

    return {
      ...envelope,
      type,
      payload: {
        adId,
        clubId,
        clubName: readString(row.data, "club_name"),
        clubLogoUrl: readString(row.data, "club_logo_url"),
        teamName: readString(row.data, "team_name"),
        teamType: readString(row.data, "team_type"),
        roleRequired: readString(row.data, "role_required"),
        category: readString(row.data, "category"),
        city: readString(row.data, "city"),
        province: readString(row.data, "province"),
        region: readString(row.data, "region"),
        targetRole: readString(row.data, "target_role"),
        isSecondaryMatch: readBoolean(row.data, "is_secondary_match"),
      },
    };
  }

  const postId = readString(row.data, "post_id");

  if (type === "post") {
    const postType = asFeedContentType(row.data?.["content_type"]);
    if (!postType || !postId) {
      return null;
    }

    // §14: il testo completo arriva in `data.body`; `excerpt` (280) resta per
    // i server pre-HOM-02.
    const body = readString(row.data, "body");
    return {
      ...envelope,
      type,
      title: row.title,
      payload: {
        contentType: postType,
        postId,
        kindLabel: readString(row.data, "kind_label"),
        text: row.excerpt,
        body,
        isTruncated: readBoolean(row.data, "is_truncated"),
        authorIdentityType: readIdentityType(row.data, row.author_kind, row.author_source_kind),
        authorMeta: readAuthorMeta(row.data),
        media: readMedia(row.data, row.item_uid, {
          thumbnailUrl: row.thumbnail_url,
          durationSeconds: readNumber(row.data, "duration_seconds"),
        }),
        mentions: readMentions(row.data, body),
        tagged: readTagged(row.data),
        linkPreview: readLinkPreview(row.data),
        likesCount: readCount(row.data, "likes_count"),
        commentsCount: readCount(row.data, "comments_count"),
        isLiked: readBoolean(row.data, "is_liked"),
        capabilities: readCapabilities(row.data, postType),
        version: readString(row.data, "version"),
      },
    };
  }

  const contentType = asContentType(row.data?.["content_type"]);
  if (!contentType || !postId) {
    return null;
  }

  const durationSeconds = readNumber(row.data, "duration_seconds");
  const intro = row.excerpt;
  const isVideo = type === "video";

  // HOM-03: stesso payload d'autore, media e interazioni del Post. Senza le
  // chiavi HOM-03 (server vecchio) la riga legacy diventa il media singolo.
  // Trappola del video editoriale: la colonna `thumbnail_url` della riga
  // contiene l'URL del VIDEO, non un'immagine. Per un video la thumbnail si
  // legge solo da `media[]`; senza, resta null e la UI mostra il placeholder.
  const media = readMedia(
    row.data,
    row.item_uid,
    isVideo
      ? { durationSeconds, thumbnailUrl: null, videoUrl: row.thumbnail_url }
      : { durationSeconds, thumbnailUrl: row.thumbnail_url, type: "image" },
  );

  return {
    ...envelope,
    type,
    title: row.title,
    payload: {
      contentType,
      postId,
      kindLabel: readString(row.data, "kind_label"),
      intro,
      summary: readString(row.data, "summary") ?? intro,
      thumbnailUrl: isVideo
        ? (media.find((entry) => entry.type === "video")?.thumbnailUrl ?? null)
        : row.thumbnail_url,
      durationSeconds,
      authorIdentityType: readIdentityType(row.data, row.author_kind, row.author_source_kind),
      authorMeta: readAuthorMeta(row.data),
      media,
      likesCount: readCount(row.data, "likes_count"),
      commentsCount: readCount(row.data, "comments_count"),
      isLiked: readBoolean(row.data, "is_liked"),
      capabilities: readCapabilities(row.data, contentType),
      version: readString(row.data, "version"),
    },
  };
}

function readCursor(row: FeedItemRow): FeedCursor | null {
  if (
    row.is_last_page ||
    row.next_cursor_uid === null ||
    row.next_cursor_bucket === null ||
    row.next_cursor_published_at === null
  ) {
    return null;
  }

  return {
    asOf: row.as_of,
    bucket: row.next_cursor_bucket,
    publishedAt: row.next_cursor_published_at,
    uid: row.next_cursor_uid,
  };
}

export async function fetchHomeFeedPage({
  scope,
  pageParam,
  pageSize = FEED_PAGE_SIZE,
}: {
  scope: FeedScope;
  pageParam: FeedPageParam;
  pageSize?: number;
}): Promise<FeedPage> {
  const { cursor, pageIndex } = pageParam;

  const { data, error } = await supabase.rpc("fetch_home_feed_page", {
    p_as_of: cursor?.asOf ?? null,
    p_cursor_bucket: cursor?.bucket ?? null,
    p_cursor_published_at: cursor?.publishedAt ?? null,
    p_cursor_uid: cursor?.uid ?? null,
    p_limit: pageSize,
    p_page_index: pageIndex,
    p_tab: scope,
  });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as FeedItemRow[];
  const first = rows[0];

  return {
    items: rows.map(mapFeedRow).filter((item): item is FeedItem => item !== null),
    pageIndex,
    // Nessuna riga: la pagina è vuota e l'asOf della sessione resta quello che
    // il chiamante aveva già (o l'istante corrente per la pagina 0).
    asOf: first?.as_of ?? cursor?.asOf ?? new Date().toISOString(),
    nextCursor: first ? readCursor(first) : null,
    isLastPage: first ? first.is_last_page === true : true,
  };
}

/**
 * Href di destinazione. Le route restano lato client (l'RPC restituisce
 * `nav_kind` + `nav_params`, non URL): congelare percorsi expo-router in SQL
 * li renderebbe impossibili da rinominare. Stesso principio di
 * `resolveMediaContentHref`.
 */
export function resolveFeedItemHref(
  item: FeedItem,
  origin: ContentOrigin | null = null,
): string | null {
  if (!item.nav) {
    return null;
  }

  if (item.nav.kind === "position") {
    const adId = item.nav.params.ad_id;
    return adId ? `/position/${adId}` : null;
  }

  const contentType = item.nav.params.content_type;
  const postId = item.nav.params.post_id;
  if (!contentType || !postId) {
    return null;
  }

  // HOM-04 §122: ogni apertura dal Feed porta la provenienza (la tab). HOM-03
  // §49: il dettaglio editoriale riceve anche la posizione. Parametri additivi:
  // il dettaglio che non li legge apre lo stesso contenuto.
  return contentDetailHref(contentType as FeedContentType, postId, {
    origin,
    position: item.type === "article" || item.type === "video" ? item.rank : undefined,
  });
}

/** Autore/fonte -> profilo pubblico o scheda società. */
export function resolveFeedAuthorHref(item: FeedItem): string | null {
  if (!item.author) {
    return null;
  }

  return item.author.kind === "club"
    ? `/club/${item.author.id}`
    : `/profile/${item.author.id}`;
}

/**
 * HOM-02 §53, §83: Mi piace come STATO desiderato, non come toggle. Due tap
 * ravvicinati diventano "true" poi "false" e il risultato finale è quello
 * dell'ultimo, anche se una richiesta viene ripetuta. Il server restituisce il
 * conteggio reale, che sostituisce quello ottimistico.
 */
export async function setPostLike(
  contentType: FeedContentType,
  postId: string,
  liked: boolean,
): Promise<{ likesCount: number; isLiked: boolean }> {
  const { data, error } = await supabase.rpc("set_content_like", {
    p_content_type: contentType,
    p_liked: liked,
    p_post_id: postId,
  });

  if (error) {
    throw error;
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { likes_count?: unknown; is_liked?: unknown }
    | null
    | undefined;

  // Una risposta senza conteggio non è uno stato: meglio l’errore (e il
  // ritorno all’ultimo stato confermato) che un "0" inventato.
  if (!row || typeof row.likes_count !== "number" || typeof row.is_liked !== "boolean") {
    throw new Error("set_content_like: risposta senza stato");
  }

  return { likesCount: row.likes_count, isLiked: row.is_liked };
}

/** HOM-03 §66: tetto per chiamata, lo stesso che applica la RPC. */
export const CONTENT_MEDIA_STATES_LIMIT = 20;

export type ContentMediaStates = {
  contentType: FeedContentType;
  postId: string;
  media: FeedMediaItem[];
};

/**
 * HOM-03 §65–66: lo stato corrente dei media di pochi contenuti, nello stesso
 * formato `media[]` del Feed. Solo i contenuti leggibili tornano indietro:
 * uno assente non si tocca (nessuno stato inventato).
 *
 * La RPC solleva oltre 20 coppie ("Al massimo 20 contenuti per richiesta"):
 * qui si spezza in blocchi da 20, in parallelo. Il poll ne manda già al
 * massimo 20, quindi in pratica è una chiamata sola.
 */
export async function fetchContentMediaStates(
  pairs: readonly { contentType: FeedContentType; postId: string }[],
): Promise<ContentMediaStates[]> {
  const batches: { contentType: FeedContentType; postId: string }[][] = [];
  for (let start = 0; start < pairs.length; start += CONTENT_MEDIA_STATES_LIMIT) {
    batches.push(pairs.slice(start, start + CONTENT_MEDIA_STATES_LIMIT));
  }

  const results = await Promise.all(batches.map(fetchContentMediaStatesBatch));
  return results.flat();
}

async function fetchContentMediaStatesBatch(
  batch: readonly { contentType: FeedContentType; postId: string }[],
): Promise<ContentMediaStates[]> {
  const { data, error } = await supabase.rpc("fetch_content_media_states", {
    p_content_types: batch.map((pair) => pair.contentType),
    p_post_ids: batch.map((pair) => pair.postId),
  });

  if (error) {
    throw error;
  }

  const rows = (Array.isArray(data) ? data : []) as {
    content_type?: unknown;
    post_id?: unknown;
    media?: unknown;
  }[];

  return rows.flatMap((row): ContentMediaStates[] => {
    const contentType = asFeedContentType(row.content_type);
    if (!contentType || typeof row.post_id !== "string") {
      return [];
    }
    return [
      {
        contentType,
        postId: row.post_id,
        media: readMedia(
          { media: Array.isArray(row.media) ? row.media : [] },
          `${contentType}:${row.post_id}`,
          { durationSeconds: null, thumbnailUrl: null },
        ),
      },
    ];
  });
}

export type ContentInteractionState = {
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
  canLike: boolean;
};

/**
 * HOM-03 §104: lo stato Mi piace del dettaglio `/content/[type]/[id]`, la
 * stessa entità del Feed. `null` quando il contenuto non è leggibile: nessun
 * Like da mostrare, non un Like a zero.
 */
export async function fetchContentInteractionState(
  contentType: FeedContentType,
  postId: string,
): Promise<ContentInteractionState | null> {
  const { data, error } = await supabase.rpc("fetch_content_interaction_state", {
    p_content_type: contentType,
    p_post_id: postId,
  });

  if (error) {
    throw error;
  }

  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null | undefined;
  if (!row || typeof row !== "object") {
    return null;
  }

  return {
    likesCount: readCount(row, "likes_count"),
    commentsCount: readCount(row, "comments_count"),
    isLiked: row.is_liked === true,
    canLike: row.can_like === true,
  };
}

/** HOM-02 §19, §22: mention e tag aprono l'identità per id, mai per nome. */
export function resolveIdentityHref(target: {
  identityType: "profile" | "club" | "team";
  identityId: string;
}): string {
  switch (target.identityType) {
    case "club":
      return `/club/${target.identityId}`;
    case "team":
      return `/club/team/${target.identityId}`;
    default:
      return `/profile/${target.identityId}`;
  }
}

/**
 * HOM-02 §35 (Luigi 2026-11-11: niente viewer nuovo): il tap su un media apre
 * il dettaglio del contenuto con l'indice selezionato.
 */
export function resolvePostMediaHref(
  item: FeedContentItem,
  index: number,
  origin: ContentOrigin | null = null,
): string {
  return contentDetailHref(item.payload.contentType, item.payload.postId, { media: index, origin });
}

type ProfilePostDetailJson = {
  post_id?: unknown;
  published_at?: unknown;
  author?: {
    id?: unknown;
    name?: unknown;
    avatar_url?: unknown;
    is_verified?: unknown;
    source_kind?: unknown;
  } | null;
  data?: Record<string, unknown> | null;
};

/**
 * HOM-02 §109: il dettaglio di un post persona usa lo stesso `data` del Feed e
 * passa dallo stesso `mapFeedRow`, così Feed e dettaglio non possono divergere.
 * `null` quando il post non è leggibile (RLS, nascosto, autore bloccato).
 */
export async function fetchProfilePostDetail(postId: string): Promise<FeedPostItem | null> {
  const { data, error } = await supabase.rpc("fetch_profile_post_detail", {
    p_post_id: postId,
  });

  if (error) {
    throw error;
  }

  return mapProfilePostDetail(data as ProfilePostDetailJson | null);
}

export function mapProfilePostDetail(json: ProfilePostDetailJson | null): FeedPostItem | null {
  if (!json || typeof json.post_id !== "string" || !json.author) {
    return null;
  }

  const author = json.author;
  const postId = json.post_id;
  const row: FeedItemRow = {
    item_uid: `profile_post:${postId}`,
    item_type: "post",
    rank_position: 0,
    rank_bucket: 0,
    layout_hint: "standard",
    component_version: 1,
    title: null,
    excerpt: null,
    thumbnail_url: null,
    published_at: typeof json.published_at === "string" ? json.published_at : null,
    author_kind: "profile",
    author_id: typeof author.id === "string" ? author.id : null,
    author_name: typeof author.name === "string" ? author.name : null,
    author_avatar_url: typeof author.avatar_url === "string" ? author.avatar_url : null,
    author_source_kind: typeof author.source_kind === "string" ? author.source_kind : null,
    author_is_verified: author.is_verified === true,
    is_seen: true,
    is_saved: false,
    is_following_author: false,
    suggestion_reason_key: null,
    suggestion_reason_label: null,
    nav_kind: "content",
    nav_params: { content_type: "profile_post", post_id: postId },
    data: { ...(json.data ?? {}), content_type: "profile_post", post_id: postId },
    as_of: new Date(0).toISOString(),
    next_cursor_bucket: null,
    next_cursor_published_at: null,
    next_cursor_uid: null,
    is_last_page: true,
  };

  const item = mapFeedRow(row);
  return item?.type === "post" ? item : null;
}
