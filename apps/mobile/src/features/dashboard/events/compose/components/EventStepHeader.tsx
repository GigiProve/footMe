import { StyleSheet, View } from "react-native";

import { colors, spacing } from "../../../../../theme/tokens";
import { AppText } from "../../../../../ui";
import type { ComposeStep } from "../event-compose-model";

type Props = {
  step: ComposeStep;
  title: string;
};

/**
 * Avanzamento e titolo dello step (DAS-REV-28 §13, §27; screen 04–11).
 *
 * «Indicatore semplice 1 di 3 / 2 di 3 / 3 di 3.» Non è il
 * `ComposerStepHeader` delle Posizioni, che scrive «1 di 3 · Posizione»
 * con le fasi di un altro dominio: qui il PNG mostra il contatore, una barra
 * a tre segmenti e il titolo dello step.
 *
 * §27: «Wizard annuncia step 1 di 3 … e titolo»: un solo nodo annunciato con
 * entrambi, la barra è decorativa.
 */
export function EventStepHeader({ step, title }: Props) {
  return (
    <View
      accessible
      accessibilityLabel={`Passaggio ${step} di 3, ${title}`}
      accessibilityRole="header"
      style={styles.block}
      testID="event-step-header"
    >
      <AppText color="neutralMuted" variant="meta">
        {`${step} di 3`}
      </AppText>

      <View style={styles.bar}>
        {[1, 2, 3].map((segment) => (
          <View
            key={segment}
            style={[styles.segment, segment <= step ? styles.segmentOn : null]}
          />
        ))}
      </View>

      <AppText color="neutral" style={styles.title} variant="screenTitle">
        {title}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    gap: spacing[6],
  },
  block: {
    gap: spacing[8],
    paddingBottom: spacing[8],
  },
  segment: {
    backgroundColor: colors.border,
    borderRadius: 999,
    flex: 1,
    height: 3,
  },
  segmentOn: {
    backgroundColor: colors.accent,
  },
  title: {
    paddingTop: spacing[4],
  },
});
