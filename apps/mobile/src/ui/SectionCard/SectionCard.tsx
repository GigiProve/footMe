import { type PropsWithChildren } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../styles";
import { AppText } from "../AppText/AppText";
import { Divider } from "../Divider/Divider";

type SectionCardProps = PropsWithChildren<{
  description?: string;
  onEdit?: () => void;
  style?: StyleProp<ViewStyle>;
  title: string;
  variant?: "card" | "flat";
}>;

export function SectionCard({
  children,
  description,
  onEdit,
  style,
  title,
  variant = "card",
}: SectionCardProps) {
  return (
    <View style={[styles.base, variant === "flat" ? styles.flat : styles.card, style]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AppText variant="titleSm">{title}</AppText>
          {description ? (
            <AppText variant="bodySm" color="secondary">
              {description}
            </AppText>
          ) : null}
        </View>
        {onEdit ? (
          <Pressable
            accessibilityLabel={`Modifica ${title}`}
            accessibilityRole="button"
            hitSlop={8}
            onPress={onEdit}
            style={({ pressed }) => [
              styles.editButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Ionicons
              color={colors.textSecondary}
              name="create-outline"
              size={18}
            />
          </Pressable>
        ) : null}
      </View>
      <Divider />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    gap: spacing[12],
  },
  card: {
    padding: spacing[16],
    borderRadius: radius[8],
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  flat: {
    paddingHorizontal: spacing[16],
    paddingTop: spacing[20],
    paddingBottom: spacing[18],
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing[12],
  },
  headerText: {
    flex: 1,
    gap: spacing[4],
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.82,
  },
  content: {
    gap: spacing[14],
  },
});
