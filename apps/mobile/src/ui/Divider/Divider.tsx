import { StyleSheet, View, type ViewStyle } from "react-native";

import { colors, spacing } from "../../styles";

/**
 * Il design ha due hairline (§1a): `subtle` fra le righe interne a un modulo,
 * `strong` quando la linea fa da cornice (testata di schermata, rail azioni).
 */
type DividerTone = "subtle" | "strong";

type DividerProps = {
  spacing?: keyof typeof spacing;
  style?: ViewStyle;
  tone?: DividerTone;
};

export function Divider({
  spacing: spacingKey,
  style,
  tone = "subtle",
}: DividerProps = {}) {
  const marginVertical = spacingKey != null ? spacing[spacingKey] : undefined;

  return (
    <View
      style={[
        styles.line,
        toneStyles[tone],
        marginVertical != null ? { marginVertical } : undefined,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  line: {
    height: 1,
  },
});

const toneStyles = StyleSheet.create({
  subtle: { backgroundColor: colors.divider },
  strong: { backgroundColor: colors.border },
});

export type { DividerProps, DividerTone };
