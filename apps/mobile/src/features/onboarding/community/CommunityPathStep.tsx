import { StyleSheet, View } from "react-native";

import { InlineError, OnboardingPage, RoleCard } from "../ui";
import { onboardingSpacing } from "../ui/onboarding-tokens";
import { COMMUNITY_PATH_OPTIONS, type CommunityPath } from "./fan-taxonomy";

type CommunityPathStepProps = {
  currentStep: number;
  errorMessage?: string;
  isBusy: boolean;
  onBack?: () => void;
  onContinue: () => void;
  onSelect: (value: CommunityPath) => void;
  selectedValue: CommunityPath | "";
  stepLabel: string;
  totalSteps: number;
};

/**
 * Secondo livello di "Media e tifosi" (REV-ONB-08 §E–§G, REV-ONB-09 §6).
 *
 * La macro-scelta del Master resta una sola voce; qui si separa chi il calcio
 * lo segue da chi lo racconta. Scelta singola, card del Master, un solo check:
 * nessun toggle, nessuna checkbox multipla. La CTA resta attiva e l'errore
 * compare inline, come nella scelta del ruolo: è il comportamento comune del
 * Master, non una variante di questa schermata.
 */
export function CommunityPathStep({
  currentStep,
  errorMessage,
  isBusy,
  onBack,
  onContinue,
  onSelect,
  selectedValue,
  stepLabel,
  totalSteps,
}: CommunityPathStepProps) {
  return (
    <OnboardingPage
      currentStep={currentStep}
      footer={{
        onPrimaryPress: onContinue,
        primaryLabel: "Continua",
        primaryLoading: isBusy,
        primaryTestID: "community-path-continue",
      }}
      onBack={onBack}
      stepLabel={stepLabel}
      subtitle="Scegli il profilo che descrive meglio il tuo utilizzo della piattaforma."
      testID="community-path-step"
      title="Come vuoi usare ProLink?"
      totalSteps={totalSteps}
    >
      <View accessibilityRole="radiogroup" style={styles.options}>
        {COMMUNITY_PATH_OPTIONS.map((option) => (
          <RoleCard
            description={option.description}
            icon={option.icon}
            key={option.value}
            label={option.label}
            onPress={() => onSelect(option.value)}
            selected={selectedValue === option.value}
            testID={`community-path-${option.value}`}
          />
        ))}
      </View>

      <InlineError message={errorMessage} />
    </OnboardingPage>
  );
}

const styles = StyleSheet.create({
  options: {
    gap: onboardingSpacing.s + 4,
    paddingBottom: onboardingSpacing.s,
  },
});
