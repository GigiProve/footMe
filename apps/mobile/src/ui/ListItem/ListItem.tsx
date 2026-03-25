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
  title: string;
};

export function ListItem({
  left,
  onPress,
  right,
  showDivider = true,
  style,
  subtitle,
  title,
}: ListItemProps) {
  const content = (
    <View style={[styles.container, showDivider ? styles.withDivider : null, style]}>
      {left ? <View style={styles.left}>{left}</View> : null}
      <View style={styles.body}>
        <AppText variant="titleSm" numberOfLines={1} style={styles.title}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="bodySm" color="muted" numberOfLines={1} style={styles.subtitle}>
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
    paddingVertical: spacing[12],
  },
  withDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  left: {
    flexShrink: 0,
  },
  body: {
    flex: 1,
    gap: spacing[4],
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 13,
  },
  right: {
    flexShrink: 0,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.82,
  },
});
