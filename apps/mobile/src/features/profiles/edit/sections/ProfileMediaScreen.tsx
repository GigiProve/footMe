/**
 * Media e contenuti (§O).
 *
 * NOTA SUL MODELLO — i contenuti del profilo Calciatore oggi NON sono post del
 * Feed: vivono in `player_profiles.media_items` (jsonb), mentre il Feed unisce
 * `club_media_posts`, `media_profile_posts` e `fan_tribuna_posts`. Non esiste
 * una tabella di post del calciatore, quindi like e commenti di questi
 * contenuti sono locali alla schermata.
 *
 * L'unificazione richiesta da §O.1 è una modifica di backend (nuova tabella +
 * union nel feed + interazioni reali) fuori dallo scopo di questa task, che
 * vieta esplicitamente di inventare nuovi stati backend. Qui si evolve il
 * modello esistente: nessun secondo oggetto Media, nessun uploader parallelo,
 * nessuna copia del contenuto.
 *
 * Griglia compatta, un editor dedicato per il singolo contenuto: la vecchia
 * card verticale che impilava immagine, evidenza, rimozione, tag e textarea è
 * proprio ciò che §O.3 chiede di smontare.
 */
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";

import { colors, spacing } from "../../../../theme/tokens";
import {
  ActionSheet,
  AppText,
  Badge,
  Button,
  ConfirmModal,
} from "../../../../ui";
import { OnboardingTextField } from "../../../onboarding/ui";
import {
  pickAndUploadMedia,
  ProfileMediaUploadError,
  removeMediaFromStorage,
  type UploadedMediaItem,
} from "../../media-upload-service";
import {
  getPlayerMediaTagMeta,
  PLAYER_MEDIA_TAG_OPTIONS,
  type PlayerMediaItemRecord,
  type PlayerMediaTag,
} from "../../player-media";
import { trackProfileEvent } from "../../profile-analytics";
import { savePlayerProfileMedia } from "../../profile-service";
import { ProfileEditScaffold } from "../ProfileEditScaffold";
import {
  completeProfileQueryKey,
  useCompleteProfileQuery,
} from "../player-profile-edit-service";
import { usePlayerEditorGuard } from "../use-player-editor-guard";
import { useUnsavedChangesGuard } from "../use-unsaved-changes-guard";

const GENERIC_SAVE_ERROR =
  "Non è stato possibile salvare le modifiche. Riprova.";

function createPlayerMediaId(index: number) {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `player-media-${Date.now()}-${index}`;
}

function formatDuration(seconds: number | null | undefined): string | null {
  if (!seconds || seconds <= 0) {
    return null;
  }

  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);

  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export function ProfileMediaScreen() {
  const { userId } = usePlayerEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const queryClient = useQueryClient();
  const data = profileQuery.data;

  const savedItems = useMemo(
    () => data?.playerProfile?.media_items ?? [],
    [data?.playerProfile?.media_items],
  );

  /*
    `null` significa "allineato al server". Tenere una copia locale sempre viva
    e risincronizzarla con un effetto farebbe render a cascata e, soprattutto,
    lascerebbe a schermo modifiche che un salvataggio fallito non ha persistito.
  */
  const [draftItems, setDraftItems] = useState<PlayerMediaItemRecord[] | null>(
    null,
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuItemId, setMenuItemId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const items = draftItems ?? savedItems;
  const isDirty = draftItems !== null;

  const handleBack = useUnsavedChangesGuard({
    isDirty,
    isSaving: isSaving || isUploading,
    onLeave: () => router.back(),
  });

  const editingItem = items.find((item) => item.id === editingId) ?? null;

  const persist = useCallback(
    async (nextItems: PlayerMediaItemRecord[], onDone?: () => void) => {
      const playerProfile = data?.playerProfile;

      if (!playerProfile || !userId) {
        return;
      }

      setIsSaving(true);
      setErrorMessage(null);

      try {
        await savePlayerProfileMedia({
          mediaItems: nextItems,
          playerProfile,
          profileId: userId,
        });

        /*
          I file rimossi si cancellano solo dopo che il nuovo elenco è stato
          accettato: eliminarli prima lascerebbe un riferimento rotto se il
          salvataggio fallisse.
        */
        const removedUrls = savedItems
          .filter((saved) => !nextItems.some((item) => item.url === saved.url))
          .map((item) => item.url);

        await Promise.allSettled(
          removedUrls.map((url) => removeMediaFromStorage(url)),
        );

        await queryClient.invalidateQueries({
          queryKey: completeProfileQueryKey(userId),
        });

        setDraftItems(null);
        trackProfileEvent("profile_edit_section_saved", {
          profileType: "player",
          section: "media",
          success: true,
        });
        onDone?.();
      } catch (error) {
        trackProfileEvent("profile_edit_section_save_failed", {
          profileType: "player",
          section: "media",
          success: false,
        });
        setErrorMessage(
          error instanceof Error && error.message
            ? error.message
            : GENERIC_SAVE_ERROR,
        );
      } finally {
        setIsSaving(false);
      }
    },
    [data, queryClient, savedItems, userId],
  );

  async function handlePickMedia() {
    if (!userId) {
      return;
    }

    trackProfileEvent("profile_media_add_tapped", {
      profileType: "player",
      section: "media",
    });
    setIsUploading(true);
    setErrorMessage(null);

    try {
      const uploads: UploadedMediaItem[] = await pickAndUploadMedia({
        allowsMultipleSelection: true,
        folder: "player-media",
        mediaTypes: ["images", "videos"],
        userId,
      });

      if (uploads.length === 0) {
        return;
      }

      /*
        Il contenuto entra nella griglia solo a caricamento riuscito (§O.4): un
        upload fallito non deve lasciare una thumbnail fantasma.
      */
      const nextItems: PlayerMediaItemRecord[] = [
        ...items,
        ...uploads.map((upload, index) => ({
          created_at: new Date().toISOString(),
          description: null,
          id: createPlayerMediaId(index),
          is_featured: false,
          tag: null,
          // Per i video la thumbnail non è disponibile lato client: resta
          // `null` invece di scaricare il video intero per generarla.
          thumbnail_url: upload.type === "image" ? upload.url : null,
          type: (upload.type === "video" ? "video" : "image") as "image" | "video",
          url: upload.url,
        })),
      ];

      setDraftItems(nextItems);
      await persist(nextItems);
    } catch (error) {
      setErrorMessage(
        error instanceof ProfileMediaUploadError
          ? error.message
          : "Caricamento non riuscito. Riprova.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  function updateItem(itemId: string, changes: Partial<PlayerMediaItemRecord>) {
    setDraftItems((current) =>
      (current ?? savedItems).map((item) =>
        item.id === itemId ? { ...item, ...changes } : item,
      ),
    );
  }

  function handleToggleFeatured(itemId: string) {
    const target = items.find((item) => item.id === itemId);

    if (!target) {
      return;
    }

    const nextItems = items.map((item) =>
      item.id === itemId ? { ...item, is_featured: !item.is_featured } : item,
    );

    trackProfileEvent("profile_media_featured_changed", {
      mediaType: target.type,
      profileType: "player",
      section: "media",
    });
    setDraftItems(nextItems);
    void persist(nextItems);
    setMenuItemId(null);
  }

  function handleDelete() {
    const target = items.find((item) => item.id === pendingDeleteId);

    if (!target) {
      return;
    }

    const nextItems = items.filter((item) => item.id !== target.id);

    trackProfileEvent("profile_media_delete_tapped", {
      mediaType: target.type,
      profileType: "player",
      section: "media",
    });
    setDraftItems(nextItems);
    void persist(nextItems, () => {
      trackProfileEvent("profile_media_deleted", {
        mediaType: target.type,
        profileType: "player",
        section: "media",
      });
      setPendingDeleteId(null);
    });
  }

  // ── Editor del singolo contenuto ──────────────────────────────────────
  if (editingItem) {
    return (
      <ProfileEditScaffold
        errorMessage={errorMessage}
        onBack={() => setEditingId(null)}
        onSave={() => void persist(items, () => setEditingId(null))}
        saving={isSaving}
        testID="profile-edit-media-item"
        title="Modifica contenuto"
      >
        <View style={styles.previewWrapper}>
          {editingItem.thumbnail_url ? (
            <Image
              source={{ uri: editingItem.thumbnail_url }}
              style={styles.preview}
            />
          ) : (
            <View style={[styles.preview, styles.previewPlaceholder]}>
              <Ionicons
                color={colors.textMuted}
                name={editingItem.type === "video" ? "videocam-outline" : "image-outline"}
                size={28}
              />
            </View>
          )}
        </View>

        <View style={styles.field}>
          <AppText variant="titleSm">Tag</AppText>
          <View style={styles.tagRow}>
            {PLAYER_MEDIA_TAG_OPTIONS.map((option) => {
              const selected = editingItem.tag === option.value;

              return (
                <Button
                  key={option.value}
                  label={selected ? `✓ ${option.label}` : option.label}
                  onPress={() =>
                    updateItem(editingItem.id, {
                      tag: selected ? null : (option.value as PlayerMediaTag),
                    })
                  }
                  selected={selected}
                  size="sm"
                  variant="chipAction"
                />
              );
            })}
          </View>
        </View>

        <OnboardingTextField
          label="Descrizione"
          multiline
          onChangeText={(value) =>
            updateItem(editingItem.id, {
              description: value.trim().length > 0 ? value : null,
            })
          }
          placeholder="Aggiungi una breve descrizione del contenuto"
          testID="media-item-description"
          value={editingItem.description ?? ""}
        />

        <Button
          label={
            editingItem.is_featured
              ? "Rimuovi dall'evidenza"
              : "Metti in evidenza"
          }
          onPress={() => handleToggleFeatured(editingItem.id)}
          variant="outline"
        />
      </ProfileEditScaffold>
    );
  }

  // ── Griglia ───────────────────────────────────────────────────────────
  return (
    <ProfileEditScaffold
      errorMessage={errorMessage}
      onBack={handleBack}
      testID="profile-edit-media"
      title="Media e contenuti"
    >
      {profileQuery.isPending ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : null}

      {profileQuery.isError ? (
        <View style={styles.centered}>
          <AppText color="secondary" variant="bodySm">
            Non è stato possibile caricare questa sezione.
          </AppText>
          <Button
            label="Riprova"
            onPress={() => profileQuery.refetch()}
            size="sm"
            variant="outline"
          />
        </View>
      ) : null}

      {data ? (
        <>
          {items.length === 0 ? (
            <View style={styles.empty} testID="media-empty">
              <AppText variant="titleSm">Nessun contenuto</AppText>
              <AppText color="secondary" variant="bodySm">
                Aggiungi foto e video del tuo percorso sportivo.
              </AppText>
            </View>
          ) : (
            <View style={styles.grid}>
              {items.map((item) => {
                const tagMeta = getPlayerMediaTagMeta(item.tag);
                const duration = formatDuration(
                  (item as { duration_seconds?: number }).duration_seconds,
                );

                return (
                  <View key={item.id} style={styles.tile}>
                    <Pressable
                      accessibilityLabel={
                        item.type === "video"
                          ? `Contenuto video${duration ? `, durata ${duration}` : ""}`
                          : "Contenuto foto"
                      }
                      accessibilityRole="button"
                      onPress={() => {
                        trackProfileEvent("profile_media_edit_tapped", {
                          mediaType: item.type,
                          profileType: "player",
                          section: "media",
                        });
                        setEditingId(item.id);
                      }}
                      style={styles.thumbWrapper}
                      testID={`media-tile-${item.id}`}
                    >
                      {item.thumbnail_url ? (
                        <Image
                          source={{ uri: item.thumbnail_url }}
                          style={styles.thumb}
                        />
                      ) : (
                        <View style={[styles.thumb, styles.previewPlaceholder]}>
                          <Ionicons
                            color={colors.textMuted}
                            name={
                              item.type === "video"
                                ? "videocam-outline"
                                : "image-outline"
                            }
                            size={24}
                          />
                        </View>
                      )}
                      {item.is_featured ? (
                        <View style={styles.featuredMark}>
                          <Ionicons
                            color={colors.inkInvert}
                            name="star"
                            size={12}
                          />
                        </View>
                      ) : null}
                      {duration ? (
                        <View style={styles.durationMark}>
                          <AppText color="inverse" variant="meta">
                            {duration}
                          </AppText>
                        </View>
                      ) : null}
                    </Pressable>

                    <View style={styles.tileFooter}>
                      {tagMeta ? (
                        <Badge label={tagMeta.label} size="sm" />
                      ) : (
                        <AppText color="muted" variant="meta">
                          Senza tag
                        </AppText>
                      )}
                      <Pressable
                        accessibilityLabel="Altre azioni"
                        accessibilityRole="button"
                        hitSlop={8}
                        onPress={() => setMenuItemId(item.id)}
                        testID={`media-menu-${item.id}`}
                      >
                        <Ionicons
                          color={colors.textSecondary}
                          name="ellipsis-horizontal"
                          size={18}
                        />
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          <Button
            label="Seleziona foto o video"
            loading={isUploading}
            onPress={() => void handlePickMedia()}
            testID="media-add"
          />
        </>
      ) : null}

      <ActionSheet
        actions={[
          {
            label: "Modifica contenuto",
            onPress: () => {
              setEditingId(menuItemId);
              setMenuItemId(null);
            },
          },
          {
            label: items.find((item) => item.id === menuItemId)?.is_featured
              ? "Rimuovi dall'evidenza"
              : "Metti in evidenza",
            onPress: () => menuItemId && handleToggleFeatured(menuItemId),
          },
          {
            destructive: true,
            label: "Elimina contenuto",
            onPress: () => {
              setPendingDeleteId(menuItemId);
              setMenuItemId(null);
            },
          },
        ]}
        onClose={() => setMenuItemId(null)}
        visible={menuItemId !== null}
      />

      <ConfirmModal
        cancelLabel="Annulla"
        confirmLabel="Elimina contenuto"
        isBusy={isSaving}
        message="Il contenuto verrà rimosso sia dal tuo profilo sia dal Feed. Like e commenti associati non saranno più disponibili."
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={handleDelete}
        title="Eliminare questo contenuto?"
        visible={pendingDeleteId !== null}
      />
    </ProfileEditScaffold>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: "center",
    gap: spacing[12],
    paddingVertical: spacing[32],
  },
  empty: {
    gap: spacing[8],
    padding: spacing[16],
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[12],
  },
  tile: {
    width: "47%",
    gap: spacing[8],
  },
  thumbWrapper: {
    aspectRatio: 1,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: colors.surfacePlaceholder,
  },
  thumb: {
    width: "100%",
    height: "100%",
  },
  previewPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  featuredMark: {
    position: "absolute",
    top: spacing[8],
    left: spacing[8],
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  durationMark: {
    position: "absolute",
    right: spacing[8],
    bottom: spacing[8],
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[4],
    borderRadius: 999,
    backgroundColor: "rgba(12, 27, 42, 0.72)",
  },
  tileFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[8],
  },
  field: {
    gap: spacing[8],
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  previewWrapper: {
    borderRadius: 16,
    overflow: "hidden",
  },
  preview: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: colors.surfacePlaceholder,
  },
});
