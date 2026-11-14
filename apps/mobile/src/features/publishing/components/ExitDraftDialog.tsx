/**
 * «Uscire dal contenuto?» (HOM-06.2 §133–§136). Tre azioni:
 *  • Continua a modificare — chiude il dialogo;
 *  • Esci e conserva bozza — salva/sincronizza e torna all'origin (§135);
 *  • Elimina bozza — elimina secondo la policy del server (§136), distruttiva.
 *
 * Un editor vuoto non lo mostra: Annulla chiude direttamente (§133). Con
 * un'operazione in corso il dialogo non si chiude da fondale o Back (§110 di
 * HOM-04, stesso comportamento di ConfirmModal).
 */

import { Modal, Pressable, StyleSheet, View } from "react-native";

import { colors, radius, shadows, spacing } from "../../../styles";
import { AppText, Button } from "../../../ui";

type Props = {
  visible: boolean;
  busy?: boolean;
  /** «Elimina bozza» solo se esiste una bozza da eliminare (server o locale). */
  canDelete?: boolean;
  onContinue: () => void;
  onKeep: () => void;
  onDelete: () => void;
  error?: string | null;
};

export function ExitDraftDialog({ visible, busy = false, canDelete = true, onContinue, onKeep, onDelete, error = null }: Props) {
  const dismiss = busy ? undefined : onContinue;
  return (
    <Modal animationType="fade" onRequestClose={dismiss} transparent visible={visible}>
      <Pressable accessibilityLabel="Continua a modificare" onPress={dismiss} style={styles.overlay}>
        <Pressable accessibilityRole="alert" style={styles.card}>
          <AppText variant="titleMd">Uscire dal contenuto?</AppText>
          <AppText color="secondary" variant="bodySm">
            La bozza resta in Bozze e programmati: potrai riprenderla quando vuoi.
          </AppText>
          {error ? (
            <AppText color="danger" variant="bodySm">
              {error}
            </AppText>
          ) : null}
          <View style={styles.actions}>
            <Button disabled={busy} fullWidth label="Continua a modificare" onPress={onContinue} testID="exit-continue" variant="secondary" />
            <Button disabled={busy} fullWidth label="Esci e conserva bozza" loading={busy} onPress={onKeep} testID="exit-keep" />
            {canDelete ? (
              <Button destructive disabled={busy} fullWidth label="Elimina bozza" onPress={onDelete} testID="exit-delete" variant="neutralOutline" />
            ) : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing[8],
    marginTop: spacing[8],
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius[16],
    gap: spacing[8],
    maxWidth: 420,
    padding: spacing[20],
    width: "100%",
    ...shadows.overlay,
  },
  overlay: {
    alignItems: "center",
    backgroundColor: colors.surfaceOverlay,
    flex: 1,
    justifyContent: "center",
    padding: spacing[24],
  },
});
