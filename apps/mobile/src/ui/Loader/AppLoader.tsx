import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, spacing } from "../../styles";
import { AppText } from "../Text/AppText";

type AppLoaderProps = {
  label?: string;
  size?: "small" | "large";
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Centralised loading indicator with optional label.
 *
 * Usage:
 *   <AppLoader />
 *   <AppLoader label="Caricamento profilo…" />
 */
export function AppLoader({
  label,
  size = "large",
  style,
  testID,
}: AppLoaderProps) {
  return (
    <View style={[styles.container, style]} testID={testID}>
      <ActivityIndicator color={colors.accent} size={size} testID={testID ? `${testID}-spinner` : undefined} />
      {label ? (
        <AppText align="center" color="textSecondary" preset="bodySmall">
          {label}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: spacing[12],
    justifyContent: "center",
    paddingVertical: spacing[32],
  },
});
