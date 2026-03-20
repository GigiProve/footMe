import { type PropsWithChildren } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, spacing } from "../../styles";

type AppListItemProps = PropsWithChildren<{
  /** Left-aligned accessory (avatar, icon) */
  leading?: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** Right-aligned accessory (chevron, badge) */
  trailing?: React.ReactNode;
}>;

/**
 * Generic list row with optional leading / trailing accessories — a common
 * pattern across search results, contacts, settings, and admin lists.
 *
 * Usage:
 *   <AppListItem
 *     leading={<AppAvatar imageUrl={url} size="sm" />}
 *     trailing={<Icon name="chevron-forward" />}
 *     onPress={goToProfile}
 *   >
 *     <AppText preset="title">Mario Rossi</AppText>
 *     <AppText preset="bodySmall">Centrocampista • AS Roma</AppText>
 *   </AppListItem>
 */
export function AppListItem({
  children,
  leading,
  onPress,
  style,
  testID,
  trailing,
}: AppListItemProps) {
  const inner = (
    <>
      {leading ?? null}
      <View style={styles.content}>{children}</View>
      {trailing ?? null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.container, pressed ? styles.pressed : null, style]}
        testID={testID}
      >
        {inner}
      </Pressable>
    );
  }

  return (
    <View style={[styles.container, style]} testID={testID}>
      {inner}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
  },
  content: {
    flex: 1,
    gap: spacing[2],
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
});
