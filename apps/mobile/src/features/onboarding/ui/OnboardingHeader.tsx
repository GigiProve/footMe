import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors } from "../../../styles";
import { AppText } from "../../../ui";
import { OnboardingProgress } from "./OnboardingProgress";
import { onboardingLayout, onboardingRadius } from "./onboarding-tokens";

type OnboardingHeaderProps = {
  /** Etichetta breve dello step: "Dati", "Foto", "Carriera". */
  stepLabel?: string;
  /** Passo corrente a base 1. Omesso insieme a `totalSteps` per nascondere il progress. */
  currentStep?: number;
  totalSteps?: number;
  onBack?: () => void;
};

/**
 * Header comune a tutti gli onboarding (§F): back, nome breve dello step,
 * contatore "2 di 6" e progress bar. Nessun ruolo ne usa una versione propria.
 */
export function OnboardingHeader({
  currentStep,
  onBack,
  stepLabel,
  totalSteps,
}: OnboardingHeaderProps) {
  const showProgress =
    typeof currentStep === "number" && typeof totalSteps === "number";

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {onBack ? (
          <Pressable
            accessibilityLabel="Torna indietro"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onBack}
            style={({ pressed }) => [
              styles.backButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Ionicons color={colors.textPrimary} name="arrow-back" size={22} />
          </Pressable>
        ) : (
          <View style={styles.backPlaceholder} />
        )}

        {stepLabel ? (
          <AppText color="secondary" numberOfLines={1} style={styles.stepLabel} variant="metaStrong">
            {stepLabel}
          </AppText>
        ) : (
          <View style={styles.stepLabel} />
        )}

        {showProgress ? (
          <AppText color="muted" variant="metaStrong">
            {currentStep} di {totalSteps}
          </AppText>
        ) : null}
      </View>

      {showProgress ? (
        <OnboardingProgress current={currentStep} total={totalSteps} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: onboardingLayout.labelGap,
    paddingBottom: onboardingLayout.labelGap,
    paddingHorizontal: onboardingLayout.pagePaddingHorizontal,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: onboardingLayout.labelGap,
    minHeight: onboardingLayout.headerHeight,
  },
  backButton: {
    alignItems: "center",
    borderRadius: onboardingRadius.pill,
    height: onboardingLayout.headerIconButton,
    justifyContent: "center",
    marginLeft: -onboardingLayout.labelGap,
    width: onboardingLayout.headerIconButton,
  },
  backPlaceholder: {
    height: onboardingLayout.headerIconButton,
    width: 0,
  },
  pressed: {
    opacity: 0.6,
  },
  stepLabel: {
    flex: 1,
  },
});
