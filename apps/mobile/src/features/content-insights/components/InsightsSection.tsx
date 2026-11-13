/**
 * Struttura comune delle sezioni di Dettagli e statistiche (HOM-05 §13, §159–161).
 *
 * La gerarchia viene da titolo, numeri, spacing e hairline (§161): un titolo di
 * sezione e UN pannello piatto (bordo `colors.border`, raggio 16, nessuna
 * ombra) con le righe separate da `colors.divider`. Mai una griglia di card.
 */

import type { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";

export function InsightsSection({
  children,
  helper,
  testID,
  title,
}: PropsWithChildren<{ helper?: string; testID?: string; title: string }>) {
  return (
    <View style={styles.section} testID={testID}>
      <View style={styles.heading}>
        <AppText accessibilityRole="header" variant="titleMd">
          {title}
        </AppText>
        {helper ? (
          <AppText color="secondary" variant="bodySm">
            {helper}
          </AppText>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export function InsightsPanel({ children, testID }: PropsWithChildren<{ testID?: string }>) {
  return (
    <View style={styles.panel} testID={testID}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    gap: spacing[4],
  },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    overflow: "hidden",
  },
  section: {
    gap: spacing[10],
  },
});
