import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing, typography } from "../../theme/tokens";

type ContactCardMessageProps = {
  isOwnMessage?: boolean;
  name: string;
  onLongPress?: () => void;
  onPress?: () => void;
  phone: string;
  timestamp: string;
};

export function ContactCardMessage({
  isOwnMessage = false,
  name,
  onLongPress,
  onPress,
  phone,
  timestamp,
}: ContactCardMessageProps) {
  return (
    <Pressable
      accessibilityLabel={`Contatto condiviso ${name}`}
      onLongPress={onLongPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        isOwnMessage ? styles.cardOwn : styles.cardOther,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.iconWrap}>
          <Ionicons
            color={isOwnMessage ? colors.inkInvert : colors.accentStrong}
            name="call-outline"
            size={18}
          />
        </View>
        <Text style={[styles.eyebrow, isOwnMessage ? styles.eyebrowOwn : null]}>
          Contatto condiviso
        </Text>
      </View>
      <Text style={[styles.name, isOwnMessage ? styles.textOwn : null]}>{name}</Text>
      <Text style={[styles.phone, isOwnMessage ? styles.textOwn : null]}>{phone}</Text>
      <Text style={[styles.hint, isOwnMessage ? styles.hintOwn : null]}>
        Tocca per chiamare · tieni premuto per copiare
      </Text>
      <Text style={[styles.timestamp, isOwnMessage ? styles.timestampOwn : null]}>
        {timestamp}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing[8],
    padding: spacing[14],
    borderRadius: radius[20],
    borderWidth: 1,
    maxWidth: "100%",
  },
  cardOther: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  cardOwn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  eyebrow: {
    color: colors.accentStrong,
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.bold,
    textTransform: "uppercase",
    letterSpacing: typography.letterSpacing.md,
  },
  eyebrowOwn: {
    color: colors.inkInvert,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[8],
  },
  hint: {
    color: colors.textSecondary,
    fontSize: typography.fontSize[12],
    lineHeight: typography.lineHeight[22],
  },
  hintOwn: {
    color: colors.textInverseMuted,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  name: {
    color: colors.textPrimary,
    fontSize: typography.fontSize[16],
    fontWeight: typography.fontWeight.heavy,
  },
  phone: {
    color: colors.textPrimary,
    fontSize: typography.fontSize[18],
    fontWeight: typography.fontWeight.heavy,
  },
  pressed: {
    opacity: 0.82,
  },
  textOwn: {
    color: colors.inkInvert,
  },
  timestamp: {
    color: colors.textMuted,
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.bold,
  },
  timestampOwn: {
    color: colors.textInverseMuted,
  },
});
