import { PropsWithChildren } from "react";
import { SafeAreaView, View } from "react-native";

import { colors, radius, sizes, spacing, zIndex } from "../../theme/tokens";

export function Screen({ children }: PropsWithChildren) {
  return (
    <SafeAreaView testID="screen-root" style={styles.root}>
      <View
        testID="screen-orb-hero"
        pointerEvents="none"
        style={styles.heroOrb}
      />
      <View
        testID="screen-orb-accent"
        pointerEvents="none"
        style={styles.accentOrb}
      />
      <View testID="screen-content" style={styles.content}>{children}</View>
    </SafeAreaView>
  );
}

const styles = {
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  heroOrb: {
    position: "absolute",
    top: -80,
    right: -40,
    width: sizes.orbHero,
    height: sizes.orbHero,
    borderRadius: radius.full,
    backgroundColor: colors.heroSoft,
    opacity: 0.5,
    zIndex: zIndex.base,
  },
  accentOrb: {
    position: "absolute",
    bottom: -120,
    left: -70,
    width: sizes.orbAccent,
    height: sizes.orbAccent,
    borderRadius: radius.full,
    backgroundColor: colors.accentSoft,
    opacity: 0.8,
    zIndex: zIndex.base,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[24],
    zIndex: zIndex.content,
  },
} as const;
