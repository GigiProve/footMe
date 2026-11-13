import { type ReactNode } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../styles";
import { AppText } from "../AppText/AppText";
import { Button } from "../Button/Button";

export type ConfirmModalProps = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isBusy?: boolean;
  /**
   * Conferma di un'azione irreversibile: la CTA prende lo stile distruttivo
   * già previsto dal design system, invece di sembrare una conferma qualsiasi.
   */
  destructive?: boolean;
  /**
   * DAS-REV-27 §4: «Le azioni distruttive seguono il trattamento sobrio del
   * design system: testo/bordo rosso». `neutralOutline` usa la variante
   * distruttiva già prevista da `button-tokens` (bordo e testo rossi, fondo
   * bianco). Default invariato per tutti gli altri dialoghi.
   */
  confirmVariant?: "primary" | "neutralOutline";
  children?: ReactNode;
};

/**
 * Mezza riga della card (~134pt a 360pt di larghezza) contiene ~13 caratteri di
 * etichetta: oltre, il testo esce dalla pillola. Con etichette lunghe («Continua a
 * modificare», «Annulla modifiche») le azioni si impilano; con quelle brevi la
 * riga resta com'è per tutti gli altri dialoghi.
 */
export const CONFIRM_STACK_THRESHOLD = 13;

export function shouldStackConfirmActions(cancelLabel: string, confirmLabel: string): boolean {
  return Math.max(cancelLabel.length, confirmLabel.length) > CONFIRM_STACK_THRESHOLD;
}

export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = "Conferma",
  cancelLabel = "Annulla",
  onConfirm,
  onCancel,
  isBusy = false,
  destructive = false,
  confirmVariant = "primary",
  children,
}: ConfirmModalProps) {
  // HOM-04 §110: con una richiesta in corso un dismiss (fondale, Back) sarebbe
  // ambiguo — chiuderebbe il dialogo senza fermare l'operazione. Si ignora.
  const dismiss = isBusy ? undefined : onCancel;
  const stacked = shouldStackConfirmActions(cancelLabel, confirmLabel);

  return (
    <Modal
      animationType="fade"
      onRequestClose={dismiss}
      transparent
      visible={visible}
    >
      <Pressable
        accessibilityLabel="Chiudi"
        accessibilityRole="button"
        onPress={dismiss}
        style={styles.backdrop}
      />
      <View style={styles.centeredWrapper} pointerEvents="box-none">
        {/* HOM-04 §113: `accessibilityViewIsModal` tiene il focus dei lettori di
            schermo dentro il dialogo (titolo, testo, bottoni) e fuori dal
            contenuto oscurato sotto. Il contenitore non è `accessible`: lo
            sarebbe a scapito dei bottoni. */}
        <View accessibilityViewIsModal style={styles.card}>
          <View style={styles.body}>
            <AppText variant="headingSm" align="center">
              {title}
            </AppText>
            {message ? (
              <AppText
                variant="bodySm"
                color="secondary"
                align="center"
                style={styles.message}
              >
                {message}
              </AppText>
            ) : null}
            {children ? (
              <View style={styles.childrenSlot}>{children}</View>
            ) : null}
          </View>
          {/* Due `width: 100%` affiancati in una riga sforavano la card: il
              secondo bottone finiva fuori dal bordo (DAS-REV-26, screen 09).
              Ogni bottone occupa ora metà riga dentro il proprio slot. */}
          <View style={[styles.footer, stacked ? styles.footerStacked : null]}>
            <View style={stacked ? null : styles.footerAction}>
              <Button
                fullWidth
                label={cancelLabel}
                onPress={onCancel}
                testID="confirm-modal-cancel"
                variant="secondary"
                disabled={isBusy}
              />
            </View>
            <View style={stacked ? null : styles.footerAction}>
              <Button
                destructive={destructive}
                fullWidth
                label={isBusy ? "..." : confirmLabel}
                loading={isBusy}
                onPress={onConfirm}
                testID="confirm-modal-confirm"
                variant={confirmVariant}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.40)",
  },
  centeredWrapper: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing[24],
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius[16],
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    width: "100%",
  },
  body: {
    padding: spacing[24],
    gap: spacing[8],
  },
  message: {
    marginTop: spacing[4],
  },
  childrenSlot: {
    marginTop: spacing[12],
  },
  footer: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[14],
  },
  footerAction: {
    flex: 1,
  },
  footerStacked: {
    flexDirection: "column",
  },
});
