import { Fragment } from "react";
import { StyleSheet, View } from "react-native";

import { colors, spacing } from "../../../../../theme/tokens";
import { AppText } from "../../../../../ui";

export type BatchSummaryRow = {
  contextLabel: string | null;
  teamName: string;
};

type Props = {
  rows: BatchSummaryRow[];
};

/**
 * Riepilogo «Posizioni da creare» dello step 1 (DAS-REV-16 §10, §15).
 *
 * §10 distingue il batch (ricerche indipendenti) dalle squadre secondarie di
 * un singolo incarico: questo blocco mostra solo il primo, e lo mostra come
 * conferma di ciò che la CTA «Continua» sta per creare — non come editor.
 * Per questo le righe **non sono tappabili**: nessun `Pressable`, nessun
 * chevron, nessun ruolo di pulsante. Rimuovere una squadra dal batch si fa
 * riaprendo lo sheet «Aggiungi un'altra squadra», non da qui.
 */
export function BatchSummary({ rows }: Props) {
  return (
    <View
      accessible
      testID="compose-batch-summary"
      accessibilityLabel={`Posizioni da creare: ${rows
        .map((row) => row.teamName)
        .join(", ")}`}
      style={styles.block}
    >
      <AppText color="neutralMuted" variant="eyebrow">
        Posizioni da creare
      </AppText>

      <View style={styles.rows}>
        {rows.map((row, index) => (
          <Fragment key={`${row.teamName}-${index}`}>
            {index > 0 ? <View style={styles.divider} /> : null}

            <View style={styles.row}>
              <AppText color="neutral" variant="bodyLg">
                {row.teamName}
              </AppText>

              {row.contextLabel ? (
                <AppText color="neutralMuted" variant="meta">
                  {row.contextLabel}
                </AppText>
              ) : null}
            </View>
          </Fragment>
        ))}
      </View>

      <AppText color="neutralMuted" variant="meta">
        {rows.length === 1 ? "1 posizione distinta" : `${rows.length} posizioni distinte`}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing[8],
    paddingVertical: spacing[8],
  },
  divider: {
    backgroundColor: colors.divider,
    height: StyleSheet.hairlineWidth,
  },
  row: {
    gap: spacing[4],
    paddingVertical: spacing[8],
  },
  rows: {
    gap: 0,
  },
});
