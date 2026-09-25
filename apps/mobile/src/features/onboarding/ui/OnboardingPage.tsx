import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KeyboardAwareForm } from "../../../components/ui/keyboard-aware-form";
import { colors } from "../../../styles";
import { AppText } from "../../../ui";
import { OnboardingFooter } from "./OnboardingFooter";
import { OnboardingHeader } from "./OnboardingHeader";
import { onboardingLayout } from "./onboarding-tokens";

type OnboardingPageFooter = {
  primaryLabel: string;
  onPrimaryPress: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  primaryTestID?: string;
  secondaryLabel?: string;
  onSecondaryPress?: () => void;
  skipLabel?: string;
  onSkipPress?: () => void;
};

type OnboardingPageProps = {
  children: ReactNode;
  /** Titolo della pagina: descrittivo, più esteso dell'etichetta di step. */
  title?: string;
  /** Una o due righe che spiegano perché lo step esiste. Omettere se ovvio. */
  subtitle?: string;
  /** Etichetta breve mostrata nell'header: "Dati", "Foto", "Carriera". */
  stepLabel?: string;
  currentStep?: number;
  totalSteps?: number;
  onBack?: () => void;
  /** Footer sticky con la CTA primaria. Omesso, la pagina non mostra footer. */
  footer?: OnboardingPageFooter;
  /**
   * `false` quando il contenuto scorre da sé — una lista lunga che deve
   * restare virtualizzata. In quel caso il figlio riceve l'area piena e si
   * occupa del proprio scroll; il resto della pagina non cambia.
   */
  scrollable?: boolean;
  testID?: string;
};

/**
 * Struttura standard di uno step di onboarding (§E): safe area, header,
 * progress, titolo, copy, contenuto scrollabile, footer azioni sticky.
 *
 * Ogni ruolo usa questa pagina. Nessun flusso costruisce la propria.
 */
export function OnboardingPage({
  children,
  currentStep,
  footer,
  onBack,
  scrollable = true,
  stepLabel,
  subtitle,
  testID,
  title,
  totalSteps,
}: OnboardingPageProps) {
  const insets = useSafeAreaInsets();

  const heading = title ? (
    <View style={styles.titleGroup}>
      <AppText variant="screenTitle">{title}</AppText>
      {subtitle ? (
        <AppText color="secondary" variant="bodyLg">
          {subtitle}
        </AppText>
      ) : null}
    </View>
  ) : null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID={testID}>
      <OnboardingHeader
        currentStep={currentStep}
        onBack={onBack}
        stepLabel={stepLabel}
        totalSteps={totalSteps}
      />

      {scrollable ? (
        <KeyboardAwareForm contentContainerStyle={styles.content}>
          {heading}
          {children}
        </KeyboardAwareForm>
      ) : (
        <View style={styles.staticContent}>
          {heading}
          {children}
        </View>
      )}

      {footer ? (
        <OnboardingFooter {...footer} bottomInset={insets.bottom} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  content: {
    paddingBottom: onboardingLayout.pagePaddingBottom,
    paddingHorizontal: onboardingLayout.pagePaddingHorizontal,
    paddingTop: onboardingLayout.pagePaddingTop,
  },
  staticContent: {
    flex: 1,
    paddingHorizontal: onboardingLayout.pagePaddingHorizontal,
    paddingTop: onboardingLayout.pagePaddingTop,
  },
  titleGroup: {
    gap: onboardingLayout.titleGap,
    paddingBottom: onboardingLayout.headerContentGap,
  },
});
