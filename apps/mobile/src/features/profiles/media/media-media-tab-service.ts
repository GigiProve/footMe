/**
 * Sorgente della tab Media del Master Profile Media/Creator (REV-PROF-21,
 * Screen 4).
 *
 * Una sola sorgente, e non è una tabella nuova: `media_profile_posts` con
 * `kind = 'media'`, cioè i contenuti visivi autonomi della redazione. Gli
 * articoli con una copertina video restano articoli e restano nella tab
 * Articoli: la selezione avviene in query sul tipo reale del record, non
 * riclassificando contenuti già pubblicati.
 *
 * Gli item escono nella forma che il modulo Media condiviso già conosce, così
 * griglia, filtri, viewer e dettaglio sono quelli di tutti gli altri profili.
 */
import type { MediaContentItem } from "../career/MediaTabContent";
import {
  MEDIA_PROFILE_POST_PAGE_SIZE,
  fetchMediaProfilePostFeed,
  type MediaProfilePost,
} from "../media-profile-post-service";

export const MEDIA_TAB_PAGE_SIZE = MEDIA_PROFILE_POST_PAGE_SIZE;

/**
 * Riferimento a un contenuto nel suo dettaglio canonico — quello condiviso
 * con il feed, la ricerca e gli altri profili.
 */
export type MediaContentRef = {
  contentType: string;
  postId: string;
};

export type MediaTabPage = {
  hasMore: boolean;
  items: MediaContentItem[];
  nextOffset: number;
};

export async function fetchMediaProfileMediaPage(
  mediaProfileId: string,
  viewerProfileId: string | null | undefined,
  offset = 0,
  pageSize: number = MEDIA_TAB_PAGE_SIZE,
): Promise<MediaTabPage> {
  const posts = await fetchMediaProfilePostFeed(
    mediaProfileId,
    viewerProfileId,
    { kinds: ["media"], limit: pageSize, offset },
  );

  return {
    hasMore: posts.length === pageSize,
    items: posts.map(toMediaContentItem),
    nextOffset: offset + posts.length,
  };
}

/**
 * Il tipo del media sta in `cover_type`, non in una colonna nuova: è il campo
 * che la tabella già usava per la copertina degli articoli.
 */
function toMediaContentItem(post: MediaProfilePost): MediaContentItem {
  const isVideo = post.cover_type === "video";

  return {
    commentCount: post.comment_count,
    comments: [],
    // Nella griglia la caption non si vede: serve al viewer e al nome
    // accessibile della cella.
    description: post.excerpt ?? post.title,
    id: post.id,
    isFeatured: false,
    isLiked: false,
    isSaved: post.is_saved,
    likeCount: 0,
    /*
      Il tap apre il dettaglio contenuto condiviso — dove vivono commenti,
      reazioni e Salva — invece di un viewer locale del profilo. Nella griglia
      l'icona Salvati non compare: REV-PROF-12 la tiene nel dettaglio.
    */
    taggedRef: { contentType: "media_profile", postId: post.id },
    thumbnailUrl: post.cover_url ?? "",
    type: isVideo ? "video" : "image",
    ...(isVideo && post.cover_url ? { videoUrl: post.cover_url } : {}),
  };
}
