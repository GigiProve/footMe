import { useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { InterestCategoriesSelector } from "../../../components/ui/interest-categories-selector";
import { SelectField } from "../../../components/ui/select-field";
import type { StaffSpecialization } from "../../onboarding/create-initial-profile";
import type { AvailabilityType } from "../../onboarding/onboarding-form";
import { AVAILABLE_FROM_OPTIONS } from "../../onboarding/coach/CoachRoleStep";
import { WhereToPlaySection } from "../../onboarding/where-to-play-section";
import type { CompleteProfessionalProfile } from "../profile-service";
import { updateCompleteProfessionalProfile } from "../profile-service";
import {
  buildFullUpdatePayload,
  buildInitialState,
  fromDelimitedString,
  specializationOptions,
} from "../profile-edit-helpers";
import { validateBirthDateInput } from "../profile-form-utils";
import { ProfileField as Field } from "../profile-screen-components";
import { EditModalShell } from "./EditModalShell";
import { AppText, Button } from "../../../ui";
import { colors, spacing } from "../../../theme/tokens";

type EditStaffInfoModalProps = {
  completeProfile: CompleteProfessionalProfile;
  onClose: () => void;
  onSaved: () => void;
  userId: string;
  visible: boolean;
};

export function EditStaffInfoModal({
  completeProfile,
  onClose,
  onSaved,
  userId,
  visible,
}: EditStaffInfoModalProps) {
  const [specialization, setSpecialization] =
    useState<StaffSpecialization>("fitness_coach");
  const [experienceSummary, setExperienceSummary] = useState("");
  const [certifications, setCertifications] = useState("");
  const [preferredCategories, setPreferredCategories] = useState<string[]>([]);
  const [preferredRegions, setPreferredRegions] = useState<string[]>([]);
  const [availabilityType, setAvailabilityType] = useState<AvailabilityType>("ITALY");
  const [availableFrom, setAvailableFrom] = useState("");
  const [preferredProvinces, setPreferredProvinces] = useState<string[]>([]);
  const [openToWork, setOpenToWork] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      const initial = buildInitialState(completeProfile);
      setSpecialization(initial.specialization);
      setExperienceSummary(initial.experienceSummary);
      setCertifications(initial.certifications);
      setPreferredCategories(fromDelimitedString(initial.staffPreferredCategories));
      setPreferredRegions(fromDelimitedString(initial.preferredRegions));
      setAvailabilityType((initial.staffAvailabilityType as AvailabilityType) || "ITALY");
      setAvailableFrom(initial.staffAvailableFrom);
      setPreferredProvinces(fromDelimitedString(initial.staffPreferredProvinces));
      setOpenToWork(initial.openToWork);
    }
  }, [visible, completeProfile]);

  async function handleSave() {
    setIsSaving(true);

    try {
      const baseState = buildInitialState(completeProfile);
      const mergedState = {
        ...baseState,
        certifications,
        experienceSummary,
        openToWork,
        preferredRegions: preferredRegions.join(", "),
        staffAvailabilityType: availabilityType,
        staffAvailableFrom: availableFrom,
        staffPreferredCategories: preferredCategories.join(", "),
        staffPreferredProvinces: preferredProvinces.join(", "),
        specialization,
      };

      const payload = buildFullUpdatePayload(completeProfile, mergedState);
      payload.profile.birth_date = validateBirthDateInput(
        baseState.birthDate,
      ).isoValue;

      await updateCompleteProfessionalProfile(payload);
      onSaved();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore durante il salvataggio.";
      Alert.alert("Errore", message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <EditModalShell
      isSaving={isSaving}
      onClose={onClose}
      onSave={handleSave}
      title="Informazioni sportive"
      visible={visible}
    >
      {/* Specialization pill selector */}
      <View style={styles.fieldGroup}>
        <AppText style={styles.fieldLabel}>Specializzazione</AppText>
        <View style={styles.pillRow}>
          {specializationOptions.map((option) => (
            <Button
              key={option.value}
              label={option.label}
              onPress={() => setSpecialization(option.value)}
              variant={
                specialization === option.value ? "primary" : "chipAction"
              }
            />
          ))}
        </View>
      </View>

      {/* Experience summary */}
      <Field
        label="Esperienza"
        multiline
        onChangeText={setExperienceSummary}
        placeholder="Descrivi brevemente la tua esperienza"
        value={experienceSummary}
      />

      {/* Certifications */}
      <Field
        label="Certificazioni"
        onChangeText={setCertifications}
        placeholder="Es. UEFA B, Preparatore atletico"
        value={certifications}
      />

      {/* Availability + geographic selection */}
      <WhereToPlaySection
        availabilityType={availabilityType}
        categories={[]}
        hideCategories
        infoMessages={{
          ITALY: "",
          REGIONS: "Indica una o più regioni in cui sei disponibile a collaborare con club e staff tecnici.",
          PROVINCES: "Indica una o più province in cui sei disponibile a collaborare con club e staff tecnici.",
        }}
        isAvailable={openToWork}
        onAvailabilityTypeChange={setAvailabilityType}
        onCategoriesChange={() => undefined}
        onIsAvailableChange={(value) => {
          setOpenToWork(value);
          if (!value) {
            setAvailableFrom("");
            setPreferredCategories([]);
            setPreferredRegions([]);
            setPreferredProvinces([]);
            setAvailabilityType("ITALY");
          }
        }}
        onProvincesChange={setPreferredProvinces}
        onRegionsChange={setPreferredRegions}
        provinces={preferredProvinces}
        provincesHelperText="Puoi selezionare più province in cui collaborare."
        provincesLabel="Province di interesse"
        regions={preferredRegions}
        regionsHelperText="Puoi selezionare più regioni in cui collaborare."
        regionsLabel="Regioni di interesse"
        toggleLabel="Disponibile a nuove collaborazioni"
        toggleSubtitle="Il tuo profilo può comparire tra gli staff tecnici disponibili."
      />

      {openToWork ? (
        <InterestCategoriesSelector
          label="Categorie di interesse"
          onChange={setPreferredCategories}
          value={preferredCategories}
        />
      ) : null}

      {openToWork ? (
        <SelectField
          label="Disponibile da"
          onChange={setAvailableFrom}
          options={AVAILABLE_FROM_OPTIONS}
          placeholder="Seleziona disponibilità"
          value={availableFrom}
        />
      ) : null}
    </EditModalShell>
  );
}

const styles = StyleSheet.create({
  fieldGroup: {
    gap: spacing[8],
  },
  fieldLabel: {
    color: colors.textPrimary,
    fontWeight: "600",
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
});
