/**
 * Sheet di conferma "Rimuovere questo ruolo?" (DAS-REV-20, screen 20, §34).
 *
 * Si apre SOPRA il dettaglio della persona, che resta visibile sotto: non è
 * un'azione sul link né sull'elenco. Nessun campo motivo, nessuna seconda
 * conferma — Annulla non cambia nulla.
 */
import { StyleSheet, View } from "react-native";

import { AppText, BottomSheet, Button } from "../../../../ui";
import { spacing } from "../../../../theme/tokens";
import { JOIN_LINKS_COPY, removeRoleSentence } from "../join-links-presentation";

type JoinLinkRemoveRoleSheetProps = {
  clubName: string;
  isBusy: boolean;
  onClose: () => void;
  onConfirm: () => void;
  personName: string;
  roleLabel: string;
  teamName: string;
  visible: boolean;
};

export function JoinLinkRemoveRoleSheet({
  clubName,
  isBusy,
  onClose,
  onConfirm,
  personName,
  roleLabel,
  teamName,
  visible,
}: JoinLinkRemoveRoleSheetProps) {
  return (
    <BottomSheet
      onClose={onClose}
      title={JOIN_LINKS_COPY.removeQuestion}
      visible={visible}
    >
      <View style={styles.body}>
        <AppText color="neutral" variant="bodyLg">
          {removeRoleSentence({ clubName, personName, roleLabel, teamName })}
        </AppText>

        <AppText color="neutralMuted" style={styles.helper} variant="meta">
          {JOIN_LINKS_COPY.removeOtherRoles}
        </AppText>

        <Button
          destructive
          fullWidth
          label={JOIN_LINKS_COPY.removeRole}
          loading={isBusy}
          onPress={onConfirm}
          style={styles.confirmButton}
          testID="join-link-remove-confirm"
          variant="danger"
        />

        <Button
          fullWidth
          label={JOIN_LINKS_COPY.cancel}
          onPress={onClose}
          style={styles.cancelButton}
          testID="join-link-remove-cancel"
          variant="ghost"
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingBottom: spacing[12],
  },
  helper: {
    marginTop: spacing[8],
  },
  confirmButton: {
    marginTop: spacing[24],
  },
  cancelButton: {
    marginTop: spacing[8],
  },
});
