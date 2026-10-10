import { type ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { colors, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";

type Props = {
  children?: ReactNode;
  /** "2026/27": l'anno, non la label del blocco. */
  headline?: string | null;
  /** "Under 18 · Élite" oppure "Da preparare". */
  meta?: string | null;
  /** "In corso", "Preparata": stato testuale neutro a destra (§4, §11). */
  statusLabel?: string | null;
  testID?: string;
  title: string;
};

/**
 * Uno dei tre blocchi dello screen 02: Stagione corrente, Prossima stagione,
 * Stagioni precedenti.
 *
 * Il titolo del blocco è un'intestazione di sezione; l'anno è il dato, e sta
 * sotto in corpo testo nero neutro. Lo stato — "In corso", "Preparata", "Da
 * preparare" — è **testo** allineato a destra: §4 è categorico, «In corso,
 * Preparata, Conclusa, Da preparare e Squadra non attiva sono label testuali
 * neutre. Non usare pill verdi, blu o gialle per il lifecycle».
 */
export function SeasonBlock({
  children,
  headline,
  meta,
  statusLabel,
  testID,
  title,
}: Props) {
  return (
    <View style={styles.block} testID={testID}>
      <AppText color="neutral" variant="titleSm">
        {title}
      </AppText>

      <View style={styles.divider} />

      {headline || meta || statusLabel ? (
        <View style={styles.summary}>
          <View style={styles.summaryBody}>
            {headline ? (
              <AppText color="neutral" variant="bodyLg">
                {headline}
              </AppText>
            ) : null}

            {meta ? (
              <AppText color="neutralMuted" variant="meta">
                {meta}
              </AppText>
            ) : null}
          </View>

          {statusLabel ? (
            <AppText color="neutralMuted" variant="meta">
              {statusLabel}
            </AppText>
          ) : null}
        </View>
      ) : null}

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing[8],
  },
  divider: {
    backgroundColor: colors.dividerNeutral,
    height: 1,
  },
  summary: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[12],
    justifyContent: "space-between",
    paddingTop: spacing[4],
  },
  summaryBody: {
    flex: 1,
    gap: spacing[4],
  },
});
