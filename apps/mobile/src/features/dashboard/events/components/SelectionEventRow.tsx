import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import { EVENTS_COPY } from "../events-copy";
import { eventRowLines, rowAccessibilityLabel } from "../events-presentation";
import type { EventSection, SelectionEventRow as Row } from "../events-types";

type Props = {
  currentYear?: number;
  /** `null` quando la destinazione non esiste ancora (§23): niente tap. */
  onPress: (() => void) | null;
  row: Row;
  section: EventSection;
  showDivider: boolean;
};

/**
 * Una riga del Centro (DAS-REV-28 §4, §11; screen 01, 02, 13, 14, 16).
 *
 * «Centro con righe e separatori, non grandi card con ombre. Non
 * trasformare tipo, Team, data, count e stato in cinque chip. Usa status
 * testuali discreti. Posti esauriti non è un allarme rosso; Annullato non è
 * un errore tecnico. Evita icone ripetitive su ogni metadato.»
 *
 * Da qui: testo nero per il titolo, grigio neutro per i metadati, nessun
 * colore di stato. Lo stato dello storico è una parola a destra, non una
 * pillola.
 *
 * §27: «Riga evento come unità tappabile quando la destinazione è
 * disponibile, non solo chevron.» Senza destinazione — eventi in programma
 * e storico finché il dettaglio della 29–31 non esiste — la riga è testo
 * annunciato come tale, senza chevron (§23: nessun chevron verso un 404).
 */
export function SelectionEventRow({
  currentYear,
  onPress,
  row,
  section,
  showDivider,
}: Props) {
  const lines = eventRowLines(row, section, { currentYear });
  const label = rowAccessibilityLabel(lines);

  const body = (
    <View style={styles.row}>
      <View style={styles.text}>
        <AppText color="neutral" variant="titleSm">
          {lines.title}
        </AppText>

        {lines.context ? (
          <AppText color="neutralMuted" variant="meta">
            {lines.context}
          </AppText>
        ) : null}

        {lines.when ? (
          <AppText color="neutralMuted" variant="meta">
            {lines.when}
          </AppText>
        ) : null}

        {lines.counts ? (
          <AppText color="neutral" variant="meta">
            {lines.counts}
          </AppText>
        ) : null}

        {lines.full ? (
          <AppText color="neutralMuted" variant="meta">
            {EVENTS_COPY.full}
          </AppText>
        ) : null}
      </View>

      {lines.status ? (
        <AppText color="neutralMuted" style={styles.status} variant="meta">
          {lines.status}
        </AppText>
      ) : null}

      {onPress ? (
        <Ionicons color={colors.textNeutralSoft} name="chevron-forward" size={18} />
      ) : null}
    </View>
  );

  return (
    <View>
      {showDivider ? <View style={styles.divider} /> : null}

      {onPress ? (
        <Pressable
          accessibilityLabel={label}
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => (pressed ? styles.pressed : null)}
          testID={`event-row-${row.id}`}
        >
          {body}
        </Pressable>
      ) : (
        <View accessible accessibilityLabel={label} testID={`event-row-${row.id}`}>
          {body}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  divider: {
    backgroundColor: colors.divider,
    height: StyleSheet.hairlineWidth,
  },
  pressed: {
    opacity: 0.6,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget,
    paddingVertical: spacing[12],
  },
  status: {
    alignSelf: "flex-start",
  },
  text: {
    flex: 1,
    gap: spacing[4],
  },
});
