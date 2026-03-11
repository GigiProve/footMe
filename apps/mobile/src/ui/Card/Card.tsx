import { PropsWithChildren } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

import { colors, radius, shadows, spacing } from "../../styles";

type CardVariant = "default" | "muted" | "inverse";

type CardProps = PropsWithChildren<{
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
  variant?: CardVariant;
}>;

const variantStyles = StyleSheet.create({
  default: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  inverse: {
    backgroundColor: colors.surfaceInverse,
  },
  muted: {
    backgroundColor: colors.surfaceMuted,
  },
});

export function Card({
  children,
  elevated = false,
  style,
  variant = "default",
}: CardProps) {
  return (
    <View
      style={[
        styles.base,
        variantStyles[variant],
        elevated ? shadows.card : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    gap: spacing[12],
    padding: spacing[18],
    borderRadius: radius[24],
  },
});
