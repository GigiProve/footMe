import { StyleSheet, View } from "react-native";

import { AppText, Input } from "../../../ui";
import { spacing } from "../../../theme/tokens";
import { OnboardingSectionCard } from "../onboarding-ui";
import { CommunityChipGroup } from "./CommunityChipGroup";

type MediaCollaborationsStepProps = {
  affiliationName: string;
  affiliationType: string;
  errorMessage?: string;
  options: readonly string[];
  onUpdate: (patch: {
    mediaAffiliationName?: string;
    mediaAffiliationType?: string;
  }) => void;
};

export function MediaCollaborationsStep({
  affiliationName,
  affiliationType,
  errorMessage,
  options,
  onUpdate,
}: MediaCollaborationsStepProps) {
  return (
    <OnboardingSectionCard
      title="Collaborazioni e riferimenti"
      subtitle="Indica se sei collegato a una realtà specifica del calcio."
    >
      <View style={styles.fieldGroup}>
        <AppText variant="bodySm" color="primary" style={styles.label}>
          Sei collegato a una realtà specifica?
        </AppText>
        <CommunityChipGroup
          multiple={false}
          onToggle={(value) => onUpdate({ mediaAffiliationType: value })}
          options={options}
          selectedValues={affiliationType ? [affiliationType] : []}
        />
      </View>

      {affiliationType && affiliationType !== "Nessuna" ? (
        <View style={styles.fieldGroup}>
          <Input
            label="Nome riferimento"
            onChangeText={(value) => onUpdate({ mediaAffiliationName: value })}
            placeholder="Inserisci nome società o realtà"
            value={affiliationName}
          />
          {errorMessage ? (
            <AppText variant="caption" color="danger">
              {errorMessage}
            </AppText>
          ) : null}
        </View>
      ) : null}
    </OnboardingSectionCard>
  );
}

const styles = StyleSheet.create({
  fieldGroup: {
    gap: spacing[8],
  },
  label: {
    fontWeight: "600",
  },
});
