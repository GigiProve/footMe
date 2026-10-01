/**
 * Stati di caricamento ed errore dei moduli "Modifica profilo"
 * (REV-PROF-05 e REV-PROF-08, "Loading state" / "Error state").
 *
 * Due regole, applicate in un posto solo invece che in ogni modulo di ogni
 * ruolo:
 *
 * - si mostra uno scheletro con l'ingombro della pagina finale, non uno
 *   spinner centrale: l'arrivo dei dati non deve spostare nulla;
 * - un errore resta locale al modulo. App bar e struttura restano, compare un
 *   messaggio con "Riprova", e nessun dato vecchio viene presentato come
 *   confermato.
 *
 * Il `testID` è un parametro perché i test di ciascun ruolo cercano il proprio
 * scheletro: la forma è una sola, i nomi restano quelli già in uso.
 */
import { StyleSheet, View } from "react-native";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, Button, Skeleton } from "../../../ui";

/** Scheletro delle righe di un form: etichetta corta + campo. */
export function ProfileEditFieldsSkeleton({
  rows = 4,
  testID,
}: {
  rows?: number;
  testID?: string;
}) {
  return (
    <View testID={testID}>
      {Array.from({ length: rows }).map((_, index) => (
        <View key={index} style={styles.field}>
          <Skeleton.Row style={styles.label} />
          <Skeleton.Row style={styles.control} />
        </View>
      ))}
    </View>
  );
}

/** Scheletro dell'hub: testata con avatar e una riga per voce. */
export function ProfileEditHubSkeleton({
  rows = 8,
  testID,
}: {
  rows?: number;
  testID?: string;
}) {
  return (
    <View testID={testID}>
      <View style={styles.identity}>
        <Skeleton.Circle />
        <View style={styles.identityText}>
          <Skeleton.Row style={styles.label} />
          <Skeleton.Row style={styles.labelShort} />
        </View>
      </View>
      {Array.from({ length: rows }).map((_, index) => (
        <View key={index} style={styles.row}>
          <Skeleton.Row style={styles.label} />
          <Skeleton.Row style={styles.labelShort} />
        </View>
      ))}
    </View>
  );
}

export function ProfileEditErrorState({
  message = "Non è stato possibile caricare questa sezione.",
  onRetry,
  testID,
}: {
  message?: string;
  onRetry: () => void;
  testID?: string;
}) {
  return (
    <View style={styles.error} testID={testID}>
      <AppText accessibilityLiveRegion="polite" color="secondary" variant="bodySm">
        {message}
      </AppText>
      <Button label="Riprova" onPress={onRetry} size="sm" variant="outline" />
    </View>
  );
}

const styles = StyleSheet.create({
  control: {
    height: 48,
  },
  error: {
    alignItems: "center",
    gap: spacing[12],
    paddingVertical: spacing[32],
  },
  field: {
    gap: spacing[4],
    marginBottom: spacing[12],
  },
  identity: {
    alignItems: "center",
    backgroundColor: colors.surface,
    flexDirection: "row",
    gap: spacing[16],
    marginBottom: spacing[16],
    padding: spacing[16],
  },
  identityText: {
    flex: 1,
  },
  label: {
    width: "45%",
  },
  labelShort: {
    height: 12,
    width: "65%",
  },
  row: {
    borderBottomColor: colors.divider,
    borderBottomWidth: 1,
    gap: spacing[4],
    paddingVertical: spacing[14],
  },
});
