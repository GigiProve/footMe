import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors } from "../../../styles";
import { Button } from "../../../ui";
import type { OnboardingFormState } from "../onboarding-form";
import {
  BottomSheetSelector,
  OnboardingPage,
  OnboardingSection,
  OnboardingTextField,
  onboardingLayout,
} from "../ui";
import {
  type ClubChannelKey,
  getAvailableClubChannels,
  getVisibleClubChannels,
} from "./club-channels";

const DESCRIPTION_MAX_LENGTH = 600;

type ClubProfileStepProps = {
  currentStep: number;
  form: OnboardingFormState;
  isBusy: boolean;
  onBack: () => void;
  onFieldChange: (field: keyof OnboardingFormState, value: string) => void;
  onSubmit: () => void;
  stepLabel: string;
  totalSteps: number;
};

/**
 * Completa il profilo (REV-ONB-05 §AG–§AN).
 *
 * L'ultimo passo è il più leggero: due campi liberi e i canali digitali.
 * Sito e Instagram sono lì da subito, gli altri compaiono solo se il club li
 * ha davvero (§AK), e il numero di tesserati non si chiede più in
 * registrazione (§AJ). Non c'è nessuno "Salta": i campi facoltativi si
 * lasciano semplicemente vuoti (§AN).
 */
export function ClubProfileStep({
  currentStep,
  form,
  isBusy,
  onBack,
  onFieldChange,
  onSubmit,
  stepLabel,
  totalSteps,
}: ClubProfileStepProps) {
  const [addedChannels, setAddedChannels] = useState<ClubChannelKey[]>([]);
  const [isChannelSheetOpen, setIsChannelSheetOpen] = useState(false);

  const visibleChannels = getVisibleClubChannels(form, addedChannels);
  const availableChannels = getAvailableClubChannels(form, addedChannels);

  const channelOptions = useMemo(
    () =>
      availableChannels.map((channel) => ({
        label: channel.label,
        value: channel.key,
      })),
    [availableChannels],
  );

  return (
    <OnboardingPage
      currentStep={currentStep}
      footer={{
        onPrimaryPress: onSubmit,
        primaryDisabled: isBusy,
        primaryLabel: "Completa registrazione",
        primaryLoading: isBusy,
      }}
      onBack={onBack}
      stepLabel={stepLabel}
      subtitle="Aggiungi qualche dettaglio per presentare meglio il tuo club."
      testID="club-profile-step"
      title="Completa il profilo"
      totalSteps={totalSteps}
    >
      <OnboardingSection>
        <OnboardingTextField
          label="Descrizione del club"
          maxLength={DESCRIPTION_MAX_LENGTH}
          multiline
          onChangeText={(value) => onFieldChange("clubDescription", value)}
          placeholder="Racconta il club, la sua storia e i suoi obiettivi..."
          value={form.clubDescription}
        />

        <OnboardingTextField
          autoCapitalize="words"
          label="Stadio / Campo principale"
          onChangeText={(value) => onFieldChange("clubStadium", value)}
          placeholder="Nome dell'impianto"
          value={form.clubStadium}
        />
      </OnboardingSection>

      <OnboardingSection title="Canali digitali">
        {visibleChannels.map((channel) => (
          <OnboardingTextField
            autoCapitalize="none"
            autoCorrect={false}
            key={channel.key}
            keyboardType={channel.key === "website" ? "url" : "default"}
            label={channel.label}
            onChangeText={(value) => onFieldChange(channel.field, value)}
            placeholder={channel.placeholder}
            value={String(form[channel.field] ?? "")}
          />
        ))}

        {channelOptions.length > 0 ? (
          <View style={styles.addChannel}>
            <Button
              label="Aggiungi altro canale"
              leftIcon={
                <Ionicons color={colors.accent} name="add" size={18} />
              }
              onPress={() => setIsChannelSheetOpen(true)}
              size="md"
              variant="secondary"
            />
          </View>
        ) : null}
      </OnboardingSection>

      <BottomSheetSelector
        mode="single"
        onChange={(value) => {
          if (value) {
            setAddedChannels((current) => [...current, value as ClubChannelKey]);
          }
        }}
        onClose={() => setIsChannelSheetOpen(false)}
        options={channelOptions}
        title="Aggiungi un canale"
        value=""
        visible={isChannelSheetOpen}
      />
    </OnboardingPage>
  );
}

const styles = StyleSheet.create({
  addChannel: {
    alignItems: "flex-start",
    paddingTop: onboardingLayout.labelGap / 2,
  },
});
