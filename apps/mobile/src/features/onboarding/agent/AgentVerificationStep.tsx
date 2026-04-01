import { StyleSheet, View } from "react-native";

import { SelectField } from "../../../components/ui/select-field";
import { spacing } from "../../../theme/tokens";
import { AppText, Button, Toggle } from "../../../ui";
import { OnboardingSectionCard } from "../onboarding-ui";
import { AGENT_FEDERATION_OPTIONS } from "./agent-options";

type AgentVerificationStepProps = {
  federation: string;
  isBusy: boolean;
  isFederationLicensed: boolean;
  validationErrors: Partial<Record<string, string>>;
  onContinue: () => void;
  onUpdate: (patch: {
    agentFederation?: string;
    agentIsFederationLicensed?: boolean;
  }) => void;
};

export function AgentVerificationStep({
  federation,
  isBusy,
  isFederationLicensed,
  validationErrors,
  onContinue,
  onUpdate,
}: AgentVerificationStepProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <AppText variant="displaySm">Verifica</AppText>
        <AppText variant="bodySm" color="secondary">
          Inserisci i dati di licenza per mostrare un profilo piu' autorevole.
        </AppText>
      </View>

      <OnboardingSectionCard>
        <Toggle
          label="Abilitazione federale"
          onValueChange={(value) =>
            onUpdate({
              agentIsFederationLicensed: value,
              ...(value ? {} : { agentFederation: "" }),
            })
          }
          subtitle="Attivalo se possiedi una licenza ufficiale come intermediario o procuratore."
          value={isFederationLicensed}
        />

        {isFederationLicensed ? (
          <>
            <SelectField
              label="Federazione *"
              onChange={(value) => onUpdate({ agentFederation: value })}
              options={AGENT_FEDERATION_OPTIONS.map((option) => ({
                label: option.label,
                value: option.value,
              }))}
              placeholder="Seleziona federazione"
              value={federation}
            />
            {validationErrors.agentFederation ? (
              <AppText variant="bodySm" color="danger">
                {validationErrors.agentFederation}
              </AppText>
            ) : null}
          </>
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
