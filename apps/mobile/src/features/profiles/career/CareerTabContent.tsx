/**
 * Tab Carriera del Master Profile (REV-PROF-01 §11–§22).
 *
 * "Percorso professionale": un elenco unico ordinato dal più recente, i Totali
 * carriera e l'Andamento carriera. Niente controlli inline di modifica — la
 * carriera si modifica solo da Modifica profilo (§32) — e niente separazione
 * fra prima squadra e settore giovanile, che spezzerebbe l'ordinamento
 * canonico di REV-ONB-02 (§18).
 */
import { StyleSheet, View } from "react-native";

import { colors, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import { CareerPerformanceChart } from "./CareerPerformanceChart";
import { CareerTotals } from "./CareerTotals";
import { PlayerCareerExperience } from "./PlayerCareerExperience";
import type { CareerMetric, PlayerCareerView } from "./player-career-model";

type CareerTabContentProps = {
  isOwner: boolean;
  onMetricChange?: (metric: CareerMetric) => void;
  view: PlayerCareerView;
};

export function CareerTabContent({
  isOwner,
  onMetricChange,
  view,
}: CareerTabContentProps) {
  if (view.experiences.length === 0) {
    return (
      <View style={styles.empty} testID="career-empty">
        <AppText variant="titleMd">Nessuna esperienza ancora</AppText>
        <AppText color="secondary" variant="bodySm">
          {isOwner
            ? "Aggiungi il tuo percorso sportivo da Modifica profilo."
            : "Questo profilo non ha ancora inserito il proprio percorso sportivo."}
        </AppText>
      </View>
    );
  }

  return (
    <View testID="career-tab">
      <View style={styles.section}>
        <AppText accessibilityRole="header" variant="titleMd">
          Percorso professionale
        </AppText>

        <View>
          {view.experiences.map((experience, index) => (
            <PlayerCareerExperience
              experience={experience}
              isLast={index === view.experiences.length - 1}
              key={experience.id}
            />
          ))}
        </View>

        <CareerTotals totals={view.totals} />
      </View>

      <CareerPerformanceChart onMetricChange={onMetricChange} view={view} />
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    backgroundColor: colors.surface,
    gap: spacing[8],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[32],
  },
  section: {
    backgroundColor: colors.surface,
    gap: spacing[8],
    paddingHorizontal: spacing[16],
    paddingTop: spacing[18],
    paddingBottom: spacing[18],
  },
});
