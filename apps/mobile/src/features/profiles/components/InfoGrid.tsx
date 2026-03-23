import { type ComponentProps } from "react";
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing, typography } from "../../../theme/tokens";
import { AppText } from "../../../ui";

type InfoGridItem = {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
};

type InfoGridProps = {
  items: InfoGridItem[];
};

export function InfoGrid({ items }: InfoGridProps) {
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <View key={item.label} style={styles.cell}>
          <View style={styles.iconCircle}>
            <Ionicons color={colors.accent} name={item.icon} size={15} />
          </View>
          <View style={styles.cellText}>
            <AppText variant="bodySm" color="muted" style={styles.cellLabel}>
              {item.label}
            </AppText>
            <AppText variant="bodySm" style={styles.cellValue}>
              {item.value}
            </AppText>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  cell: {
    width: "50%",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[8],
    paddingVertical: spacing[6],
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  cellText: {
    flex: 1,
    gap: spacing[0],
  },
  cellLabel: {
    fontSize: typography.fontSize[11],
  },
  cellValue: {
    fontSize: typography.fontSize[13],
  },
});
