/**
 * «Visualizza N risposte» / «Visualizza altre risposte» (HOM-08 §132–§136, mockup 5).
 *
 * Un link testuale accent, allineato al testo del commento sopra (sotto avatar e gap),
 * alto almeno 44pt (§236). Nessun auto-load (§136): le risposte si chiedono solo al tap.
 * Durante il caricamento di un blocco il controllo si disabilita, così un secondo tap non
 * produce una seconda richiesta.
 */

import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { colors, sizes, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";

export function CommentRepliesToggle({
  label,
  busy = false,
  flush = false,
  onPress,
  testID,
}: {
  label: string;
  busy?: boolean;
  /** Senza rientro: «Visualizza altri commenti» in fondo alla lista, non sotto un testo. */
  flush?: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ busy, disabled: busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [styles.toggle, flush ? styles.flush : styles.inset, pressed ? styles.pressed : null]}
      testID={testID}
    >
      <AppText color="accent" variant="feedMeta">
        {label}
      </AppText>
      {busy ? (
        <View style={styles.spinner}>
          <ActivityIndicator color={colors.accent} size="small" />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flush: {
    paddingLeft: 0,
  },
  // Sotto avatar (32) + gap (10): allineato al testo del commento.
  inset: {
    paddingLeft: spacing[32] + spacing[10],
  },
  pressed: {
    opacity: 0.6,
  },
  spinner: {
    marginLeft: spacing[8],
  },
  toggle: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    minHeight: sizes.touchTarget,
  },
});
