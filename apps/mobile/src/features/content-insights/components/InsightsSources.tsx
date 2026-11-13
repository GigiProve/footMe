/**
 * Origine delle visualizzazioni (HOM-05 §76–84, §170).
 *
 * Etichetta, percentuale e una barra orizzontale sottile. TUTTE le barre hanno
 * lo stesso accent PROLINK (§82): nessun colore per sorgente. La percentuale è
 * scritta, quindi il dato non dipende dal colore della barra (§170). La
 * lunghezza della barra è un valore calcolato: è l'unico stile dinamico.
 */

import { StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import { INSIGHTS_SECTION_TITLES, type SourceRowModel } from "../insights-presentation";
import { InsightsPanel, InsightsSection } from "./InsightsSection";

export function InsightsSources({ rows }: { rows: SourceRowModel[] }) {
  return (
    <InsightsSection testID="insights-sources" title={INSIGHTS_SECTION_TITLES.sources}>
      <InsightsPanel>
        {rows.map((row, index) => (
          <View
            accessible
            accessibilityLabel={row.accessibilityLabel}
            key={row.key}
            style={[styles.row, index > 0 ? styles.rowDivider : null]}
            testID={`insights-source-${row.key}`}
          >
            <View style={styles.labels}>
              <AppText style={styles.label} variant="bodyLg">
                {row.label}
              </AppText>
              <AppText variant="numeric">{row.percentLabel}</AppText>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.round(row.barRatio * 100)}%` }]} />
            </View>
          </View>
        ))}
      </InsightsPanel>
    </InsightsSection>
  );
}

const styles = StyleSheet.create({
  fill: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    height: 4,
  },
  label: {
    flex: 1,
  },
  labels: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
  },
  row: {
    gap: spacing[8],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
  },
  rowDivider: {
    borderTopColor: colors.divider,
    borderTopWidth: 1,
  },
  track: {
    backgroundColor: colors.border,
    borderRadius: radius.full,
    height: 4,
    overflow: "hidden",
  },
});
