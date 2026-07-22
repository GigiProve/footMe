import { StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";

export function DateSeparator({ label }: { label: string }) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.pill}>
        <AppText color="muted" variant="caption">
          {label}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: colors.chatDateSeparator,
    borderRadius: radius[12],
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[6],
  },
  wrapper: {
    alignItems: "center",
    paddingVertical: spacing[8],
  },
});
