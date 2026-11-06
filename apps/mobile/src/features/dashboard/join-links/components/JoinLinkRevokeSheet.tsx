/**
 * Sheet di conferma «Disattiva link» (screen 16, §5).
 *
 * Annullare non muta nulla: la mutazione vive nello schermo di dettaglio e
 * parte solo dalla conferma esplicita.
 */
import { StyleSheet, View } from "react-native";

import { AppText, BottomSheet, Button } from "../../../../ui";
import { spacing } from "../../../../theme/tokens";
import { JOIN_LINKS_COPY } from "../join-links-presentation";

type JoinLinkRevokeSheetProps = {
  isBusy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  visible: boolean;
};

export function JoinLinkRevokeSheet({
  isBusy = false,
  onClose,
  onConfirm,
  visible,
}: JoinLinkRevokeSheetProps) {
  return (
    <BottomSheet onClose={onClose} title={JOIN_LINKS_COPY.revokeQuestion} visible={visible}>
      <AppText color="neutralMuted" variant="bodySm">
        {JOIN_LINKS_COPY.revokeBody}
      </AppText>

      <View style={styles.actions}>
        <Button
          disabled={isBusy}
          fullWidth
          label={JOIN_LINKS_COPY.revoke}
          loading={isBusy}
          onPress={onConfirm}
          testID="join-link-revoke-confirm"
          destructive
          variant="danger"
        />
        <Button
          disabled={isBusy}
          fullWidth
          label={JOIN_LINKS_COPY.cancel}
          onPress={onClose}
          style={styles.cancel}
          testID="join-link-revoke-cancel"
          variant="secondary"
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  actions: {
    marginTop: spacing[20],
  },
  cancel: {
    marginTop: spacing[12],
  },
});
