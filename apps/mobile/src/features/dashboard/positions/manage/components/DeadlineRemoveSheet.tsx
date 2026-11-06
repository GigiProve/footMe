/**
 * Chiarimento prima di rimuovere una scadenza già superata (§16; screen 06).
 *
 * Esiste per un solo caso: la posizione ha smesso di ricevere candidature e
 * togliere il termine la rimette ad accettarle. §13 è esplicito sul resto —
 * «scegliere Nessuna scadenza e salvare rimuove il termine senza un secondo
 * avviso» quando la ricezione è ancora aperta. Questo sheet non deve quindi
 * comparire lì.
 *
 * Primaria **blu**, non rossa: §4 — «La rimozione della scadenza è
 * reversibile e non usa il trattamento rosso.» E nessun «non può essere
 * annullata»: basta rimettere una data.
 *
 * La conferma esegue direttamente la patch: §16 — «non segue un secondo
 * Salva o un secondo popup».
 */
import { StyleSheet, View } from "react-native";

import { spacing } from "../../../../../theme/tokens";
import { AppText, BottomSheet, Button } from "../../../../../ui";

type Props = {
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  visible: boolean;
};

const COPY = {
  body: "Rimuovendo la scadenza, la posizione tornerà ad accettare candidature senza un termine definito.",
  cancel: "Annulla",
  confirm: "Rimuovi scadenza",
  title: "Rimuovere la scadenza?",
} as const;

export function DeadlineRemoveSheet({
  busy = false,
  error,
  onCancel,
  onConfirm,
  visible,
}: Props) {
  return (
    <BottomSheet onClose={onCancel} title={COPY.title} visible={visible}>
      <AppText color="neutral" style={styles.body} variant="bodyLg">
        {COPY.body}
      </AppText>

      {error ? (
        <AppText
          accessibilityRole="alert"
          color="danger"
          style={styles.error}
          variant="meta"
        >
          {error}
        </AppText>
      ) : null}

      <View style={styles.actions}>
        <Button
          fullWidth
          label={COPY.confirm}
          loading={busy}
          onPress={onConfirm}
          testID="deadline-remove-confirm"
        />

        {/* §4: «Annulla/back/chiusura sheet: secondaria standard, senza
            competere con la primaria.» Stesso trattamento dell'Annulla già
            approvato in `PublishConfirmSheet`. */}
        <Button
          disabled={busy}
          fullWidth
          label={COPY.cancel}
          onPress={onCancel}
          size="md"
          testID="deadline-remove-cancel"
          variant="link"
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing[4],
    paddingTop: spacing[20],
  },
  body: {
    paddingTop: spacing[8],
  },
  error: {
    paddingTop: spacing[12],
  },
});
