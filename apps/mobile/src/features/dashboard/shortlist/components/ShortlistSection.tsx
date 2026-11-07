/**
 * Una sezione del centro (§9).
 *
 * «Il centro usa righe, divider e spaziatura. Niente grandi card per ogni
 * lista, toolbar da CRM, KPI globali … colori diversi per tipo di lista,
 * ricerca locale o tab.» Le due sezioni sono identiche per costruzione:
 * cambiano titolo e contenuto, non trattamento — §4 vieta «colori diversi
 * per tipo di lista».
 *
 * L'heading è semantico (§31: «Heading semantici Per posizione / Liste
 * personalizzate»).
 */
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { colors, sizes, spacing } from "../../../../theme/tokens";
import { AppText, Skeleton } from "../../../../ui";
import { SHORTLIST_COPY } from "../shortlist-presentation";

type Props = {
  children?: ReactNode;
  testID?: string;
  title: string;
};

export function ShortlistSection({ children, testID, title }: Props) {
  return (
    <View style={styles.block} testID={testID}>
      <AppText
        accessibilityRole="header"
        color="neutral"
        style={styles.heading}
        variant="headingSm"
      >
        {title}
      </AppText>

      {children}
    </View>
  );
}

/**
 * Vuoto **locale** di una sezione (§11, screen 04).
 *
 * «Mostra l'heading Per posizione e il testo leggero …» — testo leggero
 * significa metadato grigio, non una illustrazione né una card.
 */
export function ShortlistSectionEmpty({ message }: { message: string }) {
  return (
    <AppText color="neutralMuted" style={styles.empty} variant="bodySm">
      {message}
    </AppText>
  );
}

/**
 * Skeleton di un gruppo (§12, screen 07).
 *
 * «Mostra skeleton di due gruppi di righe senza nomi, numeri, valutazioni o
 * testi demo. Non usare uno spinner centrale a schermo intero.» Fuori
 * dall'albero accessibile: §31 — «Skeleton e placeholder sono non
 * interattivi e nascosti agli screen reader».
 */
export function ShortlistSectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.skeletonGroup}
      testID="shortlist-skeleton"
    >
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={styles.skeletonRow}>
          <Skeleton.Row style={styles.skeletonAvatar} />

          <View style={styles.skeletonText}>
            <Skeleton.Row style={styles.skeletonTitle} />
            <Skeleton.Row style={styles.skeletonMeta} />
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * Errore **locale** di una sezione (§12).
 *
 * «Se un solo gruppo fallisce e l'altro è utilizzabile, gestisci un errore
 * locale nel gruppo, non un vuoto. Il retry locale non deve bloccare il
 * gruppo funzionante.»
 */
export function ShortlistSectionError({
  isRetrying = false,
  onRetry,
  sectionTitle,
  testID,
}: {
  isRetrying?: boolean;
  onRetry: () => void;
  sectionTitle: string;
  testID?: string;
}) {
  return (
    <View accessibilityRole="alert" style={styles.errorRow} testID={testID}>
      <AppText color="neutralMuted" style={styles.errorText} variant="bodySm">
        {SHORTLIST_COPY.errorBody}
      </AppText>

      <Pressable
        accessibilityLabel={`Riprova caricamento ${sectionTitle.toLocaleLowerCase("it-IT")}`}
        accessibilityRole="button"
        accessibilityState={{ busy: isRetrying, disabled: isRetrying }}
        disabled={isRetrying}
        hitSlop={8}
        onPress={onRetry}
        style={({ pressed }) => (pressed ? styles.pressed : null)}
        testID={testID ? `${testID}-retry` : undefined}
      >
        {/* §4: un'azione testuale blu, senza contenitore pieno. */}
        <AppText color="accent" variant="actionLabel">
          {isRetrying ? "Aggiornamento…" : SHORTLIST_COPY.retry}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing[4],
  },
  heading: {
    paddingBottom: spacing[4],
  },
  empty: {
    paddingVertical: spacing[12],
  },
  errorRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    justifyContent: "space-between",
    minHeight: sizes.touchTarget - spacing[16],
    paddingVertical: spacing[8],
  },
  errorText: {
    flexShrink: 1,
  },
  skeletonGroup: {
    gap: spacing[4],
  },
  skeletonRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget,
    paddingVertical: spacing[8],
  },
  skeletonAvatar: {
    borderRadius: 16,
    height: 32,
    width: 32,
  },
  skeletonText: {
    flex: 1,
    gap: spacing[6],
  },
  skeletonTitle: {
    height: 14,
    width: "55%",
  },
  skeletonMeta: {
    height: 12,
    width: "35%",
  },
  pressed: {
    opacity: 0.6,
  },
});

/** Hairline fra due righe della stessa sezione, esportata per i test. */
export const SHORTLIST_DIVIDER_COLOR = colors.dividerNeutral;
