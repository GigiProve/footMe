/**
 * Dettaglio di un post persona (`profile_post`, HOM-02).
 *
 * §109: lo stesso Post component del Feed, non una seconda rappresentazione.
 * I dati arrivano da `fetch_profile_post_detail`, che restituisce lo stesso
 * `data` del Feed e passa dallo stesso mapper.
 *
 * Luigi (2026-11-11): il tap su un media del Feed apre questo dettaglio, non un
 * viewer nuovo (§35). Un'immagine è già mostrata intera nella collezione, che
 * qui è intera e non a quattro celle; il media toccato nel Feed (`?media=`)
 * viene portato in vista. HOM-03 (Luigi 2026-11-12): i video si riproducono
 * INLINE con lo stesso `VideoMedia` del Feed — niente più player modale — e
 * quello toccato nel Feed parte una volta sola (il tap è già avvenuto). Il
 * controller è locale al dettaglio: un solo video alla volta anche qui (§29), e
 * pausa su background e uscita dalla schermata. Commenti e condivisione
 * rispondono "in arrivo" (HOM-08/09); il Mi piace è quello reale del Feed e
 * aggiorna anche le tab.
 */

import { useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";

import { Screen } from "../../../components/ui/screen";
import { useSession } from "../../auth/use-session";
import { colors, spacing } from "../../../theme/tokens";
import { AppText, Button, useToast } from "../../../ui";
import { FEED_QK } from "../feed-keys";
import { FEED_ERROR_BODY, FEED_RETRY, FEED_SOON_MESSAGES } from "../feed-labels";
import {
  fetchProfilePostDetail,
  resolveFeedAuthorHref,
  resolveIdentityHref,
} from "../feed-service";
import { createFeedVideoController } from "../feed-video-controller";
import { useToggleFeedPostLike } from "../use-feed-post-like";
import { FeedVideoProvider } from "../use-feed-video";
import { useFeedVideoLifecycle } from "../use-feed-video-lifecycle";
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
  const [videoController] = useState(createFeedVideoController);
  useFeedVideoLifecycle(videoController);
  const scrollRef = useRef<ScrollView>(null);
  const scrolledRef = useRef(false);

  const query = useQuery({
    enabled: !!postId,
    queryFn: () => fetchProfilePostDetail(postId),
    queryKey: FEED_QK.postDetail(postId),
  });
  const item = query.data ?? null;

  return (
    <FeedVideoProvider controller={videoController}>
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
              autoStartMediaIndex={initialMediaIndex}
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
              // Nel dettaglio le immagini sono già intere e i video si riproducono
              // da sé (`VideoMedia`): il tap su un media non apre altro.
              onOpenMedia={() => undefined}
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
      </Screen>
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
