/**
 * Stati di Dettagli e statistiche (HOM-05 §121–125, §135, §138).
 *
 *  • `InsightsSkeleton`: segnaposto localizzati per preview, Panoramica, righe e
 *    grafico (§125, §197). Mai uno spinner a schermo intero;
 *  • `InsightsInitialState`: «Le statistiche stanno iniziando a popolarsi» (§121)
 *    senza copy promozionale (§124) e senza zeri (§122). `full` è il blocco
 *    centrale quando non c'è nessun dato; `compact` è una nota sotto le sezioni
 *    che hanno già valori (§123);
 *  • `InsightsErrorState`: «Statistiche non disponibili» + Riprova. Mai letto
 *    come «nessuna statistica» (§135–136);
 *  • `InsightsPermissionState`: permesso revocato, nessun dato, solo Indietro
 *    verso la provenienza (§137–139).
 */

import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button, Skeleton } from "../../../ui";
import {
  INSIGHTS_BACK_LABEL,
  INSIGHTS_ERROR_BODY,
  INSIGHTS_ERROR_TITLE,
  INSIGHTS_INITIAL_BODY,
  INSIGHTS_INITIAL_TITLE,
  INSIGHTS_LOADING_A11Y,
  INSIGHTS_PERMISSION_LOST,
  INSIGHTS_RETRY,
} from "../insights-presentation";
import { CHART_HEIGHT } from "./InsightsLineChart";

export function InsightsSkeleton() {
  return (
    <View
      accessibilityLabel={INSIGHTS_LOADING_A11Y}
      accessibilityState={{ busy: true }}
      accessible
      style={styles.skeleton}
      testID="insights-skeleton"
    >
      <View style={styles.previewRow}>
        <View style={styles.thumbnail} />
        <View style={styles.previewText}>
          <Skeleton.Row style={styles.block} />
          <Skeleton.Row style={[styles.block, styles.short]} />
          <Skeleton.Row style={[styles.block, styles.shorter]} />
        </View>
      </View>
      <Skeleton.Row style={[styles.block, styles.heading]} />
      <View style={styles.kpiGrid}>
        <View style={styles.kpi} />
        <View style={styles.kpi} />
        <View style={styles.kpi} />
        <View style={styles.kpi} />
      </View>
      <Skeleton.Row style={[styles.block, styles.heading]} />
      <Skeleton.Row style={[styles.block, styles.metricRow]} />
      <Skeleton.Row style={[styles.block, styles.metricRow]} />
      <Skeleton.Row style={[styles.block, styles.metricRow]} />
      <Skeleton.Row style={[styles.block, styles.heading]} />
      <View style={styles.chart} />
    </View>
  );
}

export function InsightsInitialState({ variant }: { variant: "full" | "compact" }) {
  return (
    <View
      accessible
      accessibilityLabel={`${INSIGHTS_INITIAL_TITLE}. ${INSIGHTS_INITIAL_BODY}`}
      style={variant === "full" ? styles.initialFull : styles.initialCompact}
      testID="insights-initial-state"
    >
      <View style={styles.initialIcon}>
        <Ionicons
          color={colors.accent}
          name="stats-chart-outline"
          size={variant === "full" ? 40 : 24}
        />
      </View>
      <AppText align="center" variant={variant === "full" ? "headingMd" : "titleMd"}>
        {INSIGHTS_INITIAL_TITLE}
      </AppText>
      <AppText align="center" color="secondary" variant="bodyLg">
        {INSIGHTS_INITIAL_BODY}
      </AppText>
    </View>
  );
}

export function InsightsErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.centered} testID="insights-error">
      <AppText align="center" variant="headingMd">
        {INSIGHTS_ERROR_TITLE}
      </AppText>
      <AppText align="center" color="secondary" variant="bodyLg">
        {INSIGHTS_ERROR_BODY}
      </AppText>
      <Button label={INSIGHTS_RETRY} onPress={onRetry} variant="secondary" />
    </View>
  );
}

export function InsightsPermissionState({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.centered} testID="insights-permission-revoked">
      <Ionicons color={colors.textMuted} name="lock-closed-outline" size={40} />
      <AppText align="center" variant="headingMd">
        {INSIGHTS_PERMISSION_LOST}
      </AppText>
      <Button label={INSIGHTS_BACK_LABEL} onPress={onBack} variant="secondary" />
    </View>
  );
}

const styles = StyleSheet.create({
  // Il fondo schermo è `colors.background` (= surfaceMuted): i segnaposto devono staccarsi da esso.
  block: {
    backgroundColor: colors.backgroundStrong,
  },
  centered: {
    alignItems: "center",
    flex: 1,
    gap: spacing[12],
    justifyContent: "center",
    padding: spacing[24],
  },
  chart: {
    backgroundColor: colors.backgroundStrong,
    borderRadius: radius[16],
    height: CHART_HEIGHT,
  },
  heading: {
    height: 18,
    marginTop: spacing[8],
    width: "40%",
  },
  initialCompact: {
    alignItems: "center",
    gap: spacing[8],
    paddingVertical: spacing[16],
  },
  initialFull: {
    alignItems: "center",
    gap: spacing[12],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[48],
  },
  initialIcon: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.full,
    height: 64,
    justifyContent: "center",
    width: 64,
  },
  kpi: {
    backgroundColor: colors.backgroundStrong,
    borderRadius: radius[16],
    height: 76,
    width: "48%",
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
    justifyContent: "space-between",
  },
  metricRow: {
    height: 32,
  },
  previewRow: {
    flexDirection: "row",
    gap: spacing[12],
  },
  previewText: {
    flex: 1,
    justifyContent: "center",
  },
  short: {
    width: "60%",
  },
  shorter: {
    width: "40%",
  },
  skeleton: {
    gap: spacing[8],
  },
  thumbnail: {
    backgroundColor: colors.backgroundStrong,
    borderRadius: radius[10],
    height: 92,
    width: 92,
  },
});
