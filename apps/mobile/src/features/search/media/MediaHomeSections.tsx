import { ScrollView, StyleSheet, View } from "react-native";

import { spacing } from "../../../theme/tokens";
import { AppText, EmptyState, Skeleton } from "../../../ui";
import { SearchSectionHeader } from "../components/SearchSectionHeader";
import { MediaContentPreview } from "./MediaContentPreview";
import { MediaSourcePreview } from "./MediaSourcePreview";
import type {
  MediaForYouRow,
  MediaSourceDiscoverRow,
} from "./media-search-types";

/**
 * Schermata iniziale di Cerca > Media e contenuti (CER-05 §3).
 *
 * Non è un feed: due sezioni chiuse, un numero fisso di righe, nessuno
 * scorrimento infinito e nessun `onEndReached`. Una sola anteprima è
 * leggermente più evidenziata (`variant="featured"`), le altre sono compatte.
 */

const FEATURED_COUNT = 1;

type MediaHomeSectionsProps = {
  discoverRows: MediaSourceDiscoverRow[];
  forYouRows: MediaForYouRow[];
  isLoading: boolean;
  onOpenContent: (row: MediaForYouRow) => void;
  onOpenContentSource: (row: MediaForYouRow) => void;
  onOpenSource: (row: MediaSourceDiscoverRow) => void;
  onToggleFollow: (row: MediaSourceDiscoverRow) => void;
  onToggleSave: (row: MediaForYouRow) => void;
};

export function MediaHomeSections({
  discoverRows,
  forYouRows,
  isLoading,
  onOpenContent,
  onOpenContentSource,
  onOpenSource,
  onToggleFollow,
  onToggleSave,
}: MediaHomeSectionsProps) {
  if (isLoading) {
    return (
      <View style={styles.section}>
        <Skeleton.Row />
        <Skeleton.Row />
        <Skeleton.Row />
      </View>
    );
  }

  const hasAnything = forYouRows.length > 0 || discoverRows.length > 0;

  if (!hasAnything) {
    return (
      <EmptyState
        description="Cerca un argomento, una società o una testata per iniziare."
        icon="newspaper-outline"
        title="Ancora nessun contenuto"
      />
    );
  }

  const featured = forYouRows.slice(0, FEATURED_COUNT);
  const compact = forYouRows.slice(FEATURED_COUNT);

  return (
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {forYouRows.length > 0 ? (
        <View style={styles.section}>
          <SearchSectionHeader title="Per te" />
          <AppText color="muted" style={styles.support} variant="caption">
            Contenuti selezionati in base alle società e ai profili che segui.
          </AppText>

          {featured.map((row) => (
            <MediaContentPreview
              key={`${row.content_type}-${row.post_id}`}
              onPress={() => onOpenContent(row)}
              onPressSource={() => onOpenContentSource(row)}
              onToggleSave={() => onToggleSave(row)}
              row={row}
              variant="featured"
            />
          ))}

          {compact.map((row, index) => (
            <MediaContentPreview
              key={`${row.content_type}-${row.post_id}`}
              onPress={() => onOpenContent(row)}
              onPressSource={() => onOpenContentSource(row)}
              onToggleSave={() => onToggleSave(row)}
              row={row}
              showDivider={index < compact.length - 1}
            />
          ))}
        </View>
      ) : null}

      {discoverRows.length > 0 ? (
        <View style={styles.section}>
          <SearchSectionHeader title="Media da scoprire" />
          {discoverRows.map((row, index) => (
            <MediaSourcePreview
              key={`${row.source_type}-${row.entity_id}`}
              onPress={() => onOpenSource(row)}
              onToggleFollow={() => onToggleFollow(row)}
              row={row}
              showDivider={index < discoverRows.length - 1}
            />
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing[24],
  },
  support: {
    marginBottom: spacing[8],
  },
});
