import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { colors, sizes, spacing } from "../../../../theme/tokens";
import { AppText, Skeleton } from "../../../../ui";

type Props = {
  children?: ReactNode;
  /** Testo del riepilogo. `null` = nessun dato leggibile da mostrare. */
  summary?: string | null;
  title: string;
};

/**
 * Un dominio dell'hub (§6).
 *
 * «Ogni dominio contiene heading, summary breve quando leggibile e
 * disponibile, le sole azioni pertinenti, separazione visiva dal dominio
 * successivo.» La separazione fra domini è il `gap` del contenitore, non una
 * card: §4 vuole «sezioni aperte, con divider discreti e spaziatura» e vieta
 * «card pesanti, ombre marcate, gradienti decorativi».
 *
 * Il summary è annunciato insieme al titolo del proprio dominio (§28: «Lo
 * screen reader deve associare ogni count al proprio dominio»): per questo
 * l'intestazione è un unico nodo accessibile e non due righe separate.
 */
export function StructureSection({ children, summary, title }: Props) {
  return (
    <View style={styles.block}>
      <View
        accessibilityLabel={summary ? `${title}. ${summary}` : title}
        accessibilityRole="header"
        style={styles.heading}
      >
        <AppText color="neutral" variant="headingSm">
          {title}
        </AppText>

        {summary ? (
          <AppText color="neutralMuted" variant="meta">
            {summary}
          </AppText>
        ) : null}
      </View>

      {children}
    </View>
  );
}

/**
 * Riepilogo in caricamento (§17).
 *
 * «Le righe di navigazione possono essere visibili prima del relativo count
 * se disponibilità della route e autorizzazione sono già note.» Lo spazio è
 * riservato per non far saltare il layout, e il placeholder resta fuori
 * dall'albero accessibile.
 */
export function StructureSummarySkeleton() {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Skeleton.Row style={styles.summarySkeleton} />
    </View>
  );
}

/**
 * Errore del **solo** riepilogo di un dominio (screen 06).
 *
 * §18: «Non sostituire il count con zero, non mostrare una grande card rossa
 * e non creare un'attività Da gestire.» Le righe del dominio restano sopra o
 * sotto, utilizzabili: l'errore riguarda il numero, non l'accesso.
 *
 * Il nome accessibile del retry nomina il dominio — §28 chiede
 * esplicitamente "Riprova caricamento riepilogo società collegate".
 */
export function StructureSummaryError({
  domainTitle,
  isRetrying = false,
  message,
  onRetry,
  testID,
}: {
  domainTitle: string;
  isRetrying?: boolean;
  message: string;
  onRetry: () => void;
  testID?: string;
}) {
  return (
    <View accessibilityRole="alert" style={styles.errorRow} testID={testID}>
      <AppText color="neutralMuted" style={styles.errorText} variant="meta">
        {message}
      </AppText>

      <Pressable
        accessibilityLabel={`Riprova caricamento riepilogo ${domainTitle.toLocaleLowerCase("it-IT")}`}
        accessibilityRole="button"
        accessibilityState={{ busy: isRetrying, disabled: isRetrying }}
        disabled={isRetrying}
        hitSlop={8}
        onPress={onRetry}
        style={({ pressed }) => (pressed ? styles.pressed : null)}
        testID={testID ? `${testID}-retry` : undefined}
      >
        {/* §4: "Riprova" è un'azione testuale blu, senza contenitore pieno. */}
        <AppText color="accent" variant="actionLabel">
          {isRetrying ? "Aggiornamento…" : "Riprova"}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing[8],
  },
  heading: {
    gap: spacing[4],
  },
  summarySkeleton: {
    height: 14,
    width: 120,
  },
  errorRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    justifyContent: "space-between",
    minHeight: sizes.touchTarget - spacing[16],
  },
  errorText: {
    flexShrink: 1,
  },
  pressed: {
    opacity: 0.6,
  },
});

/** Hairline fra due righe dello stesso dominio, esportata per i test. */
export const STRUCTURE_DIVIDER_COLOR = colors.dividerNeutral;
