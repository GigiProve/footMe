import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, TextInput, View } from "react-native";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";
import {
  deleteCoachAchievement,
  upsertCoachAchievement,
  type CoachAchievementRecord,
} from "../profile-service";
import { EditModalShell } from "./EditModalShell";
import Ionicons from "@expo/vector-icons/Ionicons";

type Props = {
  achievements: CoachAchievementRecord[];
  coachProfileId: string;
  onClose: () => void;
  onSaved: () => void;
  visible: boolean;
};

type AchievementType = CoachAchievementRecord["achievement_type"];

const ACHIEVEMENT_TYPES: { label: string; value: AchievementType }[] = [
  { label: "Campionato", value: "campionato" },
  { label: "Promozione", value: "promozione" },
  { label: "Coppa", value: "coppa" },
  { label: "Playoff", value: "playoff" },
  { label: "Altro", value: "altro" },
];

type AddFormState = {
  achievement_type: AchievementType;
  description: string;
  label: string;
};

const DEFAULT_FORM: AddFormState = {
  achievement_type: "campionato",
  description: "",
  label: "",
};

export function EditCoachAchievementsModal({
  achievements,
  coachProfileId,
  onClose,
  onSaved,
  visible,
}: Props) {
  const [isSaving, setIsSaving] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState<AddFormState>(DEFAULT_FORM);

  useEffect(() => {
    if (visible) {
      setIsAdding(false);
      setForm(DEFAULT_FORM);
    }
  }, [visible]);

  async function handleAdd() {
    if (!form.label.trim()) {
      Alert.alert("Errore", "Inserisci una descrizione del risultato.");
      return;
    }
    setIsSaving(true);
    try {
      await upsertCoachAchievement({
        achievement_type: form.achievement_type,
        coach_profile_id: coachProfileId,
        description: form.description.trim() || null,
        label: form.label.trim(),
        sort_order: achievements.length,
      });
      setIsAdding(false);
      setForm(DEFAULT_FORM);
      onSaved();
    } catch (error) {
      Alert.alert(
        "Errore",
        error instanceof Error ? error.message : "Salvataggio non riuscito.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    Alert.alert("Elimina risultato", "Sei sicuro di voler eliminare questo risultato?", [
      { style: "cancel", text: "Annulla" },
      {
        onPress: async () => {
          setIsSaving(true);
          try {
            await deleteCoachAchievement(id);
            onSaved();
          } catch (error) {
            Alert.alert(
              "Errore",
              error instanceof Error ? error.message : "Eliminazione non riuscita.",
            );
          } finally {
            setIsSaving(false);
          }
        },
        style: "destructive",
        text: "Elimina",
      },
    ]);
  }

  function handleSave() {
    if (isAdding) {
      handleAdd();
    } else {
      onClose();
    }
  }

  return (
    <EditModalShell
      isSaving={isSaving}
      onClose={onClose}
      onSave={handleSave}
      saveLabel={isAdding ? "Aggiungi" : "Chiudi"}
      title="Risultati Allenatore"
      visible={visible}
    >
      {/* Existing achievements */}
      {achievements.length > 0 ? (
        <View style={styles.list}>
          {achievements.map((a) => (
            <View key={a.id} style={styles.listItem}>
              <View style={styles.listItemContent}>
                <AppText variant="bodySm" style={styles.listItemLabel}>{a.label}</AppText>
                {a.description ? (
                  <AppText variant="caption" color="secondary">{a.description}</AppText>
                ) : null}
              </View>
              <Pressable
                accessibilityLabel="Elimina risultato"
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => handleDelete(a.id)}
              >
                <Ionicons color={colors.danger} name="trash-outline" size={18} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        !isAdding ? (
          <AppText color="secondary" variant="bodySm">
            Nessun risultato inserito.
          </AppText>
        ) : null
      )}

      {/* Add form */}
      {isAdding ? (
        <View style={styles.addForm}>
          <AppText variant="caption" style={styles.fieldLabel}>Tipo di risultato</AppText>
          <View style={styles.typeChips}>
            {ACHIEVEMENT_TYPES.map((t) => (
              <Pressable
                key={t.value}
                accessibilityRole="button"
                onPress={() => setForm((prev) => ({ ...prev, achievement_type: t.value }))}
                style={[
                  styles.typeChip,
                  form.achievement_type === t.value && styles.typeChipSelected,
                ]}
              >
                <AppText
                  variant="caption"
                  style={[
                    styles.typeChipText,
                    form.achievement_type === t.value && styles.typeChipTextSelected,
                  ]}
                >
                  {t.label}
                </AppText>
              </Pressable>
            ))}
          </View>

          <AppText variant="caption" style={styles.fieldLabel}>Descrizione *</AppText>
          <TextInput
            placeholder="es. Lecco - Campionato di Promozione"
            placeholderTextColor={colors.textSecondary}
            style={styles.textInput}
            value={form.label}
            onChangeText={(v) => setForm((prev) => ({ ...prev, label: v }))}
          />

          <AppText variant="caption" style={styles.fieldLabel}>Note (opzionale)</AppText>
          <TextInput
            placeholder="Stagione, dettagli..."
            placeholderTextColor={colors.textSecondary}
            style={styles.textInput}
            value={form.description}
            onChangeText={(v) => setForm((prev) => ({ ...prev, description: v }))}
          />
        </View>
      ) : (
        <Button
          label="Aggiungi risultato"
          onPress={() => setIsAdding(true)}
          variant="secondary"
        />
      )}
    </EditModalShell>
  );
}

const styles = StyleSheet.create({
  addForm: {
    gap: spacing[8],
  },
  fieldLabel: {
    color: colors.textSecondary,
    marginBottom: spacing[4],
    marginTop: spacing[8],
  },
  list: {
    gap: spacing[12],
  },
  listItem: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[12],
    paddingVertical: spacing[10],
  },
  listItemContent: {
    flex: 1,
    gap: spacing[4],
  },
  listItemLabel: {
    fontWeight: "600",
  },
  textInput: {
    backgroundColor: colors.inputBackground,
    borderColor: colors.border,
    borderRadius: radius[8],
    borderWidth: 1,
    color: colors.textPrimary,
    fontSize: 15,
    padding: spacing[12],
  },
  typeChip: {
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[6],
  },
  typeChipSelected: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary,
  },
  typeChipText: {
    color: colors.textPrimary,
    fontWeight: "500",
  },
  typeChipTextSelected: {
    color: colors.inkInvert,
  },
  typeChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
    marginBottom: spacing[8],
  },
});
