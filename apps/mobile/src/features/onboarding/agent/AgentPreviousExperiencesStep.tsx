import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { AppText } from "../../../ui";
import { InlineError, OnboardingPage, SelectionRow } from "../ui";
import { onboardingLayout, onboardingSpacing } from "../ui/onboarding-tokens";
import {
  AGENT_PREVIOUS_ROLE_OPTIONS,
  toggleAgentPreviousRole,
  type AgentPreviousRole,
} from "./agent-previous-roles";

type AgentPreviousExperiencesStepProps = {
  currentStep: number;
  isBusy: boolean;
  onBack: () => void;
  onChange: (selection: AgentPreviousRole[]) => void;
  onContinue: () => void;
  selection: AgentPreviousRole[];
  stepLabel: string;
  totalSteps: number;
};

/**
 * "Esperienze precedenti nel calcio" (REV-ONB-06 §AI–§AL).
 *
 * Nessun toggle che rivela una lista: le esperienze sono una selezione
 * multipla diretta (§AI). Che si possa scegliere più di un ruolo lo dice una
 * microcopy, non solo la forma del controllo (§AL).
 */
export function AgentPreviousExperiencesStep({
  currentStep,
  isBusy,
  onBack,
  onChange,
  onContinue,
  selection,
  stepLabel,
  totalSteps,
}: AgentPreviousExperiencesStepProps) {
  const [showError, setShowError] = useState(false);

  function handleToggle(option: AgentPreviousRole) {
    setShowError(false);
    onChange(toggleAgentPreviousRole(selection, option));
  }

  function handleContinue() {
    // Errore solo dopo un tentativo: la schermata non si apre già in colpa.
    if (selection.length === 0) {
      setShowError(true);
      return;
    }

    onContinue();
  }

  return (
    <OnboardingPage
      currentStep={currentStep}
      footer={{
        onPrimaryPress: handleContinue,
        primaryLabel: "Continua",
        primaryLoading: isBusy,
        primaryTestID: "agent-previous-experiences-continue",
      }}
      onBack={onBack}
      stepLabel={stepLabel}
      subtitle="Se hai ricoperto altri ruoli nel calcio, puoi indicarli per completare il profilo."
      testID="agent-previous-experiences-step"
      title="Esperienze precedenti nel calcio"
      totalSteps={totalSteps}
    >
      <AppText color="secondary" style={styles.hint} variant="meta">
        Puoi scegliere più opzioni.
      </AppText>

      <View style={styles.options}>
        {AGENT_PREVIOUS_ROLE_OPTIONS.map((option) => (
          <SelectionRow
            control="checkbox"
            description={option.description}
            key={option.value}
            label={option.label}
            onPress={() => handleToggle(option.value)}
            selected={selection.includes(option.value)}
            testID={`agent-previous-role-${option.value}`}
          />
        ))}
      </View>

      {showError ? (
        <InlineError message="Seleziona almeno un'opzione per continuare." />
      ) : null}
    </OnboardingPage>
  );
}

const styles = StyleSheet.create({
  hint: {
    marginBottom: onboardingSpacing.s,
  },
  options: {
    gap: onboardingLayout.labelGap + 2,
    marginBottom: onboardingSpacing.m,
  },
});
