import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Input, Toggle } from "../../../ui";
import {
  buildFullUpdatePayload,
  buildInitialState,
} from "../profile-edit-helpers";
import { validateBirthDateInput } from "../profile-form-utils";
import type { CompleteProfessionalProfile } from "../profile-service";
import { updateCompleteProfessionalProfile } from "../profile-service";
import { EditModalShell } from "./EditModalShell";

type SituationFormState = {
  contractExpiry: string;
  contractStatus: string;
  currentCondition: string;
  openToTrials: boolean;
  playerObjectives: string;
};

type Props = {
  completeProfile: CompleteProfessionalProfile;
  onClose: () => void;
  onSaved: () => void;
  userId: string;
  visible: boolean;
};

const CONTRACT_STATUS_OPTIONS = [
  { label: "Tesserato", value: "tesserato" },
  { label: "Svincolato", value: "svincolato" },
  { label: "Non specificato", value: "" },
];

const CONDITION_OPTIONS = [
  { label: "In attività", value: "in_attivita" },
  { label: "Infortunato", value: "infortunato" },
  { label: "In riabilitazione", value: "riabilitazione" },
  { label: "Non specificato", value: "" },
];

function buildForm(profile: CompleteProfessionalProfile): SituationFormState {
  const state = buildInitialState(profile);
  return {
    contractExpiry: state.contractExpiry,
    contractStatus: state.contractStatus,
    currentCondition: state.currentCondition,
    openToTrials: state.openToTrials,
    playerObjectives: state.playerObjectives,
  };
}

function ChipOption({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        selected ? styles.chipSelected : styles.chipDefault,
      ]}
    >
      <AppText
        variant="bodySm"
        style={[styles.chipText, selected ? styles.chipTextSelected : styles.chipTextDefault]}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

export function EditPlayerSituationModal({
  completeProfile,
  onClose,
  onSaved,
  visible,
}: Props) {
  const [form, setForm] = useState<SituationFormState>(() =>
    buildForm(completeProfile),
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) setForm(buildForm(completeProfile));
  }, [visible, completeProfile]);

  async function handleSave() {
    setIsSaving(true);
    try {
      const base = buildInitialState(completeProfile);
      const merged = { ...base, ...form };
      const payload = buildFullUpdatePayload(completeProfile, merged);
      payload.profile.birth_date =
        validateBirthDateInput(base.birthDate).isoValue;
      await updateCompleteProfessionalProfile(payload);
      onSaved();
    } catch {
      Alert.alert("Errore", "Impossibile salvare le informazioni.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <EditModalShell
      isSaving={isSaving}
      onClose={onClose}
      onSave={handleSave}
      title="Situazione e disponibilità"
      visible={visible}
    >
      <View style={styles.fieldGroup}>
        <AppText variant="overline" color="secondary">
          Stato contrattuale
        </AppText>
        <View style={styles.chipsRow}>
          {CONTRACT_STATUS_OPTIONS.map((opt) => (
            <ChipOption
              key={opt.value}
              label={opt.label}
              selected={form.contractStatus === opt.value}
              onPress={() => setForm((p) => ({ ...p, contractStatus: opt.value }))}
            />
          ))}
        </View>
      </View>

      <Input
        label="Scadenza contratto"
        keyboardType="numbers-and-punctuation"
        placeholder="AAAA-MM-GG"
        value={form.contractExpiry}
        onChangeText={(v) => setForm((p) => ({ ...p, contractExpiry: v }))}
      />

      <View style={styles.fieldGroup}>
        <AppText variant="overline" color="secondary">
          Condizione fisica
        </AppText>
        <View style={styles.chipsRow}>
          {CONDITION_OPTIONS.map((opt) => (
            <ChipOption
              key={opt.value}
              label={opt.label}
              selected={form.currentCondition === opt.value}
              onPress={() => setForm((p) => ({ ...p, currentCondition: opt.value }))}
            />
          ))}
        </View>
      </View>

      <Toggle
        label="Disponibile per provini"
        value={form.openToTrials}
        onValueChange={(v) => setForm((p) => ({ ...p, openToTrials: v }))}
      />

      <Input
        label="Obiettivi"
        multiline
        placeholder="Crescita, Progetto stabile, ..."
        helperText="Separa gli obiettivi con una virgola"
        value={form.playerObjectives}
        onChangeText={(v) => setForm((p) => ({ ...p, playerObjectives: v }))}
      />
    </EditModalShell>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: radius[6],
    borderWidth: 1,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[8],
  },
  chipDefault: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
  },
  chipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    fontWeight: "600",
  },
  chipTextDefault: {
    color: colors.textPrimary,
  },
  chipTextSelected: {
    color: "#fff",
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
    marginTop: spacing[6],
  },
  fieldGroup: {
    gap: spacing[4],
  },
});
