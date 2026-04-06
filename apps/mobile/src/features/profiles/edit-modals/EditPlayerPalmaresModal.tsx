import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button, Input } from "../../../ui";
import type { CompleteProfessionalProfile, PlayerPalmaresRecord } from "../profile-service";
import { supabase } from "../../../lib/supabase";
import { EditModalShell } from "./EditModalShell";

type PalmaresType = "trophy" | "medal" | "top_scorer";

type PalmaresEntry = {
  clubName: string;
  competitionName: string;
  id: string;
  palmaresType: PalmaresType;
  seasonLabel: string;
};

type Props = {
  completeProfile: CompleteProfessionalProfile;
  onClose: () => void;
  onSaved: () => void;
  userId: string;
  visible: boolean;
};

const TYPE_OPTIONS: { label: string; value: PalmaresType }[] = [
  { label: "Trofeo", value: "trophy" },
  { label: "Medaglia", value: "medal" },
  { label: "Capocannoniere", value: "top_scorer" },
];

function recordToEntry(r: PlayerPalmaresRecord): PalmaresEntry {
  return {
    clubName: r.club_name,
    competitionName: r.competition_name,
    id: r.id,
    palmaresType: (r.palmares_type as PalmaresType) || "trophy",
    seasonLabel: r.season_label,
  };
}

function newEntry(): PalmaresEntry {
  return {
    clubName: "",
    competitionName: "",
    id: `new-${Date.now()}`,
    palmaresType: "trophy",
    seasonLabel: "",
  };
}

export function EditPlayerPalmaresModal({
  completeProfile,
  onClose,
  onSaved,
  userId,
  visible,
}: Props) {
  const [entries, setEntries] = useState<PalmaresEntry[]>(() =>
    completeProfile.playerPalmares.map(recordToEntry),
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setEntries(completeProfile.playerPalmares.map(recordToEntry));
    }
  }, [visible, completeProfile]);

  function handleUpdate(index: number, patch: Partial<PalmaresEntry>) {
    setEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, ...patch } : e)),
    );
  }

  function handleRemove(index: number) {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    const hasEmpty = entries.some(
      (e) => !e.competitionName.trim() || !e.seasonLabel.trim() || !e.clubName.trim(),
    );
    if (hasEmpty) {
      Alert.alert("Campi mancanti", "Compila tutti i campi per ogni riconoscimento.");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.rpc("save_player_palmares", {
        p_profile_id: userId,
        p_entries: entries.map((e, i) => ({
          club_name: e.clubName,
          competition_name: e.competitionName,
          palmares_type: e.palmaresType,
          season_label: e.seasonLabel,
          sort_order: i,
        })),
      });
      if (error) throw error;
      onSaved();
    } catch {
      Alert.alert("Errore", "Impossibile salvare il palmarès.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <EditModalShell
      isSaving={isSaving}
      onClose={onClose}
      onSave={handleSave}
      title="Palmarès"
      visible={visible}
    >
      {entries.map((entry, index) => (
        <View key={entry.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <AppText variant="titleSm">Riconoscimento {index + 1}</AppText>
            <Pressable
              accessibilityLabel="Rimuovi"
              hitSlop={8}
              onPress={() => handleRemove(index)}
            >
              <Ionicons color={colors.danger} name="trash-outline" size={20} />
            </Pressable>
          </View>

          <Input
            label="Competizione"
            placeholder="es. Campionato Eccellenza"
            value={entry.competitionName}
            onChangeText={(v) => handleUpdate(index, { competitionName: v })}
          />
          <Input
            label="Stagione"
            placeholder="es. 2023/2024"
            value={entry.seasonLabel}
            onChangeText={(v) => handleUpdate(index, { seasonLabel: v })}
          />
          <Input
            label="Squadra"
            placeholder="es. ASD Vittoria"
            value={entry.clubName}
            onChangeText={(v) => handleUpdate(index, { clubName: v })}
          />

          <View style={styles.typeRow}>
            {TYPE_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => handleUpdate(index, { palmaresType: opt.value })}
                style={[
                  styles.typeChip,
                  entry.palmaresType === opt.value
                    ? styles.typeChipSelected
                    : styles.typeChipDefault,
                ]}
              >
                <AppText
                  variant="bodySm"
                  style={[
                    styles.typeChipText,
                    entry.palmaresType === opt.value
                      ? styles.typeChipTextSelected
                      : styles.typeChipTextDefault,
                  ]}
                >
                  {opt.label}
                </AppText>
              </Pressable>
            ))}
          </View>
        </View>
      ))}

      <Button
        label="+ Aggiungi riconoscimento"
        onPress={() => setEntries((prev) => [...prev, newEntry()])}
        variant="outline"
      />
    </EditModalShell>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[8],
    gap: spacing[12],
    padding: spacing[16],
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  typeChip: {
    borderRadius: radius[6],
    borderWidth: 1,
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[6],
  },
  typeChipDefault: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  typeChipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  typeChipText: {
    fontWeight: "600",
  },
  typeChipTextDefault: {
    color: colors.textPrimary,
  },
  typeChipTextSelected: {
    color: "#fff",
  },
  typeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
});
