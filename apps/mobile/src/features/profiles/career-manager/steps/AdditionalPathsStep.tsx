/**
 * Schermata 8 — Percorsi aggiuntivi (REV-PROF-07).
 *
 * Non è un secondo hub: è l'elenco dei percorsi professionali che restano
 * separati dalla carriera principale, con il conteggio dinamico di ciascuno.
 * Il tap apre direttamente il percorso, quindi da qui non si scende mai in un
 * hub ricorsivo.
 */
import { StyleSheet, View } from "react-native";

import { spacing } from "../../../../theme/tokens";
import { AppText, Badge } from "../../../../ui";
import {
  formatPathSummary,
  type CareerPathCopy,
  type CareerPathKey,
} from "../career-manager-config";
import { CareerPathRow } from "./CareerPathRow";

type AdditionalPathsStepProps = {
  description: string;
  onOpenPath: (path: CareerPathKey) => void;
  paths: readonly { copy: CareerPathCopy; count: number }[];
  testIDPrefix: string;
};

export function AdditionalPathsStep({
  description,
  onOpenPath,
  paths,
  testIDPrefix,
}: AdditionalPathsStepProps) {
  return (
    <View style={styles.container} testID={`${testIDPrefix}-career-paths`}>
      <View style={styles.intro}>
        <Badge label="Facoltativi" size="sm" variant="default" />
        <AppText color="secondary" variant="bodySm">
          {description}
        </AppText>
      </View>

      {paths.map(({ copy, count }) => (
        <CareerPathRow
          icon={copy.icon}
          key={copy.key}
          onPress={() => onOpenPath(copy.key)}
          // "Facoltativi" è già dichiarato una volta dal badge in testa.
          showOptionalBadge={false}
          summary={formatPathSummary(count)}
          testID={`${testIDPrefix}-career-paths-${copy.key}`}
          // Titolo esteso ("Carriera da allenatore" / "Carriera da
          // calciatore") come da spec REV-PROF-07: `copy.title` resta la
          // label breve usata altrove (hub, selettore tipo).
          title={copy.appBarTitle}
        />
      ))}

      <AppText color="muted" style={styles.hint} variant="meta">
        Puoi completarle anche in seguito.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[12],
  },
  intro: {
    alignItems: "flex-start",
    gap: spacing[8],
  },
  hint: {
    textAlign: "center",
  },
});
