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
  onContinue: () => void;
  onUpdate: (value: boolean) => void;
};

// ---------------------------------------------------------------------------
// PlayerCareerToggleStep
// ---------------------------------------------------------------------------

export function PlayerCareerToggleStep({
  hasPlayedFootball,
  isBusy,
  onContinue,
  onUpdate,
}: PlayerCareerToggleStepProps) {
  return (
    <View style={styles.container}>
      <OnboardingSectionCard
        title="Carriera da giocatore"
        subtitle="Hai maturato esperienze come calciatore prima di diventare allenatore?"
      >
        <Toggle
          label="Hai giocato a calcio?"
          onValueChange={onUpdate}
          subtitle="Aggiungi la tua carriera in campo per arricchire il tuo profilo tecnico."
          value={hasPlayedFootball}
        />
      </OnboardingSectionCard>

      <Button
        disabled={isBusy}
        label="Continua"
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
