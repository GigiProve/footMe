import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, View } from "react-native";

import { colors, sizes, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import { AREA_LEVEL_LABEL } from "../permission-catalog";
import type { AreaLevel } from "../roles-types";

type Props = {
  areaLabel: string;
  level: AreaLevel;
  onPress?: () => void;
  showDivider?: boolean;
  testID?: string;
};

export function AreaLevelRow({
  areaLabel,
  level,
  onPress,
  showDivider = false,
  testID,
}: Props) {
  const content = (
    <>
      <AppText color="neutral" style={styles.label} variant="bodyLg">
        {areaLabel}
      </AppText>
      <AppText color="neutralMuted" variant="bodySm">
        {AREA_LEVEL_LABEL[level]}
      </AppText>
      {onPress ? (
        <Ionicons
          color={colors.textNeutralSoft}
          name="chevron-forward"
          size={18}
        />
      ) : null}
    </>
  );

  if (!onPress) {
    return (
      <View
        style={[styles.row, showDivider ? styles.divider : null]}
        testID={testID}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityLabel={`${areaLabel}, ${AREA_LEVEL_LABEL[level]}`}
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.row, showDivider ? styles.divider : null]}
      testID={testID}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget,
    paddingVertical: spacing[10],
  },
  divider: {
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  label: {
    flex: 1,
  },
});
