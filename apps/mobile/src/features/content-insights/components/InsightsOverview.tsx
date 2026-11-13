/**
 * Panoramica: i quattro KPI (HOM-05 §28–31, §162, §167–168).
 *
 * Una griglia 2×2 leggera dentro UN solo pannello, separata da hairline: non
 * quattro card e non quattro pulsanti (§30, §162). Valori in `statValue`
 * (Mulish 900), un solo accent per le icone (§60). Con font grandi la griglia
 * diventa una colonna (§167). Ogni KPI si legge per esteso: «4.820
 * visualizzazioni» (§168).
 */

import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import {
  INSIGHTS_SECTION_TITLES,
  chunkItems,
  type InsightsLayout,
  type KpiModel,
} from "../insights-presentation";
import { InsightsPanel, InsightsSection } from "./InsightsSection";

export function InsightsOverview({ kpis, layout }: { kpis: KpiModel[]; layout: InsightsLayout }) {
  const rows = chunkItems(kpis, layout === "grid" ? 2 : 1);

  return (
    <InsightsSection testID="insights-overview" title={INSIGHTS_SECTION_TITLES.overview}>
      <InsightsPanel>
        {rows.map((row, rowIndex) => (
          <View
            key={row.map((kpi) => kpi.key).join("-")}
            style={[styles.row, rowIndex < rows.length - 1 ? styles.rowDivider : null]}
          >
            {row.map((kpi, cellIndex) => (
              <View
                accessible
                accessibilityLabel={kpi.accessibilityLabel}
                key={kpi.key}
                style={[styles.cell, cellIndex < row.length - 1 ? styles.cellDivider : null]}
                testID={`insights-kpi-${kpi.key}`}
              >
                <AppText align="center" variant="statValue">
                  {kpi.value}
                </AppText>
                <View style={styles.labelRow}>
                  <Ionicons color={colors.accent} name={kpi.icon} size={15} />
                  <AppText align="center" color="secondary" style={styles.label} variant="meta">
                    {kpi.label}
                  </AppText>
                </View>
              </View>
            ))}
          </View>
        ))}
      </InsightsPanel>
    </InsightsSection>
  );
}

const styles = StyleSheet.create({
  cell: {
    alignItems: "center",
    flex: 1,
    gap: spacing[6],
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[16],
  },
  cellDivider: {
    borderRightColor: colors.divider,
    borderRightWidth: 1,
  },
  label: {
    flexShrink: 1,
  },
  labelRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
  },
  rowDivider: {
    borderBottomColor: colors.divider,
    borderBottomWidth: 1,
  },
});
