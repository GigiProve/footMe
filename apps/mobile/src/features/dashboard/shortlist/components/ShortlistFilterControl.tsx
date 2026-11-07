/**
 * Controllo compatto dei filtri (DAS-REV-25 §13, screen 02 e 04).
 *
 * «Un solo controllo compatto: Tutti i profili ▾ senza filtri applicati,
 * Filtri attivi ▾ quando esiste almeno una restrizione. Non usare un
 * conteggio ambiguo di filtri né replicare la selezione in chip
 * aggiuntivi.»
 *
 * Sta sulla stessa riga del conteggio, come nel PNG: a sinistra «3 profili»,
 * a destra il controllo. Non è una toolbar e non cresce: una sola
 * restrizione o cinque producono la stessa etichetta.
 */
import { Pressable, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import { SHORTLIST_COPY, filterControlLabel } from "../shortlist-presentation";

type Props = {
  active: boolean;
  onPress: () => void;
};

export function ShortlistFilterControl({ active, onPress }: Props) {
  const label = filterControlLabel(active);

  return (
    <Pressable
      accessibilityHint="Apre i filtri per priorità e stato"
      accessibilityLabel={`${SHORTLIST_COPY.filterTitle}: ${label}`}
      accessibilityRole="button"
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.control, pressed ? styles.pressed : null]}
      testID="shortlist-filter-control"
    >
      <AppText color="neutral" numberOfLines={1} variant="meta">
        {label}
      </AppText>

      <Ionicons color={colors.textNeutral} name="chevron-down" size={14} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  control: {
    alignItems: "center",
    /* §4: «Chips e buttons sono pills.» Superficie neutra, testo nero: §4
       vieta qui un trattamento che somigli a una CTA. */
    backgroundColor: colors.surfaceNeutral,
    borderRadius: radius.full,
    flexDirection: "row",
    gap: spacing[6],
    minHeight: sizes.touchTarget - spacing[10],
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[6],
  },
  pressed: {
    opacity: 0.6,
  },
});
