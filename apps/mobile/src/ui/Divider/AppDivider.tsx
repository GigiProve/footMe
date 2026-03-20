import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, spacing } from "../../styles";

type AppDividerProps = {
  spacing?: keyof typeof spacing;
  style?: StyleProp<ViewStyle>;
};

/**
 * Horizontal separator line, optionally surrounded by vertical margin.
 *
 * Usage:
 *   <AppDivider />
 *   <AppDivider spacing={16} />
 */
export function AppDivider({ spacing: gap, style }: AppDividerProps) {
  return (
    <View
      style={[
        styles.line,
        gap != null ? { marginVertical: spacing[gap] } : null,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  line: {
    height: 1,
    backgroundColor: colors.border,
  },
});
