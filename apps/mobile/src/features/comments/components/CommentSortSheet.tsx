/**
 * Foglio dell'ordinamento (HOM-08 §117–§122, §233, mockup 9).
 *
 * Compatto: due righe, «Più rilevanti» e «Più recenti», con il check sulla scelta
 * attiva (§121). Nessun altro filtro (§119). Il ranking lo calcola il server (§122): qui
 * si sceglie soltanto. La scelta selezionata si annuncia allo screen reader (§233) e
 * il foglio si chiude.
 */

import { AccessibilityInfo, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../theme/tokens";
import { AppText, BottomSheet } from "../../../ui";
import { COMMENTS_SORT_SHEET_TITLE } from "../comment-labels";
import { sortLabel, sortSelectionAnnouncement } from "../comment-presentation";
import type { CommentSort } from "../comment-types";

const OPTIONS: readonly CommentSort[] = ["relevant", "recent"];

export function CommentSortSheet({
  visible,
  sort,
  onSelect,
  onClose,
}: {
  visible: boolean;
  sort: CommentSort;
  onSelect: (sort: CommentSort) => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet onClose={onClose} title={COMMENTS_SORT_SHEET_TITLE} visible={visible}>
      <View>
        {OPTIONS.map((option) => {
          const selected = option === sort;

          return (
            <Pressable
              accessibilityLabel={sortLabel(option)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              key={option}
              onPress={() => {
                onSelect(option);
                AccessibilityInfo?.announceForAccessibility?.(sortSelectionAnnouncement(option));
                onClose();
              }}
              style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
              testID={`comments-sort-${option}`}
            >
              <AppText variant="bodyLg">{sortLabel(option)}</AppText>
              {selected ? <Ionicons color={colors.accent} name="checkmark" size={22} /> : null}
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.6,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: sizes.touchTarget,
    paddingVertical: spacing[8],
  },
});
