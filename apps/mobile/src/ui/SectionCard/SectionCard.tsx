import { type PropsWithChildren } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, shadows, spacing } from "../../styles";
import { AppText } from "../AppText/AppText";
import { Divider } from "../Divider/Divider";

type SectionCardProps = PropsWithChildren<{
  description?: string;
  onEdit?: () => void;
  style?: StyleProp<ViewStyle>;
  title: string;
}>;

export function SectionCard({
  children,
  description,
  onEdit,
  style,
  title,
}: SectionCardProps) {
  return (
    <View style={[styles.card, style]}>
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
  card: {
    gap: spacing[12],
    padding: spacing[16],
    borderRadius: radius[8],
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.subtle,
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
