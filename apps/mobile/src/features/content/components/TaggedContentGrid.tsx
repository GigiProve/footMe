import { useRouter } from "expo-router";
import { Image, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing, typography } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";
import type { TargetType } from "../content-tag-service";
import { useTaggedContentForTarget } from "../use-tagged-content";

type TaggedContentGridProps = {
  targetId: string;
  targetType: Extract<TargetType, "club" | "team">;
};

/**
 * 3-column grid of fan/editorial content where a club or internal team is
 * tagged. These are tagged contributions surfaced on the club/team Media tab —
 * NOT content published directly by the club. Tapping a thumbnail opens the
 * content detail route.
 */
export function TaggedContentGrid({ targetId, targetType }: TaggedContentGridProps) {
  const router = useRouter();
  const { hasMore, isLoading, isLoadingMore, loadMore, taggedItems } =
    useTaggedContentForTarget(targetType, targetId);

  if (isLoading || taggedItems.length === 0) {
    return null;
  }

  return (
    <View style={styles.section} testID="tagged-content-grid">
      <View style={styles.header}>
        <AppText style={styles.title} variant="titleSm">
          Contenuti taggati
        </AppText>
        <AppText color="secondary" variant="caption">
          {targetType === "club"
            ? "Contenuti in cui la società è taggata, non pubblicati dal club."
            : "Contenuti in cui la squadra è taggata, non pubblicati dalla società."}
        </AppText>
      </View>

      <View style={styles.grid}>
        {taggedItems.map((item) => (
          <Pressable
            accessibilityLabel={`Apri ${item.description}`}
            accessibilityRole="button"
            key={item.id}
            onPress={() => {
              if (item.taggedRef) {
                router.push(
                  `/content/${item.taggedRef.contentType}/${item.taggedRef.postId}` as never,
                );
              }
            }}
            style={styles.cell}
            testID={`tagged-grid-item-${item.id}`}
          >
            <View style={styles.tile}>
              {item.thumbnailUrl ? (
                <Image source={{ uri: item.thumbnailUrl }} style={styles.image} />
              ) : (
                <View style={styles.placeholder}>
                  <Ionicons
                    color={colors.accent}
                    name={item.coverIcon ?? "pricetag-outline"}
                    size={24}
                  />
                </View>
              )}
              <View style={styles.tagBadge}>
                <Ionicons color={colors.inkInvert} name="pricetag" size={10} />
              </View>
            </View>
          </Pressable>
        ))}
      </View>

      {hasMore ? (
        <View style={styles.loadMore}>
          <Button
            accessibilityLabel="Mostra altri contenuti taggati"
            disabled={isLoadingMore}
            label={isLoadingMore ? "Caricamento…" : "Mostra altri"}
            onPress={loadMore}
            size="sm"
            variant="secondary"
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    padding: 2,
    width: "33.3333%",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -2,
  },
  header: {
    gap: spacing[4],
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  loadMore: {
    alignItems: "center",
    paddingTop: spacing[8],
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    justifyContent: "center",
  },
  section: {
    gap: spacing[12],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[24],
  },
  tile: {
    aspectRatio: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[8],
    overflow: "hidden",
    position: "relative",
  },
  tagBadge: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: radius.full,
    height: 22,
    justifyContent: "center",
    position: "absolute",
    right: spacing[6],
    top: spacing[6],
    width: 22,
  },
  title: {
    fontWeight: typography.fontWeight.heavy,
  },
});
