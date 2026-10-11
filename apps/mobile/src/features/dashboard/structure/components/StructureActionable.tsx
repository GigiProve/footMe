import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { AppText, Button } from "../../../../ui";
import { signalActionLabel } from "../structure-presentation";
import type { StructureSignal } from "../structure-types";

type Props = {
  onOpen: (signal: StructureSignal) => void;
  signals: StructureSignal[];
};

/**
 * "Da gestire" (§13, master 03).
 *
 * Sezione **condizionale**: quando non ci sono segnali pertinenti spariscono
 * titolo, contenitore e spazio — §13 vieta "Tutto sotto controllo", badge e
 * progress bar al loro posto.
 *
 * L'unica primaria piena blu della pagina vive qui: §4 la riserva alla
 * "Valuta richiesta" dello screen 03 e vieta di trasformare l'hub in una
 * colonna di grandi CTA. Il rail blu a sinistra è il marcatore
 * `personalized` del design system — contenuto scelto per questo actor, non
 * decorazione.
 *
 * Il tap **apre** la destinazione: non accetta, non risolve e non nasconde il
 * segnale, che sparirà quando il dominio proprietario registrerà la
 * transizione.
 */
export function StructureActionable({ onOpen, signals }: Props) {
  if (signals.length === 0) {
    return null;
  }

  return (
    <View style={styles.block}>
      <AppText accessibilityRole="header" color="neutral" variant="headingSm">
        Da gestire
      </AppText>

      {signals.map((signal) => (
        <View key={signal.id} style={styles.card} testID={`structure-signal-${signal.id}`}>
          <View style={styles.rail} />

          <View style={styles.body}>
            <View style={styles.head}>
              <Ionicons
                color={colors.textNeutral}
                name="document-text-outline"
                size={22}
              />

              <View style={styles.headText}>
                <AppText color="neutral" variant="titleMd">
                  {signal.title}
                </AppText>

                {signal.context ? (
                  <AppText color="neutralMuted" variant="meta">
                    {signal.context}
                  </AppText>
                ) : null}
              </View>
            </View>

            <Button
              accessibilityLabel={signalActionLabel(signal)}
              fullWidth
              label={signal.actionLabel}
              onPress={() => onOpen(signal)}
              size="md"
              testID={`structure-signal-cta-${signal.id}`}
              variant="primary"
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing[10],
  },
  card: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius[16],
    flexDirection: "row",
    overflow: "hidden",
  },
  /** Rail `personalized` da 3px: contenuto scelto per l'actor (design system). */
  rail: {
    backgroundColor: colors.accent,
    width: 3,
  },
  body: {
    flex: 1,
    gap: spacing[12],
    padding: spacing[14],
  },
  head: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[12],
  },
  headText: {
    flex: 1,
    gap: spacing[4],
  },
});
