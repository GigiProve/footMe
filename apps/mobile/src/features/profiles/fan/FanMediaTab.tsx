/**
 * Tab Media del Tifoso (REV-PROF-19, Screen 4).
 *
 * È `MediaTabContent`, il componente condiviso consolidato da REV-PROF-12,
 * senza nessuna griglia specifica per il Tifoso: le thumbnail non portano
 * l'icona Salvati — quella vive nel dettaglio contenuto, dove è sempre stata —
 * e i filtri, il viewer e la CTA di pubblicazione sono quelli di tutti gli
 * altri profili.
 *
 * Vive in un file suo, e non più dentro `FanProfileView`, perché REV-PROF-20
 * lo monta anche dentro la voce "Media e contenuti" dell'hub Modifica
 * profilo. Due superfici, un solo componente: duplicarlo avrebbe significato
 * due griglie da tenere allineate.
 */
import { StyleSheet, View } from "react-native";

import { colors, spacing } from "../../../theme/tokens";
import { Button } from "../../../ui";
import { MediaTabContent, type MediaContentItem } from "../career/MediaTabContent";
import { ProfileSectionError } from "../master/ProfileSectionBlock";
import { trackProfileEvent } from "../profile-analytics";
import type { FanContentRef } from "./fan-media-tab-service";

export type FanMediaTabProps = {
  errorMessage: string | null;
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  isOwner: boolean;
  items: MediaContentItem[];
  onAddContentPress?: () => void;
  onLoadMore: () => void;
  onOpenContent: (ref: FanContentRef) => void;
  onRetry: () => void;
  profileName: string;
  viewerMode: "owner" | "visitor";
};

export function FanMediaTab({
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
  profileName,
  viewerMode,
}: FanMediaTabProps) {
  if (isLoading) {
    return <MediaGridSkeleton />;
  }

  if (errorMessage) {
    return (
      <View style={styles.mediaState}>
        <ProfileSectionError
          message={errorMessage}
          onRetry={onRetry}
          testID="fan-media-error"
        />
      </View>
    );
  }

  return (
    <MediaTabContent
      authorName={profileName}
      emptyCtaLabel="Pubblica foto o video"
      emptyDescription={
        isOwner
          ? "Pubblica foto e video del calcio che vivi."
          : "Questo Tifoso non ha ancora pubblicato foto o video."
      }
      emptyTitle="Nessun contenuto Media"
      filtersEnabled
      footer={
        hasMore ? (
          <Button
            accessibilityLabel="Mostra altri contenuti Media"
            disabled={isLoadingMore}
            label={isLoadingMore ? "Caricamento…" : "Mostra altri"}
            onPress={onLoadMore}
            size="sm"
            variant="secondary"
          />
        ) : null
      }
      initialItems={items}
      mode={viewerMode}
      onAddContentPress={onAddContentPress}
      onFilterChange={(filter) =>
        trackProfileEvent("media_filter_changed", {
          mediaFilter: filter,
          profileType: "fan",
          viewerMode,
        })
      }
      onItemOpened={(item) =>
        trackProfileEvent("profile_media_opened", {
          mediaType: item.type,
          profileType: "fan",
          viewerMode,
        })
      }
      onOpenTaggedItem={onOpenContent}
    />
  );
}

const MEDIA_SKELETON_CELLS = [0, 1, 2, 3, 4, 5];

/** Celle della stessa misura delle thumbnail: nessun salto all'arrivo. */
export function MediaGridSkeleton() {
  return (
    <View
      accessible
      accessibilityLabel="Caricamento dei contenuti in corso"
      accessibilityRole="progressbar"
      style={styles.mediaSkeletonGrid}
      testID="fan-media-skeleton"
    >
      {MEDIA_SKELETON_CELLS.map((cell) => (
        <View key={cell} style={styles.mediaSkeletonCell} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  mediaSkeletonCell: {
    aspectRatio: 1,
    backgroundColor: colors.surfaceMuted,
    // Stessa geometria di `MediaTabContent`: tre colonne, 1px di gronda.
    marginBottom: 2,
    width: "33.3333%",
  },
  mediaSkeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingTop: spacing[12],
  },
  mediaState: {
    paddingHorizontal: spacing[20],
    paddingTop: spacing[20],
  },
});
