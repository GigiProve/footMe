/**
 * Segnalibro dei Salvati (HOM-07 §93, §109, §116, §181).
 *
 * Due stati, non salvato e salvato, e lo stato non è solo colore: cambia la
 * forma (contorno / pieno) e il nome parlato — «Salva contenuto» / «Rimuovi dai
 * salvati». Non ha stato proprio: riceve `isSaved` dallo store e il toggle dal
 * chiamante. L'icona è piccola, il target tocca i 44pt.
 */

import { Pressable, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes } from "../../../theme/tokens";

type SavedBookmarkButtonProps = {
  isSaved: boolean;
  onToggle: () => void;
  /** Nome parlato dell'azione di salvataggio; di default quello dei contenuti (§181). */
  saveLabel?: string;
  testID?: string;
};

export function SavedBookmarkButton({
  isSaved,
  onToggle,
  saveLabel = "Salva contenuto",
  testID,
}: SavedBookmarkButtonProps) {
  return (
    <Pressable
      accessibilityLabel={isSaved ? "Rimuovi dai salvati" : saveLabel}
      accessibilityRole="button"
      accessibilityState={{ selected: isSaved }}
      onPress={onToggle}
      style={styles.target}
      testID={testID}
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
  target: {
    alignItems: "center",
    height: sizes.touchTarget,
    justifyContent: "center",
    width: sizes.touchTarget,
  },
});
