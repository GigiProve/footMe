/**
 * Segnaposto di un commento che non c'è più (HOM-08 §90, §164–§168, §195–§196).
 *
 *  • `deleted` → «Commento eliminato»: resta perché le risposte non si perdono (§164,
 *    §168); senza autore, senza testo, senza Mi piace (§166);
 *  • `unavailable` → «Commento non disponibile»: il commento principale non è visibile
 *    a questo viewer (autore bloccato, sospeso o eliminato) ma ha risposte visibili.
 * Non è interattivo (§167): niente Mi piace, niente Rispondi, niente tap sul profilo,
 * niente menu — non c'è alcun controllo, quindi nessun tap verso un profilo che non
 * esiste (§196). Non si conta nel conteggio del contenuto (§90).
 */

import { StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import { placeholderLabel } from "../comment-presentation";
import type { CommentStatus } from "../comment-types";

export function CommentPlaceholderRow({ status, isReply = false }: { status: CommentStatus; isReply?: boolean }) {
  const label = placeholderLabel(status);

  return (
    <View
      accessibilityLabel={label}
      accessible
      style={[styles.row, isReply ? styles.reply : null]}
      testID="comment-placeholder"
    >
      <View style={styles.dot} />
      <AppText color="muted" variant="bodyLg">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 32,
    width: 32,
  },
  reply: {
    paddingLeft: spacing[32],
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[10],
    minHeight: 44,
    paddingVertical: spacing[12],
  },
});
