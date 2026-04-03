import { Pressable, StyleSheet, View } from "react-native";

import { SelectField } from "../../../components/ui/select-field";
import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import { OnboardingSectionCard } from "../onboarding-ui";
import type { AvailabilityType } from "../onboarding-form";
import { WhereToPlaySection } from "../where-to-play-section";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

const COACH_PRIMARY_ROLE_OPTIONS: { label: string; value: string }[] = [
  { label: "Allenatore", value: "Allenatore" },
  { label: "Vice allenatore", value: "Vice allenatore" },
  { label: "Collaboratore tecnico", value: "Collaboratore tecnico" },
  { label: "Allenatore portieri", value: "Allenatore portieri" },
  { label: "Preparatore atletico", value: "Preparatore atletico" },
];

const LICENSE_TYPE_OPTIONS: { label: string; value: string }[] = [
  { label: "UEFA Pro", value: "UEFA Pro" },
  { label: "UEFA A", value: "UEFA A" },
  { label: "UEFA B", value: "UEFA B" },
  { label: "UEFA C", value: "UEFA C" },
  { label: "Patentino base", value: "Patentino base" },
  { label: "Nessun patentino", value: "Nessun patentino" },
];

const COACH_CATEGORY_OPTIONS: string[] = [
  "Prima Squadra",
  "Juniores",
  "Allievi",
  "Giovanissimi",
  "Berretti",
  "Scuola Calcio",
  "Settore Giovanile",
];

export const AVAILABLE_FROM_OPTIONS: { label: string; value: string }[] = [
  { label: "Immediatamente", value: "Immediatamente" },
  { label: "Da luglio", value: "Da luglio" },
  { label: "Da settembre", value: "Da settembre" },
  { label: "Fine stagione", value: "Fine stagione" },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type CoachRoleStepProps = {
  availabilityType: AvailabilityType;
  availableFrom: string;
  categoriesArray: string[];
  licenseType: string;
  openToNewRole: boolean;
  primaryRole: string;
  provincesArray: string[];
  regionsArray: string[];
  onUpdate: (
    patch: Partial<{
      coachPrimaryRole: string;
      coachLicenseType: string;
      coachCategoriesArray: string[];
      openToNewRole: boolean;
      coachAvailableFrom: string;
      coachAvailabilityType: AvailabilityType;
      coachProvincesArray: string[];
      coachRegionsArray: string[];
    }>,
  ) => void;
  validationErrors: Partial<Record<string, string>>;
};

// ---------------------------------------------------------------------------
// CoachRoleStep
// ---------------------------------------------------------------------------

export function CoachRoleStep({
  availabilityType,
  availableFrom,
  categoriesArray,
  licenseType,
  openToNewRole,
  primaryRole,
  provincesArray,
  regionsArray,
  onUpdate,
  validationErrors,
}: CoachRoleStepProps) {
  function toggleCategory(option: string) {
    const next = categoriesArray.includes(option)
      ? categoriesArray.filter((c) => c !== option)
      : [...categoriesArray, option];
    onUpdate({ coachCategoriesArray: next });
  }

  return (
    <OnboardingSectionCard
      title="Qualifica e disponibilità"
      subtitle="Definisci il tuo ruolo da allenatore e la tua disponibilità."
    >
      {/* Primary role */}
      <View style={styles.fieldGroup}>
        <SelectField
          label="Ruolo principale *"
          onChange={(val) => onUpdate({ coachPrimaryRole: val })}
          options={COACH_PRIMARY_ROLE_OPTIONS}
          placeholder="Seleziona ruolo"
          value={primaryRole}
        />
        {validationErrors.coachPrimaryRole ? (
          <AppText variant="caption" color="danger">
            {validationErrors.coachPrimaryRole}
          </AppText>
        ) : null}
      </View>

      {/* License type */}
      <SelectField
        allowClear
        clearLabel="Rimuovi patentino"
        label="Tipo di patentino"
        onChange={(val) => onUpdate({ coachLicenseType: val })}
        options={LICENSE_TYPE_OPTIONS}
        placeholder="Seleziona patentino"
        value={licenseType}
      />

      {/* Categories multi-select */}
      <View style={styles.fieldGroup}>
        <AppText variant="caption" color="muted">
          Categorie allenate
        </AppText>
        <View style={styles.chipRow}>
          {COACH_CATEGORY_OPTIONS.map((option) => {
            const isSelected = categoriesArray.includes(option);
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                key={option}
                onPress={() => toggleCategory(option)}
                style={[
                  styles.chip,
                  isSelected ? styles.chipSelected : null,
                ]}
              >
                <AppText
                  variant="bodySm"
                  style={isSelected ? styles.chipTextSelected : styles.chipText}
                >
                  {option}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Availability + geographic selection */}
      <WhereToPlaySection
        availabilityType={availabilityType}
        categories={[]}
        hideCategories
        infoMessages={{
          ITALY: "",
          REGIONS: "Indica una o più regioni in cui sei disponibile ad allenare.",
          PROVINCES: "Indica una o più province in cui sei disponibile ad allenare.",
        }}
        isAvailable={openToNewRole}
        onAvailabilityTypeChange={(value) => onUpdate({ coachAvailabilityType: value })}
        onCategoriesChange={() => undefined}
        onIsAvailableChange={(value) => {
          onUpdate({
            openToNewRole: value,
            ...(value ? {} : {
              coachAvailableFrom: "",
              coachProvincesArray: [],
              coachRegionsArray: [],
            }),
          });
        }}
        onProvincesChange={(value) => onUpdate({ coachProvincesArray: value })}
        onRegionsChange={(value) => onUpdate({ coachRegionsArray: value })}
        provinces={provincesArray}
        provincesHelperText="Puoi selezionare più province in cui allenare."
        provincesLabel="Province di interesse"
        regions={regionsArray}
        regionsHelperText="Puoi selezionare più regioni in cui allenare."
        regionsLabel="Regioni di interesse"
        toggleLabel="Disponibile per una nuova squadra"
        toggleSubtitle="Il tuo profilo può comparire tra gli allenatori disponibili sul mercato."
        validationErrors={validationErrors}
      />

      {/* Available from — only when toggle is ON */}
      {openToNewRole ? (
        <SelectField
          label="Disponibile da"
          onChange={(val) => onUpdate({ coachAvailableFrom: val })}
          options={AVAILABLE_FROM_OPTIONS}
          placeholder="Seleziona disponibilità"
          value={availableFrom}
        />
      ) : null}
    </OnboardingSectionCard>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  fieldGroup: {
    gap: spacing[8],
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  chip: {
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[10],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    color: colors.textPrimary,
  },
  chipTextSelected: {
    color: colors.inkInvert,
    fontWeight: "600",
  },
});
