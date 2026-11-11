/**
 * Dettaglio di un post persona (`profile_post`, HOM-02).
 *
 * §109: lo stesso Post component del Feed, non una seconda rappresentazione.
 * I dati arrivano da `fetch_profile_post_detail`, che restituisce lo stesso
 * `data` del Feed e passa dallo stesso mapper.
 *
 * Luigi (2026-11-11): il tap su un media del Feed apre questo dettaglio, non un
 * viewer nuovo (§35, il viewer completo resta per HOM-03). Qui un video si apre
 * nel player a schermo intero già esistente; un'immagine è già mostrata intera
 * nella collezione, che qui è intera e non a quattro celle; il media toccato
 * nel Feed (`?media=`) viene portato in vista, e se è un video si apre il
 * player. Commenti e condivisione rispondono "in arrivo"
 * (HOM-08/09); il Mi piace è quello reale del Feed e aggiorna anche le tab.
 */

import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";

import { Screen } from "../../../components/ui/screen";
import { VideoPlayerModal } from "../../../components/ui/video-player-modal";
import { useSession } from "../../auth/use-session";
import { colors, spacing } from "../../../theme/tokens";
import { AppText, Button, useToast } from "../../../ui";
import { trackFeed } from "../feed-analytics";
import { FEED_QK } from "../feed-keys";
import { FEED_ERROR_BODY, FEED_RETRY, FEED_SOON_MESSAGES } from "../feed-labels";
import {
  fetchProfilePostDetail,
  resolveFeedAuthorHref,
  resolveIdentityHref,
} from "../feed-service";
import { useToggleFeedPostLike } from "../use-feed-post-like";
import { PostFeedItem } from "./items/PostFeedItem";

export function ProfilePostDetail({
  postId,
  initialMediaIndex = null,
}: {
  postId: string;
  /** §35: il media toccato nel Feed, portato in vista una sola volta. */
  initialMediaIndex?: number | null;
}) {
  const router = useRouter();
  const { profile } = useSession();
  const { showToast } = useToast();
  const toggleLike = useToggleFeedPostLike({ profileId: profile?.id ?? "" });
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const scrolledRef = useRef(false);

  const query = useQuery({
    enabled: !!postId,
    queryFn: () => fetchProfilePostDetail(postId),
    queryKey: FEED_QK.postDetail(postId),
  });
  const item = query.data ?? null;
  const initialMedia = initialMediaIndex !== null ? item?.payload.media[initialMediaIndex] : undefined;
  const initialVideoUrl =
    initialMedia?.type === "video" && initialMedia.availability === "available"
      ? initialMedia.url
      : null;

  // §36: un video toccato nel Feed si apre subito nel player, una volta sola:
  // chiuso il player, resta il dettaglio.
  const autoplayedRef = useRef(false);
  useEffect(() => {
    if (initialVideoUrl && !autoplayedRef.current) {
      autoplayedRef.current = true;
      setVideoUrl(initialVideoUrl);
    }
  }, [initialVideoUrl]);

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
          Post
        </AppText>
        <View style={styles.topBarButton} />
      </View>

      {query.isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : query.isError ? (
        // Un errore di rete non è un contenuto sparito: si offre il riprova.
        <View style={styles.centered}>
          <AppText color="secondary" variant="bodyLg">
            {FEED_ERROR_BODY}
          </AppText>
          <Button label={FEED_RETRY} onPress={() => void query.refetch()} variant="secondary" />
        </View>
      ) : !item ? (
        // §78: un contenuto non più disponibile non si mostra come normale Post.
        <View style={styles.centered}>
          <AppText color="secondary" variant="bodyLg">
            Contenuto non disponibile.
          </AppText>
          <Button label="Torna indietro" onPress={() => router.back()} variant="secondary" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} ref={scrollRef}>
          <PostFeedItem
            item={item}
            mediaVariant="list"
            onComment={() => showToast({ message: FEED_SOON_MESSAGES.comment })}
            onMediaLayout={(index, y) => {
              if (index === initialMediaIndex && !scrolledRef.current && index > 0) {
                scrolledRef.current = true;
                scrollRef.current?.scrollTo({ animated: false, y: Math.max(0, y - spacing[16]) });
              }
            }}
            onOpenIdentity={(target) => router.push(resolveIdentityHref(target) as never)}
            onOpenLink={() => {
              const url = item.payload.linkPreview?.url;
              if (url && /^https:\/\//i.test(url)) {
                void Linking.openURL(url).catch(() => undefined);
              }
            }}
            onOpenMedia={(index) => {
              const media = item.payload.media[index];
              if (media?.type === "video" && media.url && media.availability === "available") {
                trackFeed({ index, itemId: item.id, name: "feed_post_video_select" });
                setVideoUrl(media.url);
              }
            }}
            onPress={() => undefined}
            onPressAuthor={() => {
              const href = resolveFeedAuthorHref(item);
              if (href) {
                router.push(href as never);
              }
            }}
            onShare={() => showToast({ message: FEED_SOON_MESSAGES.share })}
            onToggleLike={() => toggleLike(item)}
            onToggleSaved={() => undefined}
          />
        </ScrollView>
      )}

      <VideoPlayerModal
        onClose={() => setVideoUrl(null)}
        url={videoUrl ?? ""}
        visible={videoUrl !== null}
      />
    </Screen>
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
  scroll: {
    paddingBottom: spacing[32],
    paddingHorizontal: spacing[16],
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    paddingHorizontal: spacing[8],
  },
  topBarButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  topBarTitle: {
    flex: 1,
  },
});
