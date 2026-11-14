/**
 * Header a schermo intero dell'editor Articolo (HOM-06.2 §28–§29, §72, §218, §7A,
 * §7F, §7O, mockup 2–4): «Annulla | titolo | azione», con la freccia al posto di
 * «Annulla» nell'Anteprima. Nessuna chrome Home (§29): le route stanno fuori dalle
 * tab.
 *
 * Stessa misura e stessa resa di `ComposerHeader` (HOM-06.1), che però ha sempre
 * una CTA a destra: qui «Incolla un articolo» e il selector non ne hanno. L'azione
 * di destra è testo accent, non un bottone pieno (la CTA primaria sta nel footer).
 */

import Ionicons from "@expo/vector-icons/Ionicons";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { colors, spacing } from "../../../styles";
import { AppText } from "../../../ui";
import { HEADER_MAX_FONT_SCALE } from "../../post-composer/components/ComposerHeader";

export type ArticleHeaderAction = {
  label: string;
  state: "enabled" | "disabled" | "loading";
  onPress: () => void;
  testID?: string;
};

type Props = {
  title: string;
  onLeft: () => void;
  /** Default «Annulla». */
  leftLabel?: string;
  /** `back` disegna la freccia (Anteprima). */
  leftIcon?: "back";
  leftDisabled?: boolean;
  right?: ArticleHeaderAction;
};

export function ArticleHeader({ title, onLeft, leftLabel = "Annulla", leftIcon, leftDisabled = false, right }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.side}>
        <Pressable
          accessibilityLabel={leftIcon === "back" ? "Indietro" : leftLabel}
          accessibilityRole="button"
          accessibilityState={{ disabled: leftDisabled }}
          disabled={leftDisabled}
          onPress={onLeft}
          style={({ pressed }) => [styles.action, pressed ? styles.pressed : null]}
          testID="article-header-left"
        >
          {leftIcon === "back" ? (
            <Ionicons color={colors.textPrimary} name="arrow-back" size={24} />
          ) : (
            <AppText
              color={leftDisabled ? "muted" : "primary"}
              maxFontSizeMultiplier={HEADER_MAX_FONT_SCALE}
              numberOfLines={1}
              variant="feedBody"
            >
              {leftLabel}
            </AppText>
          )}
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
        {right ? (
          <Pressable
            accessibilityLabel={right.label}
            accessibilityRole="button"
            accessibilityState={{ busy: right.state === "loading", disabled: right.state !== "enabled" }}
            disabled={right.state !== "enabled"}
            onPress={right.onPress}
            style={({ pressed }) => [styles.action, styles.actionEnd, pressed ? styles.pressed : null]}
            testID={right.testID ?? "article-header-right"}
          >
            {right.state === "loading" ? (
              <ActivityIndicator color={colors.accent} size="small" />
            ) : (
              <AppText
                color={right.state === "enabled" ? "accent" : "muted"}
                maxFontSizeMultiplier={HEADER_MAX_FONT_SCALE}
                numberOfLines={1}
                variant="titleMd"
              >
                {right.label}
              </AppText>
            )}
          </Pressable>
        ) : null}
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
