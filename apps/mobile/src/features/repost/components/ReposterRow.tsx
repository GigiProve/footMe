/**
 * La riga discreta del reposter sopra un Simple Repost nel Feed (HOM-10 §73–§76,
 * §185–§192, §259–§260, §291).
 *
 * «↻ Marco Bianchi ha ripostato» / «↻ Marco Bianchi e altre 3 persone hanno
 * ripostato». Secondaria rispetto all'originale (§74, §260): una sola riga piccola,
 * muted, senza avatar — nemmeno uno stack degli altri reposter (§188) — e senza
 * contatori. L'autore dell'originale resta dominante (§75): l'header sotto è il
 * suo. «Altre N persone» non è tappabile (§190). L'icona è la stessa di «Repost» in
 * HOM-05 (`repeat-outline`), niente di decorativo (§259).
 *
 * L'elemento sotto è l'originale e la sua action row appartiene a lui (§76–§82): qui
 * non c'è nessun engagement.
 */

import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import type { FeedContentType, FeedRepostContext } from "../../feed/feed-types";
import { trackRepost } from "../repost-analytics";
import { reposterRowLabel } from "../repost-presentation";

type ReposterRowProps = {
  repost: FeedRepostContext;
  /** L'originale, solo per l'evento di aggregazione (§269). */
  target: { contentType: FeedContentType; contentId: string };
};

export function ReposterRow({ repost, target }: ReposterRowProps) {
  const label = reposterRowLabel(repost);
  const { additionalCount } = repost;

  // §269: una volta per comparsa di un gruppo aggregato (non per il singolo reposter).
  useEffect(() => {
    if (additionalCount > 0) {
      trackRepost({
        additionalCount,
        contentId: target.contentId,
        contentType: target.contentType,
        name: "aggregated_simple_repost_rendered",
      });
    }
  }, [additionalCount, target.contentId, target.contentType]);

  return (
    <View accessible accessibilityLabel={label} style={styles.row} testID="feed-reposter-row">
      <Ionicons color={colors.textMuted} name="repeat-outline" size={14} />
      {/* Due righe: con un nome lungo «ha ripostato» / «e altre N persone» non deve sparire (§187). */}
      <AppText color="muted" numberOfLines={2} style={styles.label} variant="feedMeta">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    flexShrink: 1,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
    marginBottom: spacing[8],
  },
});
