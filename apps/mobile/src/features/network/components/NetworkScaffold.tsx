import { type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, sizes, spacing } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";

type Props = {
  children: ReactNode;
  /** Errore della mutazione, sopra la CTA e mai al posto del form (§28). */
  errorMessage?: string | null;
  onBack: () => void;
  onPrimary?: () => void;
  /** Link testuale sotto la CTA: "Rifiuta", "Mantieni collegamento" (§3). */
  onSecondary?: () => void;
  primaryDisabled?: boolean;
  primaryLabel?: string;
  primaryLoading?: boolean;
  secondaryLabel?: string;
  testID?: string;
  title: string;
};

/**
 * Shell dei flussi focalizzati della Rete societaria (screen 03, 04, 05, 06).
 *
 * §4: «Search, form di richiesta e revisione del consenso sono flussi
 * focalizzati senza bottom navigation.» Qui non c'è campanella, launcher o
 * selector di identità: back, titolo e una sola CTA sticky.
 *
 * La CTA è `primary` — fondo blu PROLINK, testo bianco — perché §3 lo chiede
 * espressamente e corregge su questo punto la versione 1.0 della task: «Il
 * vincolo sul nero riguarda la tipografia generale e non converte i pulsanti
 * primari in pulsanti neri o outlined». È lo stesso componente e lo stesso
 * token dell'onboarding, non una tonalità Dashboard nuova.
 *
 * Il resto della tipografia è invece nero neutro `#111111` e i metadati
 * grigi neutri, come §3 prescrive: per questo non riusa `SeasonsScaffold`
 * (CTA outlined nera, DAS-REV-10) né `ProfileEditScaffold` (testo navy).
 */
export function NetworkScaffold({
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
          testID="network-back"
        >
          <Ionicons color={colors.textNeutral} name="arrow-back" size={22} />
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
            label={primaryLabel ?? "Continua"}
            loading={primaryLoading}
            onPress={onPrimary}
            size="lg"
            testID="network-primary-cta"
            variant="primary"
          />

          {onSecondary && secondaryLabel ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={onSecondary}
              style={styles.secondary}
              testID="network-secondary-action"
            >
              {/* §3: azione secondaria = link testuale blu, senza riempimento. */}
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
