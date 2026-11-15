/**
 * Dettaglio canonico del Post (`profile_post` HOM-02; Post di Società e Media
 * HOM-08). Il nome del file è storico: il componente serve ogni contenuto che il
 * server classifica come Post (`fetch_post_detail`).
 *
 * §109: lo stesso Post component del Feed, non una seconda rappresentazione.
 * I dati arrivano da `fetch_post_detail`, che restituisce lo stesso `data` del
 * Feed e passa dallo stesso mapper. HOM-08 §8, §11, §266: un Post di Società o
 * Media non ha un renderer alternativo — apre questo dettaglio «← Post».
 *
 * Luigi (2026-11-11): il tap su un media del Feed apre questo dettaglio, non un
 * viewer nuovo (§35). Un'immagine è già mostrata intera nella collezione, che
 * qui è intera e non a quattro celle; il media toccato nel Feed (`?media=`)
 * viene portato in vista. HOM-03 (Luigi 2026-11-12): i video si riproducono
 * INLINE con lo stesso `VideoMedia` del Feed — niente più player modale — e
 * quello toccato nel Feed parte una volta sola (il tap è già avvenuto). Il
 * controller è locale al dettaglio: un solo video alla volta anche qui (§29), e
 * pausa su background e uscita dalla schermata. Condividi apre il pannello
 * HOM-09 sopra questo dettaglio (`useContentShare`); il Mi piace è quello reale
 * del Feed e aggiorna anche le tab.
 *
 * HOM-08 §3–§7, §184–§191: sotto la riga azioni e un filo divisore c'è la
 * sezione Commenti, nello stesso scroll; il composer è fisso in basso, fuori
 * dallo scroll (`ContentDetailFrame`). Il contenuto resta visibile mentre i
 * commenti caricano o falliscono: la sezione ha i suoi stati. `focus` (route)
 * porta alla sezione (`comments`) o al composer (`composer`) all'apertura; il
 * tap sulla cella Commenta fa lo stesso. Contenuto non disponibile → solo
 * `ContentUnavailableState`, nessun composer, nessun invio.
 */

import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { useSession } from "../../auth/use-session";
import { colors, spacing } from "../../../theme/tokens";
import { buildShareTarget } from "../../share/share-presentation";
import { useContentShare } from "../../share/use-content-share";
import { CommentComposerBar } from "../../comments/components/CommentComposerBar";
import { CommentsOverlays } from "../../comments/components/CommentsOverlays";
import { CommentsSection } from "../../comments/components/CommentsSection";
import { useCommentsController } from "../../comments/use-comments-controller";
import {
  authorOpenEventType,
  identityOpenEvent,
  sourceForOrigin,
} from "../../content-insights/content-events-presentation";
import { emitContentEvent } from "../../content-insights/content-events-service";
import { useContentDetailEvents } from "../../content-insights/use-content-detail-events";
import { normalizeContentAvailability } from "../content-availability-presentation";
import type { ContentManagement } from "../content-management-types";
import type { CommentFocus, ContentOrigin } from "../content-routes";
import { FEED_QK } from "../feed-keys";
import { useBackToFeed } from "../use-back-to-feed";
import { seedSavedFromItems, useToggleSavedFeedItem } from "../use-feed-item-actions";
import { useContentManagement } from "../use-content-management";
import { fetchPostDetail, resolveFeedAuthorHref, resolveIdentityHref } from "../feed-service";
import { createFeedVideoController } from "../feed-video-controller";
import type { FeedContentType } from "../feed-types";
import { useOpenLikes } from "../../likes/use-open-likes";
import { seedLikesFromItems, useToggleFeedPostLike } from "../use-feed-post-like";
import { FeedVideoProvider } from "../use-feed-video";
import { useFeedVideoLifecycle } from "../use-feed-video-lifecycle";
import { ContentLoadErrorState, ContentUnavailableState } from "./ContentUnavailableState";
import { ContentDetailFrame } from "./detail/ContentDetailFrame";
import { PostFeedItem } from "./items/PostFeedItem";

/**
 * HOM-04 §47: eliminato dal dettaglio, il contenuto non c'è più nella superficie
 * corrente — si esce dalla schermata invece di lasciare uno stato vuoto.
 */
function detailManagement(management: ContentManagement, leave: () => void): ContentManagement {
  return {
    ...management,
    onDelete: async () => {
      const outcome = await management.onDelete();
      if (outcome === "removed") {
        leave();
      }
      return outcome;
    },
  };
}

export function ProfilePostDetail({
  postId,
  contentType = "profile_post",
  focus = null,
  initialMediaIndex = null,
  origin = null,
}: {
  postId: string;
  /** HOM-08 §8: `profile_post`, `club_media` o `media_profile` (Post di Società/Media). */
  contentType?: FeedContentType;
  /** HOM-08 §5–§6: dove atterrare (sezione commenti o composer a fuoco). */
  focus?: CommentFocus | null;
  /** §35: il media toccato nel Feed, portato in vista una sola volta. */
  initialMediaIndex?: number | null;
  /** HOM-04 §122: da dove si è aperto il dettaglio. Assente = si affida al Back. */
  origin?: ContentOrigin | null;
}) {
  const router = useRouter();
  const { profile } = useSession();
  // HOM-09 §4, §9, §175: «Condividi» apre il pannello sopra questo dettaglio.
  const share = useContentShare(origin);
  const toggleLike = useToggleFeedPostLike({ profileId: profile?.id ?? "" });
  const openLikes = useOpenLikes();
  const manageContent = useContentManagement({ profileId: profile?.id ?? "" });
  // HOM-07 §133: il Salva del dettaglio è lo stesso del Feed (store Salvati).
  const toggleSaved = useToggleSavedFeedItem();
  const [videoController] = useState(createFeedVideoController);
  useFeedVideoLifecycle(videoController);
  const scrollRef = useRef<ScrollView>(null);
  const scrolledRef = useRef(false);
  const comments = useCommentsController({
    contentId: postId,
    contentType,
    focus,
    origin,
    scrollRef,
  });

  const query = useQuery({
    enabled: !!postId,
    queryFn: () => fetchPostDetail(contentType, postId),
    queryKey: FEED_QK.postDetail(postId),
  });
  const item = query.data ?? null;
  // HOM-07 §135: il dettaglio semina la stessa cella dei Mi piace del Feed
  // (e, HOM-08 §210, quella del conteggio commenti).
  useEffect(() => {
    if (item) {
      seedLikesFromItems([item]);
      seedSavedFromItems([item]);
    }
  }, [item]);
  const availability = normalizeContentAvailability({
    data: query.data,
    error: query.error,
    isError: query.isError,
  });
  const backToFeed = useBackToFeed(origin);
  const isReady = !!item && availability.status === "ready";

  // HOM-05 §146: l'apertura del dettaglio è un'impression con la source della
  // provenienza; solo a contenuto davvero mostrato.
  useContentDetailEvents({
    contentType,
    isArticle: false,
    isReady,
    origin,
    postId,
  });

  return (
    <FeedVideoProvider controller={videoController}>
      <ContentDetailFrame
        footer={isReady ? <CommentComposerBar controller={comments} /> : null}
        title="Post"
      >
        {query.isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        ) : availability.status === "error" ? (
          // HOM-04 §67–68: un errore di rete non è un contenuto sparito.
          <ContentLoadErrorState onRetry={() => void query.refetch()} />
        ) : availability.status === "unavailable" || !item ? (
          // §78, HOM-04 §55: un contenuto non più disponibile non si mostra come Post.
          <ContentUnavailableState onBackToFeed={backToFeed} />
        ) : (
          <>
            <ScrollView
              contentContainerStyle={styles.scroll}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
              ref={scrollRef}
            >
              <PostFeedItem
                autoStartMediaIndex={initialMediaIndex}
                item={item}
                management={detailManagement(manageContent(item, origin ?? "DEEP_LINK"), () =>
                  router.back(),
                )}
                mediaVariant="list"
                onComment={comments.onActionRowComment}
                onMediaLayout={(index, y) => {
                  if (index === initialMediaIndex && !scrolledRef.current && index > 0) {
                    scrolledRef.current = true;
                    scrollRef.current?.scrollTo({
                      animated: false,
                      y: Math.max(0, y - spacing[16]),
                    });
                  }
                }}
                onOpenIdentity={(target) => {
                  // HOM-05 §56: mention e tag; una Società è `society_open`.
                  const opened = identityOpenEvent(target.identityType);
                  emitContentEvent({
                    contentType,
                    eventType: opened.eventType,
                    postId,
                    props: opened.props,
                    source: sourceForOrigin(origin),
                  });
                  router.push(resolveIdentityHref(target) as never);
                }}
                onOpenLikes={() =>
                  openLikes({
                    contentType,
                    likesCount: item.payload.likesCount,
                    postId: item.payload.postId,
                  })
                }
                onOpenLink={() => {
                  const url = item.payload.linkPreview?.url;
                  if (url && /^https:\/\//i.test(url)) {
                    void Linking.openURL(url).catch(() => undefined);
                  }
                }}
                // Nel dettaglio le immagini sono già intere e i video si riproducono
                // da sé (`VideoMedia`): il tap su un media non apre altro.
                onOpenMedia={() => undefined}
                onPress={() => undefined}
                onPressAuthor={() => {
                  if (item.author) {
                    // HOM-05 §55.
                    emitContentEvent({
                      contentType,
                      eventType: authorOpenEventType(item.author.kind),
                      postId,
                      source: sourceForOrigin(origin),
                    });
                  }
                  const href = resolveFeedAuthorHref(item);
                  if (href) {
                    router.push(href as never);
                  }
                }}
                onShare={() => share.open(buildShareTarget(item))}
                onToggleLike={() => toggleLike(item)}
                onToggleSaved={() =>
                  toggleSaved.mutate({
                    contentType,
                    isSaved: item.isSaved,
                    itemId: item.id,
                    postId,
                  })
                }
              />
              <View style={styles.divider} />
              <CommentsSection controller={comments} />
            </ScrollView>
            <CommentsOverlays controller={comments} />
            {share.element}
          </>
        )}
      </ContentDetailFrame>
    </FeedVideoProvider>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: "center",
    flex: 1,
    gap: spacing[12],
    justifyContent: "center",
    padding: spacing[24],
  },
  divider: {
    backgroundColor: colors.divider,
    height: StyleSheet.hairlineWidth,
  },
  scroll: {
    paddingBottom: spacing[32],
    paddingHorizontal: spacing[16],
  },
});
