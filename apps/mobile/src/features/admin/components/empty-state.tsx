import { StyleSheet, View } from "react-native";

import { spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";

export function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.container}>
      <AppText variant="bodyLg" color="muted" align="center">
        {message}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: spacing[32],
  },
});
