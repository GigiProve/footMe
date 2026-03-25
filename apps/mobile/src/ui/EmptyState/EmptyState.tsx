import { type ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../styles";
import Ionicons from "@expo/vector-icons/Ionicons";

import { AppText } from "../AppText/AppText";

type EmptyStateVariant = "default" | "error";

type EmptyStateProps = {
  action?: ReactNode;
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  variant?: EmptyStateVariant;
};

export function EmptyState({
  action,
  description,
  icon,
  title,
  variant = "default",
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      {icon ? (
        <View style={[styles.iconCircle, variant === "error" ? styles.iconCircleError : null]}>
          <Ionicons
            color={variant === "error" ? colors.destructiveForeground : colors.accentStrong}
            name={icon}
            size={24}
          />
        </View>
      ) : null}
      <AppText variant="titleSm" align="center">
        {title}
      </AppText>
      {description ? (
        <AppText variant="bodySm" color="muted" align="center">
          {description}
        </AppText>
      ) : null}
      {action ?? null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: spacing[12],
    paddingVertical: spacing[32],
    paddingHorizontal: spacing[16],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius[8],
    backgroundColor: colors.surface,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[4],
  },
  iconCircleError: {
    backgroundColor: colors.danger,
  },
});
