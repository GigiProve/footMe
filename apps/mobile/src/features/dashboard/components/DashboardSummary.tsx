import { Pressable, StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";

export type SummaryMetric = {
  /** Etichetta già al plurale corretto per il valore. */
  label: string;
  /** Annuncio completo per screen reader: "3 candidature attive". */
  accessibilityLabel: string;
  id: string;
  onPress?: () => void;
  value: number;
};

type Props = {
  metrics: SummaryMetric[];
};

/**
 * Riepilogo compatto (master 01, 02, 03).
 *
 * Una **sola** superficie leggera con due–quattro metriche separate da un
 * divider verticale — non una card per numero. È la differenza con le tre
 * `StatCard` affiancate della Dashboard personale precedente, che il Common
 * Contract classifica come non conforme (CC-09).
 *
 * Una metrica è tappabile solo se ha una destinazione con lo **stesso
 * perimetro del conteggio**: aprire "tutte le candidature" da una metrica che
 * conta le sole attive renderebbe il numero inspiegabile.
 */
export function DashboardSummary({ metrics }: Props) {
  if (metrics.length === 0) {
    return null;
  }

  return (
    <View style={styles.surface}>
      {metrics.map((metric, index) => (
        <View key={metric.id} style={styles.cell}>
          {index > 0 ? <View style={styles.divider} /> : null}
          <MetricBody metric={metric} />
        </View>
      ))}
    </View>
  );
}

function MetricBody({ metric }: { metric: SummaryMetric }) {
  const body = (
    <>
      <AppText style={styles.value} variant="statValue">
        {String(metric.value)}
      </AppText>
      <AppText color="secondary" numberOfLines={2} style={styles.label} variant="meta">
        {metric.label}
      </AppText>
    </>
  );

  if (!metric.onPress) {
    return (
      <View accessibilityLabel={metric.accessibilityLabel} style={styles.metric}>
        {body}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityLabel={metric.accessibilityLabel}
      accessibilityRole="button"
      onPress={metric.onPress}
      style={({ pressed }) => [styles.metric, pressed ? styles.pressed : null]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  surface: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: 1,
    flexDirection: "row",
  },
  cell: {
    flex: 1,
    flexDirection: "row",
  },
  divider: {
    backgroundColor: colors.divider,
    marginVertical: spacing[12],
    width: 1,
  },
  metric: {
    alignItems: "center",
    flex: 1,
    gap: spacing[4],
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[14],
  },
  value: {
    color: colors.textPrimary,
  },
  label: {
    textAlign: "center",
  },
  pressed: {
    opacity: 0.7,
  },
});
