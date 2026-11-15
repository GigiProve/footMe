/**
 * Il segnaposto compatto di un contenuto nascosto (HOM-11 §29–§36, §44, §198–§199,
 * mockup 2): una riga con l'icona occhio barrato e «Contenuto nascosto · Annulla».
 *
 * NON mantiene l'altezza del Post (§31): occupa solo lo spazio del feedback e
 * dell'Annulla (§32). Sta nella STESSA posizione dell'elemento (§33): la lista non
 * ne sa nulla, la sostituzione la fa `HideableContent` per cella.
 *
 *  • «Annulla» ripristina il contenuto (§34) e cancella il feedback lato server;
 *  • «Aiutaci a migliorare i suggerimenti» (§44) apre il foglio dei motivi, solo a hide
 *    confermato e finché non si è scelto un motivo (§45);
 *  • all'apparire annuncia «Contenuto nascosto. Annulla» (§199): l'azione è
 *    raggiungibile subito, con 44pt di area di tocco (§206).
 */

import { useEffect, useState } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import {
  HIDDEN_PLACEHOLDER_LABEL,
  HIDDEN_UNDO_A11Y_LABEL,
  HIDDEN_UNDO_LABEL,
  REASONS_LINK_LABEL,
  canOfferReasons,
  hiddenTargetKey,
  placeholderAnnouncement,
} from "../feed-feedback-presentation";
import { useHiddenContent } from "../hidden-content-store";
import { useFeedbackReasons } from "../use-feedback-reasons";
import { useNotInterested, type NotInterestedTarget } from "../use-not-interested";
import { NotInterestedReasonsSheet } from "./NotInterestedReasonsSheet";

export function HiddenContentPlaceholder({ target }: { target: NotInterestedTarget }) {
  const entry = useHiddenContent(hiddenTargetKey(target.contentType, target.contentId));
  const actions = useNotInterested();
  const [isReasonsOpen, setReasonsOpen] = useState(false);
  const reasons = useFeedbackReasons(isReasonsOpen);

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(placeholderAnnouncement());
  }, []);

  if (!entry) {
    return null;
  }

  return (
    <View style={styles.frame} testID="hidden-content-placeholder">
      <View style={styles.bar}>
        <Ionicons color={colors.textSecondary} name="eye-off-outline" size={18} />
        <AppText color="secondary" variant="bodyLg">
          {HIDDEN_PLACEHOLDER_LABEL}
        </AppText>
        {/* «· Annulla» va a capo insieme: mai un puntino orfano a fine riga (font grandi, §205). */}
        <View style={styles.undoGroup}>
          <AppText color="secondary" variant="bodyLg">
            ·
          </AppText>
          <Pressable
            accessibilityLabel={HIDDEN_UNDO_A11Y_LABEL}
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => void actions.undo(target)}
            style={({ pressed }) => [styles.undo, pressed ? styles.pressed : null]}
            testID="hidden-content-undo"
          >
            <AppText color="accent" variant="actionLabel">
              {HIDDEN_UNDO_LABEL}
            </AppText>
          </Pressable>
        </View>
      </View>

      {canOfferReasons(entry) ? (
        <Pressable
          accessibilityLabel={REASONS_LINK_LABEL}
          accessibilityRole="button"
          onPress={() => {
            actions.trackReasonsOpen(target);
            setReasonsOpen(true);
          }}
          style={({ pressed }) => [styles.reasonsLink, pressed ? styles.pressed : null]}
          testID="hidden-content-reasons-link"
        >
          <AppText color="accent" variant="feedMeta">
            {REASONS_LINK_LABEL}
          </AppText>
        </Pressable>
      ) : null}

      <NotInterestedReasonsSheet
        isError={reasons.isError}
        onClose={() => setReasonsOpen(false)}
        onRetry={() => void reasons.refetch()}
        onSelect={(reasonId) => {
          // §50: un tap registra il motivo e chiude il foglio.
          setReasonsOpen(false);
          void actions.selectReason(target, reasonId);
        }}
        reasons={reasons.data}
        visible={isReasonsOpen}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: "center",
    backgroundColor: colors.backgroundStrong,
    borderRadius: radius[16],
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
    justifyContent: "center",
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[6],
  },
  frame: {
    borderBottomColor: colors.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: spacing[8],
    paddingTop: spacing[12],
  },
  pressed: {
    opacity: 0.6,
  },
  reasonsLink: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: sizes.touchTarget,
  },
  undoGroup: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
  },
  undo: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: sizes.touchTarget,
  },
});
