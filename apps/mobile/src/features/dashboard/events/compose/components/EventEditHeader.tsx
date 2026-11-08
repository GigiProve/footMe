/**
 * Intestazione della modifica di un evento esistente (DAS-REV-29 §8,
 * screen 02): «Annulla | Modifica evento | Salva».
 *
 * In creazione resta la barra della 28 con «Salva bozza» e «Continua» nel
 * footer; qui il salvataggio è un'azione dell'intestazione perché modificare
 * non pubblica nulla e non ha un passaggio finale diverso dagli altri.
 */
import { Pressable, StyleSheet, View } from "react-native";

import { colors, sizes, spacing } from "../../../../../theme/tokens";
import { AppText } from "../../../../../ui";

export const EDIT_HEADER_COPY = {
  cancel: "Annulla",
  save: "Salva",
  title: "Modifica evento",
} as const;

export function EventEditHeader({
  onCancel,
  onSave,
  saveDisabled,
  saving,
}: {
  onCancel: () => void;
  onSave: () => void;
  saveDisabled: boolean;
  saving: boolean;
}) {
  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityRole="button"
        hitSlop={8}
        onPress={onCancel}
        style={styles.side}
        testID="event-edit-cancel"
      >
        <AppText color="accent" variant="actionLabel">
          {EDIT_HEADER_COPY.cancel}
        </AppText>
      </Pressable>

      <AppText accessibilityRole="header" color="neutral" numberOfLines={1} style={styles.title} variant="titleSm">
        {EDIT_HEADER_COPY.title}
      </AppText>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ busy: saving, disabled: saveDisabled }}
        disabled={saveDisabled}
        hitSlop={8}
        onPress={onSave}
        style={[styles.side, styles.right]}
        testID="event-edit-save"
      >
        <AppText color={saveDisabled ? "neutralSoft" : "accent"} variant="actionLabel">
          {saving ? "…" : EDIT_HEADER_COPY.save}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: "center",
    borderBottomColor: colors.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[20],
  },
  right: {
    alignItems: "flex-end",
  },
  side: {
    justifyContent: "center",
    minHeight: sizes.touchTarget,
    minWidth: 72,
  },
  title: {
    flex: 1,
    textAlign: "center",
  },
});
