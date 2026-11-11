/**
 * Errore di un singolo modulo (§23): "mostrare i contenuti caricati, evitare di
 * bloccare l'intera Home, riprovare il singolo modulo quando possibile".
 *
 * Una riga sottile dentro lo slot dell'elemento: nessuna card dentro card,
 * nessun alert, nessuna icona d'allarme. Il Feed intorno resta intatto.
 */

import { StyleSheet, View } from "react-native";

import { spacing } from "../../../../theme/tokens";
import { AppText, Button } from "../../../../ui";
import { FEED_RETRY } from "../../feed-labels";

type FeedModuleErrorProps = {
  title: string;
  onRetry: () => void;
};

export function FeedModuleError({ title, onRetry }: FeedModuleErrorProps) {
  return (
    <View style={styles.row} testID="feed-module-error">
      <AppText color="muted" numberOfLines={2} style={styles.label} variant="feedMeta">
        {title} non disponibile
      </AppText>
      <Button hitSlop={6} label={FEED_RETRY} onPress={onRetry} size="sm" variant="link" />
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    flex: 1,
  },
  // HOM-01.1 §57: una riga dentro la cornice dell'elemento, senza card.
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    paddingBottom: spacing[8],
  },
});
