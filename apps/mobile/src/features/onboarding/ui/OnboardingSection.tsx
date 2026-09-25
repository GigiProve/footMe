import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { AppText } from "../../../ui";
import { onboardingLayout } from "./onboarding-tokens";

type OnboardingSectionProps = {
  children: ReactNode;
  /** Titolo di sezione. Omesso quando lo step ha un solo gruppo di campi. */
  title?: string;
  /** Una riga al massimo: dice cosa serve, non come funziona. */
  description?: string;
};

/**
 * Raggruppa i campi di uno step. Non è una card: il contenuto respira
 * direttamente nella pagina (§H). Usare una card solo per oggetti reali.
 */
export function OnboardingSection({
  children,
  description,
  title,
}: OnboardingSectionProps) {
  return (
    <View style={styles.section}>
      {title ? (
        <View style={styles.header}>
          <AppText variant="headingSm">{title}</AppText>
          {description ? (
            <AppText color="secondary" variant="meta">
              {description}
            </AppText>
          ) : null}
        </View>
      ) : null}
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: onboardingLayout.fieldGap,
    paddingBottom: onboardingLayout.sectionGap,
  },
  header: {
    gap: onboardingLayout.labelGap / 2,
  },
  body: {
    gap: onboardingLayout.fieldGap,
  },
});
