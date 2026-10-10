import { type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";

type Props = {
  /** Menu contestuale, mostrato solo quando contiene azioni autorizzate (§11). */
  action?: ReactNode;
  onBack: () => void;
  title: string;
};

/**
 * Barra di navigazione delle viste di consultazione (screen 01, 02, 09).
 *
 * Restano dentro lo Stack della tab Dashboard, quindi la bottom navigation è
 * visibile con Dashboard selezionata (§9). Qui c'è solo il back e il titolo:
 * §9 vieta «campanella, launcher +, nuove tab o cambio Team nel form».
 */
export function SeasonsNavBar({ action, onBack, title }: Props) {
  return (
    <View style={styles.navBar}>
      <Pressable
        accessibilityLabel="Indietro"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onBack}
        style={({ pressed }) => [styles.button, pressed ? styles.pressed : null]}
        testID="seasons-nav-back"
      >
        <Ionicons color={colors.textNeutral} name="arrow-back" size={22} />
      </Pressable>

      <AppText
        color="neutral"
        numberOfLines={1}
        style={styles.title}
        variant="titleMd"
      >
        {title}
      </AppText>

      {action ?? <View style={styles.button} />}
    </View>
  );
}

const styles = StyleSheet.create({
  navBar: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    minHeight: sizes.touchTarget,
  },
  button: {
    alignItems: "center",
    height: sizes.touchTarget,
    justifyContent: "center",
    width: sizes.touchTarget,
  },
  title: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
