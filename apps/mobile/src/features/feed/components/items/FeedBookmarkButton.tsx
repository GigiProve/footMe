/**
 * Segnalibro discreto di Articolo e Video editoriale (HOM-03 §37, §51, §59, §85).
 *
 * Sta nell'header, a destra, prima del menu ••• — mai come quarta azione della
 * riga Mi piace · Commenta · Condividi (§59). Riusa il Saved system unico
 * (§37, §95): non ha stato proprio, riceve `isSaved` e il toggle da FeedPane.
 * Accent solo quando è attivo; lo stato è anche nel nome parlato (§85). L'icona
 * è piccola, l'area di tocco arriva a 44pt con l'hitSlop.
 */

import { Pressable, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../../theme/tokens";
import { bookmarkAccessibilityLabel } from "../../feed-video-presentation";

type FeedBookmarkButtonProps = {
  isSaved: boolean;
  onToggle: () => void;
};

export function FeedBookmarkButton({ isSaved, onToggle }: FeedBookmarkButtonProps) {
  return (
    <Pressable
      accessibilityLabel={bookmarkAccessibilityLabel(isSaved)}
      accessibilityRole="button"
      accessibilityState={{ selected: isSaved }}
      hitSlop={8}
      onPress={onToggle}
      style={styles.trigger}
      testID="feed-bookmark"
    >
      <Ionicons
        color={isSaved ? colors.accent : colors.textMuted}
        name={isSaved ? "bookmark" : "bookmark-outline"}
        size={20}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  trigger: {
    alignItems: "center",
    justifyContent: "center",
    padding: spacing[6],
  },
});
