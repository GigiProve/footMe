import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { trackArticle } from "../../../src/features/article-editor/article-analytics";
import { articleKeys } from "../../../src/features/article-editor/article-keys";
import { articleBodyKind } from "../../../src/features/article-editor/article-render";
import { fetchArticleDetail } from "../../../src/features/article-editor/article-service";
import { ArticleDetailBody } from "../../../src/features/article-editor/components/ArticleDetailBody";
import { useSession } from "../../../src/features/auth/use-session";
import {
  fetchClubMediaPostDetail,
  type ClubMediaPost,
} from "../../../src/features/clubs/club-media-service";
import {
  fetchMediaProfilePostDetail,
  type MediaProfilePost,
} from "../../../src/features/profiles/media-profile-post-service";
import {
  fetchFanTribunaPostDetail,
  type FanTribunaPostDetail,
} from "../../../src/features/profiles/fan-tribuna-service";
import {
  fetchMediaTribunaDetail,
  type MediaTribunaPost,
} from "../../../src/features/profiles/media-tribuna-service";
import {
  fetchFanMediaPostDetail,
  type FanMediaPost,
} from "../../../src/features/profiles/fan-media-service";
import { CommentComposerBar } from "../../../src/features/comments/components/CommentComposerBar";
import { CommentsOverlays } from "../../../src/features/comments/components/CommentsOverlays";
import { CommentsSection } from "../../../src/features/comments/components/CommentsSection";
import { useCommentsController } from "../../../src/features/comments/use-comments-controller";
import { ContentActionRow } from "../../../src/features/feed/components/detail/ContentActionRow";
import { ContentDetailFrame } from "../../../src/features/feed/components/detail/ContentDetailFrame";
import { ContentDetailMedia } from "../../../src/features/feed/components/detail/ContentDetailMedia";
import { ContentDetailSkeleton } from "../../../src/features/feed/components/detail/ContentDetailSkeleton";
import { AuthorHeaderRow } from "../../../src/features/feed/components/items/FeedItemHeader";
import {
  ContentLoadErrorState,
  ContentUnavailableState,
} from "../../../src/features/feed/components/ContentUnavailableState";
import { PostOrEditorialDetail } from "../../../src/features/feed/components/PostOrEditorialDetail";
import { ProfilePostDetail } from "../../../src/features/feed/components/ProfilePostDetail";
import { classifyContentError } from "../../../src/features/feed/content-availability-presentation";
import {
  parseCommentFocus,
  parseCommentTarget,
  parseContentOrigin,
  type CommentFocus,
  type CommentTarget,
  type ContentOrigin,
} from "../../../src/features/feed/content-routes";
import { useBackToFeed } from "../../../src/features/feed/use-back-to-feed";
import { createFeedVideoController } from "../../../src/features/feed/feed-video-controller";
import { FEED_POST_OPEN_AUTHOR_HINT } from "../../../src/features/feed/feed-labels";
import {
  buildAuthorAccessibilityLabel,
  legacyVideoMedia,
} from "../../../src/features/feed/feed-video-presentation";
import type { FeedContentType, FeedMediaItem } from "../../../src/features/feed/feed-types";
import { FeedVideoProvider } from "../../../src/features/feed/use-feed-video";
import { useFeedVideoLifecycle } from "../../../src/features/feed/use-feed-video-lifecycle";
import { FanContentBody } from "../../../src/features/profiles/FanContentBody";
import { MediaTribunaBody } from "../../../src/features/profiles/media/MediaTribunaBody";
import {
  fetchClubPublisher,
  fetchContentPublisher,
  type ContentPublisher,
} from "../../../src/features/content/content-publisher-service";
import { CompactContentModule } from "../../../src/features/content/components/CompactContentModule";
import { ContentAttribution } from "../../../src/features/content/components/ContentAttribution";
import { TagManageSheet } from "../../../src/features/content/components/TagManageSheet";
import type { ContentTaggedTarget } from "../../../src/features/content/components/TaggedProfilesSheet";
import type { TaggedContentType } from "../../../src/features/content/content-tag-service";
import {
  authorOpenEventType,
  identityOpenEvent,
  isClubMediaArticle,
  sourceForOrigin,
} from "../../../src/features/content-insights/content-events-presentation";
import { emitContentEvent } from "../../../src/features/content-insights/content-events-service";
import { useContentDetailEvents } from "../../../src/features/content-insights/use-content-detail-events";
import { formatCompactRelativeTime } from "../../../src/lib/relative-time";
import { colors, radius, spacing } from "../../../src/theme/tokens";
import { SavedBookmarkButton } from "../../../src/features/saved/components/SavedBookmarkButton";
import { useContentSaved } from "../../../src/features/saved/use-content-saved";
import { buildSharePreviewFromDetail } from "../../../src/features/share/share-presentation";
import { useContentShare } from "../../../src/features/share/use-content-share";
import { AppText, Button } from "../../../src/ui";

type TaggedEntry = ContentTaggedTarget;

type ContentView = {
  /**
   * HOM-06.2: il contenuto può avere un documento Articolo
   * (`fetch_article_detail`): club_media con kind 'article', media_profile che
   * non sia di tipo 'media'. Tutto il resto resta sul rendering storico.
   */
  articleCandidate: boolean;
  authorName: string | null;
  body: string | null;
  /** HOM-03 §50: cover ampia dell'Articolo, valorizzata solo qui e non nel Feed. */
  coverUrl: string | null;
  displayMode: "full" | "preview";
  excerpt: string | null;
  externalUrl: string | null;
  /**
   * HOM-05 §101–§103: Articolo secondo la stessa regola del server
   * (`feed_content_index.content_format` → `footme_feed_item_type`), così
   * `article_open`/`article_read` partono per tutti i contenuti che le
   * statistiche classificano come Articolo.
   */
  isArticle: boolean;
  publishedAt: string | null;
  publisherId: string;
  publisherKind: "club" | "profile";
  publisherName: string;
  readingLabel: string | null;
  sourceName: string | null;
  tagged: TaggedEntry[];
  thumbnailUrl: string | null;
  title: string;
  typeLabel: string;
  /** HOM-03 §35: video del contenuto, riprodotto inline con lo stesso player del Feed. */
  video: FeedMediaItem | null;
  viewerTagged: boolean;
};

/**
 * HOM-03 §104: i tipi su cui il Mi piace è reale, gli stessi di `set_content_like`.
 * `media_tribuna` e `fan_tribuna` non hanno l'entity di like.
 */
const LIKEABLE: ContentDetailType[] = ["club_media", "media_profile", "fan_media"];

/**
 * Tutte le superfici contenuto apribili in dettaglio. `media_tribuna` e
 * `fan_media` sono state aggiunte da CER-05 perché Cerca > Media e contenuti
 * le indicizza e ogni risultato deve essere apribile.
 */
type ContentDetailType = TaggedContentType | "media_tribuna" | "fan_media";

const SUPPORTED: ContentDetailType[] = [
  "club_media",
  "media_profile",
  "fan_tribuna",
  "media_tribuna",
  "fan_media",
];

/**
 * Solo tre superfici hanno una tag table: `media_tribuna_posts` e
 * `fan_media_posts` non sono taggabili, quindi non passano da TagManageSheet.
 */
const TAGGABLE: TaggedContentType[] = ["club_media", "media_profile", "fan_tribuna"];

function asTaggedContentType(value: ContentDetailType): TaggedContentType | null {
  return TAGGABLE.includes(value as TaggedContentType)
    ? (value as TaggedContentType)
    : null;
}

function clubMediaTypeLabel(kind: ClubMediaPost["kind"]): string {
  if (kind === "article") return "Articolo";
  if (kind === "highlights") return "Highlights";
  if (kind === "interview") return "Intervista";
  if (kind === "market") return "Mercato";
  if (kind === "statement") return "Comunicato";
  if (kind === "training") return "Allenamento";
  if (kind === "event") return "Evento";
  return "Contenuto";
}

function mapClubMedia(post: ClubMediaPost, viewerId: string | null): ContentView {
  const isVideo = post.visual_type === "video" && Boolean(post.visual_url);

  return {
    articleCandidate: post.kind === "article",
    authorName: null,
    body: post.body ?? post.excerpt ?? null,
    coverUrl: isVideo ? null : (post.visual_url ?? post.thumbnail_url),
    displayMode: "full",
    excerpt: post.excerpt ?? null,
    externalUrl: null,
    // HOM-06.2: il kind entra nella regola, come in `footme_feed_item_type`:
    // un 'post' lungo non è un Articolo, un 'article' breve sì.
    isArticle: isClubMediaArticle(post.visual_type, post.body, post.kind),
    // HOM-15 §27: l'header condiviso mostra il tempo anche per le Società.
    publishedAt: post.published_at ?? post.created_at,
    publisherId: post.club_id,
    publisherKind: "club",
    publisherName: "Società",
    readingLabel: null,
    sourceName: null,
    tagged: post.tagged_profiles.map((tag) => ({
      avatar_url: tag.avatar_url,
      display_name: tag.display_name,
      subtitle: tag.role,
      target_id: tag.target_id,
      target_type: tag.target_type,
    })),
    thumbnailUrl: post.thumbnail_url ?? post.visual_url,
    title: post.title,
    typeLabel: clubMediaTypeLabel(post.kind),
    video: isVideo
      ? legacyVideoMedia({
          durationSeconds: post.video_duration_seconds,
          id: post.id,
          thumbnailUrl: post.thumbnail_url,
          url: post.visual_url,
        })
      : null,
    viewerTagged:
      !!viewerId &&
      post.tagged_profiles.some(
        (tag) =>
          tag.target_type === "profile" &&
          (tag.profile_id ?? tag.target_id) === viewerId,
      ),
  };
}

function mapMediaProfile(
  post: MediaProfilePost,
  viewerId: string | null,
): ContentView {
  const isVideo = post.cover_type === "video" && Boolean(post.cover_url);

  return {
    // fetch_article_detail serve solo il kind «article»: news e legacy restano sul body (nessuno spinner inutile).
    articleCandidate: !isVideo && post.kind === "article",
    authorName: post.author_name,
    body: post.body ?? post.excerpt ?? null,
    coverUrl: isVideo ? null : post.cover_url,
    displayMode: post.display_mode,
    excerpt: post.excerpt ?? null,
    externalUrl: post.external_url,
    isArticle: !isVideo,
    publishedAt: post.published_at ?? post.created_at,
    publisherId: post.media_profile_id,
    publisherKind: "profile",
    publisherName: post.publisher_name,
    // HOM-15 §278: «3 min» da solo si confonderebbe col tempo dell'header («12 min»).
    readingLabel: post.kind === "news" ? null : `${post.reading_time_minutes} min di lettura`,
    sourceName: post.source_name,
    tagged: post.tagged_targets.map((tag) => ({
      avatar_url: tag.avatar_url,
      display_name: tag.display_name,
      subtitle: tag.subtitle,
      target_id: tag.target_id,
      target_type: tag.target_type,
    })),
    thumbnailUrl: post.cover_url,
    title: post.title,
    typeLabel: post.kind === "news" ? "News" : "Articolo",
    video: isVideo
      ? legacyVideoMedia({
          durationSeconds: null,
          id: post.id,
          thumbnailUrl: null,
          url: post.cover_url,
        })
      : null,
    viewerTagged:
      !!viewerId &&
      post.tagged_targets.some(
        (tag) => tag.target_type === "profile" && tag.target_id === viewerId,
      ),
  };
}

function fanTribunaTypeLabel(kind: FanTribunaPostDetail["kind"]): string {
  if (kind === "poll") return "Sondaggio";
  if (kind === "formation") return "Formazione";
  if (kind === "photo") return "Foto / Video";
  if (kind === "opinion") return "Opinione";
  return "Proposta";
}

function mapFanTribuna(
  post: FanTribunaPostDetail,
  viewerId: string | null,
): ContentView {
  return {
    articleCandidate: false,
    authorName: null,
    body: post.body ?? null,
    coverUrl: null,
    displayMode: "full",
    excerpt: null,
    externalUrl: null,
    isArticle: false,
    publishedAt: post.published_at ?? post.created_at,
    publisherId: post.profile_id,
    publisherKind: "profile",
    publisherName: post.publisher_name,
    readingLabel: null,
    sourceName: null,
    tagged: post.tagged_targets.map((tag) => ({
      avatar_url: tag.avatar_url,
      display_name: tag.display_name,
      subtitle: null,
      target_id: tag.target_id,
      target_type: tag.target_type,
    })),
    thumbnailUrl: post.thumbnail_url ?? null,
    title: post.title,
    typeLabel: fanTribunaTypeLabel(post.kind),
    // Il corpo (FanContentBody) mostra già foto/video della Tribuna.
    video: null,
    viewerTagged:
      !!viewerId &&
      post.tagged_targets.some(
        (tag) => tag.target_type === "profile" && tag.target_id === viewerId,
      ),
  };
}

function mediaTribunaTypeLabel(kind: MediaTribunaPost["kind"]): string {
  if (kind === "editorial_poll") return "Sondaggio editoriale";
  if (kind === "article_debate") return "Dibattito";
  if (kind === "player_vote") return "Votazione";
  return "Domande e risposte";
}

function mapMediaTribuna(
  post: MediaTribunaPost,
  publisher: ContentPublisher,
): ContentView {
  return {
    articleCandidate: false,
    authorName: null,
    body: post.body ?? null,
    coverUrl: null,
    displayMode: "full",
    excerpt: null,
    externalUrl: null,
    isArticle: false,
    publishedAt: post.published_at ?? post.created_at,
    publisherId: post.media_profile_id,
    publisherKind: "profile",
    publisherName: publisher.name,
    readingLabel: null,
    sourceName: null,
    tagged: [],
    thumbnailUrl: null,
    title: post.title,
    typeLabel: mediaTribunaTypeLabel(post.kind),
    video: null,
    viewerTagged: false,
  };
}

function mapFanMedia(post: FanMediaPost, publisher: ContentPublisher): ContentView {
  const isVideo = post.visual_type === "video" && Boolean(post.visual_url);

  return {
    articleCandidate: false,
    authorName: null,
    body: null,
    coverUrl: null,
    displayMode: "full",
    excerpt: post.description,
    externalUrl: null,
    isArticle: false,
    publishedAt: post.published_at ?? post.created_at,
    publisherId: post.profile_id,
    publisherKind: "profile",
    publisherName: publisher.name,
    readingLabel: null,
    sourceName: post.tag,
    tagged: [],
    thumbnailUrl: post.thumbnail_url ?? post.visual_url,
    title: post.description,
    typeLabel: post.visual_type === "video" ? "Video" : "Foto",
    video: isVideo
      ? legacyVideoMedia({
          durationSeconds: null,
          id: post.id,
          thumbnailUrl: post.thumbnail_url,
          url: post.visual_url,
        })
      : null,
    viewerTagged: false,
  };
}

/**
 * HOM-08 §8, §11, §13: due dettagli, nessun terzo renderer.
 *  • Post (`profile_post`, e i Post di Società/Media dentro `club_media` /
 *    `media_profile`) → «← Post», il Post component del Feed (HOM-02 §109);
 *  • Articolo, video editoriale e le altre sorgenti CER-05 → dettaglio storico
 *    qui sotto, con la stessa riga azioni ♡ | ◯ | ↗.
 * Entrambi montano la sezione Commenti e il composer fisso. `?focus=` porta
 * alla sezione o al composer (§5–§6).
 *
 * HOM-15 §26–§27, §53–§54: il dettaglio storico usa l'header autore del Feed
 * (`AuthorHeaderRow`), il segnalibro della barra per ogni tipo (§36–§37) e lo
 * skeleton del dettaglio mentre carica (§202, §206).
 */
export default function ContentDetailRoute() {
  const { comment, focus, id, media, origin, position, root, type } = useLocalSearchParams<{
    comment?: string;
    focus?: string;
    id: string;
    media?: string;
    origin?: string;
    position?: string;
    root?: string;
    type: string;
  }>();
  // HOM-14 §47, §51: la notifica di Commento/Risposta porta commento e thread.
  const commentTarget = parseCommentTarget(comment, root);
  // `Number("")` è 0: un `?media=` vuoto non è un tap su un media.
  const mediaIndex = media ? Number(media) : Number.NaN;
  // HOM-04 §122: la provenienza passata dal Feed; assente = ci si affida al Back.
  const contentOrigin = parseContentOrigin(origin);
  const commentFocus = parseCommentFocus(focus);
  const initialMediaIndex = Number.isInteger(mediaIndex) && mediaIndex >= 0 ? mediaIndex : null;

  // §35: `?media=N` dal Feed = tap già avvenuto sul video, parte una volta sola.
  const editorial = () => (
    <ContentDetailScreen
      autoStartVideo={initialMediaIndex !== null}
      commentTarget={commentTarget}
      focus={commentFocus}
      origin={contentOrigin}
    />
  );

  // HOM-08 §2: i commenti esistono solo per i sei tipi del contratto. Un tipo
  // sconosciuto (o un id mancante) non monta il dettaglio né i commenti.
  if (!id || (type !== "profile_post" && !SUPPORTED.includes(type as ContentDetailType))) {
    return <UnavailableContentDetail origin={contentOrigin} />;
  }

  if (type === "profile_post") {
    return (
      <ProfilePostDetail
        commentTarget={commentTarget}
        focus={commentFocus}
        initialMediaIndex={initialMediaIndex}
        origin={contentOrigin}
        postId={id}
      />
    );
  }

  if (type === "club_media" || type === "media_profile") {
    // Il Feed passa `position` solo per Articolo e video editoriale (resolveFeedItemHref):
    // sono già noti come non-Post, quindi si salta la sonda e il suo round trip.
    if (position !== undefined) {
      return editorial();
    }

    return (
      <PostOrEditorialDetail
        commentTarget={commentTarget}
        contentType={type}
        focus={commentFocus}
        initialMediaIndex={initialMediaIndex}
        origin={contentOrigin}
        postId={id}
        renderEditorial={editorial}
      />
    );
  }

  return editorial();
}

function UnavailableContentDetail({ origin }: { origin: ContentOrigin | null }) {
  const backToFeed = useBackToFeed(origin);

  return (
    <ContentDetailFrame title="Contenuto">
      <ContentUnavailableState onBackToFeed={backToFeed} />
    </ContentDetailFrame>
  );
}

function ContentDetailScreen({
  autoStartVideo,
  commentTarget,
  focus,
  origin,
}: {
  autoStartVideo: boolean;
  commentTarget: CommentTarget | null;
  focus: CommentFocus | null;
  origin: ContentOrigin | null;
}) {
  // Controller locale al dettaglio: un solo video alla volta, pausa su
  // background e uscita dalla schermata.
  const [videoController] = useState(createFeedVideoController);
  useFeedVideoLifecycle(videoController);

  return (
    <FeedVideoProvider controller={videoController}>
      <ContentDetailBody
        autoStartVideo={autoStartVideo}
        commentTarget={commentTarget}
        focus={focus}
        origin={origin}
      />
    </FeedVideoProvider>
  );
}

function ContentDetailBody({
  autoStartVideo,
  commentTarget,
  focus,
  origin,
}: {
  autoStartVideo: boolean;
  commentTarget: CommentTarget | null;
  focus: CommentFocus | null;
  origin: ContentOrigin | null;
}) {
  const { id, type } = useLocalSearchParams<{ id: string; type: string }>();
  const { profile } = useSession();
  const router = useRouter();
  // HOM-09 §4, §9, §175: Condividi apre il pannello sopra questo dettaglio.
  const share = useContentShare(origin);
  const viewerId = profile?.id ?? null;
  const scrollRef = useRef<ScrollView>(null);
  const comments = useCommentsController({
    contentId: id ?? "",
    contentType: type,
    focus,
    origin,
    scrollRef,
    target: commentTarget,
  });

  const [content, setContent] = useState<ContentView | null>(null);
  const [fanPost, setFanPost] = useState<FanTribunaPostDetail | null>(null);
  /*
    REV-PROF-21: voto e Q&A della Tribuna editoriale vivono nel dettaglio
    condiviso: serve il post, non solo la sua proiezione di lettura.
  */
  const [mediaTribunaPost, setMediaTribunaPost] =
    useState<MediaTribunaPost | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [failure, setFailure] = useState<"unavailable" | "error" | null>(null);
  const [isManageOpen, setManageOpen] = useState(false);
  const backToFeed = useBackToFeed(origin);
  const queryClient = useQueryClient();

  const contentType = type as ContentDetailType;
  const taggableType = asTaggedContentType(contentType);

  /*
    HOM-07 §91–§93, mockup 5: segnalibro nella barra del dettaglio, sullo store
    Salvati. HOM-15 §36–§37: vale anche per Media/Creator (articoli e Tribuna),
    che prima avevano un rail testuale «Salva/Salvato» sotto la riga azioni;
    `fetch_content_interaction_state` serve già `can_save`/`is_saved` per tutti
    e cinque i tipi.
  */
  const bookmark = useContentSaved(contentType as FeedContentType, id ?? "", {
    enabled: !!viewerId && !!id && SUPPORTED.includes(contentType),
  });

  const load = useCallback(async () => {
    if (!id || !SUPPORTED.includes(contentType)) {
      setContent(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setFailure(null);
    setMediaTribunaPost(null);

    // Stessa chiave della query dell'header: il publisher letto qui non si rilegge.
    const loadPublisher = (profileId: string) =>
      queryClient.fetchQuery({
        queryFn: () => fetchContentPublisher(profileId),
        queryKey: ["content-publisher", "profile", profileId],
      });

    try {
      if (contentType === "club_media") {
        const post = await fetchClubMediaPostDetail(id, viewerId);
        setFanPost(null);
        setContent(post ? mapClubMedia(post, viewerId) : null);
      } else if (contentType === "fan_tribuna") {
        const post = await fetchFanTribunaPostDetail(id, viewerId);
        setFanPost(post);
        setContent(post ? mapFanTribuna(post, viewerId) : null);
      } else if (contentType === "media_tribuna") {
        const post = await fetchMediaTribunaDetail(id, viewerId);
        setFanPost(null);
        setMediaTribunaPost(post);
        const publisher = post ? await loadPublisher(post.media_profile_id) : null;
        setContent(post && publisher ? mapMediaTribuna(post, publisher) : null);
      } else if (contentType === "fan_media") {
        const post = await fetchFanMediaPostDetail(id, viewerId);
        setFanPost(null);
        const publisher = post ? await loadPublisher(post.profile_id) : null;
        setContent(post && publisher ? mapFanMedia(post, publisher) : null);
      } else {
        const post = await fetchMediaProfilePostDetail(id, viewerId);
        setFanPost(null);
        setContent(post ? mapMediaProfile(post, viewerId) : null);
      }
    } catch (error) {
      // HOM-04 §66–68: un guasto di rete NON è «contenuto non disponibile».
      // Solo una risposta definitiva lo è; il resto offre «Riprova».
      setFailure(classifyContentError(error));
      setContent(null);
      setFanPost(null);
      setMediaTribunaPost(null);
    } finally {
      setLoading(false);
    }
  }, [contentType, id, queryClient, viewerId]);

  useEffect(() => {
    load();
  }, [load]);

  // HOM-05 §146, §103: impression all'apertura e, per l'Articolo (stessa regola
  // di `footme_feed_item_type`, vedi `ContentView.isArticle`), apertura e lettura attiva.
  const isArticle = !!content && content.isArticle;
  useContentDetailEvents({
    contentType,
    isArticle,
    isReady: !!content && !!id,
    origin,
    postId: id,
  });

  /*
    HOM-06.2 §7K, §49, §216: documento, cover, fonte e attribuzione di un
    Articolo. Un guasto non blocca la pagina: ripiega sul corpo storico. Mentre
    carica, il corpo storico non compare (niente «Fonte: …» che poi cambia).
  */
  const articleType =
    contentType === "club_media" || contentType === "media_profile" ? contentType : null;
  const articleDetailQuery = useQuery({
    enabled: !!content && !!id && content.articleCandidate && articleType !== null,
    queryFn: () => fetchArticleDetail(articleType as FeedContentType, id as string),
    queryKey: articleKeys.detail((articleType ?? "club_media") as FeedContentType, id ?? ""),
  });
  const articleDetail = articleDetailQuery.data ?? null;
  const isArticleLoading = !!content && content.articleCandidate && articleDetailQuery.isLoading;
  const articleBody = articleBodyKind(articleDetail);

  /*
    HOM-15 §26–§28: logo/avatar e verifica di chi pubblica, per l'header
    condiviso col Feed. Per club_media porta anche il nome («Condiviso da
    [Società]»), che il dettaglio storico non ha. Un guasto qui non blocca la
    pagina: l'header resta con il nome già noto, senza logo né check.
  */
  const publisherKind = content?.publisherKind ?? null;
  const publisherId = content?.publisherId ?? null;
  const publisherQuery = useQuery({
    enabled: publisherId !== null,
    queryFn: () =>
      publisherKind === "club"
        ? fetchClubPublisher(publisherId as string)
        : fetchContentPublisher(publisherId as string),
    queryKey: ["content-publisher", publisherKind, publisherId],
  });
  const publisher = publisherQuery.data ?? null;
  const publisherName =
    (publisherKind === "club" ? publisher?.name : null) ?? content?.publisherName ?? "";
  /*
    §7J, §7K: in EXTERNAL_LINK l'immagine è quella della fonte, dentro la
    card; una cover sopra la testata la duplicherebbe. Finché il documento non
    c'è, nessuna cover: comparirebbe e poi sparirebbe.
  */
  const detailCoverUrl = !content
    ? null
    : content.articleCandidate
      ? isArticleLoading || articleBody === "external"
        ? null
        : (articleDetail?.cover?.url ?? content.coverUrl)
      : content.coverUrl;

  /** HOM-05 §55–56: un solo evento per tap, con la source della provenienza. */
  function emitFromContent(
    eventType: Parameters<typeof emitContentEvent>[0]["eventType"],
    props?: Parameters<typeof emitContentEvent>[0]["props"],
  ) {
    if (id) {
      emitContentEvent({ contentType, eventType, postId: id, props, source: sourceForOrigin(origin) });
    }
  }

  function openTarget(target: TaggedEntry) {
    const opened = identityOpenEvent(target.target_type);
    emitFromContent(opened.eventType, opened.props);
    if (target.target_type === "club") {
      router.push({ params: { id: target.target_id }, pathname: "/club/[id]" });
    } else if (target.target_type === "team") {
      router.push({
        params: { id: target.target_id },
        pathname: "/club/team/[id]",
      });
    } else {
      router.push({ params: { id: target.target_id }, pathname: "/profile/[id]" });
    }
  }

  function openPublisher() {
    if (!content) {
      return;
    }
    emitFromContent(authorOpenEventType(content.publisherKind));
    if (content.publisherKind === "club") {
      router.push({ params: { id: content.publisherId }, pathname: "/club/[id]" });
    } else {
      router.push({
        params: { id: content.publisherId },
        pathname: "/profile/[id]",
      });
    }
  }

  return (
    <ContentDetailFrame
      footer={content ? <CommentComposerBar controller={comments} /> : null}
      right={
        content && bookmark.canSave ? (
          <SavedBookmarkButton isSaved={bookmark.isSaved} onToggle={bookmark.toggle} />
        ) : undefined
      }
      title="Contenuto"
    >
      {isLoading ? (
        // HOM-15 §202, §206: skeleton del dettaglio, non uno spinner a schermo intero.
        <View style={styles.scroll}>
          <ContentDetailSkeleton />
        </View>
      ) : !content ? (
        failure === "error" ? (
          <ContentLoadErrorState onRetry={load} />
        ) : (
          <ContentUnavailableState onBackToFeed={backToFeed} />
        )
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          ref={scrollRef}
        >
          {/*
            HOM-15 §26–§27, §53–§54: lo stesso header autore del Feed (avatar o
            logo, nome, verifica, tempo compatto), in testa come nel Post.
          */}
          <AuthorHeaderRow
            accessibilityHint={FEED_POST_OPEN_AUTHOR_HINT}
            accessibilityLabel={buildAuthorAccessibilityLabel({
              isVerified: publisher?.isVerified ?? false,
              name: publisherName,
              publishedAt: content.publishedAt,
            })}
            author={{
              avatarUrl: publisher?.avatarUrl ?? null,
              isVerified: publisher?.isVerified ?? false,
              kind: content.publisherKind,
              name: publisherName,
            }}
            meta={content.publishedAt ? formatCompactRelativeTime(content.publishedAt) : ""}
            onPressAuthor={openPublisher}
          />

          {content.video || detailCoverUrl ? (
            // HOM-03 §35, §50: video inline o cover ampia in testa; il titolo
            // segue come testata, senza la miniatura che la cover già mostra.
            <>
              <ContentDetailMedia
                autoStart={autoStartVideo}
                coverUrl={detailCoverUrl}
                itemId={`${contentType}:${id}`}
                title={content.title}
                video={content.video}
              />
              <View style={styles.headline}>
                <AppText color="secondary" variant="eyebrow">
                  {content.typeLabel}
                </AppText>
                <AppText variant="headingMd">{content.title}</AppText>
              </View>
            </>
          ) : content.articleCandidate ? (
            // HOM-06.2 §38, §7J: un Articolo senza cover non ha una miniatura
            // segnaposto; la testata è solo testo.
            <View style={styles.headline}>
              <AppText color="secondary" variant="eyebrow">
                {content.typeLabel}
              </AppText>
              <AppText variant="headingMd">{content.title}</AppText>
            </View>
          ) : (
            <CompactContentModule
              thumbnailUrl={content.thumbnailUrl}
              title={content.title}
              typeLabel={content.typeLabel}
            />
          )}

          <ContentAttribution
            authorName={content.authorName}
            onOpenTarget={openTarget}
            readingLabel={content.readingLabel}
            tagged={content.tagged}
          />

          {contentType === "fan_tribuna" && fanPost ? (
            <FanContentBody post={fanPost} viewerProfileId={viewerId} />
          ) : contentType === "media_tribuna" && mediaTribunaPost ? (
            /*
              REV-PROF-21: voto e Q&A della Tribuna editoriale vivono qui, nel
              dettaglio condiviso, non in un composer inline su ogni card del
              profilo.
            */
            <MediaTribunaBody
              post={mediaTribunaPost}
              viewerProfileId={viewerId}
            />
          ) : isArticleLoading ? (
            <View style={styles.bodyLoading}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : articleDetail && articleBody !== "none" ? (
            /*
              HOM-06.2 §7K, §73: documento (stesso renderer dell'Anteprima),
              card della fonte esterna o attribuzione. Sostituisce il blocco
              storico «Fonte: …», che qui sarebbe un doppione. L'URL esterno
              non è mai nei props dell'evento (§257).
            */
            <ArticleDetailBody
              detail={articleDetail}
              headline={content.title}
              onOpenSource={() => {
                trackArticle({ name: "external_article_opened" });
                if (isArticle) {
                  emitFromContent("article_link_click");
                }
              }}
              publisherName={publisherName}
            />
          ) : content.displayMode === "preview" ? (
            <>
              {content.excerpt ? (
                <AppText color="secondary" variant="bodyLg">
                  {content.excerpt}
                </AppText>
              ) : null}
              {content.externalUrl ? (
                <SourceLinkCard
                  onOpen={isArticle ? () => emitFromContent("article_link_click") : undefined}
                  sourceName={content.sourceName}
                  title="Leggi l'articolo completo sul sito"
                  url={content.externalUrl}
                />
              ) : null}
            </>
          ) : (
            <>
              {content.body ? (
                <AppText color="secondary" variant="bodyLg">
                  {content.body}
                </AppText>
              ) : null}
              {content.externalUrl ? (
                <SourceLinkCard
                  onOpen={isArticle ? () => emitFromContent("article_link_click") : undefined}
                  sourceName={content.sourceName}
                  title="Leggi anche sul sito"
                  url={content.externalUrl}
                />
              ) : null}
            </>
          )}

          {/*
            HOM-08 §13: la riga azioni ♡ | ◯ | ↗ del Post anche qui (HOM-03 §104:
            il Mi piace è la stessa entity del Feed). Condividi apre il pannello
            HOM-09 (la preview viene da ciò che questa vista già conosce, senza un
            secondo fetch); Commenta porta alla sezione sotto o al composer.
          */}
          {viewerId && id && SUPPORTED.includes(contentType) ? (
            <ContentActionRow
              contentType={contentType as FeedContentType}
              likeable={LIKEABLE.includes(contentType)}
              onComment={comments.onActionRowComment}
              onShare={() =>
                share.open({
                  contentId: id,
                  contentType: contentType as FeedContentType,
                  preview: buildSharePreviewFromDetail({
                    authorName: publisherName || null,
                    durationSeconds: content.video?.durationSeconds ?? null,
                    excerpt: content.excerpt ?? content.body,
                    hasVideo: content.video !== null,
                    isArticle: content.isArticle,
                    thumbnailUrl: detailCoverUrl ?? content.thumbnailUrl,
                    title: content.title,
                  }),
                })
              }
              postId={id}
              profileId={viewerId}
            />
          ) : null}

          {content.viewerTagged ? (
            <Button
              label="Gestisci tag"
              leftIcon={
                <Ionicons color={colors.textPrimary} name="pricetag-outline" size={18} />
              }
              onPress={() => setManageOpen(true)}
              variant="secondary"
            />
          ) : null}

          {/* HOM-08 §3, §184–§187: i commenti hanno i propri stati; il contenuto resta. */}
          <View style={styles.divider} />
          <CommentsSection controller={comments} />
        </ScrollView>
      )}

      {content ? <CommentsOverlays controller={comments} /> : null}
      {share.element}

      {isManageOpen && content && viewerId && taggableType ? (
        <TagManageSheet
          content={{
            thumbnailUrl: content.thumbnailUrl,
            title: content.title,
            typeLabel: content.typeLabel,
          }}
          contentType={taggableType}
          onActionDone={load}
          onClose={() => setManageOpen(false)}
          postId={id}
          taggedId={viewerId}
          targetType="profile"
          visible
        />
      ) : null}
    </ContentDetailFrame>
  );
}

function SourceLinkCard({
  onOpen,
  sourceName,
  title,
  url,
}: {
  /** HOM-05 §148: tap sul link dell'articolo. */
  onOpen?: () => void;
  sourceName: string | null;
  title: string;
  url: string;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => {
        onOpen?.();
        void Linking.openURL(url);
      }}
      style={styles.sourceCard}
    >
      <View style={styles.sourceCardText}>
        <AppText color="accent" variant="bodySm">
          {title}
        </AppText>
        <AppText color="secondary" numberOfLines={1} variant="caption">
          {sourceName ? `Fonte: ${sourceName}` : "Fonte originale"}
        </AppText>
      </View>
      <Ionicons color={colors.accent} name="open-outline" size={19} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bodyLoading: {
    alignItems: "center",
    paddingVertical: spacing[24],
  },
  divider: {
    backgroundColor: colors.divider,
    height: StyleSheet.hairlineWidth,
  },
  headline: {
    gap: spacing[4],
  },
  scroll: {
    gap: spacing[16],
    paddingBottom: spacing[28],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[8],
  },
  sourceCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[12],
  },
  sourceCardText: {
    flex: 1,
    gap: spacing[4],
  },
});
