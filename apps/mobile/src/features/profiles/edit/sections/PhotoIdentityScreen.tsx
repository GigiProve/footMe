/**
 * Foto e identità (§H.2): copertina e foto profilo.
 *
 * Separata dai dati anagrafici perché è l'unica sezione che non salva un form
 * ma esegue caricamenti: permessi, preview, upload, errore e retry hanno un
 * ciclo di vita tutto loro, e mescolarli a nome e residenza rendeva la
 * schermata due cose insieme.
 */
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";

import { colors, spacing } from "../../../../theme/tokens";
import { AppText, Button } from "../../../../ui";
import { PhotoPicker } from "../../../onboarding/ui";
import {
  captureAndUploadPhoto,
  pickAndUploadMedia,
  removeMediaFromStorage,
} from "../../media-upload-service";
import { trackProfileEvent } from "../../profile-analytics";
import { ProfileEditScaffold } from "../ProfileEditScaffold";
import {
  useCompleteProfileQuery,
  usePlayerSectionSave,
} from "../player-profile-edit-service";
import { usePlayerEditorGuard } from "../use-player-editor-guard";
import { useUnsavedChangesGuard } from "../use-unsaved-changes-guard";

type PhotoForm = {
  avatarUrl: string;
  coverUrl: string;
};

type UploadTarget = "avatar" | "cover" | null;

const GENERIC_SAVE_ERROR =
  "Non è stato possibile salvare le modifiche. Riprova.";

export function PhotoIdentityScreen() {
  const { userId } = usePlayerEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const save = usePlayerSectionSave(userId);
  const data = profileQuery.data;

  const initialForm = useMemo<PhotoForm | null>(
    () =>
      data
        ? {
            avatarUrl: data.profile.avatar_url ?? "",
            coverUrl: data.profile.cover_url ?? "",
          }
        : null,
    [data],
  );

  const [draft, setDraft] = useState<PhotoForm | null>(null);
  const [uploading, setUploading] = useState<UploadTarget>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const form = draft ?? initialForm;

  const isDirty = Boolean(
    form && initialForm && JSON.stringify(form) !== JSON.stringify(initialForm),
  );

  const handleBack = useUnsavedChangesGuard({
    isDirty,
    isSaving: save.isPending || uploading !== null,
    onLeave: () => router.back(),
  });

  const patch = useCallback(
    (changes: Partial<PhotoForm>) => {
      setErrorMessage(null);
      setDraft((current) => {
        const base = current ?? initialForm;

        return base ? { ...base, ...changes } : base;
      });
    },
    [initialForm],
  );

  /*
    L'immagine entra nel form solo quando lo storage ha restituito un URL: non
    si esce mai da qui con un'anteprima che sul server non esiste (§H.2). La
    vecchia immagine si rimuove solo dopo che la nuova è stata accettata.
  */
  const uploadImage = useCallback(
    async (target: Exclude<UploadTarget, null>, source: "library" | "camera") => {
      if (!userId || !form) {
        return;
      }

      const folder = target === "avatar" ? "avatars" : "profile-cover";
      const previousUrl = target === "avatar" ? form.avatarUrl : form.coverUrl;

      trackProfileEvent(
        target === "avatar"
          ? "profile_photo_change_tapped"
          : "profile_cover_change_tapped",
        { profileType: "player", section: "photo" },
      );

      setUploading(target);
      setUploadError(null);

      try {
        const uploaded =
          source === "camera"
            ? await captureAndUploadPhoto({ folder, userId })
            : await pickAndUploadMedia({
                folder,
                mediaTypes: ["images"],
                userId,
              });

        const next = uploaded[0]?.url;

        if (!next) {
          return;
        }

        patch(target === "avatar" ? { avatarUrl: next } : { coverUrl: next });

        if (previousUrl && previousUrl !== next) {
          void removeMediaFromStorage(previousUrl);
        }
      } catch (error) {
        setUploadError(
          error instanceof Error && error.message
            ? error.message
            : "Caricamento non riuscito. Riprova.",
        );
      } finally {
        setUploading(null);
      }
    },
    [form, patch, userId],
  );

  function handleSave() {
    if (!data || !form) {
      return;
    }

    setErrorMessage(null);
    save.mutate(
      { data, patch: { avatarUrl: form.avatarUrl, coverUrl: form.coverUrl } },
      {
        onError: (error) => {
          trackProfileEvent("profile_edit_section_save_failed", {
            profileType: "player",
            section: "photo",
            success: false,
          });
          setErrorMessage(
            error instanceof Error && error.message
              ? error.message
              : GENERIC_SAVE_ERROR,
          );
        },
        onSuccess: () => {
          trackProfileEvent("profile_edit_section_saved", {
            profileType: "player",
            section: "photo",
            success: true,
          });
          setDraft(null);
          router.back();
        },
      },
    );
  }

  return (
    <ProfileEditScaffold
      errorMessage={errorMessage}
      onBack={handleBack}
      onSave={form ? handleSave : undefined}
      saveDisabled={uploading !== null}
      saving={save.isPending}
      testID="profile-edit-photo"
      title="Foto e identità"
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

      {form ? (
        <>
          {/* Copertina: proporzione orizzontale, coerente con il Master Profile. */}
          <View style={styles.field}>
            <AppText variant="titleSm">Copertina</AppText>
            <Pressable
              accessibilityLabel="Modifica immagine di copertina"
              accessibilityRole="button"
              onPress={() => void uploadImage("cover", "library")}
              style={styles.cover}
              testID="photo-cover"
            >
              {form.coverUrl ? (
                <Image source={{ uri: form.coverUrl }} style={styles.coverImage} />
              ) : (
                <View style={styles.coverPlaceholder}>
                  <Ionicons
                    color={colors.textMuted}
                    name="image-outline"
                    size={28}
                  />
                </View>
              )}
              {uploading === "cover" ? (
                <View style={styles.coverOverlay}>
                  <ActivityIndicator color={colors.inkInvert} />
                </View>
              ) : null}
            </Pressable>
            <Button
              disabled={uploading !== null}
              label="Modifica copertina"
              onPress={() => void uploadImage("cover", "library")}
              size="sm"
              variant="outline"
            />
          </View>

          <View style={styles.field}>
            <AppText variant="titleSm">Foto profilo</AppText>
            <PhotoPicker
              addLabel="Modifica foto"
              errorMessage={uploadError ?? undefined}
              onPickFromLibrary={() => void uploadImage("avatar", "library")}
              onRemove={
                form.avatarUrl ? () => patch({ avatarUrl: "" }) : undefined
              }
              onRetry={() => void uploadImage("avatar", "library")}
              onTakePhoto={() => void uploadImage("avatar", "camera")}
              replaceLabel="Modifica foto"
              shape="circle"
              sheetTitle="Foto profilo"
              testID="photo-avatar"
              uploading={uploading === "avatar"}
              value={form.avatarUrl || null}
            />
          </View>
        </>
      ) : null}
    </ProfileEditScaffold>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: "center",
    gap: spacing[12],
    paddingVertical: spacing[32],
  },
  field: {
    gap: spacing[8],
  },
  cover: {
    aspectRatio: 16 / 9,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: colors.surfacePlaceholder,
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  coverPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  coverOverlay: {
    // RN 0.86 ha rimosso StyleSheet.absoluteFillObject.
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(12, 27, 42, 0.45)",
  },
});
