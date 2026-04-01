import { StyleSheet, View } from "react-native";

import { InterestCategoriesSelector } from "../../../components/ui/interest-categories-selector";
import { SelectField } from "../../../components/ui/select-field";
import { spacing } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";
import type { AvailabilityType } from "../onboarding-form";
import { WhereToPlaySection } from "../where-to-play-section";
import { OnboardingSectionCard } from "../onboarding-ui";
import { AVAILABLE_FROM_OPTIONS } from "../coach/CoachRoleStep";

type StaffAvailabilityStepProps = {
  availabilityType: AvailabilityType;
  availableFrom: string;
  isBusy: boolean;
  onContinue: () => void;
  onUpdate: (patch: {
    openToWork?: boolean;
    staffAvailabilityType?: AvailabilityType;
    staffAvailableFrom?: string;
    staffPreferredCategories?: string;
    staffPreferredProvinces?: string;
    staffPreferredRegions?: string;
  }) => void;
  openToWork: boolean;
  preferredCategories: string[];
  preferredProvinces: string[];
  preferredRegions: string[];
  validationErrors: Partial<Record<string, string>>;
};

const STAFF_INFO_MESSAGES: Record<AvailabilityType, string> = {
  ITALY: "",
  REGIONS:
    "Indica una o più regioni in cui sei disponibile a collaborare con club e staff tecnici.",
  PROVINCES:
    "Indica una o più province in cui sei disponibile a collaborare con club e staff tecnici.",
};

export function StaffAvailabilityStep({
  availabilityType,
  availableFrom,
  isBusy,
  onContinue,
  onUpdate,
  openToWork,
  preferredCategories,
  preferredProvinces,
  preferredRegions,
  validationErrors,
}: StaffAvailabilityStepProps) {
  return (
    <View style={styles.container}>
      <OnboardingSectionCard
        title="Dove vuoi collaborare?"
        subtitle="Imposta disponibilità geografica e tempi di partenza con lo stesso schema usato per il calciatore."
      >
        <WhereToPlaySection
          availabilityType={availabilityType}
          categories={[]}
          hideCategories
          infoMessages={STAFF_INFO_MESSAGES}
          isAvailable={openToWork}
          onAvailabilityTypeChange={(value) =>
            onUpdate({ staffAvailabilityType: value })
          }
          onCategoriesChange={() => undefined}
          onIsAvailableChange={(value) =>
            onUpdate({
              openToWork: value,
              ...(value
                ? {}
                : {
                    staffAvailableFrom: "",
                    staffPreferredProvinces: "",
                    staffPreferredRegions: "",
                  }),
            })
          }
          onProvincesChange={(value) =>
            onUpdate({ staffPreferredProvinces: value.join(", ") })
          }
          onRegionsChange={(value) =>
            onUpdate({ staffPreferredRegions: value.join(", ") })
          }
          provinces={preferredProvinces}
          provincesHelperText="Puoi selezionare più province in cui collaborare."
          provincesLabel="Province di interesse"
          regions={preferredRegions}
          regionsHelperText="Puoi selezionare più regioni in cui collaborare."
          regionsLabel="Regioni di interesse"
          toggleLabel="Disponibile a nuove collaborazioni"
          toggleSubtitle="Il tuo profilo può comparire tra gli staff tecnici disponibili."
          validationErrors={validationErrors}
        />

        {openToWork ? (
          <View style={styles.availableFromGroup}>
            <InterestCategoriesSelector
              label="Categorie di interesse"
              onChange={(value) =>
                onUpdate({ staffPreferredCategories: value.join(", ") })
              }
              value={preferredCategories}
            />
            {validationErrors.staffPreferredCategories ? (
              <AppText variant="caption" color="danger">
                {validationErrors.staffPreferredCategories}
              </AppText>
            ) : null}
          </View>
        ) : null}

        {openToWork ? (
          <View style={styles.availableFromGroup}>
            <SelectField
              label="Disponibile da"
              onChange={(value) => onUpdate({ staffAvailableFrom: value })}
              options={AVAILABLE_FROM_OPTIONS}
              placeholder="Seleziona disponibilità"
              value={availableFrom}
            />
            {validationErrors.staffAvailableFrom ? (
              <AppText variant="caption" color="danger">
                {validationErrors.staffAvailableFrom}
              </AppText>
            ) : null}
          </View>
        ) : null}
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

const styles = StyleSheet.create({
  availableFromGroup: {
    gap: spacing[8],
  },
  container: {
    gap: spacing[16],
  },
});
