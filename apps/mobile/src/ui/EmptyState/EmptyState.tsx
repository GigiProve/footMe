import { type ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { colors, spacing } from "../../styles";
import Ionicons from "@expo/vector-icons/Ionicons";

import { AppText } from "../AppText/AppText";

type EmptyStateProps = {
  action?: ReactNode;
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
};

export function EmptyState({
  action,
  description,
  icon,
  title,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      {icon ? (
        <Ionicons color={colors.textMuted} name={icon} size={40} />
      ) : null}
      <AppText variant="titleMd" align="center">
        {title}
      </AppText>
      {description ? (
        <AppText variant="bodySm" color="secondary" align="center">
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
    paddingHorizontal: spacing[20],
  },
});
