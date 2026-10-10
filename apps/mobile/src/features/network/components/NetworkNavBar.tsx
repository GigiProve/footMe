import { type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";

type Props = {
  action?: ReactNode;
  onBack: () => void;
  title: string;
};

/**
 * Barra di navigazione delle viste dentro la tab Dashboard (screen 01, 02,
 * 08, 10).
 *
 * §4: «Negli screen 01, 02, 08 e 10 mantenere Home | Cerca | Dashboard |
 * Messaggi | Profilo, con Dashboard selezionata.» Queste route vivono nello
 * Stack annidato della tab, quindi qui serve solo il back e il titolo —
 * §4 vieta «una terza tab principale o una nuova voce nella bottom
 * navigation».
 */
export function NetworkNavBar({ action, onBack, title }: Props) {
  return (
    <View style={styles.navBar}>
      <Pressable
        accessibilityLabel="Indietro"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onBack}
        style={({ pressed }) => [styles.button, pressed ? styles.pressed : null]}
        testID="network-nav-back"
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
