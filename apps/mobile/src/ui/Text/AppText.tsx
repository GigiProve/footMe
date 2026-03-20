import { Text as RNText, type StyleProp, type TextStyle } from "react-native";

import { colors, textPresets, type TextPreset } from "../../styles";

type AppTextProps = {
  align?: TextStyle["textAlign"];
  children: React.ReactNode;
  color?: keyof typeof colors;
  numberOfLines?: number;
  preset?: TextPreset;
  style?: StyleProp<TextStyle>;
  testID?: string;
};

/**
 * Typed text primitive. Every piece of visible text in FootMe should go
 * through AppText so that typography presets remain the single source of truth.
 *
 * Usage:
 *   <AppText preset="h1">Section title</AppText>
 *   <AppText preset="body" color="textSecondary">…</AppText>
 */
export function AppText({
  align,
  children,
  color,
  numberOfLines,
  preset = "body",
  style,
  testID,
}: AppTextProps) {
  return (
    <RNText
      numberOfLines={numberOfLines}
      style={[
        textPresets[preset],
        color ? { color: colors[color] } : null,
        align ? { textAlign: align } : null,
        style,
      ]}
      testID={testID}
    >
      {children}
    </RNText>
  );
}
