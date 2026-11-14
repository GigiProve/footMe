/**
 * Le righe selezionabili del selector di modalità (HOM-06.2 §7A, §7X): «Scrivi su
 * PROLINK», «Collega da un link», «Incolla un articolo». Righe compatte con un
 * divisore, non tre grandi card promozionali (§7A, §10). Una sola selezionata; lo
 * stato non è affidato al solo colore: cerchio pieno contro vuoto più
 * `accessibilityState` (§7A). Usato dalla schermata del selector e dal foglio di
 * cambio modalità dell'editor (§7X).
 */

import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, View } from "react-native";

import { colors, spacing } from "../../../styles";
import { AppText } from "../../../ui";
import type { ArticleCreationMode } from "../../publishing/publishing-types";
import { MODE_OPTIONS } from "../article-presentation";

type Props = {
  /** Le modalità realmente disponibili (§7B), nell'ordine del selector. */
  modes: readonly ArticleCreationMode[];
  selected: ArticleCreationMode | null;
  onSelect: (mode: ArticleCreationMode) => void;
};

export function ArticleModeOptions({ modes, selected, onSelect }: Props) {
  const options = MODE_OPTIONS.filter((option) => modes.includes(option.mode));

  return (
    <View accessibilityRole="radiogroup">
      {options.map((option, index) => {
        const isSelected = option.mode === selected;
        return (
          <Pressable
            accessibilityLabel={`${option.title}. ${option.description}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected, selected: isSelected }}
            key={option.mode}
            onPress={() => onSelect(option.mode)}
            style={({ pressed }) => [styles.row, index < options.length - 1 ? styles.divider : null, pressed ? styles.pressed : null]}
            testID={`article-mode-${option.mode}`}
          >
            <View style={styles.text}>
              <AppText variant="titleSm">{option.title}</AppText>
              <AppText color="secondary" variant="bodySm">
                {option.description}
              </AppText>
            </View>
            <Ionicons color={isSelected ? colors.accent : colors.textMuted} name={isSelected ? "radio-button-on" : "radio-button-off"} size={24} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  divider: {
    borderBottomColor: colors.divider,
    borderBottomWidth: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: 64,
    paddingVertical: spacing[12],
  },
  text: {
    flex: 1,
    gap: spacing[4],
  },
});
