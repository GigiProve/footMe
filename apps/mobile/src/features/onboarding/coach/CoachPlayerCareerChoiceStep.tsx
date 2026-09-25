import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { InlineError, OnboardingPage, RoleCard } from "../ui";
import { onboardingSpacing } from "../ui/onboarding-tokens";

type CoachPlayerCareerChoiceStepProps = {
  currentStep: number;
  /**
   * `true` solo quando l'utente ha già dichiarato di aver giocato. Un `false`
   * non distingue "ho risposto no" da "non ho ancora risposto": per questo la
   * schermata parte senza nessuna card selezionata.
   */
  hasPlayedFootball: boolean;
  isBusy: boolean;
  onBack: () => void;
  onChange: (value: boolean) => void;
  onContinue: () => void;
  stepLabel: string;
  totalSteps: number;
};

/**
 * Step "Esperienze da giocatore" dell'Allenatore (REV-ONB-03 §AE–§AG).
 *
 * È un bivio del flusso, non un'impostazione: perciò due card di scelta e non
 * un toggle (§AF). Rispondere "No" porta direttamente a Filosofia e stile di
 * gioco, senza schermate intermedie vuote (§AG).
 */
export function CoachPlayerCareerChoiceStep({
  currentStep,
  hasPlayedFootball,
  isBusy,
  onBack,
  onChange,
  onContinue,
  stepLabel,
  totalSteps,
}: CoachPlayerCareerChoiceStepProps) {
  const [choice, setChoice] = useState<boolean | null>(
    hasPlayedFootball ? true : null,
  );
  const [showError, setShowError] = useState(false);

  function handleSelect(value: boolean) {
    setChoice(value);
    setShowError(false);
    onChange(value);
  }

  function handleContinue() {
    // Errore solo dopo un tentativo: la schermata non si apre già in colpa.
    if (choice === null) {
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
        primaryTestID: "coach-player-career-choice-continue",
      }}
      onBack={onBack}
      stepLabel={stepLabel}
      subtitle="Hai avuto esperienze come calciatore?"
      testID="coach-player-career-choice-step"
      title="Esperienze da giocatore"
      totalSteps={totalSteps}
    >
      <View style={styles.options}>
        <RoleCard
          description="Le aggiungi subito, con lo stesso sistema del profilo Calciatore."
          icon="football-outline"
          label="Sì, aggiungi la mia carriera da giocatore"
          onPress={() => handleSelect(true)}
          selected={choice === true}
          testID="coach-player-career-yes"
        />

        <RoleCard
          description="Prosegui verso la tua filosofia e il tuo stile di gioco."
          icon="walk-outline"
          label="No, continua"
          onPress={() => handleSelect(false)}
          selected={choice === false}
          testID="coach-player-career-no"
        />
      </View>

      {showError && choice === null ? (
        <InlineError message="Scegli una delle due opzioni per continuare." />
      ) : null}
    </OnboardingPage>
  );
}

const styles = StyleSheet.create({
  options: {
    gap: onboardingSpacing.s + 4,
    marginBottom: onboardingSpacing.m,
  },
});
