/**
 * Accesso alla spina del Feed (`fetch_home_feed_page`).
 *
 * `mapFeedRow` è l'unico ponte tra le righe snake_case dell'RPC e la union
 * discriminata che i componenti consumano. Scarta (restituendo null) le righe
 * di tipo sconosciuto invece di sollevare: un client vecchio davanti a un
 * server nuovo deve degradare, non crashare.
 */

import { supabase } from "../../lib/supabase";
import {
  FEED_ITEM_TYPES,
  type FeedCursor,
  type FeedItem,
  type FeedItemRow,
  type FeedItemType,
  type FeedLayoutHint,
  type FeedNavKind,
  type FeedPage,
  type FeedPageParam,
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

function readMediaType(
  data: Record<string, unknown> | null,
): "image" | "video" | null {
  const value = data?.["media_type"];
  return value === "image" || value === "video" ? value : null;
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

  const contentType = asContentType(row.data?.["content_type"]);
  const postId = readString(row.data, "post_id");
  if (!contentType || !postId) {
    return null;
  }

  if (type === "post") {
    return {
      ...envelope,
      type,
      title: row.title,
      payload: {
        contentType,
        postId,
        kindLabel: readString(row.data, "kind_label"),
        text: row.excerpt,
        isTruncated: readBoolean(row.data, "is_truncated"),
        imageUrl: row.thumbnail_url,
        mediaType: readMediaType(row.data),
      },
    };
  }

  return {
    ...envelope,
    type,
    title: row.title,
    payload: {
      contentType,
      postId,
      kindLabel: readString(row.data, "kind_label"),
      intro: row.excerpt,
      thumbnailUrl: row.thumbnail_url,
      durationSeconds: readNumber(row.data, "duration_seconds"),
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
export function resolveFeedItemHref(item: FeedItem): string | null {
  if (!item.nav) {
    return null;
  }

  if (item.nav.kind === "position") {
    const adId = item.nav.params.ad_id;
    return adId ? `/position/${adId}` : null;
  }

  const contentType = item.nav.params.content_type;
  const postId = item.nav.params.post_id;
  return contentType && postId ? `/content/${contentType}/${postId}` : null;
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
