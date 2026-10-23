import { StyleSheet, View } from "react-native";

import { spacing } from "../../../../../theme/tokens";
import { AppText } from "../../../../../ui";

type Props = {
  /** «Prima squadra · Serie D» oppure «Intera società». Mai una categoria
   *  inventata per un incarico Society-level (§17). */
  context?: string | null;
  /** 1, 2 o 3. Un selector non è un quarto passo (§4). */
  step: 1 | 2 | 3;
  title: string;
};

const STEP_LABELS: Record<1 | 2 | 3, string> = {
  1: "1 di 3 · Posizione",
  2: "2 di 3 · Dettagli",
  3: "3 di 3 · Anteprima",
};

/**
 * Titolo funzionale e avanzamento, nel body (DAS-REV-16 §4).
 *
 * «I titoli funzionali sono nel body, come nel PNG.» Il titolo usa la
 * variante `screenTitle` — Mulish 900 — che il design system riserva a
 * titoli di schermata e nomi hero.
 */
export function ComposerStepHeader({ context, step, title }: Props) {
  return (
    <View style={styles.block}>
      <AppText color="neutral" variant="screenTitle">
        {title}
      </AppText>

      {context ? (
        <AppText color="neutralMuted" variant="bodySm">
          {context}
        </AppText>
      ) : null}

      <AppText color="neutralMuted" variant="meta">
        {STEP_LABELS[step]}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing[4],
  },
});
