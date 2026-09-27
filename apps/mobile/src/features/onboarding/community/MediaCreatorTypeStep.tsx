import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors } from "../../../styles";
import {
  InlineError,
  OnboardingPage,
  OnboardingTextField,
  SelectionRow,
} from "../ui";
import { onboardingSpacing } from "../ui/onboarding-tokens";
import {
  MEDIA_CREATOR_TYPE_OPTIONS,
  type MediaCreatorType,
} from "./media-taxonomy";

type MediaCreatorTypeStepProps = {
  currentStep: number;
  errorMessage?: string;
  isBusy: boolean;
  onBack: () => void;
  onContinue: () => void;
  onOtherLabelChange: (value: string) => void;
  onSelect: (value: MediaCreatorType) => void;
  otherErrorMessage?: string;
  otherLabel: string;
  selectedValue: MediaCreatorType | "";
  stepLabel: string;
  totalSteps: number;
};

/**
 * "Che tipo di realtà rappresenti?" (REV-ONB-09 §11–§14).
 *
 * Scelta singola su sei categorie: è il dato che dice al resto del prodotto
 * se davanti c'è una testata registrata o una persona con il proprio nome.
 * "Altro" apre il campo libero subito sotto le card; scegliendo un'altra
 * categoria il campo sparisce e il suo valore non viene più usato (§14).
 */
export function MediaCreatorTypeStep({
  currentStep,
  errorMessage,
  isBusy,
  onBack,
  onContinue,
  onOtherLabelChange,
  onSelect,
  otherErrorMessage,
  otherLabel,
  selectedValue,
  stepLabel,
  totalSteps,
}: MediaCreatorTypeStepProps) {
  return (
    <OnboardingPage
      currentStep={currentStep}
      footer={{
        onPrimaryPress: onContinue,
        primaryLabel: "Continua",
        primaryLoading: isBusy,
        primaryTestID: "media-creator-type-continue",
      }}
      onBack={onBack}
      stepLabel={stepLabel}
      subtitle="Scegli la tipologia che descrive meglio il tuo progetto o la tua presenza online nel calcio."
      testID="media-creator-type-step"
      title="Che tipo di realtà rappresenti?"
      totalSteps={totalSteps}
    >
      <View accessibilityRole="radiogroup" style={styles.options}>
        {MEDIA_CREATOR_TYPE_OPTIONS.map((option) => {
          const selected = selectedValue === option.value;

          return (
            <SelectionRow
              control="radio"
              description={option.description}
              key={option.value}
              label={option.label}
              leading={
                <Ionicons
                  color={selected ? colors.accent : colors.textSecondary}
                  name={option.icon}
                  size={18}
                />
              }
              onPress={() => onSelect(option.value)}
              selected={selected}
              testID={`media-creator-type-${option.value}`}
            />
          );
        })}
      </View>

      {selectedValue === "other" ? (
        <View style={styles.otherField}>
          <OnboardingTextField
            autoCapitalize="sentences"
            errorMessage={otherErrorMessage}
            label="Specifica tipologia"
            maxLength={60}
            onChangeText={onOtherLabelChange}
            placeholder="Es. Collettivo di tifosi"
            testID="media-creator-type-other-label"
            value={otherLabel}
          />
        </View>
      ) : null}

      <InlineError message={errorMessage} />
    </OnboardingPage>
  );
}

const styles = StyleSheet.create({
  options: {
    gap: onboardingSpacing.s + 4,
  },
  otherField: {
    paddingTop: onboardingSpacing.m,
  },
});
