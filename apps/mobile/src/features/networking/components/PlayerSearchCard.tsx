import { Pressable, StyleSheet, View } from "react-native";

import {
  colors,
  radius,
  shadows,
  spacing,
  typography,
} from "../../../theme/tokens";
import { AppText, Avatar, Button } from "../../../ui";

type PlayerSearchCardProps = {
  avatarUrl?: string | null;
  category: string;
  name: string;
  onPress: () => void;
  onViewProfile: () => void;
  region: string;
  role: string;
  subtitle: string;
};

export function PlayerSearchCard({
  avatarUrl,
  category,
  name,
  onPress,
  onViewProfile,
  region,
  role,
  subtitle,
}: PlayerSearchCardProps) {
  return (
    <Pressable
      accessibilityLabel={`Profilo di ${name}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
    >
      <Avatar name={name} size="lg" uri={avatarUrl} />
      <View style={styles.body}>
        <AppText numberOfLines={1} variant="titleSm">
          {name}
        </AppText>
        <AppText variant="bodySm" color="accent">
          {subtitle}
        </AppText>
        <AppText variant="bodySm" color="muted" style={styles.metaText}>
          {region} · {category}
        </AppText>
      </View>
      <Button
        label="Vedi"
        onPress={onViewProfile}
        size="sm"
        variant="secondary"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[12],
    backgroundColor: colors.surface,
    borderRadius: radius[8],
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[16],
    ...shadows.subtle,
  },
  pressed: {
    opacity: 0.85,
  },
  body: {
    flex: 1,
    gap: spacing[4],
  },
  metaText: {
    fontSize: typography.fontSize[12],
  },
});
