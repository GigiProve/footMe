import { StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button, Skeleton } from "../../../ui";

/**
 * Stati della Foundation (§21).
 *
 * Quattro stati distinti che il codice precedente confondeva in uno: la
 * Dashboard personale mostrava "Nessuna notifica" anche quando la query
 * falliva, cioè presentava un errore come un empty.
 */

/**
 * Scheletro del primo caricamento, prima che la composizione sia nota.
 *
 * Placeholder **generico**: non si possono disegnare gli skeleton dei moduli
 * finché non si sa quali moduli l'actor è autorizzato a vedere — sarebbe
 * un'anticipazione visiva di un permesso non ancora verificato.
 */
export function DashboardSkeleton() {
  return (
    <View accessibilityLabel="Caricamento della Dashboard" style={styles.block}>
      <Skeleton.Row style={styles.skeletonSummary} />

      <View style={styles.sectionGap}>
        <Skeleton.Row style={styles.skeletonSectionTitle} />
        <Skeleton.Row style={styles.skeletonCard} />
      </View>

      <View style={styles.sectionGap}>
        <Skeleton.Row style={styles.skeletonSectionTitle} />
        <Skeleton.Row style={styles.skeletonRow} />
        <Skeleton.Row style={styles.skeletonRow} />
      </View>
    </View>
  );
}

/**
 * Errore globale: solo quando non esiste una Dashboard sufficientemente
 * affidabile da mostrare. Header e identità nota restano visibili sopra —
 * li disegna la Foundation, non questo componente.
 *
 * Nessuna CTA operativa: le azioni dipenderebbero da dati che non sono stati
 * caricati.
 */
export function DashboardGlobalError({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.centered}>
      <AppText variant="headingSm">Non riusciamo a caricare la Dashboard</AppText>
      <AppText color="secondary" style={styles.centeredText} variant="bodyLg">
        Riprova tra poco.
      </AppText>
      <Button label="Riprova" onPress={onRetry} size="md" variant="outline" />
    </View>
  );
}

/**
 * Nessuna identità operativa disponibile (§13).
 *
 * Il copy è quello della task e non è tecnico: l'actor non deve dedurre di
 * aver perso un permesso da un messaggio di sistema.
 */
export function DashboardNoIdentity() {
  return (
    <View style={styles.centered}>
      <AppText color="secondary" style={styles.centeredText} variant="bodyLg">
        Non hai attività da gestire al momento.
      </AppText>
    </View>
  );
}

/** Empty di modulo: risposta valida, nessuna attività. */
export function DashboardModuleEmpty({ message }: { message: string }) {
  return (
    <View style={styles.emptyBox}>
      <AppText color="secondary" variant="bodyLg">
        {message}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing[20],
  },
  sectionGap: {
    gap: spacing[10],
  },
  skeletonSummary: {
    borderRadius: radius[12],
    height: 76,
    marginBottom: 0,
  },
  skeletonSectionTitle: {
    height: 20,
    marginBottom: 0,
    width: "46%",
  },
  skeletonCard: {
    borderRadius: radius[12],
    height: 92,
    marginBottom: 0,
  },
  skeletonRow: {
    borderRadius: radius[12],
    height: 64,
    marginBottom: 0,
  },
  centered: {
    alignItems: "center",
    gap: spacing[10],
    paddingVertical: spacing[40],
  },
  centeredText: {
    textAlign: "center",
  },
  emptyBox: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: 1,
    padding: spacing[14],
  },
});
