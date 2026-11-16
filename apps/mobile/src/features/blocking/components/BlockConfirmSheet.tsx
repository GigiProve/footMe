/**
 * Conferma «Bloccare {nome}?» (HOM-12 §22–§28, §220–§221, §242–§243, §262).
 *
 * Gerarchia (§220): triangolo di avviso → titolo → descrizione → Annulla / Blocca.
 * Il triangolo è PICCOLO e sobrio (§25–§26), mai un cerchio rosso (§221, §237). Il rosso
 * sta solo sul triangolo e sulla CTA finale (§27, §229): lo sheet non è colorato. Il
 * copy non promette alcuna cancellazione (§28). Il triangolo è decorativo per lo screen
 * reader: il rischio lo comunicano titolo e testo (§242), e le due azioni hanno label
 * distinte (§243). I target sono a 44pt (§249) e si impilano con i font grandi (§248).
 */

import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, BottomSheet, Button } from "../../../ui";
import {
  BLOCK_COPY,
  blockConfirmTitle,
  confirmBlockA11yLabel,
  confirmCancelA11yLabel,
} from "../blocking-presentation";

type BlockConfirmSheetProps = {
  name: string | null;
  visible: boolean;
  /** Annulla e chiusura: nessuna mutation (§263). */
  onCancel: () => void;
  onConfirm: () => void;
};

export function BlockConfirmSheet({ name, onCancel, onConfirm, visible }: BlockConfirmSheetProps) {
  return (
    <BottomSheet onClose={onCancel} scrollable showHandle visible={visible}>
      <View style={styles.content} testID="block-confirm-sheet">
        <View style={styles.iconWrap}>
          <Ionicons
            accessibilityElementsHidden
            color={colors.danger}
            importantForAccessibility="no"
            name="warning"
            size={28}
            testID="block-confirm-alert-triangle"
          />
        </View>
        <AppText accessibilityRole="header" align="center" variant="headingMd">
          {blockConfirmTitle(name)}
        </AppText>
        <AppText align="center" color="secondary" variant="bodyLg">
          {BLOCK_COPY.confirmBody}
        </AppText>
        <View style={styles.actions}>
          <Button
            accessibilityLabel={confirmCancelA11yLabel(name)}
            fullWidth
            label={BLOCK_COPY.cancel}
            onPress={onCancel}
            size="lg"
            testID="block-confirm-cancel"
            variant="secondary"
          />
          <Button
            accessibilityLabel={confirmBlockA11yLabel(name)}
            fullWidth
            label={BLOCK_COPY.confirm}
            onPress={onConfirm}
            size="lg"
            testID="block-confirm-submit"
            variant="danger"
          />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing[8],
    marginTop: spacing[8],
    width: "100%",
  },
  content: {
    alignItems: "center",
    gap: spacing[12],
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 32,
  },
});
