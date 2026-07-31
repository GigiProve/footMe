/**
 * Modulo di primo accesso "Personalizza il tuo Feed" (§6).
 *
 * Vive nel `ListHeaderComponent` della tab Per te, quindi scorre via col
 * contenuto: NON è una pagina esterna né un onboarding separato, come il §6
 * richiede espressamente. Dopo il completamento o la chiusura scompare e non
 * occupa più il Feed.
 *
 * Le opzioni sono selezioni multiple compatte, non filtri: il testo lo dice e
 * il server le tratta come un boost temporaneo e additivo.
 */

import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { AppText, Button } from "../../../../ui";
import {
  FEED_INTRO_BODY,
  FEED_INTRO_PRIMARY_CTA,
  FEED_INTRO_SECONDARY_CTA,
  FEED_INTRO_TITLE,
} from "../../feed-labels";
import type { FeedIntroOption, FeedPreferenceKey } from "../../feed-types";

type FeedPersonalizeModuleProps = {
  options: FeedIntroOption[];
  isSaving: boolean;
  onSave: (selected: FeedPreferenceKey[]) => void;
  onDismiss: () => void;
};

export function FeedPersonalizeModule({
  options,
  isSaving,
  onSave,
  onDismiss,
}: FeedPersonalizeModuleProps) {
  // `prefill` viene dal server: le opzioni già deducibili dal profilo partono
  // selezionate, così il §7 ("non richiedere di nuovo ciò che c'è già") è
  // visibile anche nell'interfaccia e non solo nella logica.
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
    <View style={styles.card} testID="feed-personalize">
      <AppText variant="titleMd">{FEED_INTRO_TITLE}</AppText>
      <AppText color="secondary" variant="bodySm">
        {FEED_INTRO_BODY}
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
              style={[styles.chip, isOn ? styles.chipOn : null]}
            >
              <Ionicons
                color={isOn ? colors.accent : colors.textMuted}
                name={isOn ? "checkmark-circle" : "ellipse-outline"}
                size={16}
              />
              <AppText color={isOn ? "accent" : "secondary"} variant="bodySm">
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <Button
        fullWidth
        label={FEED_INTRO_PRIMARY_CTA}
        loading={isSaving}
        onPress={() => onSave(Array.from(selected))}
      />
      <Button
        fullWidth
        label={FEED_INTRO_SECONDARY_CTA}
        onPress={onDismiss}
        variant="link"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: 1,
    gap: spacing[8],
    padding: spacing[14],
  },
  chip: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[6],
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[8],
  },
  chipOn: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  options: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
    marginVertical: spacing[4],
  },
});
