/**
 * Header del composer: «Annulla | Nuovo post | Pubblica» (HOM-06.1 §7–10, §145,
 * §186, mockup screen 1 e 7).
 *
 * Stesso componente per creazione e modifica: cambiano solo `title` e
 * `ctaLabel` («Nuovo post»/«Pubblica», «Modifica post»/«Salva»). La CTA è testo
 * accent, non un bottone pieno (§186); ha tre stati — disabled, enabled,
 * loading — e in loading non è tappabile (§119).
 *
 * Safe area: questo componente NON aggiunge l'inset superiore. Il chiamante
 * avvolge la schermata in `Screen`/`SafeAreaView` (edges top) così l'header
 * resta lo stesso dentro un Modal o in una route.
 */

import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { colors, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";

/**
 * Annulla | titolo | Pubblica stanno su una riga sola: a Dynamic Type 2× i tre
 * testi si toccavano. Il titolo è un elemento di chrome, non contenuto (§196 vale
 * per testo e toolbar): si scala fino a 1,3×.
 */
export const HEADER_MAX_FONT_SCALE = 1.3;

export type ComposerHeaderCtaState = "disabled" | "enabled" | "loading";

type ComposerHeaderProps = {
  title: string;
  ctaLabel: string;
  ctaState: ComposerHeaderCtaState;
  /** Default «Annulla». */
  cancelLabel?: string;
  /** Es. durante la pubblicazione: Annulla non deve interrompere l'invio. */
  cancelDisabled?: boolean;
  onCancel: () => void;
  onSubmit: () => void;
};

export function ComposerHeader({
  title,
  ctaLabel,
  ctaState,
  cancelLabel = "Annulla",
  cancelDisabled = false,
  onCancel,
  onSubmit,
}: ComposerHeaderProps) {
  const isLoading = ctaState === "loading";
  const isEnabled = ctaState === "enabled";

  return (
    <View style={styles.container}>
      <View style={styles.side}>
        <Pressable
          accessibilityLabel={cancelLabel}
          accessibilityRole="button"
          accessibilityState={{ disabled: cancelDisabled }}
          disabled={cancelDisabled}
          onPress={onCancel}
          style={({ pressed }) => [styles.action, pressed ? styles.pressed : null]}
          testID="composer-header-cancel"
        >
          <AppText
            color={cancelDisabled ? "muted" : "primary"}
            maxFontSizeMultiplier={HEADER_MAX_FONT_SCALE}
            numberOfLines={1}
            variant="feedBody"
          >
            {cancelLabel}
          </AppText>
        </Pressable>
      </View>

      <AppText
        accessibilityRole="header"
        align="center"
        maxFontSizeMultiplier={HEADER_MAX_FONT_SCALE}
        numberOfLines={1}
        style={styles.title}
        variant="titleMd"
      >
        {title}
      </AppText>

      <View style={[styles.side, styles.sideEnd]}>
        <Pressable
          accessibilityLabel={ctaLabel}
          accessibilityRole="button"
          accessibilityState={{ busy: isLoading, disabled: !isEnabled }}
          disabled={!isEnabled}
          onPress={onSubmit}
          style={({ pressed }) => [styles.action, styles.actionEnd, pressed ? styles.pressed : null]}
          testID="composer-header-cta"
        >
          {isLoading ? (
            <ActivityIndicator color={colors.accent} size="small" />
          ) : (
            <AppText
              color={isEnabled ? "accent" : "muted"}
              maxFontSizeMultiplier={HEADER_MAX_FONT_SCALE}
              numberOfLines={1}
              variant="titleMd"
            >
              {ctaLabel}
            </AppText>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    justifyContent: "center",
    minHeight: 44,
    minWidth: 44,
  },
  actionEnd: {
    alignItems: "flex-end",
  },
  container: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing[8],
    minHeight: 52,
    paddingHorizontal: spacing[16],
  },
  pressed: {
    opacity: 0.6,
  },
  side: {
    alignItems: "flex-start",
    flex: 1,
    justifyContent: "center",
  },
  sideEnd: {
    alignItems: "flex-end",
  },
  title: {
    flexShrink: 1,
  },
});
