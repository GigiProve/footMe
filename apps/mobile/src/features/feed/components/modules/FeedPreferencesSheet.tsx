/**
 * Foglio delle preferenze del Feed, aperto da "Personalizza" (HOM-01.1 §30).
 *
 * Sono le stesse quattro opzioni e lo stesso salvataggio del modulo HOM-01,
 * spostati fuori dalla Home: il §27 non vuole quattro grossi selettori nel
 * Feed, il §30 non ridefinisce il ranking. Le opzioni restano selezioni
 * multiple, non filtri: il server le tratta come un boost additivo.
 *
 * `prefill` viene dal server: le opzioni già deducibili dal profilo partono
 * selezionate, così "non richiedere di nuovo ciò che c'è già" resta visibile
 * anche nell'interfaccia (§31: si continuano a usare i dati del profilo).
 */

import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes, spacing } from "../../../../theme/tokens";
import { AppText, BottomSheet, Button } from "../../../../ui";
import {
  FEED_INTRO_SHEET_BODY,
  FEED_INTRO_SHEET_SAVE,
  FEED_INTRO_TITLE,
} from "../../feed-labels";
import type { FeedIntroOption, FeedPreferenceKey } from "../../feed-types";

type FeedPreferencesSheetProps = {
  visible: boolean;
  options: FeedIntroOption[];
  isSaving: boolean;
  onSave: (selected: FeedPreferenceKey[]) => void;
  onClose: () => void;
};

export function FeedPreferencesSheet({
  visible,
  options,
  isSaving,
  onSave,
  onClose,
}: FeedPreferencesSheetProps) {
  const [selected, setSelected] = useState<Set<FeedPreferenceKey>>(
    () => new Set(options.filter((option) => option.prefill).map((option) => option.key)),
  );

  function toggle(key: FeedPreferenceKey) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <BottomSheet onClose={onClose} title={FEED_INTRO_TITLE} visible={visible}>
      <AppText color="secondary" variant="feedMeta">
        {FEED_INTRO_SHEET_BODY}
      </AppText>

      <View style={styles.options}>
        {options.map((option) => {
          const isOn = selected.has(option.key);
          return (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isOn }}
              key={option.key}
              onPress={() => toggle(option.key)}
              style={[styles.option, isOn ? styles.optionOn : null]}
            >
              <Ionicons
                color={isOn ? colors.accent : colors.textMuted}
                name={isOn ? "checkmark-circle" : "ellipse-outline"}
                size={18}
              />
              <AppText color={isOn ? "accent" : "primary"} variant="feedMeta">
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <Button
        fullWidth
        label={FEED_INTRO_SHEET_SAVE}
        loading={isSaving}
        onPress={() => onSave(Array.from(selected))}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  option: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[8],
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[14],
  },
  optionOn: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentSoftBorder,
  },
  options: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
    marginBottom: spacing[16],
    marginTop: spacing[14],
  },
});
