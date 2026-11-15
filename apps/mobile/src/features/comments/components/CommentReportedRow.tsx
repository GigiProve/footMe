/**
 * Il commento che il viewer ha segnalato, ripiegato (HOM-11 §134–§140, mockup 8).
 *
 * Una riga compatta con la bandierina e «Commento segnalato», al posto del commento, solo
 * per il reporter (§123, §138): il commento resta per tutti gli altri (§124). Non ha azioni
 * verso il commento nascosto — niente Mi piace, Rispondi né menu (§140) — e quindi nessun
 * tap verso un profilo o un Mi piace su ciò che non si vuole più vedere.
 *
 * Le risposte NON seguono il padre (§136–§139): sono righe sorelle, intatte e utilizzabili.
 * Una risposta segnalata si ripiega da sola e le altre restano (§138–§139). Il segnaposto è
 * un solo elemento leggibile ai lettori di schermo (§201): il colore non è l'unico segnale.
 */

import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import { COMMENT_REPORTED_LABEL } from "../../moderation/moderation-presentation";

export function CommentReportedRow({ commentId, isReply = false }: { commentId: string; isReply?: boolean }) {
  return (
    <View style={[styles.frame, isReply ? styles.reply : null]}>
      <View
        accessibilityLabel={COMMENT_REPORTED_LABEL}
        accessible
        style={styles.bar}
        testID={`comment-reported-${commentId}`}
      >
        <Ionicons color={colors.textSecondary} name="flag-outline" size={18} />
        <AppText color="secondary" variant="bodyLg">
          {COMMENT_REPORTED_LABEL}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: "center",
    backgroundColor: colors.backgroundStrong,
    borderRadius: radius[16],
    flexDirection: "row",
    gap: spacing[10],
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[8],
  },
  frame: {
    paddingVertical: spacing[12],
  },
  // Lo stesso unico livello di indentazione delle risposte (HOM-08 §50–§51).
  reply: {
    paddingLeft: spacing[24],
  },
});
