import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { KeyboardAwareForm } from "../../../components/ui/keyboard-aware-form";
import { MediaPickerField } from "../../../components/ui/media-picker-field";
import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Avatar, Card, ChipGroup, Input } from "../../../ui";
import {
  AGENT_MEDIA_OPERATION_TYPE_OPTIONS,
  AGENT_MEDIA_TAG_OPTIONS,
  type AgentMediaItemRecord,
  type AgentMediaOperationType,
  type AgentMediaTag,
  type AgentMediaTaggedPlayerRecord,
} from "../agent-media";
import {
  createLocalUuid,
  type AgentPlayerCandidate,
} from "../agent-profile";
import {
  pickAndUploadMedia,
  ProfileMediaUploadError,
  removeMediaFromStorage,
  type UploadedMediaItem,
} from "../media-upload-service";
import {
  saveAgentProfileMedia,
  searchAgentPlayerCandidates,
  type CompleteProfessionalProfile,
} from "../profile-service";

type EditAgentMediaModalProps = {
  completeProfile: CompleteProfessionalProfile;
  editingItemId?: string | null;
  onClose: () => void;
  onSaved: () => void;
  userId: string;
  visible: boolean;
};

const SEARCH_DEBOUNCE_MS = 250;

export function EditAgentMediaModal({
  completeProfile,
  editingItemId = null,
  onClose,
  onSaved,
  userId,
  visible,
}: EditAgentMediaModalProps) {
  const originalItems = useMemo(
    () => completeProfile.agentProfile?.media_items ?? [],
    [completeProfile.agentProfile?.media_items],
  );
  const editingItem = useMemo(
    () => originalItems.find((item) => item.id === editingItemId) ?? null,
    [editingItemId, originalItems],
  );
  const [draft, setDraft] = useState<AgentMediaItemRecord>(createEmptyAgentMediaDraft);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AgentPlayerCandidate[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setDraft(editingItem ? cloneAgentMediaItem(editingItem) : createEmptyAgentMediaDraft());
    setSearchQuery("");
    setSuggestions([]);
    setIsSaving(false);
    setIsUploading(false);
  }, [editingItem, visible]);

  useEffect(() => {
    let isMounted = true;

    const timeout = setTimeout(() => {
      async function loadSuggestions() {
        if (searchQuery.trim().length < 2) {
          if (isMounted) {
            setSuggestions([]);
          }
          return;
        }

        try {
          const results = await searchAgentPlayerCandidates(searchQuery.trim());

          if (isMounted) {
            setSuggestions(results);
          }
        } catch {
          if (isMounted) {
            setSuggestions([]);
          }
        }
      }

      void loadSuggestions();
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, [searchQuery]);

  const selectedProfileIds = useMemo(
    () => new Set(draft.tagged_players.map((player) => player.profile_id)),
    [draft.tagged_players],
  );
  const saveDisabled = isUploading || !draft.url;
  const saveLabel = editingItem ? "Aggiorna" : "Pubblica";

  function patchDraft<Key extends keyof AgentMediaItemRecord>(
    key: Key,
    value: AgentMediaItemRecord[Key],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function handlePickMedia() {
    setIsUploading(true);

    try {
      const uploads: UploadedMediaItem[] = await pickAndUploadMedia({
        folder: "agent-media",
        mediaTypes: ["images", "videos"],
        userId,
      });

      if (uploads.length === 0) {
        return;
      }

      const upload = uploads[0];
      patchDraft("thumbnail_url", upload.type === "image" ? upload.url : null);
      patchDraft("type", upload.type === "video" ? "video" : "image");
      patchDraft("url", upload.url);
    } catch (error) {
      const message =
        error instanceof ProfileMediaUploadError
          ? error.message
          : "Caricamento media non riuscito.";
      Alert.alert("Errore", message);
    } finally {
      setIsUploading(false);
    }
  }

  function handleTagChange(value: AgentMediaTag | null) {
    patchDraft("tag", value);
  }

  function handleOperationTypeChange(value: AgentMediaOperationType | null) {
    patchDraft("operation_type", value);
  }

  function handleDescriptionChange(value: string) {
    patchDraft("description", value.trim().length > 0 ? value : null);
  }

  function handleAddTaggedPlayer(candidate: AgentPlayerCandidate) {
    if (selectedProfileIds.has(candidate.profile_id)) {
      return;
    }

    patchDraft("tagged_players", [
      ...draft.tagged_players,
      {
        avatar_url: candidate.avatar_url,
        display_name: candidate.full_name,
        profile_id: candidate.profile_id,
      } satisfies AgentMediaTaggedPlayerRecord,
    ]);
    setSearchQuery("");
    setSuggestions([]);
  }

  function handleRemoveTaggedPlayer(profileId: string) {
    patchDraft(
      "tagged_players",
      draft.tagged_players.filter((player) => player.profile_id !== profileId),
    );
  }

  async function handleSave() {
    if (!completeProfile.agentProfile) {
      Alert.alert("Errore", "Profilo agente non disponibile.");
      return;
    }

    if (!draft.url) {
      Alert.alert("Contenuto richiesto", "Seleziona una foto o un video prima di pubblicare.");
      return;
    }

    const normalizedDraft: AgentMediaItemRecord = {
      ...draft,
      created_at: editingItem?.created_at ?? draft.created_at ?? new Date().toISOString(),
      description:
        typeof draft.description === "string" && draft.description.trim()
          ? draft.description.trim()
          : null,
      thumbnail_url: draft.type === "image" ? draft.url : draft.thumbnail_url,
    };

    const nextItems = editingItem
      ? originalItems.map((item) => (item.id === editingItem.id ? normalizedDraft : item))
      : [normalizedDraft, ...originalItems];

    setIsSaving(true);

    try {
      await saveAgentProfileMedia({
        agentProfile: completeProfile.agentProfile,
        mediaItems: nextItems,
        profileId: userId,
      });

      if (editingItem && editingItem.url !== normalizedDraft.url) {
        await Promise.allSettled([removeMediaFromStorage(editingItem.url)]);
      }

      onSaved();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Salvataggio contenuto non riuscito.";
      Alert.alert("Errore", message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={visible}>
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Chiudi editor media agente"
            hitSlop={8}
            onPress={onClose}
            style={({ pressed }) => [
              styles.headerIconButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Ionicons color={colors.textPrimary} name="close" size={22} />
          </Pressable>

          <AppText variant="titleSm">
            {editingItem ? "Modifica contenuto" : "Nuovo contenuto"}
          </AppText>

          <Pressable
            accessibilityLabel={editingItem ? "Aggiorna contenuto media agente" : "Pubblica contenuto media agente"}
            disabled={saveDisabled || isSaving}
            hitSlop={8}
            onPress={() => {
              void handleSave();
            }}
            style={({ pressed }) => [
              styles.headerAction,
              (saveDisabled || isSaving) ? styles.headerActionDisabled : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <AppText color="accent" variant="bodySm">
              {isSaving ? "Salvataggio..." : saveLabel}
            </AppText>
          </Pressable>
        </View>

        <KeyboardAwareForm contentContainerStyle={styles.scrollContent}>
          <MediaPickerField
            buttonLabel={draft.url ? "Sostituisci media" : "Seleziona foto o video"}
            helperText="Un contenuto per volta, con metadati opzionali e calciatori collegati."
            isUploading={isUploading}
            label="Media"
            mediaType={draft.type}
            onPick={handlePickMedia}
            previewLabel="Anteprima contenuto media agente"
            previewUrl={(draft.thumbnail_url ?? draft.url) || null}
          />

          <Card style={styles.sectionCard}>
            <AppText variant="titleSm">Tag contenuto</AppText>
            <ChipGroup
              onChange={handleTagChange}
              options={AGENT_MEDIA_TAG_OPTIONS}
              value={draft.tag}
            />
          </Card>

          <Card style={styles.sectionCard}>
            <AppText variant="titleSm">Tipo operazione</AppText>
            <ChipGroup
              onChange={handleOperationTypeChange}
              options={AGENT_MEDIA_OPERATION_TYPE_OPTIONS}
              value={draft.operation_type}
            />
          </Card>

          <Card style={styles.sectionCard}>
            <AppText variant="titleSm">Tag giocatori</AppText>
            <Input
              label="Cerca un calciatore su FootMe"
              onChangeText={setSearchQuery}
              placeholder="Digita nome e cognome"
              value={searchQuery}
            />

            {draft.tagged_players.length > 0 ? (
              <View style={styles.selectedPlayersWrap}>
                {draft.tagged_players.map((player) => (
                  <View key={player.profile_id} style={styles.selectedPlayerChip}>
                    <Avatar name={player.display_name} size="sm" uri={player.avatar_url} />
                    <AppText variant="bodySm">{player.display_name}</AppText>
                    <Pressable
                      accessibilityLabel={`Rimuovi ${player.display_name} dai giocatori taggati`}
                      hitSlop={8}
                      onPress={() => handleRemoveTaggedPlayer(player.profile_id)}
                      style={({ pressed }) => [pressed ? styles.pressed : null]}
                    >
                      <Ionicons color={colors.accentStrong} name="close" size={16} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            {suggestions.length > 0 ? (
              <View style={styles.suggestionsSurface}>
                <ScrollView
                  contentContainerStyle={styles.suggestionsContent}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                >
                  {suggestions.map((suggestion) => {
                    const isSelected = selectedProfileIds.has(suggestion.profile_id);

                    return (
                      <Pressable
                        accessibilityRole="button"
                        disabled={isSelected}
                        key={suggestion.profile_id}
                        onPress={() => handleAddTaggedPlayer(suggestion)}
                        style={[
                          styles.suggestionRow,
                          isSelected ? styles.suggestionRowDisabled : null,
                        ]}
                      >
                        <Avatar
                          name={suggestion.full_name}
                          size="md"
                          uri={suggestion.avatar_url}
                        />
                        <View style={styles.suggestionText}>
                          <AppText variant="titleSm">{suggestion.full_name}</AppText>
                          <AppText color="secondary" variant="bodySm">
                            {buildPlayerSummaryLine(suggestion)}
                          </AppText>
                        </View>
                        <Ionicons
                          color={isSelected ? colors.textMuted : colors.accent}
                          name={isSelected ? "checkmark-circle" : "add-circle-outline"}
                          size={22}
                        />
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : searchQuery.trim().length >= 2 ? (
              <View style={styles.inlineEmptyState}>
                <AppText color="secondary" variant="bodySm">
                  Nessun calciatore FootMe trovato con questo nome.
                </AppText>
              </View>
            ) : null}
          </Card>

          <Card style={styles.sectionCard}>
            <Input
              label="Descrizione"
              multiline
              onChangeText={handleDescriptionChange}
              placeholder="Aggiungi una descrizione del contenuto"
              value={draft.description ?? ""}
            />
          </Card>
        </KeyboardAwareForm>
      </SafeAreaView>
    </Modal>
  );
}

function cloneAgentMediaItem(item: AgentMediaItemRecord): AgentMediaItemRecord {
  return {
    ...item,
    tagged_players: [...item.tagged_players],
  };
}

function createEmptyAgentMediaDraft(): AgentMediaItemRecord {
  return {
    created_at: null,
    description: null,
    id: createLocalUuid(),
    operation_type: null,
    tag: null,
    tagged_players: [],
    thumbnail_url: null,
    type: "image",
    url: "",
  };
}

function buildPlayerSummaryLine(candidate: AgentPlayerCandidate) {
  const parts = [
    candidate.primary_position ? getPlayerPositionLabel(candidate.primary_position) : null,
    candidate.birth_year ? String(candidate.birth_year) : null,
    candidate.category_label,
    candidate.is_free_agent ? "Svincolato" : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "Profilo calciatore FootMe";
}

function getPlayerPositionLabel(position: AgentPlayerCandidate["primary_position"]) {
  if (position === "goalkeeper") return "Portiere";
  if (position === "defender") return "Difensore";
  if (position === "midfielder") return "Centrocampista";
  if (position === "forward") return "Attaccante";
  return null;
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[12],
  },
  headerAction: {
    minWidth: 72,
  },
  headerActionDisabled: {
    opacity: 0.45,
  },
  headerIconButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  inlineEmptyState: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[12],
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[12],
  },
  pressed: {
    opacity: 0.82,
  },
  root: {
    backgroundColor: colors.background,
    flex: 1,
  },
  scrollContent: {
    gap: spacing[16],
    padding: spacing[20],
  },
  sectionCard: {
    gap: spacing[12],
  },
  selectedPlayerChip: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.full,
    flexDirection: "row",
    gap: spacing[8],
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[6],
  },
  selectedPlayersWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  suggestionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[8],
  },
  suggestionRowDisabled: {
    opacity: 0.55,
  },
  suggestionText: {
    flex: 1,
    gap: spacing[4],
  },
  suggestionsContent: {
    gap: spacing[4],
  },
  suggestionsSurface: {
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: 1,
    maxHeight: 220,
    padding: spacing[8],
  },
});
