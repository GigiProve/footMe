import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";

type Props = {
  error?: string | null;
  label: string;
  /** `null`/assente: valore statico. §19 vieta un chevron su un ruolo fisso. */
  onPress?: (() => void) | null;
  placeholder?: string;
  showDivider?: boolean;
  testID?: string;
  value: string | null;
};

/**
 * Riga etichetta/valore del passo Collegamento e dei riepiloghi (§19, §23).
 *
 * «Non mostrare un chevron sul ruolo statico, né trattarlo come un input
 * disabled»: senza `onPress` la riga non è un bottone, non ha chevron e non
 * viene annunciata come controllo — §45 chiede che «i ruoli statici non
 * vengano annunciati come selector disabled».
 *
 * Righe e divider, non card: §12 vieta «uno schema di grandi card».
 */
export function InviteFieldRow({
  error,
  label,
  onPress,
  placeholder = "Seleziona",
  showDivider = false,
  testID,
  value,
}: Props) {
  const shown = value ?? placeholder;

  const content = (
    <View style={styles.row}>
      <View style={styles.body}>
        <AppText color="neutralMuted" variant="meta">
          {label}
        </AppText>

        <AppText
          color={value ? "neutral" : "neutralSoft"}
          numberOfLines={2}
          variant="bodyLg"
        >
          {shown}
        </AppText>
      </View>

      {onPress ? (
        <Ionicons
          color={colors.textNeutralSoft}
          name="chevron-forward"
          size={18}
        />
      ) : null}
    </View>
  );

  return (
    <View style={[styles.block, showDivider ? styles.divided : null]}>
      {onPress ? (
        <Pressable
          accessibilityHint="Apre l'elenco delle opzioni"
          accessibilityLabel={`${label}: ${shown}`}
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => (pressed ? styles.pressed : null)}
          testID={testID}
        >
          {content}
        </Pressable>
      ) : (
        <View accessible accessibilityLabel={`${label}: ${shown}`} testID={testID}>
          {content}
        </View>
      )}

      {error ? (
        <AppText
          accessibilityRole="alert"
          color="danger"
          style={styles.error}
          variant="meta"
        >
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    paddingVertical: spacing[4],
  },
  divided: {
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    minHeight: sizes.touchTarget,
    paddingVertical: spacing[8],
  },
  body: {
    flex: 1,
    gap: spacing[4],
  },
  error: {
    paddingBottom: spacing[8],
  },
  pressed: {
    opacity: 0.6,
  },
});
