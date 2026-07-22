import { Pressable, StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";

type ChatContextCardProps = {
  onPress: () => void;
  subtitle: string;
  title: string;
};

export function ChatContextCard({ onPress, subtitle, title }: ChatContextCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
    >
      <View style={styles.body}>
        <AppText color="accent" style={styles.overline} variant="overline">
          IN MERITO A:
        </AppText>
        <AppText style={styles.title} variant="caption">
          {title}
        </AppText>
        <AppText color="muted" style={styles.subtitle} variant="caption">
          {subtitle}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.infoSurface,
    borderColor: colors.infoBorder,
    borderRadius: radius[8],
    borderWidth: 1,
    marginBottom: spacing[4],
    marginHorizontal: spacing[16],
    marginTop: spacing[12],
    padding: spacing[12],
  },
  body: {
    gap: spacing[4],
  },
  overline: {
    fontSize: 10,
  },
  pressed: {
    opacity: 0.75,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: "400",
  },
  title: {
    fontSize: 12,
  },
});
