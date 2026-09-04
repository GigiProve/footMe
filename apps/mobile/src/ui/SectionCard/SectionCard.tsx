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

/**
 * Sezione di contenuto dentro un modulo. Il titolo è un eyebrow (§1a): dice
 * perché il blocco è lì, non compete con il contenuto e sta sempre nella
 * stessa posizione. Nessuna riga di separazione sotto l'intestazione: a
 * separare basta lo spazio.
 */
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
    <View
      style={[styles.base, variant === "flat" ? styles.flat : styles.card, style]}
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AppText color="muted" variant="eyebrow">
            {title}
          </AppText>
          {description ? (
            <AppText color="secondary" variant="meta">
              {description}
            </AppText>
          ) : null}
        </View>
        {onEdit ? (
          <Pressable
            accessibilityLabel={`Modifica ${title}`}
            accessibilityRole="button"
            hitSlop={12}
            onPress={onEdit}
            style={({ pressed }) => (pressed ? styles.pressed : null)}
          >
            <Ionicons color={colors.textMuted} name="create-outline" size={19} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    gap: spacing[12],
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    paddingBottom: spacing[16],
    paddingHorizontal: spacing[16],
    paddingTop: spacing[14],
  },
  flat: {
    backgroundColor: colors.surface,
    paddingBottom: spacing[18],
    paddingHorizontal: spacing[16],
    paddingTop: spacing[20],
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[12],
    justifyContent: "space-between",
  },
  headerText: {
    flex: 1,
    gap: spacing[4],
  },
  pressed: {
    opacity: 0.6,
  },
  content: {
    gap: spacing[14],
  },
});
