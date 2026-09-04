import { type ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, spacing } from "../../styles";
import { AppText } from "../AppText/AppText";

type ListItemProps = {
  left?: ReactNode;
  onPress?: () => void;
  right?: ReactNode;
  showDivider?: boolean;
  style?: StyleProp<ViewStyle>;
  subtitle?: string;
  subtitleNumberOfLines?: number;
  title: string;
};

export function ListItem({
  left,
  onPress,
  right,
  showDivider = true,
  style,
  subtitle,
  subtitleNumberOfLines = 1,
  title,
}: ListItemProps) {
  const content = (
    <View style={[styles.container, showDivider ? styles.withDivider : null, style]}>
      {left ? <View style={styles.left}>{left}</View> : null}
      <View style={styles.body}>
        <AppText variant="titleSm" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText
            variant="meta"
            color="secondary"
            numberOfLines={subtitleNumberOfLines}
          >
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => (pressed ? styles.pressed : null)}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[12],
    paddingVertical: spacing[14],
  },
  withDivider: {
    borderBottomWidth: 1,
    // Hairline interna al modulo: più chiara del bordo che lo racchiude (§1d).
    borderBottomColor: colors.divider,
  },
  left: {
    flexShrink: 0,
  },
  body: {
    flex: 1,
    gap: spacing[4],
  },
  right: {
    flexShrink: 0,
    minWidth: 32,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.82,
  },
});
