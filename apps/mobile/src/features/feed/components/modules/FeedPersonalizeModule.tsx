/**
 * Prompt di primo accesso "Personalizza ciò che vuoi vedere" (HOM-01.1
 * §27–§31).
 *
 * Semplificato rispetto a HOM-01: niente più quattro selettori dentro la Home,
 * solo titolo, una riga di testo, "Personalizza" e "Non ora". Vive nel
 * `ListHeaderComponent` della tab Per te, quindi il Feed comincia subito sotto
 * e scorre via insieme al prompt: non è un secondo onboarding (§29).
 *
 * "Personalizza" apre il foglio con le stesse quattro opzioni e lo stesso
 * salvataggio di HOM-01 (§30: si aggiorna solo il punto d'accesso, il ranking
 * non cambia). "Non ora" e la × chiudono il prompt; la chiusura è persistita
 * da `useFeedFirstAccess`, lato server e in cache locale (§31).
 *
 * Gli eventi del §69 vivono qui perché descrivono il prompt, non il
 * salvataggio: gli eventi HOM-01 (`feed_personalize_*`) restano nell'hook.
 */

import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes, spacing } from "../../../../theme/tokens";
import { AppText, Button } from "../../../../ui";
import { trackFeed } from "../../feed-analytics";
import {
  FEED_INTRO_BODY,
  FEED_INTRO_PRIMARY_CTA,
  FEED_INTRO_SECONDARY_CTA,
  FEED_INTRO_TITLE,
} from "../../feed-labels";
import type { FeedIntroOption, FeedPreferenceKey } from "../../feed-types";
import { FeedPreferencesSheet } from "./FeedPreferencesSheet";

/** Vive a livello di modulo per sopravvivere ai rimontaggi del prompt. */
let promptImpressionTracked = false;

/** Solo per i test: azzera il registro dell'impression. */
export function resetPromptImpressionForTests(): void {
  promptImpressionTracked = false;
}

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
  const [isSheetOpen, setSheetOpen] = useState(false);

  // Una impression per sessione JS: il prompt si rimonta quando la lista passa
  // per skeleton o errore, e ogni rimontaggio non è una nuova comparsa.
  useEffect(() => {
    if (promptImpressionTracked) {
      return;
    }
    promptImpressionTracked = true;
    trackFeed({ name: "home_personalization_prompt_impression" });
  }, []);

  function open() {
    trackFeed({ name: "home_personalization_opened" });
    setSheetOpen(true);
  }

  function skip() {
    trackFeed({ name: "home_personalization_skipped" });
    onDismiss();
  }

  return (
    <View style={styles.card} testID="feed-personalize">
      <View style={styles.topRow}>
        <Ionicons color={colors.accent} name="sparkles-outline" size={20} />
        <Pressable
          accessibilityHint={FEED_INTRO_SECONDARY_CTA}
          accessibilityLabel="Chiudi"
          accessibilityRole="button"
          onPress={skip}
          style={styles.close}
        >
          <Ionicons color={colors.textMuted} name="close" size={20} />
        </Pressable>
      </View>

      <AppText accessibilityRole="header" align="center" variant="titleMd">
        {FEED_INTRO_TITLE}
      </AppText>
      <AppText align="center" color="secondary" style={styles.body} variant="feedMeta">
        {FEED_INTRO_BODY}
      </AppText>

      <View style={styles.actions}>
        <Button
          label={FEED_INTRO_PRIMARY_CTA}
          onPress={open}
          style={styles.action}
        />
        <Button
          label={FEED_INTRO_SECONDARY_CTA}
          onPress={skip}
          style={styles.action}
          variant="link"
        />
      </View>

      <FeedPreferencesSheet
        isSaving={isSaving}
        onClose={() => setSheetOpen(false)}
        onSave={onSave}
        options={options}
        visible={isSheetOpen}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    gap: spacing[12],
    marginTop: spacing[14],
  },
  body: {
    marginTop: spacing[6],
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    paddingBottom: spacing[16],
    paddingHorizontal: spacing[16],
    paddingTop: spacing[4],
  },
  // L'area di tocco della × sporge oltre il padding per restare a 44pt.
  close: {
    alignItems: "center",
    height: sizes.touchTarget,
    justifyContent: "center",
    marginRight: -spacing[12],
    width: sizes.touchTarget,
  },
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
