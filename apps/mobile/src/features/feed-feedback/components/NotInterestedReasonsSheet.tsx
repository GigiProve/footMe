/**
 * Foglio dei motivi facoltativi (HOM-11 §44–§50, §205–§206, mockup 3).
 *
 * `BottomSheet` di sistema: titolo «Aiutaci a migliorare i suggerimenti», «Facoltativo»
 * e il testo «La tua scelta ci aiuta a proporti contenuti più rilevanti.». Le righe
 * sono i motivi del server (§48), mai replicati qui (§49): nessuna icona per motivo,
 * perché richiederebbe di conoscere gli id. Un tap registra il motivo e chiude il
 * foglio (§50): nessun wizard, nessun secondo passaggio. L'hide è già completo prima
 * (§45): chiudere senza scegliere non toglie nulla.
 *
 * Elenco semplice con hairline `divider` e chevron, non card (§212–§213). Riga a
 * 44pt minimi (§206) e testo che va a capo con font grandi (§205).
 */

import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../theme/tokens";
import { AppText, BottomSheet } from "../../../ui";
import {
  REASONS_LOAD_ERROR,
  REASONS_RETRY,
  REASONS_SHEET_BODY,
  REASONS_SHEET_SUBTITLE,
  REASONS_SHEET_TITLE,
  sortReasons,
} from "../feed-feedback-presentation";
import type { FeedbackReason } from "../feed-feedback-types";

type NotInterestedReasonsSheetProps = {
  visible: boolean;
  /** `undefined` finché il server non ha risposto. */
  reasons: readonly FeedbackReason[] | undefined;
  isError: boolean;
  onRetry: () => void;
  onSelect: (reasonId: string) => void;
  onClose: () => void;
};

export function NotInterestedReasonsSheet({
  isError,
  onClose,
  onRetry,
  onSelect,
  reasons,
  visible,
}: NotInterestedReasonsSheetProps) {
  const rows = reasons ? sortReasons(reasons) : [];

  return (
    <BottomSheet onClose={onClose} scrollable showHandle visible={visible}>
      <Pressable
        accessibilityLabel="Chiudi"
        accessibilityRole="button"
        onPress={onClose}
        style={styles.close}
        testID="not-interested-reasons-close"
      >
        <Ionicons color={colors.textPrimary} name="close" size={22} />
      </Pressable>
      <View style={styles.header}>
        <AppText align="center" variant="titleMd">
          {REASONS_SHEET_TITLE}
        </AppText>
        <AppText align="center" color="secondary" variant="feedMeta">
          {REASONS_SHEET_SUBTITLE}
        </AppText>
        <AppText align="center" color="secondary" variant="bodySm">
          {REASONS_SHEET_BODY}
        </AppText>
      </View>

      {isError ? (
        <View style={styles.state}>
          <AppText align="center" color="secondary" variant="bodySm">
            {REASONS_LOAD_ERROR}
          </AppText>
          <Pressable
            accessibilityLabel={REASONS_RETRY}
            accessibilityRole="button"
            onPress={onRetry}
            style={styles.retry}
          >
            <AppText color="accent" variant="actionLabel">
              {REASONS_RETRY}
            </AppText>
          </Pressable>
        </View>
      ) : (
        rows.map((reason, index) => (
          <Pressable
            accessibilityLabel={reason.label}
            accessibilityRole="button"
            key={reason.reasonId}
            onPress={() => onSelect(reason.reasonId)}
            style={({ pressed }) => [
              styles.row,
              index > 0 ? styles.rowDivider : null,
              pressed ? styles.pressed : null,
            ]}
            testID={`not-interested-reason-${reason.reasonId}`}
          >
            <AppText style={styles.rowLabel} variant="bodyLg">
              {reason.label}
            </AppText>
            <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
          </Pressable>
        ))
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  close: {
    alignItems: "center",
    alignSelf: "flex-start",
    height: sizes.touchTarget,
    justifyContent: "center",
    marginLeft: -spacing[12],
    width: sizes.touchTarget,
  },
  header: {
    gap: spacing[4],
    paddingBottom: spacing[16],
  },
  pressed: {
    opacity: 0.6,
  },
  retry: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: sizes.touchTarget,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget,
    paddingVertical: spacing[12],
  },
  rowDivider: {
    borderTopColor: colors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: {
    flex: 1,
  },
  state: {
    gap: spacing[8],
    paddingVertical: spacing[16],
  },
});
