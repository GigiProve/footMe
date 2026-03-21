import { PropsWithChildren } from "react";
import { SafeAreaView, StyleSheet, View } from "react-native";

import { colors, spacing } from "../../theme/tokens";

export function Screen({ children }: PropsWithChildren) {
  return (
    <SafeAreaView testID="screen-root" style={styles.root}>
      <View testID="screen-content" style={styles.content}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[24],
  },
});
