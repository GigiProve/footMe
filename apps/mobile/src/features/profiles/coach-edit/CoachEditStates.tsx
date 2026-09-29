/**
 * Stati di caricamento ed errore condivisi dai moduli dell'editor Allenatore
 * (REV-PROF-05, "Loading state" / "Error state").
 *
 * Due regole, applicate in un posto solo invece che in otto:
 *
 * - si mostra uno scheletro con l'ingombro della pagina finale, non uno
 *   spinner centrale: l'arrivo dei dati non deve spostare nulla;
 * - un errore resta locale al modulo. App bar e struttura restano, compare un
 *   messaggio con "Riprova", e nessun dato vecchio viene presentato come
 *   confermato.
 */
import { StyleSheet, View } from "react-native";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, Button, Skeleton } from "../../../ui";

/** Scheletro delle righe di un form: etichetta corta + campo. */
export function CoachEditFieldsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <View testID="coach-edit-skeleton">
      {Array.from({ length: rows }).map((_, index) => (
        <View key={index} style={styles.field}>
          <Skeleton.Row style={styles.label} />
          <Skeleton.Row style={styles.control} />
        </View>
      ))}
    </View>
  );
}

/** Scheletro dell'hub: testata con avatar e otto righe. */
export function CoachEditHubSkeleton() {
  return (
    <View testID="coach-edit-hub-skeleton">
      <View style={styles.identity}>
        <Skeleton.Circle />
        <View style={styles.identityText}>
          <Skeleton.Row style={styles.label} />
          <Skeleton.Row style={styles.labelShort} />
        </View>
      </View>
      {Array.from({ length: 8 }).map((_, index) => (
        <View key={index} style={styles.row}>
          <Skeleton.Row style={styles.label} />
          <Skeleton.Row style={styles.labelShort} />
        </View>
      ))}
    </View>
  );
}

export function CoachEditErrorState({
  message = "Non è stato possibile caricare questa sezione.",
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <View style={styles.error} testID="coach-edit-error">
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
