import { Pressable, StyleSheet, View } from "react-native";

import { colors, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";

type InfoRowProps = {
  isLast?: boolean;
  label: string;
  onPress?: () => void;
  value: string;
  valueColor?: "default" | "primary" | "success";
};

export function InfoRow({
  isLast = false,
  label,
  onPress,
  value,
  valueColor = "default",
}: InfoRowProps) {
  const valueStyle = [
    styles.value,
    valueColor === "primary" && styles.valuePrimary,
    valueColor === "success" && styles.valueSuccess,
  ];

  const rowStyle = [styles.row, !isLast && styles.rowBorder];

  const content = (
    <View style={rowStyle}>
      <AppText variant="bodySm" color="secondary" style={styles.label}>
        {label}
      </AppText>
      <AppText variant="bodySm" style={valueStyle}>
        {value}
      </AppText>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => (pressed ? styles.pressed : undefined)}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  label: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    justifyContent: "space-between",
    paddingVertical: spacing[10],
  },
  rowBorder: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  value: {
    color: colors.textPrimary,
    fontWeight: "700",
    maxWidth: "60%",
    textAlign: "right",
  },
  valuePrimary: {
    color: colors.accent,
  },
  valueSuccess: {
    color: colors.success,
  },
});
