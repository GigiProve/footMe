/**
 * Lista Mi piace (HOM-07 §45–§69, §179, §183, §197–§199; mockup 3).
 *
 * Pagina detail «← Mi piace», FUORI dalle tab: nessun PROLINK, nessuna
 * campanella, nessun «+», nessuna bottom navigation (§46). Una FlatList
 * verticale di righe PERSON / SOCIETY / MEDIA (`LikeActorRow`), ordine del
 * server (§58), senza spiegare il ranking.
 *
 * Stati, tutti compatti e senza illustrazioni (§65–§67, §156):
 *  • caricamento: skeleton di righe (§66);
 *  • nessun Mi piace: «Nessun Mi piace» (§65) — se nel frattempo sono spariti;
 *  • errore: «Non è stato possibile caricare i Mi piace.» + «Riprova» (§67); con
 *    righe già caricate l'avviso è una riga sobria e la lista resta;
 *  • contenuto non più leggibile (`content_unavailable`, §62): «Contenuto non
 *    disponibile», la stessa frase di HOM-04, senza «Riprova».
 *
 * Paginazione a cursore con scroll infinito (§60); il dedupe è di
 * `mergeLikerPages`. La schermata resta montata nello stack mentre si apre un
 * profilo: tornando, stessa lista e stesso scroll (§54). Al rientro si
 * rilegge solo lo stato Follow, che nel frattempo può essere cambiato altrove
 * (§54, §55): un refetch silenzioso, senza svuotare la lista.
 */

import Ionicons from "@expo/vector-icons/Ionicons";
import { useCallback, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, radius, sizes, spacing } from "../../../styles";
import { AppText, Button, EmptyState, ScreenHeader, Skeleton } from "../../../ui";
import { useSession } from "../../auth/use-session";
import {
  CONTENT_UNAVAILABLE_BODY,
  CONTENT_UNAVAILABLE_TITLE,
} from "../../feed/content-availability-presentation";
import {
  LIKES_EMPTY,
  LIKES_ERROR,
  LIKES_RETRY,
  LIKES_TITLE,
} from "../../interactions/like-labels";
import { trackLike } from "../../interactions/like-analytics";
import { classifyLikesError, keepLikerOrder, likeActorHref } from "../likes-presentation";
import { parseLikesParams } from "../likes-routes";
import { useContentLikers } from "../use-content-likers";
import { useToggleLikerFollow } from "../use-toggle-liker-follow";
import { LikeActorRow } from "./LikeActorRow";

function SkeletonRows({ count }: { count: number }) {
  return (
    <View testID="likes-skeleton">
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={styles.skeletonRow}>
          <Skeleton.Circle />
          <View style={styles.skeletonText}>
            <Skeleton.Row style={styles.skeletonName} />
            <Skeleton.Row style={styles.skeletonMeta} />
          </View>
          <View style={styles.skeletonAction} />
        </View>
      ))}
    </View>
  );
}

export function LikesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string; id?: string }>();
  const target = parseLikesParams(params);
  const { profile, session } = useSession();
  const viewerId = profile?.id ?? session?.user.id ?? "";
  const contentType = target?.contentType ?? "";
  const postId = target?.postId ?? "";

  const { actors: loaded, query } = useContentLikers({ contentType, postId, viewerId });
  // §54: stessa lista allo stesso posto anche dopo la rilettura al rientro.
  // Stato aggiornato durante il render (schema di React per i valori derivati
  // dalla render precedente): nessun ref letto nel render.
  const [order, setOrder] = useState<string[]>([]);
  const actors = keepLikerOrder(order, loaded);
  const actorKeys = actors.map((actor) => actor.key);
  if (actorKeys.join("|") !== order.join("|")) {
    setOrder(actorKeys);
  }
  const follow = useToggleLikerFollow({ contentType, postId, viewerId });

  // Rientro da un profilo: rilegge lo stato Follow. `useFocusEffect` richiede
  // una callback stabile (altrimenti rigira a ogni render).
  const hasLeftRef = useRef(false);
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      if (hasLeftRef.current) {
        void refetch();
      }
      return () => {
        hasLeftRef.current = true;
      };
    }, [refetch]),
  );

  const failure = query.isError ? classifyLikesError(query.error) : null;
  const hasData = actors.length > 0;

  function goBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)" as never);
    }
  }

  function renderBody() {
    if (!target) {
      return (
        <View style={styles.message}>
          <EmptyState description={CONTENT_UNAVAILABLE_BODY} title={CONTENT_UNAVAILABLE_TITLE} />
        </View>
      );
    }

    if (query.isPending) {
      return <SkeletonRows count={8} />;
    }

    // Il contenuto non è più leggibile (anche se la lista era già aperta): nessuna
    // riga fantasma (§62, §230) e nessun «Riprova», la risposta è definitiva.
    if (failure === "unavailable") {
      return (
        <View style={styles.message} testID="likes-unavailable">
          <EmptyState description={CONTENT_UNAVAILABLE_BODY} title={CONTENT_UNAVAILABLE_TITLE} />
        </View>
      );
    }

    // Con righe già caricate un errore temporaneo non le cancella (§159): resta
    // la lista, con l'avviso in fondo.
    if (query.isError && !hasData) {
      return (
        <View style={styles.message} testID="likes-error">
          <EmptyState
            action={<Button label={LIKES_RETRY} onPress={() => void query.refetch()} variant="secondary" />}
            title={LIKES_ERROR}
            variant="error"
          />
        </View>
      );
    }

    if (!hasData) {
      return (
        <View style={styles.message} testID="likes-empty">
          <EmptyState title={LIKES_EMPTY} />
        </View>
      );
    }

    return (
      <FlatList
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <SkeletonRows count={2} />
          ) : query.isError ? (
            <View accessibilityLiveRegion="polite" style={styles.transient}>
              <AppText color="secondary" style={styles.transientText} variant="bodySm">
                {LIKES_ERROR}
              </AppText>
              <Pressable
                accessibilityLabel={LIKES_RETRY}
                accessibilityRole="button"
                onPress={() => void query.fetchNextPage()}
                style={styles.transientAction}
              >
                <AppText color="accent" variant="actionLabel">
                  {LIKES_RETRY}
                </AppText>
              </Pressable>
            </View>
          ) : null
        }
        contentContainerStyle={styles.listContent}
        data={actors}
        keyExtractor={(actor) => actor.key}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage && !query.isError) {
            void query.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        renderItem={({ item: actor }) => (
          <LikeActorRow
            actor={actor}
            isFollowBusy={follow.isBusy(actor)}
            onOpen={() => {
              trackLike({
                actorType: actor.actorType,
                contentId: postId,
                contentType,
                name: "identity_open_from_likes",
              });
              router.push(likeActorHref(actor) as never);
            }}
            onToggleFollow={() => follow.toggle(actor)}
          />
        )}
        testID="likes-list"
      />
    );
  }

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.root}>
      <View style={styles.header}>
        <ScreenHeader
          leading={
            <Pressable
              accessibilityLabel="Indietro"
              accessibilityRole="button"
              hitSlop={8}
              onPress={goBack}
              style={({ pressed }) => [styles.back, pressed ? styles.pressed : null]}
              testID="likes-back"
            >
              <Ionicons color={colors.textPrimary} name="arrow-back" size={20} />
            </Pressable>
          }
          title={LIKES_TITLE}
        />
      </View>

      <View style={styles.body}>{renderBody()}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  back: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: sizes.touchTarget,
    justifyContent: "center",
    width: sizes.touchTarget,
  },
  body: {
    flex: 1,
  },
  header: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[8],
  },
  listContent: {
    paddingBottom: spacing[24],
  },
  message: {
    padding: spacing[16],
  },
  pressed: {
    opacity: 0.75,
  },
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  skeletonAction: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 32,
    width: 72,
  },
  skeletonMeta: {
    width: "40%",
  },
  skeletonName: {
    width: "60%",
  },
  skeletonRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
  },
  skeletonText: {
    flex: 1,
  },
  transient: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    flexDirection: "row",
    gap: spacing[12],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[8],
  },
  transientAction: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[8],
  },
  transientText: {
    flex: 1,
  },
});
