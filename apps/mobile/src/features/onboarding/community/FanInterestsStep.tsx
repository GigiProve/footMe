import { StyleSheet, View } from "react-native";

import { InterestCategoriesSelector } from "../../../components/ui/interest-categories-selector";
import { REGION_OPTIONS } from "../../profiles/profile-form-utils";
import { spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import { OnboardingSectionCard } from "../onboarding-ui";
import { CommunityChipGroup } from "./CommunityChipGroup";

type FanInterestsStepProps = {
  interestCategories: string[];
  interestRegions: string[];
  validationErrors: Partial<Record<string, string>>;
  onUpdate: (patch: {
    fanInterestCategories?: string[];
    fanInterestRegions?: string[];
  }) => void;
};

export function FanInterestsStep({
  interestCategories,
  interestRegions,
  validationErrors,
  onUpdate,
}: FanInterestsStepProps) {
  return (
    <View style={styles.container}>
      <OnboardingSectionCard
        title="Cosa vuoi seguire?"
        subtitle="Seleziona velocemente gli interessi e le regioni che ti interessano di più."
      >
        <View style={styles.fieldGroup}>
          <InterestCategoriesSelector
            onChange={(value) => onUpdate({ fanInterestCategories: value })}
            value={interestCategories}
          />
          {validationErrors.fanInterestCategories ? (
            <AppText variant="caption" color="danger">
              {validationErrors.fanInterestCategories}
            </AppText>
          ) : null}
        </View>

        <View style={styles.fieldGroup}>
          <AppText variant="bodySm" color="primary" style={styles.label}>
            Regioni di interesse
          </AppText>
          <CommunityChipGroup
            onToggle={(value) => {
              const next = interestRegions.includes(value)
                ? interestRegions.filter((entry) => entry !== value)
                : [...interestRegions, value];
              onUpdate({ fanInterestRegions: next });
            }}
            options={REGION_OPTIONS}
            selectedValues={interestRegions}
          />
          {validationErrors.fanInterestRegions ? (
            <AppText variant="caption" color="danger">
              {validationErrors.fanInterestRegions}
            </AppText>
          ) : null}
        </View>
      </OnboardingSectionCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[16],
  },
  fieldGroup: {
    gap: spacing[8],
  },
  label: {
    fontWeight: "600",
  },
});
