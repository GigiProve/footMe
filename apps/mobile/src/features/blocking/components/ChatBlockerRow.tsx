/**
 * Chat lato blocker: una sola riga compatta sopra il composer (HOM-12 §91–§101, §224–§226,
 * §238, Screen Master 5): piccolo triangolo di avviso rosso · «Hai bloccato {nome}» ·
 * «Sblocca» in stile link.
 *
 * Volutamente NON la card alta con il bottone a tutta larghezza del mockup (§93–§94):
 * lo storico resta il protagonista (§225). Con i font grandi il testo va a capo e la
 * riga cresce solo del necessario; «Sblocca» mantiene il target a 44pt (§248–§249). Un
 * Sblocca fallito lascia la riga e il pulsante disponibili (§205).
 */

import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import { BLOCK_COPY, chatBlockerLabel, unblockA11yLabel } from "../blocking-presentation";

type ChatBlockerRowProps = {
  name: string | null;
  isBusy?: boolean;
  onUnblock: () => void;
};

export function ChatBlockerRow({ isBusy = false, name, onUnblock }: ChatBlockerRowProps) {
  return (
    <View style={styles.row} testID="chat-blocker-row">
      <Ionicons
        accessibilityElementsHidden
        color={colors.danger}
        importantForAccessibility="no"
        name="warning"
        size={16}
      />
      <View style={styles.text}>
        <AppText color="secondary" variant="bodySm">
          {chatBlockerLabel(name)}
        </AppText>
      </View>
      <Pressable
        accessibilityLabel={unblockA11yLabel(name)}
        accessibilityRole="button"
        accessibilityState={{ busy: isBusy, disabled: isBusy }}
        disabled={isBusy}
        hitSlop={8}
        onPress={onUnblock}
        style={({ pressed }) => [styles.action, pressed ? styles.pressed : null]}
        testID="chat-blocker-unblock"
      >
        <AppText color="accent" variant="titleSm">
          {BLOCK_COPY.unblock}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: sizes.touchTarget,
    minWidth: sizes.touchTarget,
  },
  pressed: {
    opacity: 0.6,
  },
  row: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing[8],
    paddingHorizontal: spacing[16],
  },
  text: {
    flex: 1,
  },
});
