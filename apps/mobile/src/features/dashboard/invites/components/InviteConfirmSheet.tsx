import { StyleSheet, View } from "react-native";

import { spacing } from "../../../../theme/tokens";
import { AppText, BottomSheet, Button } from "../../../../ui";

type Props = {
  body: string;
  /** `true` solo per l'annullamento del pending (§5, screen 15). */
  destructive?: boolean;
  isBusy?: boolean;
  confirmLabel: string;
  cancelLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  /** `outline` per Rifiuta: secondaria neutra, non un allarme (§32). */
  tone?: "primary" | "outline";
  title: string;
  visible: boolean;
};

/**
 * Conferma sopra il contesto (§26, §29, §32; screen 11, 13, 15).
 *
 * Tre conferme, una forma sola: titolo, una frase che nomina l'effetto, una
 * azione che lo esegue e una conservativa che chiude senza mutazioni.
 *
 * Il tono dell'azione principale cambia con il significato, non con
 * l'importanza: blu per accettare, outlined neutra per rifiutare — §32:
 * «Il rifiuto non è un errore di sistema; non usare un grande warning
 * rosso» — e rossa **solo** per l'annullamento, che è l'unica azione
 * davvero distruttiva sul pending.
 */
export function InviteConfirmSheet({
  body,
  cancelLabel,
  confirmLabel,
  destructive = false,
  isBusy = false,
  onCancel,
  onConfirm,
  title,
  tone = "primary",
  visible,
}: Props) {
  return (
    <BottomSheet onClose={onCancel} title={title} visible={visible}>
      <AppText color="neutralMuted" style={styles.body} variant="bodyLg">
        {body}
      </AppText>

      <View style={styles.actions}>
        <Button
          destructive={destructive}
          fullWidth
          label={confirmLabel}
          loading={isBusy}
          onPress={onConfirm}
          size="md"
          testID="invite-confirm-primary"
          variant={
            destructive ? "primary" : tone === "outline" ? "neutralOutline" : "primary"
          }
        />

        <Button
          disabled={isBusy}
          fullWidth
          label={cancelLabel}
          onPress={onCancel}
          size="md"
          testID="invite-confirm-cancel"
          variant="link"
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingBottom: spacing[20],
  },
  actions: {
    gap: spacing[4],
  },
});
