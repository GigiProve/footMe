import { StyleSheet, View } from "react-native";

import { InterestCategoriesSelector } from "../../../components/ui/interest-categories-selector";
import { REGION_OPTIONS } from "../../profiles/profile-form-utils";
import type { TeamAutocompleteOption } from "../../profiles/player-sports";
import { TeamAutocompleteInput } from "../../profiles/player-sports-section";
import { spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import { OnboardingSectionCard } from "../onboarding-ui";
import { CommunityChipGroup } from "./CommunityChipGroup";

type FanInterestsStepProps = {
  favoriteClubId: string | null;
  favoriteTeamName: string;
  interestCategories: string[];
  interestRegions: string[];
  validationErrors: Partial<Record<string, string>>;
  onUpdate: (patch: {
    fanFavoriteClubId?: string | null;
    fanFavoriteTeamName?: string;
    fanInterestCategories?: string[];
    fanInterestRegions?: string[];
  }) => void;
  searchTeams: (query: string) => Promise<TeamAutocompleteOption[]>;
};

export function FanInterestsStep({
  favoriteTeamName,
  interestCategories,
  interestRegions,
  searchTeams,
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
          <TeamAutocompleteInput
            label="Squadra tifata"
            onChangeText={(value) =>
              onUpdate({
                fanFavoriteClubId: null,
                fanFavoriteTeamName: value,
              })
            }
            onSelectTeam={(team) =>
              onUpdate({
                fanFavoriteClubId: team.id ?? null,
                fanFavoriteTeamName: team.name,
              })
            }
            placeholder="Es. AC Como"
            searchTeams={searchTeams}
            value={favoriteTeamName}
          />
        </View>

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
