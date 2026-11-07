import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";

type Props = {
  label: string;
  onPress: () => void;
};

/**
 * Riga del filtro, sotto le tab (§12, §14 — screen 01, 04).
 *
 * «Il controllo filtro è una riga semplice con icona/chevron. A filtri vuoti:
 * Tutte le candidature. Non impilarvi numerosi chip selezionati.»
 *
 * Il riepilogo è testo, non una fila di chip rimovibili: §14 vieta il
 * secondo sistema di reset — «Le checkbox sono sufficienti: non aggiungere
 * chip duplicati sotto la checklist» — e lo stesso principio vale qui, dove
 * il riepilogo racconta la selezione invece di duplicarne i controlli.
 */
export function ApplicationsFilterRow({ label, onPress }: Props) {
  return (
    <Pressable
      accessibilityHint="Apre i filtri per squadra e posizione"
      accessibilityLabel={`Filtro: ${label}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, pressed ? styles.pressed : null]}
      testID="applications-filter-row"
    >
      <View style={styles.row}>
        <AppText
          color="neutral"
          numberOfLines={1}
          style={styles.label}
          variant="bodyLg"
        >
          {label}
        </AppText>

        <Ionicons
          color={colors.textNeutralSoft}
          name="chevron-forward"
          size={18}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderBottomColor: colors.dividerNeutral,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    minHeight: sizes.touchTarget,
    paddingVertical: spacing[10],
  },
  label: {
    flex: 1,
  },
  pressed: {
    opacity: 0.6,
  },
});
