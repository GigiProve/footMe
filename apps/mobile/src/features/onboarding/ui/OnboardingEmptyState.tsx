import { StyleSheet, View } from "react-native";

import { colors } from "../../../styles";
import { AppText, Button } from "../../../ui";
import {
  onboardingBorderWidth,
  onboardingRadius,
  onboardingSpacing,
} from "./onboarding-tokens";

type OnboardingEmptyStateProps = {
  title: string;
  /** Una riga che dice cosa aggiungere, non perché la lista è vuota. */
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
};

/**
 * Stato vuoto dell'onboarding (§AA): testo breve e una sola azione.
 * Nessuna illustrazione generica, nessuna card informativa gigante.
 */
export function OnboardingEmptyState({
  actionLabel,
  description,
  onAction,
  testID,
  title,
}: OnboardingEmptyStateProps) {
  return (
    <View style={styles.container} testID={testID}>
      <AppText align="center" variant="titleSm">
        {title}
      </AppText>
      {description ? (
        <AppText align="center" color="secondary" variant="meta">
          {description}
        </AppText>
      ) : null}
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          size="md"
          style={styles.action}
          variant="secondary"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: onboardingRadius.card,
    borderStyle: "dashed",
    borderWidth: onboardingBorderWidth.hairline,
    gap: onboardingSpacing.s,
    paddingHorizontal: onboardingSpacing.m,
    paddingVertical: onboardingSpacing.l,
  },
  action: {
    marginTop: onboardingSpacing.xs,
  },
});
