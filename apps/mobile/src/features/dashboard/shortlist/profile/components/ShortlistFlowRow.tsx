/**
 * Riga interamente tappabile del flusso Shortlist dal profilo (DAS-REV-26
 * §4, §11, §14).
 *
 * «I pannelli usano righe semplici interamente tappabili. Nessun type
 * switcher, griglia di pulsanti … o lista di checkbox.» Una riga del
 * selector è una destinazione; una riga del riepilogo è una membership.
 * Stesso componente, perché §14 chiede lo stesso trattamento visivo.
 *
 * Il loading è **locale alla riga** (§13: «Durante la richiesta mostra
 * loading locale sulla riga e impedisci ulteriori submit dello stesso
 * passaggio»): la riga resta al suo posto e il chevron diventa un
 * indicatore.
 */
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../../../theme/tokens";
import { AppText } from "../../../../../ui";

type Props = {
  accessibilityLabel?: string;
  busy?: boolean;
  disabled?: boolean;
  lines: (string | null)[];
  onPress: () => void;
  testID?: string;
  title: string;
};

export function ShortlistFlowRow({
  accessibilityLabel,
  busy = false,
  disabled = false,
  lines,
  onPress,
  testID,
  title,
}: Props) {
  const meta = lines.filter((line): line is string => !!line && line.length > 0);

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? [title, ...meta].join(", ")}
      accessibilityRole="button"
      accessibilityState={{ busy, disabled: disabled || busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
      testID={testID}
    >
      <View style={styles.text}>
        <AppText color="neutral" variant="bodyLg">
          {title}
        </AppText>
        {meta.map((line) => (
          <AppText color="neutralMuted" key={line} variant="meta">
            {line}
          </AppText>
        ))}
      </View>

      {busy ? (
        <ActivityIndicator color={colors.textNeutralMuted} size="small" />
      ) : (
        <Ionicons color={colors.textNeutralSoft} name="chevron-forward" size={18} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    borderBottomColor: colors.dividerNeutral,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget + spacing[8],
    paddingVertical: spacing[10],
  },
  pressed: {
    opacity: 0.6,
  },
  text: {
    flex: 1,
    gap: spacing[4],
  },
});
