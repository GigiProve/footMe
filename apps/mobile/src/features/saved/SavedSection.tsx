import { StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { colors, radius, spacing } from "../../styles";
import { AppText, Button } from "../../ui";
import {
  fetchSavedCounts,
  fetchSavedItems,
  resolveSavedItemHref,
} from "./saved-service";
import { SavedItemRow } from "./components/SavedItemRow";

const PREVIEW_COUNT = 3;

function CountCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.countCard}>
      <AppText variant="headingSm">{value}</AppText>
      <AppText color="muted" variant="caption">
        {label}
      </AppText>
    </View>
  );
}

export function SavedSection() {
  const router = useRouter();

  const { data: counts } = useQuery({
    queryKey: ["saved-counts"],
    queryFn: fetchSavedCounts,
  });

  const { data: previewItems } = useQuery({
    queryKey: ["saved-items", "all", "preview"],
    queryFn: () => fetchSavedItems("all", 0, PREVIEW_COUNT),
  });

  function handleOpenItem(href: string | null) {
    router.push((href ?? "/saved") as never);
  }

  return (
    <View style={styles.section}>
      <AppText variant="titleMd">Salvati</AppText>
      <AppText color="muted" style={styles.privacy} variant="bodySm">
        Solo tu puoi vedere ciò che salvi.
      </AppText>

      {counts ? (
        <View style={styles.countsRow}>
          <CountCard label="Profili" value={counts.profiles_count} />
          <CountCard label="Posizioni" value={counts.positions_count} />
          <CountCard label="Contenuti" value={counts.contents_count} />
          <CountCard label="Società" value={counts.clubs_count} />
        </View>
      ) : null}

      {previewItems && previewItems.length > 0 ? (
        <View style={styles.previewList}>
          <AppText color="secondary" style={styles.previewHeading} variant="titleSm">
            Ultimi salvati
          </AppText>
          {previewItems.map((item) => (
            <SavedItemRow
              key={`${item.source_table}-${item.entity_id}`}
              item={item}
              onPress={() => handleOpenItem(resolveSavedItemHref(item))}
            />
          ))}
        </View>
      ) : null}

      <Button
        label="Vedi tutti i Salvati"
        onPress={() => router.push("/saved" as never)}
        variant="outline"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing[12],
    paddingTop: spacing[24],
  },
  privacy: {
    marginTop: -spacing[8],
  },
  countsRow: {
    flexDirection: "row",
    gap: spacing[8],
  },
  countCard: {
    flex: 1,
    alignItems: "center",
    gap: spacing[4],
    paddingVertical: spacing[12],
    borderRadius: radius[12],
    backgroundColor: colors.surface,
  },
  previewList: {
    gap: spacing[8],
  },
  previewHeading: {
    marginBottom: spacing[4],
  },
});
