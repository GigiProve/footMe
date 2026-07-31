/**
 * Errore di un singolo modulo (§23): "mostrare i contenuti caricati, evitare di
 * bloccare l'intera Home, riprovare il singolo modulo quando possibile".
 *
 * Una riga sottile dentro lo slot dell'elemento: nessuna card dentro card,
 * nessun alert, nessuna icona d'allarme. Il Feed intorno resta intatto.
 */

import { StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { AppText, Button } from "../../../../ui";
import { FEED_RETRY } from "../../feed-labels";

type FeedModuleErrorProps = {
  title: string;
  onRetry: () => void;
};

export function FeedModuleError({ title, onRetry }: FeedModuleErrorProps) {
  return (
    <View style={styles.row} testID="feed-module-error">
      <AppText color="muted" numberOfLines={1} style={styles.label} variant="bodySm">
        {title} non disponibile
      </AppText>
      <Button label={FEED_RETRY} onPress={onRetry} size="sm" variant="link" />
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    flex: 1,
  },
  row: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[8],
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[8],
  },
});
