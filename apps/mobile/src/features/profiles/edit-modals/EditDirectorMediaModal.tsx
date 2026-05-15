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
import { AppText, Avatar, Button, Card, ChipGroup, Input } from "../../../ui";
import {
  DIRECTOR_MEDIA_TAG_OPTIONS,
  type DirectorMediaItemRecord,
  type DirectorMediaLinkedTarget,
  type DirectorMediaTag,
  type DirectorMediaTargetCandidate,
} from "../director-media";
import {
  pickAndUploadMedia,
  ProfileMediaUploadError,
  removeMediaFromStorage,
  type UploadedMediaItem,
} from "../media-upload-service";
import {
  saveDirectorProfileMedia,
  searchDirectorMediaTargets,
  type CompleteProfessionalProfile,
} from "../profile-service";

type EditDirectorMediaModalProps = {
  completeProfile: CompleteProfessionalProfile;
  editingItemId?: string | null;
  onClose: () => void;
  onSaved: () => void;
  userId: string;
  visible: boolean;
};

const SEARCH_DEBOUNCE_MS = 250;

export function EditDirectorMediaModal({
  completeProfile,
  editingItemId = null,
  onClose,
  onSaved,
  userId,
  visible,
}: EditDirectorMediaModalProps) {
  const originalItems = useMemo(
    () => completeProfile.directorProfile?.media_items ?? [],
    [completeProfile.directorProfile?.media_items],
  );
  const editingItem = useMemo(
    () => originalItems.find((item) => item.id === editingItemId) ?? null,
    [editingItemId, originalItems],
  );
  const [draft, setDraft] = useState<DirectorMediaItemRecord>(
    createEmptyDirectorMediaDraft,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<DirectorMediaTargetCandidate[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setDraft(
      editingItem
        ? cloneDirectorMediaItem(editingItem)
        : createEmptyDirectorMediaDraft(),
    );
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
          const results = await searchDirectorMediaTargets(searchQuery.trim());

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

  const selectedTargetKeys = useMemo(
    () => new Set(draft.linked_targets.map(getLinkedTargetKey)),
    [draft.linked_targets],
  );
  const saveDisabled = isUploading || !draft.url;
  const saveLabel = editingItem ? "Aggiorna" : "Pubblica";

  function patchDraft<Key extends keyof DirectorMediaItemRecord>(
    key: Key,
    value: DirectorMediaItemRecord[Key],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function handlePickMedia() {
    setIsUploading(true);

    try {
      const uploads: UploadedMediaItem[] = await pickAndUploadMedia({
        folder: "director-media",
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

  function handleTagChange(value: DirectorMediaTag | null) {
    patchDraft("tag", value);
  }

  function handleDescriptionChange(value: string) {
    patchDraft("description", value.trim().length > 0 ? value : null);
  }

  function handleToggleFeatured() {
    patchDraft("is_featured", !draft.is_featured);
  }

  function handleAddLinkedTarget(candidate: DirectorMediaTargetCandidate) {
    if (selectedTargetKeys.has(getLinkedTargetKey(candidate))) {
      return;
    }

    patchDraft("linked_targets", [...draft.linked_targets, candidate]);
    setSearchQuery("");
    setSuggestions([]);
  }

  function handleRemoveLinkedTarget(target: DirectorMediaLinkedTarget) {
    const targetKey = getLinkedTargetKey(target);
    patchDraft(
      "linked_targets",
      draft.linked_targets.filter((entry) => getLinkedTargetKey(entry) !== targetKey),
    );
  }

  async function handleSave() {
    if (!completeProfile.directorProfile) {
      Alert.alert("Errore", "Profilo dirigente non disponibile.");
      return;
    }

    if (!draft.url) {
      Alert.alert("Contenuto richiesto", "Seleziona una foto o un video prima di pubblicare.");
      return;
    }

    const normalizedDraft: DirectorMediaItemRecord = {
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
      await saveDirectorProfileMedia({
        directorProfile: completeProfile.directorProfile,
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
            accessibilityLabel="Chiudi editor media dirigente"
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
            accessibilityLabel={
              editingItem
                ? "Aggiorna contenuto media dirigente"
                : "Pubblica contenuto media dirigente"
            }
            disabled={saveDisabled || isSaving}
            hitSlop={8}
            onPress={() => {
              void handleSave();
            }}
            style={({ pressed }) => [
              styles.headerAction,
              saveDisabled || isSaving ? styles.headerActionDisabled : null,
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
            helperText="Un contenuto per volta, con tag e collegamenti opzionali."
            isUploading={isUploading}
            label="Media"
            mediaType={draft.type}
            onPick={handlePickMedia}
            previewLabel="Anteprima contenuto media dirigente"
            previewUrl={
              draft.thumbnail_url ?? (draft.type === "image" ? draft.url : null)
            }
          />

          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderText}>
                <AppText variant="titleSm">Tag contenuto</AppText>
                <AppText color="secondary" variant="bodySm">
                  Opzionale, visibile sulla thumbnail solo se selezionato.
                </AppText>
              </View>
              <Button
                label={draft.is_featured ? "In evidenza" : "Metti in evidenza"}
                onPress={handleToggleFeatured}
                size="sm"
                variant={draft.is_featured ? "primary" : "secondary"}
              />
            </View>
            <ChipGroup
              onChange={handleTagChange}
              options={DIRECTOR_MEDIA_TAG_OPTIONS}
              value={draft.tag}
            />
          </Card>

          <Card style={styles.sectionCard}>
            <Input
              label="Descrizione"
              multiline
              onChangeText={handleDescriptionChange}
              placeholder="Aggiungi una breve descrizione professionale"
              value={draft.description ?? ""}
            />
          </Card>

          <Card style={styles.sectionCard}>
            <AppText variant="titleSm">Profili collegati</AppText>
            <Input
              label="Cerca persone o societa"
              onChangeText={setSearchQuery}
              placeholder="Calciatore, allenatore, staff o club"
              value={searchQuery}
            />

            {draft.linked_targets.length > 0 ? (
              <View style={styles.selectedTargetsWrap}>
                {draft.linked_targets.map((target) => (
                  <View key={getLinkedTargetKey(target)} style={styles.selectedTargetChip}>
                    <Avatar
                      name={target.display_name}
                      size="sm"
                      square={target.target_type === "club"}
                      uri={target.avatar_url}
                    />
                    <View style={styles.selectedTargetText}>
                      <AppText numberOfLines={1} variant="bodySm">
                        {target.display_name}
                      </AppText>
                      {target.subtitle ? (
                        <AppText color="secondary" numberOfLines={1} variant="caption">
                          {target.subtitle}
                        </AppText>
                      ) : null}
                    </View>
                    <Pressable
                      accessibilityLabel={`Rimuovi ${target.display_name} dai profili collegati`}
                      hitSlop={8}
                      onPress={() => handleRemoveLinkedTarget(target)}
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
                    const suggestionKey = getLinkedTargetKey(suggestion);
                    const isSelected = selectedTargetKeys.has(suggestionKey);

                    return (
                      <Pressable
                        accessibilityRole="button"
                        disabled={isSelected}
                        key={suggestionKey}
                        onPress={() => handleAddLinkedTarget(suggestion)}
                        style={[
                          styles.suggestionRow,
                          isSelected ? styles.suggestionRowDisabled : null,
                        ]}
                      >
                        <Avatar
                          name={suggestion.display_name}
                          size="md"
                          square={suggestion.target_type === "club"}
                          uri={suggestion.avatar_url}
                        />
                        <View style={styles.suggestionText}>
                          <AppText numberOfLines={1} variant="titleSm">
                            {suggestion.display_name}
                          </AppText>
                          {suggestion.subtitle ? (
                            <AppText color="secondary" numberOfLines={1} variant="bodySm">
                              {suggestion.subtitle}
                            </AppText>
                          ) : null}
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
                  Nessun profilo o club trovato con questo nome.
                </AppText>
              </View>
            ) : null}
          </Card>
        </KeyboardAwareForm>
      </SafeAreaView>
    </Modal>
  );
}

function cloneDirectorMediaItem(
  item: DirectorMediaItemRecord,
): DirectorMediaItemRecord {
  return {
    ...item,
    linked_targets: [...item.linked_targets],
  };
}

function createEmptyDirectorMediaDraft(): DirectorMediaItemRecord {
  return {
    created_at: null,
    description: null,
    id: createDirectorMediaId(),
    is_featured: false,
    linked_targets: [],
    tag: null,
    thumbnail_url: null,
    type: "image",
    url: "",
  };
}

function createDirectorMediaId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `director-media-${Date.now()}`;
}

function getLinkedTargetKey(target: DirectorMediaLinkedTarget) {
  return `${target.target_type}:${target.target_id}`;
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
    backgroundColor: "#F7FAFD",
    flex: 1,
  },
  scrollContent: {
    gap: spacing[16],
    padding: spacing[20],
  },
  sectionCard: {
    gap: spacing[12],
  },
  sectionHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[12],
    justifyContent: "space-between",
  },
  sectionHeaderText: {
    flex: 1,
    gap: spacing[4],
  },
  selectedTargetChip: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius[12],
    flexDirection: "row",
    gap: spacing[8],
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[8],
  },
  selectedTargetText: {
    flex: 1,
    minWidth: 0,
  },
  selectedTargetsWrap: {
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
  suggestionsContent: {
    gap: spacing[4],
    maxHeight: 260,
  },
  suggestionsSurface: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[12],
    padding: spacing[8],
  },
  suggestionText: {
    flex: 1,
    gap: spacing[4],
    minWidth: 0,
  },
});
