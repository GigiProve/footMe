import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";

import { colors, radius, spacing, typography } from "../../styles";
import { AppText } from "../Text/AppText";

type ChipVariant = "default" | "selected" | "accent" | "muted";

type AppChipProps = {
  label: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  variant?: ChipVariant;
};

const backgroundMap: Record<ChipVariant, string> = {
  accent: colors.accentSoft,
  default: colors.background,
  muted: colors.surfaceMuted,
  selected: colors.accentStrong,
};

const textColorMap: Record<ChipVariant, string> = {
  accent: colors.accentStrong,
  default: colors.textPrimary,
  muted: colors.textSecondary,
  selected: colors.inkInvert,
};

const borderColorMap: Record<ChipVariant, string> = {
  accent: colors.transparent,
  default: colors.border,
  muted: colors.transparent,
  selected: colors.accentStrong,
};

/**
 * Compact tag / filter element.
 *
 * Usage:
 *   <AppChip label="Attaccante" variant="accent" />
 *   <AppChip label="Under 21" onPress={toggle} variant={active ? "selected" : "default"} />
 */
export function AppChip({
  label,
  onPress,
  style,
  testID,
  variant = "default",
}: AppChipProps) {
  const content = (
    <AppText
      preset="caption"
      style={{
        color: textColorMap[variant],
        fontSize: typography.fontSize[12],
        fontWeight: typography.fontWeight.bold,
      }}
    >
      {label}
    </AppText>
  );

  const containerStyle = [
    styles.base,
    {
      backgroundColor: backgroundMap[variant],
      borderColor: borderColorMap[variant],
    },
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [...containerStyle, pressed ? styles.pressed : null]}
        testID={testID}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <Pressable style={containerStyle} testID={testID}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: "flex-start",
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[6],
  },
  pressed: {
    opacity: 0.88,
  },
});
