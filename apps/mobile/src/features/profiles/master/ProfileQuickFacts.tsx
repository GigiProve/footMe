/**
 * Informazioni rapide dell'header (REV-PROF-01 §9).
 *
 * Riga editoriale con separatori leggeri: nessuna card per singolo dato e —
 * vincolo esplicito della correzione finale dello Screen 1 — nessuna icona
 * davanti alle etichette.
 */
import { StyleSheet, View } from "react-native";

import { colors, spacing, typography } from "../../../theme/tokens";
import { AppText } from "../../../ui";

export type ProfileQuickFact = {
  /**
   * Etichetta accessibile dell'intero dato, letta come unità semantica:
   * "Altezza, 192 centimetri" (§39).
   */
  accessibilityLabel: string;
  key: string;
  label: string;
  /** Unità mostrata più piccola accanto al valore: "cm", "kg". */
  unit?: string;
  value: string;
};

type ProfileQuickFactsProps = {
  facts: readonly ProfileQuickFact[];
  testID?: string;
};

export function ProfileQuickFacts({ facts, testID }: ProfileQuickFactsProps) {
  if (facts.length === 0) {
    return null;
  }

  return (
    // `flexWrap` invece di uno scroll orizzontale: con Dynamic Type elevato i
    // dati vanno a capo, non fuori dallo schermo (§9, §40).
    <View style={styles.row} testID={testID}>
      {facts.map((fact, index) => (
        <View
          accessible
          accessibilityLabel={fact.accessibilityLabel}
          key={fact.key}
          style={[styles.item, index > 0 ? styles.itemDivided : null]}
        >
          <View style={styles.valueRow}>
            <AppText numberOfLines={1} variant="statValue">
              {fact.value}
            </AppText>
            {fact.unit ? (
              <AppText color="secondary" style={styles.unit} variant="bodySm">
                {fact.unit}
              </AppText>
            ) : null}
          </View>
          <AppText color="muted" numberOfLines={1} variant="caption">
            {fact.label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    alignItems: "flex-start",
    flexGrow: 1,
    flexShrink: 1,
    gap: spacing[4],
    minWidth: 76,
    paddingHorizontal: spacing[12],
  },
  itemDivided: {
    borderLeftColor: colors.divider,
    borderLeftWidth: StyleSheet.hairlineWidth,
  },
  row: {
    alignItems: "flex-start",
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[16],
    rowGap: spacing[16],
  },
  unit: {
    lineHeight: typography.lineHeight[18],
  },
  valueRow: {
    alignItems: "baseline",
    flexDirection: "row",
    gap: spacing[4],
  },
});
