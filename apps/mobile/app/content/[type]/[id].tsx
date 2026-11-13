import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Screen } from "../../../src/components/ui/screen";
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
import { ContentDetailMedia } from "../../../src/features/feed/components/detail/ContentDetailMedia";
import { ContentLikeControl } from "../../../src/features/feed/components/detail/ContentLikeControl";
import {
  ContentLoadErrorState,
  ContentUnavailableState,
} from "../../../src/features/feed/components/ContentUnavailableState";
import { ProfilePostDetail } from "../../../src/features/feed/components/ProfilePostDetail";
import { classifyContentError } from "../../../src/features/feed/content-availability-presentation";
import { parseContentOrigin, type ContentOrigin } from "../../../src/features/feed/content-routes";
import { useBackToFeed } from "../../../src/features/feed/use-back-to-feed";
import { createFeedVideoController } from "../../../src/features/feed/feed-video-controller";
import { legacyVideoMedia } from "../../../src/features/feed/feed-video-presentation";
import type { FeedContentType, FeedMediaItem } from "../../../src/features/feed/feed-types";
import { FeedVideoProvider } from "../../../src/features/feed/use-feed-video";
import { useFeedVideoLifecycle } from "../../../src/features/feed/use-feed-video-lifecycle";
import { FanContentBody } from "../../../src/features/profiles/FanContentBody";
import { MediaContentInteractions } from "../../../src/features/profiles/media/MediaContentInteractions";
import { MediaTribunaBody } from "../../../src/features/profiles/media/MediaTribunaBody";
import {
  fetchContentPublisher,
  type ContentPublisher,
} from "../../../src/features/content/content-publisher-service";
import { CompactContentModule } from "../../../src/features/content/components/CompactContentModule";
import { ContentTaggedHeader } from "../../../src/features/content/components/ContentTaggedHeader";
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
import { colors, radius, spacing } from "../../../src/theme/tokens";
import { AppText, Button } from "../../../src/ui";

type TaggedEntry = ContentTaggedTarget;

type ContentView = {
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
    authorName: null,
    body: post.body ?? post.excerpt ?? null,
    coverUrl: isVideo ? null : (post.visual_url ?? post.thumbnail_url),
    displayMode: "full",
    excerpt: post.excerpt ?? null,
    externalUrl: null,
    isArticle: isClubMediaArticle(post.visual_type, post.body),
    publishedAt: null,
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
    readingLabel: post.kind === "news" ? null : `${post.reading_time_minutes} min`,
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
 * HOM-02: i post persona (`profile_post`) usano il Post component del Feed
 * (§109); le cinque sorgenti CER-05 restano sul dettaglio storico qui sotto.
 */
export default function ContentDetailRoute() {
  const { id, media, origin, type } = useLocalSearchParams<{
    id: string;
    media?: string;
    origin?: string;
    type: string;
  }>();
  // `Number("")` è 0: un `?media=` vuoto non è un tap su un media.
  const mediaIndex = media ? Number(media) : Number.NaN;
  // HOM-04 §122: la provenienza passata dal Feed; assente = ci si affida al Back.
  const contentOrigin = parseContentOrigin(origin);

  if (type === "profile_post" && id) {
    return (
      <ProfilePostDetail
        initialMediaIndex={Number.isInteger(mediaIndex) && mediaIndex >= 0 ? mediaIndex : null}
        origin={contentOrigin}
        postId={id}
      />
    );
  }

  // §35: `?media=N` dal Feed = tap già avvenuto sul video, parte una volta sola.
  return (
    <ContentDetailScreen
      autoStartVideo={Number.isInteger(mediaIndex) && mediaIndex >= 0}
      origin={contentOrigin}
    />
  );
}

function ContentDetailScreen({
  autoStartVideo,
  origin,
}: {
  autoStartVideo: boolean;
  origin: ContentOrigin | null;
}) {
  // Controller locale al dettaglio: un solo video alla volta, pausa su
  // background e uscita dalla schermata.
  const [videoController] = useState(createFeedVideoController);
  useFeedVideoLifecycle(videoController);

  return (
    <FeedVideoProvider controller={videoController}>
      <ContentDetailBody autoStartVideo={autoStartVideo} origin={origin} />
    </FeedVideoProvider>
  );
}

function ContentDetailBody({
  autoStartVideo,
  origin,
}: {
  autoStartVideo: boolean;
  origin: ContentOrigin | null;
}) {
  const { id, type } = useLocalSearchParams<{ id: string; type: string }>();
  const { profile } = useSession();
  const router = useRouter();
  const viewerId = profile?.id ?? null;

  const [content, setContent] = useState<ContentView | null>(null);
  const [fanPost, setFanPost] = useState<FanTribunaPostDetail | null>(null);
  /*
    REV-PROF-21: il dettaglio dei contenuti Media/Creator porta anche Salva,
    commenti, voto e Q&A, che prima vivevano in una modale dentro il profilo.
    Serve quindi il post, non solo la sua proiezione di lettura.
  */
  const [mediaPost, setMediaPost] = useState<MediaProfilePost | null>(null);
  const [mediaTribunaPost, setMediaTribunaPost] =
    useState<MediaTribunaPost | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [failure, setFailure] = useState<"unavailable" | "error" | null>(null);
  const [isManageOpen, setManageOpen] = useState(false);
  const backToFeed = useBackToFeed(origin);

  const contentType = type as ContentDetailType;
  const taggableType = asTaggedContentType(contentType);

  const load = useCallback(async () => {
    if (!id || !SUPPORTED.includes(contentType)) {
      setContent(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setFailure(null);
    setMediaPost(null);
    setMediaTribunaPost(null);

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
        const publisher = post ? await fetchContentPublisher(post.media_profile_id) : null;
        setContent(post && publisher ? mapMediaTribuna(post, publisher) : null);
      } else if (contentType === "fan_media") {
        const post = await fetchFanMediaPostDetail(id, viewerId);
        setFanPost(null);
        const publisher = post ? await fetchContentPublisher(post.profile_id) : null;
        setContent(post && publisher ? mapFanMedia(post, publisher) : null);
      } else {
        const post = await fetchMediaProfilePostDetail(id, viewerId);
        setFanPost(null);
        setMediaPost(post);
        setContent(post ? mapMediaProfile(post, viewerId) : null);
      }
    } catch (error) {
      // HOM-04 §66–68: un guasto di rete NON è «contenuto non disponibile».
      // Solo una risposta definitiva lo è; il resto offre «Riprova».
      setFailure(classifyContentError(error));
      setContent(null);
      setFanPost(null);
      setMediaPost(null);
      setMediaTribunaPost(null);
    } finally {
      setLoading(false);
    }
  }, [contentType, id, viewerId]);

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
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel="Torna indietro"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.topBarButton}
        >
          <Ionicons color={colors.textPrimary} name="arrow-back" size={24} />
        </Pressable>
        <AppText align="center" style={styles.topBarTitle} variant="bodySm">
          Contenuto
        </AppText>
        <View style={styles.topBarButton} />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : !content ? (
        failure === "error" ? (
          <ContentLoadErrorState onRetry={load} />
        ) : (
          <ContentUnavailableState onBackToFeed={backToFeed} />
        )
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {content.video || content.coverUrl ? (
            // HOM-03 §35, §50: video inline o cover ampia in testa; il titolo
            // segue come testata, senza la miniatura che la cover già mostra.
            <>
              <ContentDetailMedia
                autoStart={autoStartVideo}
                coverUrl={content.coverUrl}
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
          ) : (
            <CompactContentModule
              thumbnailUrl={content.thumbnailUrl}
              title={content.title}
              typeLabel={content.typeLabel}
            />
          )}

          <ContentTaggedHeader
            authorName={content.authorName}
            onOpenTarget={openTarget}
            onPressPublisher={openPublisher}
            publishedAt={content.publishedAt}
            publisherName={content.publisherName}
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

          {/* HOM-03 §104: il Mi piace è la stessa entity del Feed. */}
          {viewerId && id && LIKEABLE.includes(contentType) ? (
            <ContentLikeControl
              contentType={contentType as FeedContentType}
              postId={id}
              profileId={viewerId}
            />
          ) : null}

          {/*
            REV-PROF-21: Salva e commenti dei contenuti Media/Creator. Prima
            stavano in una modale dentro il profilo — un secondo dettaglio —
            e qui non esistevano: ora esiste un dettaglio solo, e non si è
            perso niente.
          */}
          {mediaPost ? (
            <MediaContentInteractions
              contentType="media_profile"
              initialComments={mediaPost.comments}
              initialIsSaved={mediaPost.is_saved}
              postId={mediaPost.id}
              viewerProfileId={viewerId}
            />
          ) : null}

          {mediaTribunaPost ? (
            <MediaContentInteractions
              contentType="media_tribuna"
              initialComments={mediaTribunaPost.comments}
              initialIsSaved={mediaTribunaPost.is_saved}
              postId={mediaTribunaPost.id}
              viewerProfileId={viewerId}
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
        </ScrollView>
      )}

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
    </Screen>
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
  centered: {
    alignItems: "center",
    flex: 1,
    gap: spacing[16],
    justifyContent: "center",
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
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 44,
  },
  topBarButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  topBarTitle: {
    flex: 1,
    fontWeight: "600",
  },
});
