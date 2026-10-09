/**
 * Tab Tribuna del Master Profile Tifoso (REV-PROF-19, Screen 1 e 2).
 *
 * I contributi calcistici del Tifoso: opinioni, sondaggi e formazioni. Foto e
 * video non passano di qui — hanno la loro tab e lo stesso record non viene
 * copiato per comparire in due posti.
 */
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";
import { ProfileSectionError } from "../master/ProfileSectionBlock";
import type { FanTribunaPost } from "../fan-tribuna-service";
import { FanTribunaCard } from "./FanTribunaCard";

const SKELETON_CARDS = [0, 1, 2];

type FanTribunaTabProps = {
  /** Solo l'owner autorizzato vede la CTA di creazione. */
  canCreateContent: boolean;
  errorMessage?: string | null;
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  isOwner: boolean;
  onCreatePress: () => void;
  onLoadMore: () => void;
  onOpenPost: (post: FanTribunaPost) => void;
  onRetry: () => void;
  posts: readonly FanTribunaPost[];
};

export function FanTribunaTab({
  canCreateContent,
  errorMessage,
  hasMore,
  isLoading,
  isLoadingMore,
  isOwner,
  onCreatePress,
  onLoadMore,
  onOpenPost,
  onRetry,
  posts,
}: FanTribunaTabProps) {
  return (
    <View style={styles.container} testID="fan-tribuna-tab">
      {canCreateContent ? (
        <View style={styles.createRow}>
          {/*
            Compatta e allineata ai contenuti, non il bottone outline a tutta
            larghezza: la CTA non deve pesare quanto l'identità del profilo.
          */}
          <Button
            accessibilityLabel="Crea un contenuto"
            label="Crea"
            leftIcon={
              <Ionicons color={colors.inkInvert} name="add" size={16} />
            }
            onPress={onCreatePress}
            size="sm"
            testID="fan-create-button"
            variant="outline"
          />
        </View>
      ) : null}

      {isLoading ? (
        <TribunaSkeleton />
      ) : errorMessage ? (
        /*
          Errore locale: l'app bar, l'header e le altre tab restano quelle che
          sono. Un errore non diventa mai un empty state.
        */
        <ProfileSectionError
          message={errorMessage}
          onRetry={onRetry}
          testID="fan-tribuna-error"
        />
      ) : posts.length > 0 ? (
        <View style={styles.list} testID="fan-tribuna-feed">
          {posts.map((post) => (
            <FanTribunaCard
              key={post.id}
              onOpen={() => onOpenPost(post)}
              post={post}
            />
          ))}
          {hasMore ? (
            <Button
              accessibilityLabel="Mostra altri contenuti della Tribuna"
              disabled={isLoadingMore}
              label={isLoadingMore ? "Caricamento…" : "Mostra altri"}
              onPress={onLoadMore}
              size="sm"
              variant="secondary"
            />
          ) : null}
        </View>
      ) : (
        <View style={styles.empty} testID="fan-tribuna-empty">
          <AppText variant="titleSm">
            {isOwner ? "La tua Tribuna è vuota" : "Nessun contenuto nella Tribuna"}
          </AppText>
          <AppText align="center" color="secondary" variant="bodySm">
            {isOwner
              ? "Condividi un'opinione, crea un sondaggio o pubblica la tua formazione."
              : "Questo Tifoso non ha ancora pubblicato opinioni, sondaggi o formazioni."}
          </AppText>
          {canCreateContent ? (
            <Button
              label="Crea"
              onPress={onCreatePress}
              size="sm"
              variant="outline"
            />
          ) : null}
        </View>
      )}
    </View>
  );
}

/** Ingombro delle card vere, non uno spinner centrale. */
function TribunaSkeleton() {
  return (
    <View
      accessible
      accessibilityLabel="Caricamento della Tribuna in corso"
      accessibilityRole="progressbar"
      style={styles.list}
      testID="fan-tribuna-skeleton"
    >
      {SKELETON_CARDS.map((slot) => (
        <View key={slot} style={styles.skeletonCard}>
          <View style={[styles.skeletonLine, styles.skeletonChip]} />
          <View style={[styles.skeletonLine, styles.skeletonTitle]} />
          <View style={styles.skeletonLine} />
          <View style={[styles.skeletonLine, styles.skeletonShort]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[12],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[16],
  },
  createRow: {
    alignItems: "flex-end",
  },
  empty: {
    alignItems: "center",
    gap: spacing[8],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[32],
  },
  list: {
    gap: spacing[12],
  },
  skeletonCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing[8],
    padding: spacing[16],
  },
  skeletonChip: {
    height: 20,
    width: 92,
  },
  skeletonLine: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[4],
    height: 14,
    width: "100%",
  },
  skeletonShort: {
    width: "55%",
  },
  skeletonTitle: {
    height: 18,
    width: "75%",
  },
});
