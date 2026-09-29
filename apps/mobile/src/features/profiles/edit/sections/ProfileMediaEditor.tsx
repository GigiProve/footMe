/**
 * Gestione "Media e contenuti" del profilo, condivisa fra i ruoli.
 *
 * Era la schermata del Calciatore; REV-PROF-05 chiede che l'Allenatore usi la
 * stessa — upload, anteprima, tag, evidenza, eliminazione, error handling e
 * conteggi — invece di averne una propria. Quello che cambia da un ruolo
 * all'altro è pochissimo e sta tutto in `ProfileMediaEditorConfig`: dove sono
 * salvati i contenuti, come si scrivono, quali tag esistono e come si chiama
 * il ruolo negli analytics.
 *
 * NOTA SUL MODELLO — i contenuti del profilo oggi NON sono post del Feed:
 * vivono in `<ruolo>_profiles.media_items` (jsonb), mentre il Feed unisce
 * `club_media_posts`, `media_profile_posts` e `fan_tribuna_posts`. Non esiste
 * una tabella di post del profilo, quindi like e commenti di questi contenuti
 * sono locali alla schermata.
 *
 * Griglia compatta, un editor dedicato per il singolo contenuto: la vecchia
 * card verticale che impilava immagine, evidenza, rimozione, tag e textarea è
 * proprio ciò che la revisione chiedeva di smontare.
 */
import { type ComponentProps, useCallback, useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";

import { colors, radius, spacing } from "../../../../theme/tokens";
import {
  ActionSheet,
  AppText,
  Badge,
  Button,
  ConfirmModal,
  Skeleton,
} from "../../../../ui";
import { OnboardingTextField } from "../../../onboarding/ui";
import {
  pickAndUploadMedia,
  ProfileMediaUploadError,
  removeMediaFromStorage,
  type UploadedMediaItem,
} from "../../media-upload-service";
import { trackProfileEvent } from "../../profile-analytics";
import type { CompleteProfessionalProfile } from "../../profile-service";
import { ProfileEditScaffold } from "../ProfileEditScaffold";
import { completeProfileQueryKey, useCompleteProfileQuery } from "../player-profile-edit-service";
import { useUnsavedChangesGuard } from "../use-unsaved-changes-guard";

/** Forma comune dei media di profilo: il `tag` cambia dominio, non struttura. */
export type ProfileMediaItem = {
  created_at: string | null;
  description: string | null;
  id: string;
  is_featured: boolean;
  tag: string | null;
  thumbnail_url: string | null;
  type: "image" | "video";
  url: string;
};

export type ProfileMediaTagOption = {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
};

export type ProfileMediaEditorConfig = {
  /** Copy dell'empty state: l'unica differenza editoriale fra i ruoli. */
  emptyDescription: string;
  /** Cartella di storage, per non mescolare i media di ruoli diversi. */
  folder: string;
  /** Contenuti già salvati, letti dal profilo completo. */
  getItems: (data: CompleteProfessionalProfile) => ProfileMediaItem[];
  /** Scrittura sul backend reale. Riceve la lista completa, non un delta. */
  persist: (input: {
    data: CompleteProfessionalProfile;
    items: ProfileMediaItem[];
    profileId: string;
  }) => Promise<void>;
  /** Identificatore di ruolo negli eventi: mai un dato dell'utente. */
  profileType: string;
  tagOptions: readonly ProfileMediaTagOption[];
};

const GENERIC_SAVE_ERROR =
  "Non è stato possibile salvare le modifiche. Riprova.";

function createMediaId(profileType: string, index: number) {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${profileType}-media-${Date.now()}-${index}`;
}

function formatDuration(seconds: number | null | undefined): string | null {
  if (!seconds || seconds <= 0) {
    return null;
  }

  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);

  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export function ProfileMediaEditor({
  config,
  userId,
}: {
  config: ProfileMediaEditorConfig;
  /** Arriva dalla guard del ruolo: l'editor non decide chi può entrare. */
  userId: string | null;
}) {
  const profileQuery = useCompleteProfileQuery(userId);
  const queryClient = useQueryClient();
  const data = profileQuery.data;

  /*
    Memorizzato non per velocità ma per identità: `persist` lo tiene fra le
    dipendenze, e un array nuovo a ogni render lo farebbe ricreare sempre.
  */
  const savedItems = useMemo(
    () => (data ? config.getItems(data) : []),
    [config, data],
  );

  /*
    `null` significa "allineato al server". Tenere una copia locale sempre viva
    e risincronizzarla con un effetto farebbe render a cascata e, soprattutto,
    lascerebbe a schermo modifiche che un salvataggio fallito non ha
    persistito.
  */
  const [draftItems, setDraftItems] = useState<ProfileMediaItem[] | null>(null);
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
    onLeave: () => {
      if (isDirty) {
        trackProfileEvent("profile_edit_unsaved_exit", {
          profileType: config.profileType,
          section: "media",
        });
      }

      router.back();
    },
  });

  const editingItem = items.find((item) => item.id === editingId) ?? null;

  const persist = useCallback(
    async (nextItems: ProfileMediaItem[], onDone?: () => void) => {
      if (!data || !userId) {
        return;
      }

      setIsSaving(true);
      setErrorMessage(null);

      try {
        await config.persist({ data, items: nextItems, profileId: userId });

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
          profileType: config.profileType,
          section: "media",
          success: true,
        });
        onDone?.();
      } catch (error) {
        trackProfileEvent("profile_edit_section_save_failed", {
          profileType: config.profileType,
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
    [config, data, queryClient, savedItems, userId],
  );

  async function handlePickMedia() {
    if (!userId) {
      return;
    }

    trackProfileEvent("profile_media_add_tapped", {
      profileType: config.profileType,
      section: "media",
    });
    setIsUploading(true);
    setErrorMessage(null);

    try {
      const uploads: UploadedMediaItem[] = await pickAndUploadMedia({
        allowsMultipleSelection: true,
        folder: config.folder,
        mediaTypes: ["images", "videos"],
        userId,
      });

      if (uploads.length === 0) {
        return;
      }

      /*
        Il contenuto entra nella griglia solo a caricamento riuscito: un upload
        fallito non deve lasciare una thumbnail fantasma.
      */
      const nextItems: ProfileMediaItem[] = [
        ...items,
        ...uploads.map((upload, index) => ({
          created_at: new Date().toISOString(),
          description: null,
          id: createMediaId(config.profileType, index),
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
      trackProfileEvent("profile_media_upload_failed", {
        profileType: config.profileType,
        section: "media",
        success: false,
      });
      setErrorMessage(
        error instanceof ProfileMediaUploadError
          ? error.message
          : "Non è stato possibile caricare l'immagine. Riprova.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  function updateItem(itemId: string, changes: Partial<ProfileMediaItem>) {
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
      profileType: config.profileType,
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
      profileType: config.profileType,
      section: "media",
    });
    setDraftItems(nextItems);
    void persist(nextItems, () => {
      trackProfileEvent("profile_media_deleted", {
        mediaType: target.type,
        profileType: config.profileType,
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
                name={
                  editingItem.type === "video"
                    ? "videocam-outline"
                    : "image-outline"
                }
                size={28}
              />
            </View>
          )}
        </View>

        <View style={styles.field}>
          <AppText variant="titleSm">Tag</AppText>
          <View style={styles.tagRow}>
            {config.tagOptions.map((option) => {
              const selected = editingItem.tag === option.value;

              return (
                <Button
                  key={option.value}
                  label={selected ? `✓ ${option.label}` : option.label}
                  onPress={() =>
                    updateItem(editingItem.id, {
                      tag: selected ? null : option.value,
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
        <View style={styles.grid} testID="profile-edit-media-skeleton">
          <View style={styles.tile}>
            <Skeleton.Row style={styles.skeletonTile} />
          </View>
          <View style={styles.tile}>
            <Skeleton.Row style={styles.skeletonTile} />
          </View>
        </View>
      ) : null}

      {profileQuery.isError ? (
        <View style={styles.centered}>
          <AppText color="secondary" variant="bodySm">
            Non è stato possibile caricare questa sezione.
          </AppText>
          <Button
            label="Riprova"
            onPress={() => void profileQuery.refetch()}
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
                {config.emptyDescription}
              </AppText>
            </View>
          ) : (
            <View style={styles.grid}>
              {items.map((item) => {
                const tagMeta = config.tagOptions.find(
                  (option) => option.value === item.tag,
                );
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
                          profileType: config.profileType,
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
        message="Il contenuto verrà rimosso dal tuo profilo. Like e commenti associati non saranno più disponibili."
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
  durationMark: {
    backgroundColor: "rgba(12, 27, 42, 0.72)",
    borderRadius: radius.full,
    bottom: spacing[8],
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[4],
    position: "absolute",
    right: spacing[8],
  },
  empty: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    gap: spacing[8],
    padding: spacing[16],
  },
  featuredMark: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    height: 22,
    justifyContent: "center",
    left: spacing[8],
    position: "absolute",
    top: spacing[8],
    width: 22,
  },
  field: {
    gap: spacing[8],
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[12],
  },
  preview: {
    aspectRatio: 1,
    backgroundColor: colors.surfacePlaceholder,
    width: "100%",
  },
  previewPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  previewWrapper: {
    borderRadius: radius[16],
    overflow: "hidden",
  },
  skeletonTile: {
    aspectRatio: 1,
    borderRadius: radius[16],
    height: undefined,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  thumb: {
    height: "100%",
    width: "100%",
  },
  thumbWrapper: {
    aspectRatio: 1,
    backgroundColor: colors.surfacePlaceholder,
    borderRadius: radius[16],
    overflow: "hidden",
  },
  tile: {
    gap: spacing[8],
    width: "47%",
  },
  tileFooter: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    justifyContent: "space-between",
  },
});
