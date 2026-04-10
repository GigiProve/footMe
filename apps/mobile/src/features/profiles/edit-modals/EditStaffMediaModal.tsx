import { useEffect, useMemo, useState } from "react";
import { Alert, Image, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { MediaPickerField } from "../../../components/ui/media-picker-field";
import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button, Card, ChipGroup, Input } from "../../../ui";
import {
  STAFF_MEDIA_TAG_OPTIONS,
  getStaffMediaTagMeta,
  type StaffMediaItemRecord,
  type StaffMediaTag,
} from "../staff-media";
import {
  pickAndUploadMedia,
  ProfileMediaUploadError,
  removeMediaFromStorage,
  type UploadedMediaItem,
} from "../media-upload-service";
import type { CompleteProfessionalProfile } from "../profile-service";
import { saveStaffProfileMedia } from "../profile-service";
import { EditModalShell } from "./EditModalShell";

type EditStaffMediaModalProps = {
  completeProfile: CompleteProfessionalProfile;
  onClose: () => void;
  onSaved: () => void;
  userId: string;
  visible: boolean;
};

export function EditStaffMediaModal({
  completeProfile,
  onClose,
  onSaved,
  userId,
  visible,
}: EditStaffMediaModalProps) {
  const originalItems = useMemo(
    () => completeProfile.staffProfile?.media_items ?? [],
    [completeProfile.staffProfile?.media_items],
  );
  const [items, setItems] = useState<StaffMediaItemRecord[]>(originalItems);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (visible) {
      setItems(originalItems);
      setIsUploading(false);
      setIsSaving(false);
    }
  }, [originalItems, visible]);

  async function handlePickMedia() {
    setIsUploading(true);

    try {
      const uploads: UploadedMediaItem[] = await pickAndUploadMedia({
        allowsMultipleSelection: true,
        folder: "staff-media",
        mediaTypes: ["images", "videos"],
        userId,
      });

      if (uploads.length === 0) {
        return;
      }

      setItems((currentItems) => [
        ...currentItems,
        ...uploads.map(
          (upload, index) =>
            ({
              created_at: new Date().toISOString(),
              description: null,
              id: createStaffMediaId(index),
              is_featured: false,
              tag: null,
              thumbnail_url: upload.type === "image" ? upload.url : null,
              type: upload.type === "video" ? "video" : "image",
              url: upload.url,
            }) satisfies StaffMediaItemRecord,
        ),
      ]);
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

  function handleRemoveItem(itemId: string) {
    setItems((currentItems) => currentItems.filter((item) => item.id !== itemId));
  }

  function handleTagChange(itemId: string, tag: StaffMediaTag | null) {
    setItems((currentItems) =>
      currentItems.map((item) => (item.id === itemId ? { ...item, tag } : item)),
    );
  }

  function handleDescriptionChange(itemId: string, description: string) {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              description: description.trim().length > 0 ? description : null,
            }
          : item,
      ),
    );
  }

  function handleToggleFeatured(itemId: string) {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId
          ? { ...item, is_featured: !item.is_featured }
          : item,
      ),
    );
  }

  async function handleSave() {
    if (!completeProfile.staffProfile) {
      Alert.alert("Errore", "Profilo staff non disponibile.");
      return;
    }

    setIsSaving(true);

    try {
      await saveStaffProfileMedia({
        mediaItems: items,
        staffProfile: completeProfile.staffProfile,
        profileId: userId,
      });

      const removedUrls = originalItems
        .filter((originalItem) => !items.some((item) => item.url === originalItem.url))
        .map((item) => item.url);

      await Promise.allSettled(
        removedUrls.map((url) => removeMediaFromStorage(url)),
      );

      onSaved();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Salvataggio media non riuscito.";
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
      saveLabel="Salva media"
      title="Gestisci media"
      visible={visible}
    >
      <MediaPickerField
        buttonLabel="Seleziona foto o video"
        helperText="Puoi caricare uno o piu' contenuti, aggiungere tag e descrizione."
        isUploading={isUploading}
        label="Contenuti del profilo"
        onPick={handlePickMedia}
        selectedCount={items.length}
        selectedLabel={
          items.length > 0
            ? `${items.length} contenuti pronti`
            : "Nessun contenuto caricato"
        }
      />

      {items.length > 0 ? (
        <View style={styles.list}>
          {items.map((item) => (
            <Card key={item.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.previewFrame}>
                  {item.type === "image" && item.thumbnail_url ? (
                    <Image source={{ uri: item.thumbnail_url }} style={styles.previewImage} />
                  ) : (
                    <View style={styles.videoPreview}>
                      <Ionicons color={colors.accent} name="play-circle" size={28} />
                      <AppText color="secondary" variant="caption">
                        Video
                      </AppText>
                    </View>
                  )}
                </View>

                <View style={styles.cardHeaderInfo}>
                  {item.tag !== null ? (
                    (() => {
                      const meta = getStaffMediaTagMeta(item.tag);
                      return meta ? (
                        <View style={styles.currentTag}>
                          <Ionicons color={colors.accentStrong} name={meta.icon} size={14} />
                          <AppText color="accentStrong" variant="caption">{meta.label}</AppText>
                        </View>
                      ) : null;
                    })()
                  ) : (
                    <View style={styles.currentTag}>
                      <AppText color="secondary" variant="caption">Nessun tag</AppText>
                    </View>
                  )}
                  <Button
                    label={item.is_featured ? "In evidenza" : "Metti in evidenza"}
                    onPress={() => handleToggleFeatured(item.id)}
                    size="sm"
                    variant={item.is_featured ? "primary" : "secondary"}
                  />
                  <Button
                    label="Rimuovi"
                    onPress={() => handleRemoveItem(item.id)}
                    size="sm"
                    variant="danger"
                  />
                </View>
              </View>

              <View style={styles.field}>
                <AppText color="secondary" variant="caption">
                  Tag contenuto
                </AppText>
                <ChipGroup
                  onChange={(value) => handleTagChange(item.id, value)}
                  options={STAFF_MEDIA_TAG_OPTIONS}
                  value={item.tag}
                />
              </View>

              <Input
                label="Descrizione"
                multiline
                onChangeText={(value) => handleDescriptionChange(item.id, value)}
                placeholder="Aggiungi una breve descrizione del contenuto"
                value={item.description ?? ""}
              />
            </Card>
          ))}
        </View>
      ) : null}
    </EditModalShell>
  );
}

function createStaffMediaId(index: number) {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `staff-media-${Date.now()}-${index}`;
}

const styles = StyleSheet.create({
  card: {
    gap: spacing[14],
  },
  cardHeader: {
    flexDirection: "row",
    gap: spacing[14],
  },
  cardHeaderInfo: {
    flex: 1,
    gap: spacing[10],
    justifyContent: "center",
  },
  currentTag: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.full,
    flexDirection: "row",
    gap: spacing[6],
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[6],
  },
  field: {
    gap: spacing[8],
  },
  list: {
    gap: spacing[12],
  },
  previewFrame: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[12],
    height: 96,
    overflow: "hidden",
    width: 96,
  },
  previewImage: {
    height: "100%",
    width: "100%",
  },
  videoPreview: {
    alignItems: "center",
    flex: 1,
    gap: spacing[8],
    justifyContent: "center",
  },
});
