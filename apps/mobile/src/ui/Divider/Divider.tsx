import { StyleSheet, View, type ViewStyle } from "react-native";

import { colors, spacing } from "../../styles";

type DividerProps = {
  spacing?: keyof typeof spacing;
  style?: ViewStyle;
};

export function Divider({
  spacing: spacingKey,
  style,
}: DividerProps = {}) {
  const marginVertical = spacingKey != null ? spacing[spacingKey] : undefined;

  return (
    <View
      style={[
        styles.line,
        marginVertical != null ? { marginVertical } : undefined,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  line: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
});

export type { DividerProps };
