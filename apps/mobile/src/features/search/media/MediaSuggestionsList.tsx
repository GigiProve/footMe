import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { spacing } from "../../../theme/tokens";
import { AppText, Divider, EmptyState, Skeleton } from "../../../ui";
import { SearchResultRow } from "../components/SearchResultRow";
import type {
  MediaSuggestionGroupKey,
  MediaSuggestionRow,
} from "./media-search-types";

/**
 * Autocomplete di Cerca > Media e contenuti (CER-05 §6): lista compatta di
 * suggerimenti, mai anteprime piene di articoli o video, più la CTA finale
 * "Vedi tutti i risultati per …".
 */

const GROUP_ORDER: MediaSuggestionGroupKey[] = [
  "societa",
  "fonte",
  "profilo",
  "argomento",
  "territorio",
];

const GROUP_LABELS: Record<MediaSuggestionGroupKey, string> = {
  argomento: "Argomenti",
  fonte: "Testate, giornalisti e creator",
  profilo: "Profili",
  societa: "Società e squadre",
  territorio: "Territori",
};

const GROUP_ICONS: Record<MediaSuggestionGroupKey, keyof typeof Ionicons.glyphMap> = {
  argomento: "pricetag-outline",
  fonte: "newspaper-outline",
  profilo: "person-outline",
  societa: "shield-outline",
  territorio: "map-outline",
};

type MediaSuggestionsListProps = {
  isLoading: boolean;
  onSeeAllResults: () => void;
  onSelect: (row: MediaSuggestionRow) => void;
  query: string;
  rows: MediaSuggestionRow[];
};

export function MediaSuggestionsList({
  isLoading,
  onSeeAllResults,
  onSelect,
  query,
  rows,
}: MediaSuggestionsListProps) {
  const grouped = GROUP_ORDER.map((groupKey) => ({
    groupKey,
    rows: rows.filter((row) => row.group_key === groupKey),
  })).filter((group) => group.rows.length > 0);

  return (
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {isLoading ? (
        <View style={styles.section}>
          <Skeleton.Row />
          <Skeleton.Row />
          <Skeleton.Row />
        </View>
      ) : grouped.length === 0 ? (
        <EmptyState
          description="Prova con un altro nome o una parola chiave diversa."
          icon="search-outline"
          title="Nessun suggerimento"
        />
      ) : (
        <>
          {grouped.map((group, index) => (
            <View key={group.groupKey} style={styles.section}>
              {index > 0 ? <Divider spacing={12} /> : null}
              <AppText color="muted" style={styles.groupLabel} variant="overline">
                {GROUP_LABELS[group.groupKey]}
              </AppText>
              {group.rows.map((row) => (
                <SearchResultRow
                  fallbackIcon={GROUP_ICONS[group.groupKey]}
                  imageUrl={row.image_url}
                  key={`${row.group_key}-${row.target_id ?? row.label}`}
                  onPress={() => onSelect(row)}
                  showDivider={false}
                  squareAvatar={row.group_key === "societa"}
                  subtitle={row.subtitle}
                  title={row.label}
                />
              ))}
            </View>
          ))}
        </>
      )}

      <Pressable accessibilityRole="button" onPress={onSeeAllResults} style={styles.seeAllRow}>
        <AppText color="accent" variant="bodySm">
          {`Vedi tutti i risultati per "${query}"`}
        </AppText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  groupLabel: {
    marginBottom: spacing[4],
  },
  section: {
    marginBottom: spacing[20],
  },
  seeAllRow: {
    alignItems: "center",
    paddingBottom: spacing[24],
    paddingVertical: spacing[16],
  },
});
