/**
 * «Hai già ripostato questo contenuto.» + «Rimuovi repost» (HOM-10 §120–§133, §275;
 * mockup 7).
 *
 * Sta sotto la card incorporata, nel composer. Dice lo stato (non azionabile) e offre
 * l'azione secondaria: «Rimuovi repost», rossa, IMMEDIATA e senza conferma (§129).
 * Il campo testo sopra resta utilizzabile (§125, §132): l'utente può comunque
 * pubblicare un Post con testo (§133). Rimuovere non tocca l'originale (§131).
 *
 * §275: «Rimuovi repost» si distingue chiaramente — è un bottone con icona e testo
 * danger, mai affidato al solo colore.
 */

import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import { REPOST_COMPOSER_COPY } from "../repost-composer-presentation";

type RepostAlreadyNoticeProps = {
  /** Una rimozione è in corso: il tap non parte due volte. */
  busy?: boolean;
  onRemove: () => void;
};

export function RepostAlreadyNotice({ busy = false, onRemove }: RepostAlreadyNoticeProps) {
  return (
    <View style={styles.container} testID="repost-already-notice">
      <AppText color="secondary" variant="bodySm">
        {REPOST_COMPOSER_COPY.alreadyReposted}
      </AppText>
      <Pressable
        accessibilityLabel={REPOST_COMPOSER_COPY.remove}
        accessibilityRole="button"
        accessibilityState={{ busy, disabled: busy }}
        disabled={busy}
        onPress={onRemove}
        style={({ pressed }) => [styles.remove, busy ? styles.busy : null, pressed ? styles.pressed : null]}
        testID="repost-remove"
      >
        <Ionicons color={colors.danger} name="close-circle-outline" size={20} />
        <AppText color="danger" variant="titleSm">
          {REPOST_COMPOSER_COPY.remove}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  busy: {
    opacity: 0.4,
  },
  container: {
    gap: spacing[4],
    paddingHorizontal: spacing[16],
    paddingTop: spacing[12],
  },
  pressed: {
    opacity: 0.6,
  },
  remove: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: spacing[8],
    minHeight: sizes.touchTarget,
  },
});
