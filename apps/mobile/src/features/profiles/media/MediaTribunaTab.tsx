/**
 * Tab Tribuna del Master Profile Media/Creator (REV-PROF-21, Screen 3).
 *
 * Soltanto contenuti interattivi: sondaggi, dibattiti, votazioni e Q&A. Non è
 * una seconda lista di articoli e non mostra foto o video isolati — quelli
 * hanno la loro tab, e la selezione avviene in query sul tipo reale del
 * record.
 */
import { StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";
import { ProfileSectionError } from "../master/ProfileSectionBlock";
import type { MediaTribunaPost } from "../media-tribuna-service";
import { MediaTribunaCard } from "./MediaTribunaCard";

export type MediaTribunaTabProps = {
  canCreateContent: boolean;
  canVote: boolean;
  errorMessage?: string | null;
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  isOwner: boolean;
  onCreatePress?: () => void;
  onLoadMore: () => void;
  onOpenLinkedArticle?: (articleId: string) => void;
  onOpenPost: (post: MediaTribunaPost) => void;
  onRetry: () => void;
  onVote?: (post: MediaTribunaPost, optionId: string) => void;
  posts: readonly MediaTribunaPost[];
};

export function MediaTribunaTab({
  canCreateContent,
  canVote,
  errorMessage,
  hasMore,
  isLoading,
  isLoadingMore,
  isOwner,
  onCreatePress,
  onLoadMore,
  onOpenLinkedArticle,
  onOpenPost,
  onRetry,
  onVote,
  posts,
}: MediaTribunaTabProps) {
  return (
    <View style={styles.root} testID="media-tribuna-tab">
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AppText variant="eyebrow">COMMUNITY</AppText>
          <AppText accessibilityRole="header" variant="titleMd">
            Tribuna
          </AppText>
          <AppText color="secondary" variant="bodySm">
            Sondaggi, dibattiti e domande alla community.
          </AppText>
        </View>

        {canCreateContent && onCreatePress ? (
          <Button
            accessibilityLabel="Crea un contenuto Tribuna"
            label="Crea"
            onPress={onCreatePress}
            size="sm"
            testID="media-tribuna-create-button"
            variant="outline"
          />
        ) : null}
      </View>

      {isLoading ? (
        <TribunaSkeleton />
      ) : errorMessage ? (
        <View style={styles.state}>
          <ProfileSectionError
            message={errorMessage}
            onRetry={onRetry}
            testID="media-tribuna-error"
          />
        </View>
      ) : posts.length === 0 ? (
        <View style={styles.empty} testID="media-tribuna-empty">
          <AppText variant="titleSm">
            {isOwner ? "La tua Tribuna è vuota" : "Tribuna vuota"}
          </AppText>
          <AppText align="center" color="secondary" variant="bodySm">
            {isOwner
              ? "Crea un sondaggio o avvia un dibattito con la community."
              : "Questo profilo non ha ancora aperto discussioni."}
          </AppText>
          {isOwner && canCreateContent && onCreatePress ? (
            <Button
              label="Crea"
              onPress={onCreatePress}
              size="sm"
              testID="media-tribuna-empty-cta"
              variant="outline"
            />
          ) : null}
        </View>
      ) : (
        <View style={styles.list} testID="media-tribuna-feed">
          {posts.map((post) => (
            <MediaTribunaCard
              canVote={canVote}
              key={post.id}
              onOpen={onOpenPost}
              onOpenLinkedArticle={onOpenLinkedArticle}
              onVote={onVote}
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
              testID="media-tribuna-load-more"
              variant="secondary"
            />
          ) : null}
        </View>
      )}
    </View>
  );
}

const SKELETON_CARDS = [0, 1];

function TribunaSkeleton() {
  return (
    <View
      accessible
      accessibilityLabel="Caricamento della Tribuna in corso"
      accessibilityRole="progressbar"
      style={styles.list}
      testID="media-tribuna-skeleton"
    >
      {SKELETON_CARDS.map((card) => (
        <View key={card} style={styles.skeletonCard}>
          <View style={[styles.skeletonLine, styles.skeletonLineShort]} />
          <View style={[styles.skeletonLine, styles.skeletonLineTitle]} />
          <View style={styles.skeletonLine} />
          <View style={styles.skeletonLine} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: "center",
    gap: spacing[8],
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[32],
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[12],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[16],
  },
  headerText: {
    flexShrink: 1,
    gap: spacing[4],
    minWidth: 0,
  },
  list: {
    gap: spacing[12],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
  },
  root: {
    gap: spacing[6],
  },
  skeletonCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing[10],
    padding: spacing[16],
  },
  skeletonLine: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[4],
    height: 12,
  },
  skeletonLineShort: {
    height: 10,
    width: 72,
  },
  skeletonLineTitle: {
    height: 16,
    width: "70%",
  },
  state: {
    paddingHorizontal: spacing[20],
    paddingTop: spacing[16],
  },
});
