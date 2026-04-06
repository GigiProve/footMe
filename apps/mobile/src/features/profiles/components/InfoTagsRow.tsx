import { StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";

type InfoTagsRowProps = {
  highlightedTags?: string[];
  label?: string;
  tags: string[];
};

export function InfoTagsRow({ highlightedTags = [], label, tags }: InfoTagsRowProps) {
  if (tags.length === 0) return null;

  return (
    <View style={styles.container}>
      {label ? (
        <AppText variant="overline" color="secondary" style={styles.label}>
          {label}
        </AppText>
      ) : null}
      <View style={styles.row}>
        {tags.map((tag) => {
          const highlighted = highlightedTags.includes(tag);
          return (
            <View
              key={tag}
              style={[styles.tag, highlighted ? styles.tagHighlighted : styles.tagDefault]}
            >
              <AppText
                variant="bodySm"
                style={[styles.tagText, highlighted ? styles.tagTextHighlighted : styles.tagTextDefault]}
              >
                {tag}
              </AppText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[8],
  },
  label: {
    marginBottom: spacing[4],
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  tag: {
    borderRadius: radius[6],
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[6],
  },
  tagDefault: {
    backgroundColor: colors.surfaceMuted,
  },
  tagHighlighted: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
    borderWidth: 1,
  },
  tagText: {
    fontWeight: "600",
  },
  tagTextDefault: {
    color: colors.textPrimary,
  },
  tagTextHighlighted: {
    color: colors.accent,
  },
});
