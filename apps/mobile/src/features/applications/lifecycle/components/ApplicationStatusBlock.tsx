/**
 * Il riquadro di stato del lifecycle (screen 01, 03, 06-09).
 *
 * Un componente solo per le due sponde: §29 dà a Ritirata, Termine scaduto e
 * Posizione chiusa lo **stesso** trattamento — «stato neutro, label esplicita,
 * senza allarme rosso» — e due copie finirebbero per divergere proprio sul
 * colore, che è la cosa che §29 vincola.
 *
 * Non è un `Card` né un `ContentModule`: non ha eyebrow e non ha rail azioni.
 * È il blocco più semplice del sistema — cornice hairline, radius 16, fondo
 * neutro — e l'elevazione la fa il bordo, non un'ombra.
 */
import { StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import type { LifecycleStatus } from "../lifecycle-presentation";

export function ApplicationStatusBlock({
  status,
  testID,
}: {
  status: LifecycleStatus;
  testID?: string;
}) {
  return (
    <View
      accessible
      /* §34: lo screen reader riceve stato e date come un fatto unico, non
         come tre frammenti separati da leggere uno per volta. */
      accessibilityLabel={[status.title, ...status.lines].join(". ")}
      accessibilityRole="text"
      style={styles.block}
      testID={testID}
    >
      <AppText color="neutral" variant="titleSm">
        {status.title}
      </AppText>

      {status.lines.map((line) => (
        <AppText color="neutralMuted" key={line} variant="bodySm">
          {line}
        </AppText>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: colors.surfaceNeutral,
    /* §29: «bordi sottili, divider e stati neutri grigi». */
    borderColor: colors.borderNeutral,
    borderRadius: radius[16],
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing[4],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
  },
});
