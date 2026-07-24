import { Pressable, StyleSheet, View } from "react-native";

import { spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";

type SearchSectionHeaderProps = {
  actionLabel?: string;
  onActionPress?: () => void;
  title: string;
};

export function SearchSectionHeader({
  actionLabel,
  onActionPress,
  title,
}: SearchSectionHeaderProps) {
  return (
    <View style={styles.row}>
      <AppText variant="overline" color="muted">
        {title}
      </AppText>
      {actionLabel && onActionPress ? (
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={onActionPress}
        >
          <AppText variant="bodySm" color="accent">
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing[8],
  },
});
