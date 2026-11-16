/**
 * Stato di primo accesso «Rendiamo il tuo Feed più utile fin da subito» (HOM-13 D1,
 * §135–§146, §274, §285). Stessa architettura di HOM-01.1 §27–§31: un modulo dentro la
 * Home, nel `ListHeaderComponent` della tab Per te, che scorre via insieme al Feed e non è
 * un secondo onboarding.
 *
 * Contenuto (§136–§144):
 *  • titolo e due testi (§138 + §139): si parte dalle aree, il resto lo impara PROLINK, le
 *    preferenze danno priorità e non escludono nulla;
 *  • «Le tue aree» con i valori già presenti nel profilo (§140–§141) e «Modifica» verso
 *    l'editor del profilo esistente (§142). Senza aree la sezione non compare;
 *  • CTA principale «Inizia» (§143); accesso rapido «Chiudi» nel rail (§144): stessa azione.
 *
 * Niente checkbox né foglio di preferenze (§240), niente «Non ora» con riproposta (§146).
 * Dynamic Type (§274): solo `AppText` e `minHeight`, nessuna altezza fissa sul testo; le aree
 * vanno a capo (`flexWrap`).
 */

import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { colors, radius, sizes, spacing } from "../../../../theme/tokens";
import { AppText, Button, ContentModule } from "../../../../ui";
import { trackFeed } from "../../feed-analytics";
import {
  FEED_INTRO_AREAS_TITLE,
  FEED_INTRO_BODY,
  FEED_INTRO_CLOSE,
  FEED_INTRO_EDIT_AREAS,
  FEED_INTRO_EDIT_AREAS_A11Y,
  FEED_INTRO_EYEBROW,
  FEED_INTRO_NOTE,
  FEED_INTRO_PRIMARY_CTA,
  FEED_INTRO_TITLE,
} from "../../feed-labels";
import type { FeedIntroArea } from "../../feed-types";

/** Vive a livello di modulo per sopravvivere ai rimontaggi dello stato. */
let introImpressionTracked = false;

/** Solo per i test: azzera il registro dell'impression. */
export function resetIntroImpressionForTests(): void {
  introImpressionTracked = false;
}

type FeedPersonalizeModuleProps = {
  areas: readonly FeedIntroArea[];
  /** «Inizia»: riconosce lo stato (`acknowledge_feed_intro`). */
  onStart: () => void;
  /** Accesso rapido (§144): la stessa azione di «Inizia». */
  onClose: () => void;
  /** «Modifica» (§142). Assente = nessuna route di editor per questo ruolo. */
  onEditAreas?: () => void;
};

export function FeedPersonalizeModule({
  areas,
  onStart,
  onClose,
  onEditAreas,
}: FeedPersonalizeModuleProps) {
  // Una impression per sessione JS: lo stato si rimonta quando la lista passa per
  // skeleton o errore, e ogni rimontaggio non è una nuova comparsa.
  useEffect(() => {
    if (introImpressionTracked) {
      return;
    }
    introImpressionTracked = true;
    trackFeed({ name: "home_intro_impression" });
  }, []);

  function editAreas() {
    trackFeed({ name: "home_intro_edit_areas" });
    onEditAreas?.();
  }

  return (
    <ContentModule
      actions={[
        {
          accessibilityLabel: FEED_INTRO_CLOSE,
          icon: "close",
          label: FEED_INTRO_CLOSE,
          onPress: onClose,
          tone: "muted",
        },
      ]}
      eyebrow={FEED_INTRO_EYEBROW}
      testID="feed-personalize"
    >
      <AppText accessibilityRole="header" variant="titleMd">
        {FEED_INTRO_TITLE}
      </AppText>
      <AppText color="secondary" style={styles.paragraph} variant="feedMeta">
        {FEED_INTRO_BODY}
      </AppText>
      <AppText color="secondary" style={styles.paragraph} variant="feedMeta">
        {FEED_INTRO_NOTE}
      </AppText>

      {areas.length > 0 ? (
        <View style={styles.areas} testID="feed-personalize-areas">
          <View style={styles.areasHeader}>
            <AppText color="muted" style={styles.areasTitle} variant="eyebrow">
              {FEED_INTRO_AREAS_TITLE}
            </AppText>
            {onEditAreas ? (
              <Pressable
                accessibilityHint={FEED_INTRO_EDIT_AREAS_A11Y}
                accessibilityLabel={FEED_INTRO_EDIT_AREAS_A11Y}
                accessibilityRole="button"
                hitSlop={8}
                onPress={editAreas}
                style={styles.edit}
              >
                <AppText color="accent" variant="actionLabel">
                  {FEED_INTRO_EDIT_AREAS}
                </AppText>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.chips}>
            {areas.map((area) => (
              <View key={`${area.kind}:${area.label}`} style={styles.chip}>
                <AppText variant="feedMeta">{area.label}</AppText>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <Button
        fullWidth
        label={FEED_INTRO_PRIMARY_CTA}
        onPress={onStart}
        style={styles.cta}
      />
    </ContentModule>
  );
}

const styles = StyleSheet.create({
  areas: {
    marginTop: spacing[14],
  },
  areasHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing[8],
  },
  areasTitle: {
    flexShrink: 1,
  },
  chip: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: spacing[32],
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[4],
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  cta: {
    marginTop: spacing[16],
  },
  // L'area di tocco di «Modifica» arriva a 44pt senza fissare l'altezza del testo.
  edit: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[4],
  },
  paragraph: {
    marginTop: spacing[6],
  },
});
