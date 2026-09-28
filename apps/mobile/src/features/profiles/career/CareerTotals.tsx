/**
 * Totali carriera (REV-PROF-01 §20).
 *
 * Blocco compatto integrato nel flusso della pagina: divider leggeri, nessuna
 * card scura e — requisito della correzione definitiva del mockup — numeri e
 * label in nero/navy, mai in blu PROLINK.
 */
import { StyleSheet, View } from "react-native";

import { colors, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import {
  CAREER_METRIC_LABELS,
  formatCareerStat,
  getCareerStatAccessibilityLabel,
  type CareerMetric,
  type CareerTotals as CareerTotalsValue,
} from "./player-career-model";

const METRICS: readonly CareerMetric[] = ["appearances", "goals", "assists"];

type CareerTotalsProps = {
  totals: CareerTotalsValue;
};

export function CareerTotals({ totals }: CareerTotalsProps) {
  return (
    <View style={styles.container} testID="career-totals">
      <AppText color="muted" variant="eyebrow">
        Totali carriera
      </AppText>
      <View style={styles.row}>
        {METRICS.map((metric, index) => (
          <View
            accessible
            accessibilityLabel={getCareerStatAccessibilityLabel(
              metric,
              totals[metric],
            )}
            key={metric}
            style={[styles.item, index > 0 ? styles.itemDivided : null]}
          >
            <AppText numberOfLines={1} variant="statValue">
              {formatCareerStat(totals[metric])}
            </AppText>
            <AppText color="secondary" numberOfLines={1} variant="caption">
              {CAREER_METRIC_LABELS[metric]}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing[12],
    paddingTop: spacing[16],
  },
  item: {
    alignItems: "center",
    flex: 1,
    gap: spacing[4],
  },
  itemDivided: {
    borderLeftColor: colors.divider,
    borderLeftWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: "row",
  },
});
