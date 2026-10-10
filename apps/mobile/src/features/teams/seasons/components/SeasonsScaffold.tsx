import { type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, sizes, spacing } from "../../../../theme/tokens";
import { AppText, Button } from "../../../../ui";

type Props = {
  children: ReactNode;
  /** Errore della mutazione, sopra la CTA e mai al posto del form (§33). */
  errorMessage?: string | null;
  onBack: () => void;
  onPrimary?: () => void;
  /** Azione testuale sotto la CTA: "Annulla" dello screen 04. */
  onSecondary?: () => void;
  primaryDisabled?: boolean;
  primaryLabel?: string;
  primaryLoading?: boolean;
  secondaryLabel?: string;
  testID?: string;
  title: string;
};

/**
 * Shell dei flussi focalizzati (screen 03, 04, 05, 06, 07, 10).
 *
 * §9: «Gli screen 03, 04, 05, 06, 07 e 10 sono flussi focalizzati senza
 * bottom navigation.» Qui non c'è nemmeno una campanella, un launcher o un
 * selector identità: solo il back, il titolo e una sola CTA sticky.
 *
 * Non riusa `ProfileEditScaffold` per una ragione sola, ma sufficiente: il
 * vincolo cromatico di §4. Quello scaffold disegna chevron e titolo in
 * `textPrimary` (#0C1B2A) e la CTA in blu pieno, e cambiarlo avrebbe
 * ricolorato i venti editor di profilo già rilasciati — che §4 vieta
 * («Non ricolorare indiscriminatamente altre aree dell'app»).
 *
 * La CTA è `neutralOutline`: fondo bianco, bordo scuro, testo nero, come §4
 * e §12 descrivono. Nel PNG è blu piena; la precedenza di §2 mette il
 * vincolo cromatico esplicito della task sopra il colore della tavola.
 */
export function SeasonsScaffold({
  children,
  errorMessage,
  onBack,
  onPrimary,
  onSecondary,
  primaryDisabled = false,
  primaryLabel,
  primaryLoading = false,
  secondaryLabel,
  testID,
  title,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID={testID}>
      <View style={styles.navBar}>
        <Pressable
          accessibilityLabel="Indietro"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, pressed ? styles.pressed : null]}
          testID="seasons-back"
        >
          <Ionicons color={colors.textNeutral} name="chevron-back" size={24} />
        </Pressable>

        <AppText
          color="neutral"
          numberOfLines={1}
          style={styles.navTitle}
          variant="titleMd"
        >
          {title}
        </AppText>

        <View style={styles.backButton} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          !onPrimary ? { paddingBottom: spacing[24] + insets.bottom } : null,
        ]}
        keyboardShouldPersistTaps="handled"
        style={styles.scroll}
      >
        {children}
      </ScrollView>

      {onPrimary ? (
        <View style={[styles.footer, { paddingBottom: spacing[16] + insets.bottom }]}>
          {errorMessage ? (
            <AppText
              accessibilityRole="alert"
              color="danger"
              style={styles.error}
              variant="bodySm"
            >
              {errorMessage}
            </AppText>
          ) : null}

          <Button
            disabled={primaryDisabled}
            fullWidth
            label={primaryLabel ?? "Salva"}
            loading={primaryLoading}
            onPress={onPrimary}
            testID="seasons-primary-cta"
            variant="neutralOutline"
          />

          {onSecondary && secondaryLabel ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={onSecondary}
              style={styles.secondary}
              testID="seasons-secondary-action"
            >
              {/* "Annulla" del master 04: link funzionale, non una seconda
                  CTA. §4 ne conserva l'accento. */}
              <AppText color="accent" variant="actionLabel">
                {secondaryLabel}
              </AppText>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  navBar: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[12],
  },
  backButton: {
    alignItems: "center",
    height: sizes.touchTarget,
    justifyContent: "center",
    width: sizes.touchTarget,
  },
  navTitle: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    gap: spacing[20],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[8],
    paddingBottom: spacing[24],
  },
  footer: {
    backgroundColor: colors.surface,
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: 1,
    gap: spacing[10],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[16],
  },
  error: {
    textAlign: "center",
  },
  secondary: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: sizes.touchTarget,
  },
  pressed: {
    opacity: 0.7,
  },
});
