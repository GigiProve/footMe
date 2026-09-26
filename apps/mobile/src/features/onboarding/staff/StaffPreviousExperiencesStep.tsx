import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors } from "../../../styles";
import { AppText } from "../../../ui";
import { InlineError, OnboardingPage, SelectionRow } from "../ui";
import { onboardingSpacing } from "../ui/onboarding-tokens";
import {
  toggleStaffPreviousExperience,
  type StaffPreviousExperience,
} from "./staff-previous-experiences";

type StaffPreviousExperiencesStepProps = {
  currentStep: number;
  isBusy: boolean;
  onBack: () => void;
  onChange: (selection: StaffPreviousExperience[]) => void;
  onContinue: () => void;
  selection: StaffPreviousExperience[];
  stepLabel: string;
  totalSteps: number;
};

const OPTIONS: {
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: StaffPreviousExperience;
}[] = [
  {
    description: "Aggiungi la tua carriera da allenatore.",
    icon: "clipboard-outline",
    label: "Esperienza da allenatore",
    value: "coach",
  },
  {
    description: "Aggiungi la tua carriera da calciatore.",
    icon: "football-outline",
    label: "Esperienza da calciatore",
    value: "player",
  },
  {
    description: "Non hai ricoperto altri ruoli nel calcio.",
    icon: "remove-circle-outline",
    label: "Nessuna esperienza aggiuntiva",
    value: "none",
  },
];

/**
 * Passo "Esperienze precedenti" dello Staff tecnico (REV-ONB-04 §AE–§AG).
 *
 * È una selezione multipla e deve leggersi come tale: righe con checkbox, mai
 * card a scelta singola. Allenatore e Calciatore possono convivere; "Nessuna
 * esperienza aggiuntiva" è esclusiva e si annulla a vicenda con le altre due.
 */
export function StaffPreviousExperiencesStep({
  currentStep,
  isBusy,
  onBack,
  onChange,
  onContinue,
  selection,
  stepLabel,
  totalSteps,
}: StaffPreviousExperiencesStepProps) {
  const [showError, setShowError] = useState(false);

  function handleToggle(option: StaffPreviousExperience) {
    setShowError(false);
    onChange(toggleStaffPreviousExperience(selection, option));
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
        primaryTestID: "staff-previous-experiences-continue",
      }}
      onBack={onBack}
      stepLabel={stepLabel}
      subtitle="Hai maturato altre esperienze nel calcio? Puoi selezionarne più di una."
      testID="staff-previous-experiences-step"
      title="Esperienze precedenti"
      totalSteps={totalSteps}
    >
      {/* §AF, §AW: che la scelta sia multipla deve vedersi e sentirsi, non
          dedursi dalla forma del controllo. */}
      <AppText color="secondary" style={styles.hint} variant="meta">
        Selezione multipla: puoi scegliere sia allenatore sia calciatore.
      </AppText>

      <View style={styles.options}>
        {OPTIONS.map((option) => (
          <SelectionRow
            control="checkbox"
            description={option.description}
            key={option.value}
            label={option.label}
            leading={
              <Ionicons
                color={
                  selection.includes(option.value)
                    ? colors.accent
                    : colors.textSecondary
                }
                name={option.icon}
                size={20}
              />
            }
            onPress={() => handleToggle(option.value)}
            selected={selection.includes(option.value)}
            testID={`staff-previous-experience-${option.value}`}
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
    gap: onboardingSpacing.s + 4,
    marginBottom: onboardingSpacing.m,
  },
});
