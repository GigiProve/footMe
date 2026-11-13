/**
 * Sezioni a righe compatte: Interazioni, Azioni generate, Prestazioni video e
 * articolo (HOM-05 §36–49, §91, §102, §163–164).
 *
 * Icone semplici e coerenti, tutte outline (§163). `tone="accent"` per Azioni
 * generate e Prestazioni (blu PROLINK, §60, §164, §184: mai verde); le
 * Interazioni restano neutre. Il valore è `numeric` (Mulish 900). La frase
 * dell'insight (§58–59) è una riga informativa con icona discreta e superficie
 * leggera dentro lo stesso pannello: non una card verde/azzurra. Ogni riga si
 * legge per esteso (§168) e il label va a capo con i font grandi (§167).
 */

import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import type { ActionsSectionModel, MetricRowModel } from "../insights-presentation";
import { INSIGHTS_SECTION_TITLES } from "../insights-presentation";
import { InsightsPanel, InsightsSection } from "./InsightsSection";

type Tone = "neutral" | "accent";

export function InsightsMetricRows({
  footer,
  helper,
  rows,
  testID,
  title,
  tone,
}: {
  footer?: ReactNode;
  helper?: string;
  rows: MetricRowModel[];
  testID?: string;
  title: string;
  tone: Tone;
}) {
  return (
    <InsightsSection helper={helper} testID={testID} title={title}>
      <InsightsPanel>
        {rows.map((row, index) => (
          <View
            accessible
            accessibilityLabel={row.accessibilityLabel}
            key={row.key}
            style={[styles.row, index > 0 ? styles.rowDivider : null]}
            testID={`insights-row-${row.key}`}
          >
            <Ionicons
              color={tone === "accent" ? colors.accent : colors.textSecondary}
              name={row.icon}
              size={18}
            />
            <AppText style={styles.label} variant="bodyLg">
              {row.label}
            </AppText>
            <AppText style={styles.value} variant="numeric">
              {row.value}
            </AppText>
          </View>
        ))}
        {footer}
      </InsightsPanel>
    </InsightsSection>
  );
}

/** §45–46, §58–59: helper, righe delle azioni e (se il server lo manda) la frase neutrale. */
export function InsightsActionsSection({ model }: { model: ActionsSectionModel }) {
  return (
    <View testID="insights-actions">
      <InsightsMetricRows
        helper={model.helper}
        footer={
          model.insight ? (
            <View
              accessible
              accessibilityLabel={model.insight}
              style={styles.insight}
              testID="insights-insight"
            >
              <Ionicons color={colors.accent} name="trending-up-outline" size={18} />
              <AppText color="secondary" style={styles.insightText} variant="bodySm">
                {model.insight}
              </AppText>
            </View>
          ) : null
        }
        rows={model.rows}
        title={INSIGHTS_SECTION_TITLES.actions}
        tone="accent"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  insight: {
    alignItems: "flex-start",
    backgroundColor: colors.surfaceMuted,
    borderTopColor: colors.divider,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing[10],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
  },
  insightText: {
    flex: 1,
  },
  label: {
    flex: 1,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: 44,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[10],
  },
  rowDivider: {
    borderTopColor: colors.divider,
    borderTopWidth: 1,
  },
  value: {
    flexShrink: 0,
  },
});
