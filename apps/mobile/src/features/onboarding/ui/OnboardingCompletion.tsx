import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors } from "../../../styles";
import { AppText, Button } from "../../../ui";
import { onboardingLayout, onboardingRadius, onboardingSpacing } from "./onboarding-tokens";

type OnboardingCompletionProps = {
  title?: string;
  /** Copy contestuale al ruolo: una o due righe. */
  description?: string;
  primaryLabel: string;
  onPrimaryPress: () => void;
  primaryLoading?: boolean;
  /** Azione facoltativa, sempre più leggera della primaria. */
  secondaryLabel?: string;
  onSecondaryPress?: () => void;
  testID?: string;
};

/**
 * Schermata di chiusura dell'onboarding (§AI). Una sola CTA primaria: la
 * destinazione la decide il flusso del singolo ruolo.
 */
export function OnboardingCompletion({
  description,
  onPrimaryPress,
  onSecondaryPress,
  primaryLabel,
  primaryLoading = false,
  secondaryLabel,
  testID,
  title = "Il tuo profilo è pronto",
}: OnboardingCompletionProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.screen,
        { paddingBottom: onboardingSpacing.l + insets.bottom, paddingTop: insets.top },
      ]}
      testID={testID}
    >
      <View style={styles.body}>
        <View style={styles.iconShell}>
          <Ionicons color={colors.success} name="checkmark" size={38} />
        </View>

        <AppText align="center" variant="screenTitle">
          {title}
        </AppText>

        {description ? (
          <AppText align="center" color="secondary" variant="bodyLg">
            {description}
          </AppText>
        ) : null}
      </View>

      <View style={styles.actions}>
        <Button
          fullWidth
          label={primaryLabel}
          loading={primaryLoading}
          onPress={onPrimaryPress}
          size="lg"
          style={styles.primary}
          variant="primary"
        />
        {secondaryLabel && onSecondaryPress ? (
          <Button
            label={secondaryLabel}
            onPress={onSecondaryPress}
            size="sm"
            style={styles.secondary}
            variant="link"
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.surface,
    flex: 1,
    paddingHorizontal: onboardingLayout.pagePaddingHorizontal,
  },
  body: {
    alignItems: "center",
    flex: 1,
    gap: onboardingSpacing.m - 4,
    justifyContent: "center",
  },
  iconShell: {
    alignItems: "center",
    backgroundColor: colors.successSoft,
    borderRadius: onboardingRadius.pill,
    height: 84,
    justifyContent: "center",
    marginBottom: onboardingSpacing.s,
    width: 84,
  },
  actions: {
    gap: onboardingSpacing.s,
  },
  primary: {
    minHeight: onboardingLayout.ctaHeight,
  },
  secondary: {
    alignSelf: "center",
  },
});
