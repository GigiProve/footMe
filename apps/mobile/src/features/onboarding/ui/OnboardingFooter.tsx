import { StyleSheet, View } from "react-native";

import { colors, typography } from "../../../styles";
import { Button } from "../../../ui";
import { onboardingLayout, onboardingSpacing } from "./onboarding-tokens";

type OnboardingFooterProps = {
  primaryLabel: string;
  onPrimaryPress: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  primaryTestID?: string;
  /**
   * Azione secondaria, sempre meno pesante della primaria (§Q). Non usarla
   * per duplicare il back dell'header.
   */
  secondaryLabel?: string;
  onSecondaryPress?: () => void;
  /**
   * Skip: disponibile solo quando il flusso specifico dichiara lo step
   * facoltativo (§R). Il Master fornisce lo stile, non il permesso.
   */
  skipLabel?: string;
  onSkipPress?: () => void;
  /** Padding aggiuntivo per la safe area inferiore. */
  bottomInset?: number;
};

/**
 * Footer azioni dell'onboarding: una sola CTA primaria, hairline in alto,
 * stessa posizione su ogni schermata di ogni ruolo (§P, §AF).
 */
export function OnboardingFooter({
  bottomInset = 0,
  onPrimaryPress,
  onSecondaryPress,
  onSkipPress,
  primaryDisabled = false,
  primaryLabel,
  primaryLoading = false,
  primaryTestID,
  secondaryLabel,
  skipLabel,
}: OnboardingFooterProps) {
  return (
    <View
      style={[
        styles.container,
        { paddingBottom: onboardingSpacing.m + bottomInset },
      ]}
    >
      <Button
        disabled={primaryDisabled}
        fullWidth
        label={primaryLabel}
        loading={primaryLoading}
        onPress={onPrimaryPress}
        size="lg"
        style={styles.primary}
        testID={primaryTestID}
        textStyle={styles.primaryLabel}
        variant="primary"
      />

      {secondaryLabel && onSecondaryPress ? (
        <Button
          fullWidth
          label={secondaryLabel}
          onPress={onSecondaryPress}
          size="md"
          variant="secondary"
        />
      ) : null}

      {skipLabel && onSkipPress ? (
        <Button
          label={skipLabel}
          onPress={onSkipPress}
          size="sm"
          style={styles.skip}
          variant="link"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: onboardingSpacing.s,
    paddingHorizontal: onboardingLayout.pagePaddingHorizontal,
    paddingTop: onboardingSpacing.m,
  },
  primary: {
    minHeight: onboardingLayout.ctaHeight,
  },
  primaryLabel: {
    fontSize: typography.fontSize[15],
  },
  skip: {
    alignSelf: "center",
  },
});
