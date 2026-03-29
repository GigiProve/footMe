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
        <View
          style={[
            styles.iconCircle,
            variant === "error" ? styles.iconCircleError : null,
          ]}
        >
          <Ionicons
            color={variant === "error" ? colors.danger : colors.textMuted}
            name={icon}
            size={32}
          />
        </View>
      ) : null}
      <AppText variant="headingSm" align="center">
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
    gap: spacing[16],
    paddingVertical: spacing[40],
    paddingHorizontal: spacing[20],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius[8],
    backgroundColor: colors.surface,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[4],
  },
  iconCircleError: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
  },
});
