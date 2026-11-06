import { StyleSheet, View } from "react-native";

import { spacing } from "../../../theme/tokens";
import { AppText, BottomSheet, Button } from "../../../ui";

type Props = {
  body: string;
  cancelLabel: string;
  confirmLabel: string;
  /** Rosso discreto: rifiuto, annullamento, rimozione, termine (§5). */
  destructive?: boolean;
  isBusy?: boolean;
  /** Seconda riga: ciò che **resta**, non ciò che finisce (§36, §37). */
  note?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  testID?: string;
  title: string;
  visible: boolean;
};

/**
 * Conferma distruttiva sopra il contesto (§19, §23, §35, §36, §37).
 *
 * Sei sheet, una forma sola: titolo, la frase che nomina l'effetto,
 * eventualmente la frase che nomina ciò che resta, l'azione che esegue e
 * quella conservativa.
 *
 * §23: «Lo sheet non contiene già Richiesta rifiutata mentre la decisione
 * deve ancora essere eseguita.» Il componente non conosce l'esito e non può
 * quindi anticiparlo: lo mostra la schermata sotto, dopo il commit.
 *
 * §46: «Le conferme distruttive applicano l'azione solo sul tap finale.»
 */
export function RoleConfirmSheet({
  body,
  cancelLabel,
  confirmLabel,
  destructive = false,
  isBusy = false,
  note,
  onCancel,
  onConfirm,
  testID,
  title,
  visible,
}: Props) {
  return (
    <BottomSheet onClose={onCancel} title={title} visible={visible}>
      <AppText color="neutralMuted" style={styles.body} variant="bodyLg">
        {body}
      </AppText>

      {note ? (
        <AppText color="neutralMuted" style={styles.note} variant="bodySm">
          {note}
        </AppText>
      ) : null}

      <View style={styles.actions}>
        <Button
          destructive={destructive}
          fullWidth
          label={confirmLabel}
          loading={isBusy}
          onPress={onConfirm}
          size="md"
          testID={testID ? `${testID}-confirm` : "role-confirm-primary"}
          variant="primary"
        />

        <Button
          disabled={isBusy}
          fullWidth
          label={cancelLabel}
          onPress={onCancel}
          size="md"
          testID={testID ? `${testID}-cancel` : "role-confirm-cancel"}
          variant="neutralOutline"
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingBottom: spacing[8],
  },
  note: {
    paddingBottom: spacing[20],
  },
  actions: {
    gap: spacing[8],
  },
});
