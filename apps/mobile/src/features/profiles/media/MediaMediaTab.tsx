/**
 * Tab Media del Master Profile Media/Creator (REV-PROF-21, Screen 4).
 *
 * È `MediaTabContent`, il componente condiviso consolidato da REV-PROF-12:
 * stessa griglia a tre colonne, stessi filtri Tutti/Foto/Video, stesso
 * viewer, stesso dettaglio. Niente galleria specifica del Media/Creator,
 * nessun upload duplicato e nessuna icona Salvati sulle thumbnail — Salva
 * vive nel dettaglio, dove è sempre stato.
 */
import { StyleSheet, View } from "react-native";

import { colors, spacing } from "../../../theme/tokens";
import { Button } from "../../../ui";
import { MediaTabContent, type MediaContentItem } from "../career/MediaTabContent";
import { ProfileSectionError } from "../master/ProfileSectionBlock";
import { trackProfileEvent } from "../profile-analytics";
import type { MediaContentRef } from "./media-media-tab-service";

export type MediaMediaTabProps = {
  entityName: string | null;
  errorMessage: string | null;
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  isOwner: boolean;
  items: readonly MediaContentItem[];
  onAddContentPress?: () => void;
  onLoadMore: () => void;
  onOpenContent: (ref: MediaContentRef) => void;
  onRetry: () => void;
  viewerMode: "owner" | "visitor";
};

export function MediaMediaTab({
  entityName,
  errorMessage,
  hasMore,
  isLoading,
  isLoadingMore,
  isOwner,
  items,
  onAddContentPress,
  onLoadMore,
  onOpenContent,
  onRetry,
  viewerMode,
}: MediaMediaTabProps) {
  if (isLoading) {
    return <MediaGridSkeleton />;
  }

  if (errorMessage) {
    return (
      <View style={styles.state}>
        <ProfileSectionError
          message={errorMessage}
          onRetry={onRetry}
          testID="media-media-error"
        />
      </View>
    );
  }

  return (
    <MediaTabContent
      authorName={entityName ?? "Redazione"}
      emptyCtaLabel="Aggiungi contenuto"
      emptyDescription={
        isOwner
          ? "Racconta il tuo progetto attraverso i contenuti della redazione."
          : "Questo profilo non ha ancora pubblicato foto o video."
      }
      emptyTitle={isOwner ? "Aggiungi foto e video" : "Nessun contenuto"}
      filtersEnabled
      footer={
        hasMore ? (
          <Button
            accessibilityLabel="Mostra altri contenuti Media"
            disabled={isLoadingMore}
            label={isLoadingMore ? "Caricamento…" : "Mostra altri"}
            onPress={onLoadMore}
            size="sm"
            testID="media-media-load-more"
            variant="secondary"
          />
        ) : null
      }
      initialItems={items as MediaContentItem[]}
      mode={viewerMode}
      onAddContentPress={onAddContentPress}
      onFilterChange={(filter) =>
        trackProfileEvent("media_filter_changed", {
          mediaFilter: filter,
          profileType: "media",
          viewerMode,
        })
      }
      onItemOpened={(item) =>
        trackProfileEvent("profile_media_opened", {
          mediaType: item.type,
          profileType: "media",
          viewerMode,
        })
      }
      onOpenTaggedItem={onOpenContent}
    />
  );
}

const MEDIA_SKELETON_CELLS = [0, 1, 2, 3, 4, 5];

/** Celle della stessa misura delle thumbnail: nessun salto all'arrivo. */
function MediaGridSkeleton() {
  return (
    <View
      accessible
      accessibilityLabel="Caricamento dei contenuti in corso"
      accessibilityRole="progressbar"
      style={styles.skeletonGrid}
      testID="media-media-skeleton"
    >
      {MEDIA_SKELETON_CELLS.map((cell) => (
        <View key={cell} style={styles.skeletonCell} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  skeletonCell: {
    aspectRatio: 1,
    backgroundColor: colors.surfaceMuted,
    // Stessa geometria di `MediaTabContent`: tre colonne, 1px di gronda.
    marginBottom: 2,
    width: "33.3333%",
  },
  skeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingTop: spacing[12],
  },
  state: {
    paddingHorizontal: spacing[20],
    paddingTop: spacing[20],
  },
});
