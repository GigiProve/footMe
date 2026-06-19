import { useEffect, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, View } from "react-native";

import { EditModalShell } from "../../profiles/edit-modals/EditModalShell";
import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Avatar, Input } from "../../../ui";
import { addLinkedMember, addManualMember, suggestProfiles } from "../membership-service";
import { fetchClubTeams, type ClubTeam } from "../team-service";
import type { MemberRole, ProfileSuggestion } from "../membership-types";

type AddMemberModalProps = {
  clubId: string;
  memberRole: MemberRole;
  onClose: () => void;
  onSaved: () => void;
  visible: boolean;
};

const roleTitleMap: Record<MemberRole, string> = {
  coach: "Aggiungi allenatore",
  director: "Aggiungi dirigente",
  player: "Aggiungi giocatore",
  staff: "Aggiungi staff",
};

export function AddMemberModal({
  clubId,
  memberRole,
  onClose,
  onSaved,
  visible,
}: AddMemberModalProps) {
  const [name, setName] = useState("");
  const [staffTitle, setStaffTitle] = useState("");
  const [season, setSeason] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [teams, setTeams] = useState<ClubTeam[]>([]);
  const [suggestions, setSuggestions] = useState<ProfileSuggestion[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<ProfileSuggestion | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible || !clubId) return;
    fetchClubTeams(clubId)
      .then(setTeams)
      .catch(() => {
        // Non-blocking — team picker is optional
      });
  }, [visible, clubId]);

  function resetState() {
    setName("");
    setStaffTitle("");
    setSeason("");
    setSelectedTeamId(null);
    setSuggestions([]);
    setSelectedProfile(null);
    setIsSaving(false);
  }

  function handleClose() {
    resetState();
    onClose();
  }

  function handleNameChange(text: string) {
    setName(text);
    setSelectedProfile(null);

    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (text.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const results = await suggestProfiles(text);
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      }
    }, 300);

    setSearchTimeout(timeout);
  }

  function handleSelectProfile(profile: ProfileSuggestion) {
    setSelectedProfile(profile);
    setName(profile.full_name);
    setSuggestions([]);
  }

  async function handleSave() {
    if (!name.trim() && !selectedProfile) {
      return;
    }

    setIsSaving(true);

    try {
      if (selectedProfile) {
        await addLinkedMember({
          clubId,
          memberRole,
          profileId: selectedProfile.profile_id,
          season: season.trim() || undefined,
          staffTitle: staffTitle || undefined,
          teamId: selectedTeamId ?? undefined,
        });
      } else {
        await addManualMember({
          clubId,
          manualName: name.trim(),
          memberRole,
          staffTitle: staffTitle || undefined,
        });
      }

      resetState();
      onSaved();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Errore durante il salvataggio";
      Alert.alert("Errore", message);
    } finally {
      setIsSaving(false);
    }
  }

  const showStaffTitle = memberRole === "staff" || memberRole === "coach" || memberRole === "director";
  const isLinkedPath = selectedProfile !== null;

  return (
    <EditModalShell
      isSaving={isSaving}
      onClose={handleClose}
      onSave={handleSave}
      title={roleTitleMap[memberRole]}
      visible={visible}
    >
      <View style={styles.inputContainer}>
        {selectedProfile ? (
          <View style={styles.selectedProfile}>
            <Avatar
              name={selectedProfile.full_name}
              size="md"
              uri={selectedProfile.avatar_url}
            />
            <View style={styles.selectedInfo}>
              <AppText variant="titleSm">{selectedProfile.full_name}</AppText>
              <AppText variant="bodySm" color="secondary">
                {selectedProfile.city ?? selectedProfile.region ?? ""}
              </AppText>
            </View>
            <Pressable
              onPress={() => {
                setSelectedProfile(null);
                setName("");
              }}
            >
              <AppText variant="bodySm" color="danger">Rimuovi</AppText>
            </Pressable>
          </View>
        ) : (
          <Input
            autoCapitalize="words"
            label="Nome e cognome"
            onChangeText={handleNameChange}
            placeholder="Cerca o inserisci manualmente"
            value={name}
          />
        )}

        {suggestions.length > 0 && !selectedProfile ? (
          <View style={styles.suggestionsContainer}>
            <AppText variant="caption" color="muted">
              Suggerimenti — tocca per collegare
            </AppText>
            <FlatList
              data={suggestions}
              keyExtractor={(item) => item.profile_id}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => handleSelectProfile(item)}
                  style={({ pressed }) => [
                    styles.suggestionRow,
                    pressed ? styles.suggestionRowPressed : null,
                  ]}
                >
                  <Avatar name={item.full_name} size="sm" uri={item.avatar_url} />
                  <View style={styles.suggestionInfo}>
                    <AppText variant="titleSm">{item.full_name}</AppText>
                    <AppText variant="bodySm" color="secondary">
                      {[item.city, item.region].filter(Boolean).join(", ")}
                    </AppText>
                  </View>
                </Pressable>
              )}
              scrollEnabled={false}
            />
          </View>
        ) : null}
      </View>

      {showStaffTitle ? (
        <Input
          label="Ruolo nello staff"
          onChangeText={setStaffTitle}
          placeholder="Es. Preparatore atletico, Direttore sportivo"
          value={staffTitle}
        />
      ) : null}

      {isLinkedPath ? (
        <>
          {teams.length > 0 ? (
            <View style={styles.teamSection}>
              <AppText variant="bodySm" color="secondary">
                Squadra (opzionale)
              </AppText>
              <View style={styles.teamChips}>
                <Pressable
                  onPress={() => setSelectedTeamId(null)}
                  style={[
                    styles.teamChip,
                    selectedTeamId === null ? styles.teamChipActive : null,
                  ]}
                >
                  <AppText
                    variant="bodySm"
                    color={selectedTeamId === null ? "inverse" : "secondary"}
                  >
                    Tutta la società
                  </AppText>
                </Pressable>
                {teams.map((team) => (
                  <Pressable
                    key={team.id}
                    onPress={() => setSelectedTeamId(team.id)}
                    style={[
                      styles.teamChip,
                      selectedTeamId === team.id ? styles.teamChipActive : null,
                    ]}
                  >
                    <AppText
                      variant="bodySm"
                      color={selectedTeamId === team.id ? "inverse" : "secondary"}
                    >
                      {team.name}
                    </AppText>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <Input
            label="Stagione (opzionale)"
            onChangeText={setSeason}
            placeholder="Es. 2025/2026"
            value={season}
          />

          <View style={styles.confirmNote}>
            <AppText variant="caption" color="secondary">
              La persona dovrà confermare l'assegnazione.
            </AppText>
          </View>
        </>
      ) : null}
    </EditModalShell>
  );
}

const styles = StyleSheet.create({
  confirmNote: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[8],
    padding: spacing[10],
  },
  inputContainer: {
    gap: spacing[8],
  },
  selectedInfo: {
    flex: 1,
    gap: spacing[4],
  },
  selectedProfile: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[12],
    flexDirection: "row",
    gap: spacing[12],
    padding: spacing[12],
  },
  suggestionInfo: {
    flex: 1,
    gap: spacing[4],
  },
  suggestionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[10],
    paddingVertical: spacing[8],
  },
  suggestionRowPressed: {
    opacity: 0.7,
  },
  suggestionsContainer: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: 1,
    gap: spacing[8],
    padding: spacing[12],
  },
  teamChip: {
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[6],
  },
  teamChipActive: {
    backgroundColor: colors.surfaceInverse,
    borderColor: colors.surfaceInverse,
  },
  teamChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  teamSection: {
    gap: spacing[8],
  },
});
