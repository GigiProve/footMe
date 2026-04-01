import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { AvailabilityProvincesSelector } from "../../components/ui/availability-provinces-selector";
import { AvailabilityRegionsSelector } from "../../components/ui/availability-regions-selector";
import { InterestCategoriesSelector } from "../../components/ui/interest-categories-selector";
import { colors, radius, spacing } from "../../theme/tokens";
import { AppText, Toggle } from "../../ui";
import type { AvailabilityType } from "./onboarding-form";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WhereToPlaySectionProps = {
  availabilityType: AvailabilityType;
  categories: string[];
  categoriesHelperText?: string;
  categoriesLabel?: string;
  hideCategories?: boolean;
  infoMessages?: Partial<Record<AvailabilityType, string>>;
  isAvailable: boolean;
  regionsHelperText?: string;
  regionsLabel?: string;
  onAvailabilityTypeChange: (type: AvailabilityType) => void;
  onCategoriesChange: (categories: string[]) => void;
  onIsAvailableChange: (value: boolean) => void;
  onProvincesChange: (provinces: string[]) => void;
  onRegionsChange: (regions: string[]) => void;
  provincesHelperText?: string;
  provincesLabel?: string;
  provinces: string[];
  regions: string[];
  toggleLabel?: string;
  toggleSubtitle?: string;
  validationErrors?: Partial<Record<string, string>>;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AVAILABILITY_OPTIONS: { label: string; value: AvailabilityType }[] = [
  { label: "Ovunque in Italia", value: "ITALY" },
  { label: "In una o più regioni", value: "REGIONS" },
  { label: "Zone specifiche", value: "PROVINCES" },
];

const INFO_MESSAGES: Record<AvailabilityType, string> = {
  ITALY: "",
  REGIONS:
    "Hai selezionato la disponibilità regionale. Indica una o più regioni in cui sei interessato a giocare.",
  PROVINCES:
    "Hai selezionato zone specifiche. Indica una o più province in cui sei interessato a giocare.",
};

// ---------------------------------------------------------------------------
// WhereToPlaySection
// ---------------------------------------------------------------------------

export function WhereToPlaySection({
  availabilityType,
  categories,
  categoriesHelperText = undefined,
  categoriesLabel = "Categorie di interesse",
  hideCategories = false,
  infoMessages,
  isAvailable,
  regionsHelperText = "Puoi selezionare più zone.",
  regionsLabel = "Regioni di interesse",
  onAvailabilityTypeChange,
  onCategoriesChange,
  onIsAvailableChange,
  onProvincesChange,
  onRegionsChange,
  provincesHelperText = "Puoi selezionare più province.",
  provincesLabel = "Province di interesse",
  provinces,
  regions,
  toggleLabel = "Disponibile a cambiare squadra",
  toggleSubtitle = "Il tuo profilo può comparire tra i calciatori disponibili sul mercato.",
  validationErrors = {},
}: WhereToPlaySectionProps) {
  function handleAvailabilityTypeChange(type: AvailabilityType) {
    onAvailabilityTypeChange(type);
    if (type !== "REGIONS") {
      onRegionsChange([]);
    }
    if (type !== "PROVINCES") {
      onProvincesChange([]);
    }
  }

  function handleToggle(value: boolean) {
    onIsAvailableChange(value);
  }

  return (
    <View style={styles.container}>
      {/* Toggle */}
      <Toggle
        label={toggleLabel}
        onValueChange={handleToggle}
        subtitle={toggleSubtitle}
        value={isAvailable}
      />

      {isAvailable ? (
        <>
          {/* Availability type pills */}
          <View style={styles.fieldGroup}>
            <AppText variant="bodySm" color="primary" style={styles.fieldLabel}>
              Disponibilità geografica
            </AppText>
            <View style={styles.pillsRow}>
              {AVAILABILITY_OPTIONS.map((option) => {
                const isSelected = availabilityType === option.value;
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    key={option.value}
                    onPress={() => handleAvailabilityTypeChange(option.value)}
                    style={[styles.pill, isSelected ? styles.pillActive : null]}
                  >
                    <AppText
                      variant="bodySm"
                      color={isSelected ? "accent" : "primary"}
                      style={styles.pillText}
                    >
                      {option.label}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
            <AppText variant="caption" color="secondary">
              Puoi selezionare l'opzione più adatta alle tue preferenze attuali.
            </AppText>
          </View>

          {/* Info card — shown for REGIONS and PROVINCES */}
                {availabilityType !== "ITALY" ? (
            <View style={styles.infoCard}>
              <Ionicons name="map-outline" size={20} color={colors.accent} />
              <AppText variant="bodySm" color="secondary" style={styles.infoText}>
                {(infoMessages ?? INFO_MESSAGES)[availabilityType] ?? ""}
              </AppText>
            </View>
          ) : null}

          {/* Region selector */}
          {availabilityType === "REGIONS" ? (
            <View style={styles.fieldGroup}>
              <AvailabilityRegionsSelector
                label={regionsLabel}
                onChange={onRegionsChange}
                placeholder="Cerca regione"
                value={regions}
              />
              <AppText variant="caption" color="secondary">
                {regionsHelperText}
              </AppText>
              {validationErrors.transferRegions || validationErrors.staffPreferredRegions ? (
                <AppText variant="caption" color="danger">
                  {validationErrors.transferRegions ?? validationErrors.staffPreferredRegions}
                </AppText>
              ) : null}
            </View>
          ) : null}

          {/* Province selector */}
          {availabilityType === "PROVINCES" ? (
            <View style={styles.fieldGroup}>
              <AvailabilityProvincesSelector
                label={provincesLabel}
                onChange={onProvincesChange}
                placeholder="Cerca provincia"
                value={provinces}
              />
              <AppText variant="caption" color="secondary">
                {provincesHelperText}
              </AppText>
              {validationErrors.transferProvinces || validationErrors.staffPreferredProvinces ? (
                <AppText variant="caption" color="danger">
                  {validationErrors.transferProvinces ?? validationErrors.staffPreferredProvinces}
                </AppText>
              ) : null}
            </View>
          ) : null}

          {/* Categories */}
          {!hideCategories ? (
            <View style={styles.fieldGroup}>
              <InterestCategoriesSelector
                label={categoriesLabel}
                onChange={onCategoriesChange}
                value={categories}
              />
              {categoriesHelperText ? (
                <AppText variant="caption" color="secondary">
                  {categoriesHelperText}
                </AppText>
              ) : null}
              {validationErrors.preferredCategories ? (
                <AppText variant="caption" color="danger">
                  {validationErrors.preferredCategories}
                </AppText>
              ) : null}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    gap: spacing[18],
  },
  fieldGroup: {
    gap: spacing[8],
  },
  fieldLabel: {
    fontWeight: "700",
  },
  pillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  pill: {
    minHeight: 40,
    paddingHorizontal: spacing[14],
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  pillActive: {
    backgroundColor: colors.accentSoft,
    borderColor: "rgba(10,102,194,0.18)",
  },
  pillText: {
    fontWeight: "600",
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[10],
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[8],
    padding: spacing[14],
  },
  infoText: {
    flex: 1,
  },
});
