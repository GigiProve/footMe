import { StyleSheet, View } from "react-native";

import { spacing } from "../../../theme/tokens";
import { Button, Toggle } from "../../../ui";
import { OnboardingSectionCard } from "../onboarding-ui";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type PlayerCareerToggleStepProps = {
  hasPlayedFootball: boolean;
  isBusy: boolean;
  buttonLabel?: string;
  onContinue: () => void;
  onUpdate: (value: boolean) => void;
  subtitle?: string;
  title?: string;
  toggleLabel?: string;
  toggleSubtitle?: string;
};

// ---------------------------------------------------------------------------
// PlayerCareerToggleStep
// ---------------------------------------------------------------------------

export function PlayerCareerToggleStep({
  hasPlayedFootball,
  isBusy,
  buttonLabel = "Continua",
  onContinue,
  onUpdate,
  subtitle = "Hai maturato esperienze come calciatore prima di diventare allenatore?",
  title = "Carriera da giocatore",
  toggleLabel = "Hai giocato a calcio?",
  toggleSubtitle = "Aggiungi la tua carriera in campo per arricchire il tuo profilo tecnico.",
}: PlayerCareerToggleStepProps) {
  return (
    <View style={styles.container}>
      <OnboardingSectionCard
        title={title}
        subtitle={subtitle}
      >
        <Toggle
          label={toggleLabel}
          onValueChange={onUpdate}
          subtitle={toggleSubtitle}
          value={hasPlayedFootball}
        />
      </OnboardingSectionCard>

      <Button
        disabled={isBusy}
        fullWidth
        label={buttonLabel}
        onPress={onContinue}
        variant="primary"
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    gap: spacing[16],
  },
});
