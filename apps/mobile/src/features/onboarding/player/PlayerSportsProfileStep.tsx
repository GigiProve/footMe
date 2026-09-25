import { StyleSheet, View } from "react-native";

import { AppText } from "../../../ui";
import {
  PREFERRED_FOOT_OPTIONS,
  type PlayerPosition,
  type PreferredFoot,
} from "../../profiles/player-sports";
import {
  FieldShell,
  OnboardingPage,
  OnboardingSection,
  OnboardingSelectField,
  SegmentedSelector,
  ToggleRow,
} from "../ui";
import { onboardingSpacing } from "../ui/onboarding-tokens";
import { FootballPitchRoleSelector } from "./FootballPitchRoleSelector";
import { PlayerMeasureField } from "./PlayerMeasureField";
import { getSecondaryPositionOptions } from "./player-pitch-positions";

type PlayerSportsProfileStepProps = {
  currentStep: number;
  heightCm: string;
  isBusy: boolean;
  onBack: () => void;
  onContinue: () => void;
  onHeightChange: (value: string) => void;
  onPreferredFootChange: (value: PreferredFoot) => void;
  onPrimaryPositionChange: (value: PlayerPosition) => void;
  onSecondaryPositionChange: (value: PlayerPosition | "") => void;
  onShowPhysicalFieldsChange: (value: boolean) => void;
  onWeightChange: (value: string) => void;
  preferredFoot: PreferredFoot | "";
  primaryPosition: PlayerPosition | "";
  primaryPositionError?: string;
  secondaryPosition: PlayerPosition | "";
  showPhysicalFields: boolean;
  stepLabel: string;
  totalSteps: number;
  weightKg: string;
};

/**
 * Step "Il tuo profilo sportivo" del Calciatore (REV-ONB-02 §L–§R).
 *
 * Una sola schermata: il ruolo principale si sceglie sul campo, il secondario
 * dal selector subito sotto. Non esiste una schermata separata per il ruolo
 * secondario, né una CTA "Aggiungi ruolo secondario" (§P).
 */
export function PlayerSportsProfileStep({
  currentStep,
  heightCm,
  isBusy,
  onBack,
  onContinue,
  onHeightChange,
  onPreferredFootChange,
  onPrimaryPositionChange,
  onSecondaryPositionChange,
  onShowPhysicalFieldsChange,
  onWeightChange,
  preferredFoot,
  primaryPosition,
  primaryPositionError,
  secondaryPosition,
  showPhysicalFields,
  stepLabel,
  totalSteps,
  weightKg,
}: PlayerSportsProfileStepProps) {
  return (
    <OnboardingPage
      currentStep={currentStep}
      footer={{
        onPrimaryPress: onContinue,
        primaryDisabled: !primaryPosition,
        primaryLabel: "Continua",
        primaryLoading: isBusy,
        primaryTestID: "sports-profile-continue",
      }}
      onBack={onBack}
      stepLabel={stepLabel}
      subtitle="Tocca il campo per indicare il ruolo in cui giochi."
      testID="player-sports-profile-step"
      title="Il tuo profilo sportivo"
      totalSteps={totalSteps}
    >
      <OnboardingSection>
        <FieldShell label="Ruolo principale">
          <FootballPitchRoleSelector
            errorMessage={primaryPositionError}
            onSelectPrimary={onPrimaryPositionChange}
            primaryPosition={primaryPosition}
            secondaryPosition={secondaryPosition}
            testID="player-pitch"
          />
        </FieldShell>

        <View style={styles.secondaryGroup}>
          <OnboardingSelectField
            allowClear
            helperText="Puoi selezionare anche un ruolo secondario o modificarlo più tardi."
            label="Ruolo secondario"
            onChange={onSecondaryPositionChange}
            optional
            options={getSecondaryPositionOptions(primaryPosition)}
            placeholder="Seleziona un ruolo"
            sheetTitle="Ruolo secondario"
            testID="secondary-position-select"
            value={secondaryPosition}
          />
        </View>
      </OnboardingSection>

      <OnboardingSection title="Caratteristiche">
        <SegmentedSelector
          label="Piede preferito"
          onChange={onPreferredFootChange}
          optional
          options={PREFERRED_FOOT_OPTIONS}
          testID="preferred-foot-selector"
          value={preferredFoot}
        />

        <ToggleRow
          description="Altezza e peso restano visibili solo se scegli di mostrarli."
          label="Mostra altezza e peso nel profilo"
          onValueChange={onShowPhysicalFieldsChange}
          testID="physical-fields-toggle"
          value={showPhysicalFields}
        >
          <View style={styles.measureRow}>
            <PlayerMeasureField
              label="Altezza"
              max={220}
              min={140}
              onChange={onHeightChange}
              unit="cm"
              value={heightCm}
            />
            <PlayerMeasureField
              label="Peso"
              max={130}
              min={40}
              onChange={onWeightChange}
              unit="kg"
              value={weightKg}
            />
          </View>
        </ToggleRow>
      </OnboardingSection>

      <AppText color="muted" variant="meta">
        Ruoli e caratteristiche finiscono direttamente nel tuo profilo: potrai
        aggiornarli quando vuoi.
      </AppText>
    </OnboardingPage>
  );
}

const styles = StyleSheet.create({
  secondaryGroup: {
    paddingTop: onboardingSpacing.xs,
  },
  measureRow: {
    flexDirection: "row",
    gap: onboardingSpacing.s + 4,
  },
});
