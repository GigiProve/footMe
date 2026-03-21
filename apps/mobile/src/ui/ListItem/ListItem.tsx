import { type ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, radius, spacing } from "../../styles";
import { AppText } from "../AppText/AppText";

type ListItemProps = {
  left?: ReactNode;
  onPress?: () => void;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
  subtitle?: string;
  title: string;
};

export function ListItem({
  left,
  onPress,
  right,
  style,
  subtitle,
  title,
}: ListItemProps) {
  const content = (
    <View style={[styles.container, style]}>
      {left ? <View style={styles.left}>{left}</View> : null}
      <View style={styles.body}>
        <AppText variant="titleSm" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="bodySm" color="secondary" numberOfLines={1}>
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
    paddingHorizontal: spacing[16],
    borderRadius: radius[12],
    backgroundColor: colors.surface,
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
  },
  pressed: {
    opacity: 0.82,
  },
});
