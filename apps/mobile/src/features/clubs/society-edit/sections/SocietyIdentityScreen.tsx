/**
 * Identità del club (REV-PROF-18, schermata 2).
 *
 * Copertina, logo, denominazione, anno di fondazione e colori sociali: i
 * cinque dati che compongono l'identità pubblica della Società, salvati
 * insieme perché insieme vengono letti dall'header del Master Profile.
 *
 * Due comandi per le immagini, e solo due — la pill "Modifica copertina" e la
 * fotocamera sovrapposta al logo — esattamente come per i profili persona: un
 * pulsante rettangolare separato "Modifica logo" non esiste e non va
 * reintrodotto.
 *
 * L'immagine entra nel draft solo quando lo storage ha restituito un URL, e
 * diventa pubblica solo con il salvataggio: fino ad allora il Master Profile
 * continua a mostrare quella vecchia, quindi un upload riuscito seguito da un
 * salvataggio fallito non lascia il profilo con il logo nuovo e il nome
 * vecchio.
 */
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";

import { spacing } from "../../../../theme/tokens";
import { ActionSheet } from "../../../../ui";
import { ClubColorsField } from "../../../onboarding/club/ClubColorsField";
import { OnboardingTextField } from "../../../onboarding/ui";
import { trackProfileEvent } from "../../../profiles/profile-analytics";
import { ProfileCoverAvatarEditor } from "../../../profiles/edit/ProfileCoverAvatarEditor";
import { ProfileEditScaffold } from "../../../profiles/edit/ProfileEditScaffold";
import {
  ProfileEditErrorState,
  ProfileEditFieldsSkeleton,
} from "../../../profiles/edit/ProfileEditStates";
import { useUnsavedChangesGuard } from "../../../profiles/edit/use-unsaved-changes-guard";
import {
  captureAndUploadPhoto,
  pickAndUploadMedia,
  ProfileMediaUploadError,
} from "../../../profiles/media-upload-service";
import {
  normalizeClubName,
  normalizeFoundingYearInput,
  parseSocietyColors,
  serializeSocietyColors,
  validateClubName,
  validateFoundingYear,
  validateSocietyColors,
} from "../society-edit-rules";
import { useSocietySectionEditor } from "./use-society-section-editor";

const GENERIC_UPLOAD_ERROR =
  "Non è stato possibile caricare l'immagine. Riprova.";

type IdentityForm = {
  colors: string[];
  coverUrl: string;
  foundingYear: string;
  logoUrl: string;
  name: string;
};

type UploadTarget = "cover" | "logo";

export function SocietyIdentityScreen() {
  const editor = useSocietySectionEditor("identity");
  const club = editor.club;

  const initialForm = useMemo<IdentityForm | null>(() => {
    if (!club) {
      return null;
    }

    return {
      colors: parseSocietyColors(club.clubColors),
      coverUrl: club.coverUrl ?? "",
      foundingYear: club.foundingYear ? String(club.foundingYear) : "",
      logoUrl: club.logoUrl ?? "",
      name: club.name,
    };
  }, [club]);

  const [draft, setDraft] = useState<IdentityForm | null>(null);
  const [uploading, setUploading] = useState<UploadTarget | null>(null);
  const [pickerTarget, setPickerTarget] = useState<UploadTarget | null>(null);
  const form = draft ?? initialForm;

  const isDirty = Boolean(
    form && initialForm && JSON.stringify(form) !== JSON.stringify(initialForm),
  );

  const handleBack = useUnsavedChangesGuard({
    isDirty,
    isSaving: editor.saving,
    onLeave: () => {
      editor.trackUnsavedExit(isDirty);
      router.back();
    },
  });

  const patch = useCallback(
    (changes: Partial<IdentityForm>) => {
      editor.clearError();
      setDraft((current) => {
        const base = current ?? initialForm;

        return base ? { ...base, ...changes } : base;
      });
    },
    [editor, initialForm],
  );

  const uploadImage = useCallback(
    async (target: UploadTarget, source: "camera" | "library") => {
      if (!editor.clubId) {
        return;
      }

      trackProfileEvent(
        target === "logo"
          ? "profile_photo_change_tapped"
          : "profile_cover_change_tapped",
        { profileType: "society", section: "identity" },
      );

      setUploading(target);
      editor.clearError();

      try {
        const options = {
          /*
            Lo stemma non è una foto: il crop quadrato lo lascia intero, e la
            trasparenza del PNG sopravvive perché l'upload non ricodifica il
            file. La copertina resta panoramica come nel Master Profile.
          */
          aspect: (target === "logo" ? [1, 1] : [16, 9]) as [number, number],
          folder: target === "logo" ? "club-logos" : "club-cover",
          userId: editor.clubId,
        };

        const uploaded =
          source === "camera"
            ? await captureAndUploadPhoto(options)
            : await pickAndUploadMedia({ ...options, mediaTypes: ["images"] });

        const next = uploaded[0]?.url;

        if (!next) {
          return;
        }

        patch(target === "logo" ? { logoUrl: next } : { coverUrl: next });
        trackProfileEvent(
          target === "logo"
            ? "profile_photo_change_completed"
            : "profile_cover_change_completed",
          { profileType: "society", section: "identity" },
        );
      } catch (error) {
        trackProfileEvent("profile_image_upload_failed", {
          profileType: "society",
          section: "identity",
          success: false,
        });
        editor.setErrorMessage(
          error instanceof ProfileMediaUploadError
            ? error.message
            : GENERIC_UPLOAD_ERROR,
        );
      } finally {
        setUploading(null);
      }
    },
    [editor, patch],
  );

  function handleSave() {
    if (!form) {
      return;
    }

    const nameError = validateClubName(form.name);
    const yearError = validateFoundingYear(form.foundingYear);
    const colorsError = validateSocietyColors(form.colors);
    const error = nameError ?? yearError ?? colorsError;

    if (error) {
      editor.setErrorMessage(error);
      return;
    }

    editor.save(
      {
        club_colors: serializeSocietyColors(form.colors),
        cover_url: form.coverUrl,
        founding_year: form.foundingYear,
        logo_url: form.logoUrl,
        name: normalizeClubName(form.name),
      },
      () => setDraft(null),
    );
  }

  return (
    <ProfileEditScaffold
      errorMessage={editor.errorMessage}
      onBack={handleBack}
      onSave={form ? handleSave : undefined}
      onSecondary={editor.hasConflict ? editor.reload : undefined}
      saveDisabled={!isDirty}
      saving={editor.saving}
      secondaryLabel={editor.hasConflict ? "Ricarica" : undefined}
      testID="society-profile-edit-identity"
      title="Identità del club"
    >
      {editor.isPending ? (
        <ProfileEditFieldsSkeleton rows={4} testID="society-edit-skeleton" />
      ) : null}

      {editor.isError ? (
        <ProfileEditErrorState
          onRetry={editor.reload}
          testID="society-edit-error"
        />
      ) : null}

      {form ? (
        <>
          <ProfileCoverAvatarEditor
            avatarActionLabel="Modifica logo"
            avatarUrl={form.logoUrl || null}
            coverUrl={form.coverUrl || null}
            fullName={form.name}
            onEditAvatar={() => setPickerTarget("logo")}
            onEditCover={() => setPickerTarget("cover")}
            testIDPrefix="society"
            uploading={uploading === "logo" ? "avatar" : uploading}
          />

          <View style={styles.fields}>
            <OnboardingTextField
              autoCapitalize="words"
              label="Denominazione"
              onChangeText={(value) => patch({ name: value })}
              placeholder="Es. ASD Predappio"
              testID="society-identity-name"
              value={form.name}
            />

            <OnboardingTextField
              keyboardType="number-pad"
              label="Anno di fondazione"
              maxLength={4}
              onChangeText={(value) =>
                patch({ foundingYear: normalizeFoundingYearInput(value) })
              }
              placeholder="Es. 1945"
              testID="society-identity-founding-year"
              value={form.foundingYear}
            />

            {/*
              Stesso selector dell'onboarding Società: i colori sono una
              collezione senza gerarchia, e qui non ne nasce una seconda.
            */}
            <ClubColorsField
              onChange={(values) => patch({ colors: values })}
              values={form.colors}
            />
          </View>
        </>
      ) : null}

      <ActionSheet
        actions={[
          {
            label: "Scatta una foto",
            onPress: () => {
              const target = pickerTarget;
              setPickerTarget(null);

              if (target) {
                void uploadImage(target, "camera");
              }
            },
          },
          {
            label: "Scegli dalla libreria",
            onPress: () => {
              const target = pickerTarget;
              setPickerTarget(null);

              if (target) {
                void uploadImage(target, "library");
              }
            },
          },
          /*
            La copertina è facoltativa e si può togliere. Il logo no: è
            obbligatorio dall'onboarding, quindi si sostituisce e basta —
            rimuoverlo lascerebbe la Società senza stemma.
          */
          ...(pickerTarget === "cover" && form?.coverUrl
            ? [
                {
                  destructive: true,
                  label: "Rimuovi copertina",
                  onPress: () => {
                    setPickerTarget(null);
                    patch({ coverUrl: "" });
                  },
                },
              ]
            : []),
        ]}
        onClose={() => setPickerTarget(null)}
        title={
          pickerTarget === "cover" ? "Copertina del club" : "Logo del club"
        }
        visible={pickerTarget !== null}
      />
    </ProfileEditScaffold>
  );
}

const styles = StyleSheet.create({
  fields: {
    gap: spacing[16],
  },
});
