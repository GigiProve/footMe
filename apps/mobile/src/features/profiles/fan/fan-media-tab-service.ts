/**
 * Sorgente della tab Media del Tifoso (REV-PROF-19, Screen 4).
 *
 * Due sorgenti reali, nessuna tabella nuova e nessun record duplicato:
 *
 *   • `fan_tribuna_posts` con `kind = 'photo'` — ciò che il Tifoso pubblica
 *     oggi da "Pubblica foto o video";
 *   • `fan_media_posts` — la bacheca storica, non più alimentata ma viva: i
 *     suoi contenuti restano visibili dove ora stanno le foto e i video.
 *
 * Opinioni, sondaggi e formazioni non passano di qui: la selezione avviene in
 * query sul tipo reale del record, non riclassificando contenuti.
 */
import { supabase } from "../../../lib/supabase";
import type { MediaContentItem } from "../career/MediaTabContent";
import {
  FAN_MEDIA_PAGE_SIZE,
  fetchFanMediaFeed,
  type FanMediaPost,
} from "../fan-media-service";
import {
  fetchFanTribunaFeed,
  type FanTribunaPost,
} from "../fan-tribuna-service";
import { dedupeFanContentById } from "./fan-master-profile";

export const FAN_MEDIA_TAB_PAGE_SIZE = FAN_MEDIA_PAGE_SIZE;

/**
 * Riferimento a un contenuto nel suo dettaglio canonico — quello condiviso
 * con il feed e con la ricerca, non un viewer del profilo.
 */
export type FanContentRef = {
  contentType: string;
  postId: string;
};

/**
 * Offset indipendenti per sorgente: una pagina può esaurire la bacheca
 * storica molto prima dei contenuti nuovi, e viceversa.
 */
export type FanMediaCursor = {
  legacyOffset: number;
  tribunaOffset: number;
};

export const FAN_MEDIA_INITIAL_CURSOR: FanMediaCursor = {
  legacyOffset: 0,
  tribunaOffset: 0,
};

export type FanMediaPage = {
  cursor: FanMediaCursor;
  hasMore: boolean;
  items: MediaContentItem[];
};

/**
 * Una pagina della tab Media, ordinata dal contenuto più recente. Le due
 * richieste partono insieme: sono indipendenti e non c'è motivo di metterle
 * in fila.
 */
export async function fetchFanMediaPage(
  profileId: string,
  viewerProfileId: string | null | undefined,
  cursor: FanMediaCursor = FAN_MEDIA_INITIAL_CURSOR,
  pageSize: number = FAN_MEDIA_TAB_PAGE_SIZE,
): Promise<FanMediaPage> {
  const [tribunaPhotos, legacyPosts] = await Promise.all([
    fetchFanTribunaFeed(profileId, viewerProfileId, {
      kinds: ["photo"],
      limit: pageSize,
      offset: cursor.tribunaOffset,
    }),
    fetchFanMediaFeed(profileId, viewerProfileId, {
      limit: pageSize,
      offset: cursor.legacyOffset,
    }),
  ]);

  const items = dedupeFanContentById([
    ...tribunaPhotos.map(mapTribunaPhoto),
    ...legacyPosts.map(mapLegacyPost),
  ]).sort((left, right) => right.sortKey.localeCompare(left.sortKey));

  return {
    cursor: {
      legacyOffset: cursor.legacyOffset + legacyPosts.length,
      tribunaOffset: cursor.tribunaOffset + tribunaPhotos.length,
    },
    hasMore:
      tribunaPhotos.length === pageSize || legacyPosts.length === pageSize,
    items: items.map(({ sortKey: _sortKey, ...item }) => item),
  };
}

/**
 * Quanti contenuti gestisce il modulo Media (REV-PROF-20, riepilogo della
 * voce "Media e contenuti" nell'hub).
 *
 * È un conteggio, non una pagina: due `head` con `count: exact` sulle stesse
 * due sorgenti della griglia, con lo stesso predicato di pubblicazione. Non
 * si contano le pagine già caricate — il riepilogo direbbe "20 contenuti" a
 * chi ne ha cinquanta — e non si contano opinioni, sondaggi e formazioni, che
 * questo modulo non gestisce.
 */
export async function countFanMediaContents(
  profileId: string,
): Promise<number> {
  const [tribuna, legacy] = await Promise.all([
    supabase
      .from("fan_tribuna_posts")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profileId)
      .eq("status", "published")
      .eq("kind", "photo"),
    supabase
      .from("fan_media_posts")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profileId)
      .eq("status", "published"),
  ]);

  if (tribuna.error) {
    throw tribuna.error;
  }

  if (legacy.error) {
    throw legacy.error;
  }

  return (tribuna.count ?? 0) + (legacy.count ?? 0);
}

type SortableMediaItem = MediaContentItem & { sortKey: string };

/** Foto e video pubblicati dalla Tribuna. Il tipo lo dice `media_type`. */
function mapTribunaPhoto(post: FanTribunaPost): SortableMediaItem {
  const isVideo = post.media_type === "video";

  return {
    commentCount: post.comment_count,
    comments: [],
    description: post.body ?? post.title ?? "",
    id: post.id,
    isFeatured: false,
    isLiked: post.is_supported,
    isSaved: post.is_saved,
    likeCount: post.support_count,
    sortKey: post.published_at ?? post.created_at,
    // Il dettaglio canonico è quello del contenuto, condiviso con il feed e
    // con la ricerca: il tap apre quello, non un secondo viewer.
    taggedRef: { contentType: "fan_tribuna", postId: post.id },
    thumbnailUrl: post.thumbnail_url ?? post.media_url ?? "",
    type: isVideo ? "video" : "image",
    ...(isVideo && post.media_url ? { videoUrl: post.media_url } : {}),
  };
}

/** Bacheca storica: stessi contenuti, stessa griglia, stesso dettaglio. */
function mapLegacyPost(post: FanMediaPost): SortableMediaItem {
  const isVideo = post.visual_type === "video";

  return {
    commentCount: post.comment_count,
    comments: [],
    description: post.description,
    id: post.id,
    isFeatured: false,
    isLiked: post.is_liked,
    isSaved: post.is_saved,
    likeCount: post.like_count,
    sortKey: post.published_at ?? post.created_at,
    taggedRef: { contentType: "fan_media", postId: post.id },
    thumbnailUrl: post.thumbnail_url ?? post.visual_url,
    type: isVideo ? "video" : "image",
    ...(isVideo ? { videoUrl: post.visual_url } : {}),
  };
}
