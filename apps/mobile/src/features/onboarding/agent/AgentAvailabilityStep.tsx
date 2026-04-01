import { StyleSheet, View } from "react-native";

import { spacing } from "../../../theme/tokens";
import { AppText, Button, Toggle } from "../../../ui";
import { OnboardingSectionCard } from "../onboarding-ui";

type AgentAvailabilityStepProps = {
  isBusy: boolean;
  openToClubs: boolean;
  openToPlayers: boolean;
  errorMessage?: string;
  onContinue: () => void;
  onUpdate: (patch: {
    agentOpenToClubs?: boolean;
    agentOpenToPlayers?: boolean;
  }) => void;
};

export function AgentAvailabilityStep({
  isBusy,
  openToClubs,
  openToPlayers,
  errorMessage,
  onContinue,
  onUpdate,
}: AgentAvailabilityStepProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <AppText variant="displaySm">Disponibilita'</AppText>
        <AppText variant="bodySm" color="secondary">
          Scegli chi puo' contattarti da subito tramite il tuo profilo.
        </AppText>
      </View>

      <OnboardingSectionCard>
        <Toggle
          label="Aperto ai club"
          onValueChange={(value) => onUpdate({ agentOpenToClubs: value })}
          subtitle="I club possono contattarti per proporre collaborazioni o visionare il tuo network."
          value={openToClubs}
        />

        <Toggle
          label="Aperto ai calciatori"
          onValueChange={(value) => onUpdate({ agentOpenToPlayers: value })}
          subtitle="I calciatori possono contattarti per richiedere rappresentanza."
          value={openToPlayers}
        />

        {errorMessage ? (
          <AppText variant="bodySm" color="danger">
            {errorMessage}
          </AppText>
        ) : null}
      </OnboardingSectionCard>

      <Button
        disabled={isBusy}
        fullWidth
        label="Continua"
        onPress={onContinue}
        variant="primary"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[16],
  },
  header: {
    gap: spacing[8],
  },
});
