import { useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import type { StaffSpecialization } from "../../onboarding/create-initial-profile";
import type { CompleteProfessionalProfile } from "../profile-service";
import { updateCompleteProfessionalProfile } from "../profile-service";
import {
  buildFullUpdatePayload,
  buildInitialState,
  specializationOptions,
} from "../profile-edit-helpers";
import { validateBirthDateInput } from "../profile-form-utils";
import { ProfileField as Field } from "../profile-screen-components";
import { EditModalShell } from "./EditModalShell";
import { AppText, Button } from "../../../ui";
import { colors, spacing } from "../../../theme/tokens";

type StaffFormState = {
  certifications: string;
  experienceSummary: string;
  openToWork: boolean;
  preferredRegions: string;
  specialization: StaffSpecialization;
};

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
  const [specialization, setSpecialization] = useState<StaffSpecialization>("fitness_coach");
  const [experienceSummary, setExperienceSummary] = useState("");
  const [certifications, setCertifications] = useState("");
  const [preferredRegions, setPreferredRegions] = useState("");
  const [openToWork, setOpenToWork] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      const initial = buildInitialState(completeProfile);
      setSpecialization(initial.specialization);
      setExperienceSummary(initial.experienceSummary);
      setCertifications(initial.certifications);
      setPreferredRegions(initial.preferredRegions);
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
        preferredRegions,
        specialization,
      };

      const payload = buildFullUpdatePayload(completeProfile, mergedState);
      payload.profile.birth_date = validateBirthDateInput(baseState.birthDate).isoValue;

      await updateCompleteProfessionalProfile(payload);
      onSaved();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Errore durante il salvataggio.";
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
              variant={specialization === option.value ? "primary" : "chipAction"}
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

      {/* Preferred regions */}
      <Field
        label="Aree di interesse"
        onChangeText={setPreferredRegions}
        placeholder="Es. Lombardia, Piemonte"
        value={preferredRegions}
      />

      {/* Open to work boolean field */}
      <View style={styles.fieldGroup}>
        <AppText style={styles.fieldLabel}>Disponibile a lavorare</AppText>
        <View style={styles.booleanRow}>
          <Button
            label="Si"
            onPress={() => setOpenToWork(true)}
            variant={openToWork ? "primary" : "chipAction"}
          />
          <Button
            label="No"
            onPress={() => setOpenToWork(false)}
            variant={!openToWork ? "primary" : "chipAction"}
          />
        </View>
      </View>
    </EditModalShell>
  );
}

const styles = StyleSheet.create({
  booleanRow: {
    flexDirection: "row",
    gap: spacing[8],
  },
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
