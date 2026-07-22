import { StyleSheet, View } from "react-native";

import { colors, radius, spacing, typography } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import { categoryLabel } from "../inbox-helpers";
import type { CommunicationCategory } from "../communications-service";

type CommunicationCategoryBadgeProps = {
  category: CommunicationCategory;
};

// No violet token exists in the design system yet; local literals mirror the
// precedent already used in ui/Badge/Badge.tsx for one-off tints.
const STORE_TINT = {
  background: "#FAF5FF",
  border: "#E9D5FF",
  text: "#7C3AED",
};

const CATEGORY_STYLES: Record<
  CommunicationCategory,
  { background: string; border: string; text: string }
> = {
  eventi: {
    background: colors.warningSoft,
    border: colors.warning,
    text: colors.warningStrong,
  },
  societa: {
    background: colors.accentSoft,
    border: colors.accent,
    text: colors.accent,
  },
  squadra: {
    background: colors.successSoft,
    border: colors.success,
    text: colors.success,
  },
  store: STORE_TINT,
};

export function CommunicationCategoryBadge({
  category,
}: CommunicationCategoryBadgeProps) {
  const palette = CATEGORY_STYLES[category];

  return (
    <View
      style={[
        styles.base,
        { backgroundColor: palette.background, borderColor: palette.border },
      ]}
    >
      <AppText style={[styles.label, { color: palette.text }]} variant="overline">
        {categoryLabel(category)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: "flex-start",
    borderRadius: radius[4],
    borderWidth: 1,
    paddingHorizontal: spacing[8],
    paddingVertical: 2,
  },
  label: {
    fontSize: typography.fontSize[10],
    lineHeight: 12,
  },
});
