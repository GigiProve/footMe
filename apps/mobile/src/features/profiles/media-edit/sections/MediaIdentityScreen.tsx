/**
 * Identità editoriale (REV-PROF-22, Screen 2).
 *
 * Quattro dati che compongono l'identità pubblica della realtà — copertina,
 * logo, nome e tipo — salvati insieme perché insieme vengono letti
 * dall'header del Master Profile.
 *
 * Due comandi per le immagini, e solo due: la pill "Modifica copertina" e la
 * fotocamera sovrapposta al logo. Il pulsante rettangolare separato "Modifica
 * foto" **non esiste** — è vietato dalla task e non va reintrodotto nemmeno
 * come testo accanto al logo. Sono gli stessi due comandi della Società e dei
 * profili persona: `ProfileCoverAvatarEditor`, non un secondo uploader.
 *
 * L'immagine entra nel draft solo quando lo storage ha restituito un URL, e
 * diventa pubblica solo con il salvataggio: fino ad allora il Master Profile
 * continua a mostrare quella vecchia, quindi un upload riuscito seguito da un
 * salvataggio fallito non lascia il profilo con il logo nuovo e il nome
 * vecchio.
 *
 * Il logo **non** è la foto personale dell'account, e il nome della realtà
 * non è il nome del proprietario: nessuno dei due ha l'altro come fallback,
 * né qui né nel serializer pubblico.
 */
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";

import { spacing } from "../../../../theme/tokens";
import { ActionSheet } from "../../../../ui";
import {
  MEDIA_CREATOR_TYPE_OPTIONS,
  coerceMediaCreatorType,
  type MediaCreatorType,
} from "../../../onboarding/community/media-taxonomy";
import {
  InfoMessage,
  OnboardingSelectField,
  OnboardingTextField,
} from "../../../onboarding/ui";
import { ProfileCoverAvatarEditor } from "../../edit/ProfileCoverAvatarEditor";
import { ProfileEditScaffold } from "../../edit/ProfileEditScaffold";
import {
  ProfileEditErrorState,
  ProfileEditFieldsSkeleton,
} from "../../edit/ProfileEditStates";
import { useUnsavedChangesGuard } from "../../edit/use-unsaved-changes-guard";
import {
  captureAndUploadPhoto,
  pickAndUploadMedia,
  ProfileMediaUploadError,
} from "../../media-upload-service";
import { trackProfileEvent } from "../../profile-analytics";
import {
  normalizeMediaEntityName,
  validateMediaCreatorType,
  validateMediaEntityName,
} from "../media-edit-rules";
import {
  MEDIA_LOAD_ERROR_MESSAGE,
  MediaProfileConflictError,
  describeMediaSaveError,
  useCompleteProfileQuery,
  useMediaSectionSave,
} from "../media-profile-edit-service";
import { useMediaEditorGuard } from "../use-media-editor-guard";

const GENERIC_UPLOAD_ERROR =
  "Non è stato possibile caricare l'immagine. Riprova.";

type UploadTarget = "cover" | "logo";

type IdentityForm = {
  coverUrl: string;
  creatorType: MediaCreatorType | "";
  creatorTypeOther: string;
  logoUrl: string;
  name: string;
};

const TYPE_OPTIONS = MEDIA_CREATOR_TYPE_OPTIONS.map((option) => ({
  label: option.label,
  value: option.value as string,
}));

export function MediaIdentityScreen() {
  const { userId } = useMediaEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const save = useMediaSectionSave(userId);
  const data = profileQuery.data;

  const initialForm = useMemo<IdentityForm | null>(() => {
    if (!data) {
      return null;
    }

    const media = data.mediaProfile ?? null;

    return {
      coverUrl: data.profile.cover_url ?? "",
      /*
        Un profilo anteriore a REV-ONB-09 non ha una tipologia strutturata:
        la si ricava dal testo libero storico invece di ripartire da vuoto,
        con la stessa funzione che usa l'onboarding.
      */
      creatorType: coerceMediaCreatorType(
        media?.creator_type ?? media?.editorial_type ?? media?.affiliation_type,
      ),
      creatorTypeOther: media?.creator_type_other ?? "",
      logoUrl: media?.logo_url ?? "",
      name: media?.entity_name ?? "",
    };
  }, [data]);

  const [draft, setDraft] = useState<IdentityForm | null>(null);
  const [uploading, setUploading] = useState<UploadTarget | null>(null);
  const [pickerTarget, setPickerTarget] = useState<UploadTarget | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const form = draft ?? initialForm;

  const isDirty = Boolean(
    form && initialForm && JSON.stringify(form) !== JSON.stringify(initialForm),
  );

  const handleBack = useUnsavedChangesGuard({
    isDirty,
    isSaving: save.isPending || uploading !== null,
    onLeave: () => {
      if (isDirty) {
        trackProfileEvent("profile_edit_unsaved_exit", {
          profileType: "media",
          section: "identity",
        });
      }

      router.back();
    },
    title: "Uscire senza salvare?",
  });

  const patch = useCallback(
    (changes: Partial<IdentityForm>) => {
      setErrorMessage(null);
      setDraft((current) => {
        const base = current ?? initialForm;

        return base ? { ...base, ...changes } : base;
      });
    },
    [initialForm],
  );

  const uploadImage = useCallback(
    async (target: UploadTarget, source: "camera" | "library") => {
      if (!userId) {
        return;
      }

      trackProfileEvent(
        target === "logo"
          ? "profile_photo_change_tapped"
          : "profile_cover_change_tapped",
        { profileType: "media", section: "identity" },
      );

      setUploading(target);
      setErrorMessage(null);

      try {
        const options = {
          /*
            Il logo di una testata non è una foto: il crop quadrato lo lascia
            intero. La copertina resta panoramica come nel Master Profile.
          */
          aspect: (target === "logo" ? [1, 1] : [16, 9]) as [number, number],
          folder: target === "logo" ? "media-logos" : "media-cover",
          userId,
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
          { profileType: "media", section: "identity" },
        );
      } catch (error) {
        trackProfileEvent("profile_image_upload_failed", {
          profileType: "media",
          section: "identity",
          success: false,
        });
        setErrorMessage(
          error instanceof ProfileMediaUploadError
            ? error.message
            : GENERIC_UPLOAD_ERROR,
        );
      } finally {
        setUploading(null);
      }
    },
    [patch, userId],
  );

  function handleSave() {
    if (!data || !form) {
      return;
    }

    const error =
      validateMediaEntityName(form.name) ??
      validateMediaCreatorType(form.creatorType, form.creatorTypeOther);

    if (error) {
      setErrorMessage(error);
      return;
    }

    setErrorMessage(null);
    save.mutate(
      {
        data,
        patch: {
          coverUrl: form.coverUrl || null,
          kind: "identity",
          value: {
            creator_type: form.creatorType as MediaCreatorType,
            /*
              Il testo libero appartiene soltanto ad "Altro": tenerlo dopo un
              cambio di tipologia lascerebbe un descrittore che contraddice
              la categoria scelta.
            */
            creator_type_other:
              form.creatorType === "other"
                ? form.creatorTypeOther.trim()
                : null,
            entity_name: normalizeMediaEntityName(form.name),
            logo_url: form.logoUrl || null,
          },
        },
      },
      {
        onError: (saveError) => {
          if (saveError instanceof MediaProfileConflictError) {
            trackProfileEvent("media_profile_edit_conflict", {
              profileType: "media",
              section: "identity",
            });
          }

          trackProfileEvent("profile_edit_section_save_failed", {
            profileType: "media",
            section: "identity",
            success: false,
          });
          setErrorMessage(describeMediaSaveError(saveError));
        },
        onSuccess: () => {
          trackProfileEvent("profile_edit_section_saved", {
            profileType: "media",
            section: "identity",
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
      saveDisabled={!isDirty || uploading !== null}
      saving={save.isPending}
      testID="media-profile-edit-identity"
      title="Identità editoriale"
    >
      {profileQuery.isPending ? (
        <ProfileEditFieldsSkeleton rows={4} testID="media-edit-skeleton" />
      ) : null}

      {profileQuery.isError ? (
        <ProfileEditErrorState
          message={MEDIA_LOAD_ERROR_MESSAGE}
          onRetry={() => void profileQuery.refetch()}
          testID="media-edit-error"
        />
      ) : null}

      {form ? (
        <>
          <ProfileCoverAvatarEditor
            avatarActionLabel="Modifica logo"
            avatarUrl={form.logoUrl || null}
            coverUrl={form.coverUrl || null}
            /*
              Il monogramma del logo mancante viene dal nome editoriale. Un
              nome ancora vuoto non diventa una sigla inventata, e
              soprattutto non diventa le iniziali del proprietario.
            */
            fullName={form.name}
            onEditAvatar={() => setPickerTarget("logo")}
            onEditCover={() => setPickerTarget("cover")}
            testIDPrefix="media"
            uploading={uploading === "logo" ? "avatar" : uploading}
          />

          <View style={styles.fields}>
            <OnboardingTextField
              label="Nome della realtà"
              onChangeText={(value) => patch({ name: value })}
              placeholder="Come si chiama il tuo progetto"
              testID="media-identity-name"
              value={form.name}
            />

            <OnboardingSelectField
              label="Tipo di realtà"
              onChange={(value) =>
                patch({ creatorType: value as MediaCreatorType })
              }
              options={TYPE_OPTIONS}
              placeholder="Seleziona"
              sheetTitle="Tipo di realtà"
              testID="media-identity-type"
              value={form.creatorType}
            />

            {form.creatorType === "other" ? (
              <OnboardingTextField
                label="Specifica il tipo"
                onChangeText={(value) => patch({ creatorTypeOther: value })}
                placeholder="Es. collettivo di tifosi"
                testID="media-identity-type-other"
                value={form.creatorTypeOther}
              />
            ) : null}

            <InfoMessage
              message="Nome, logo e copertina sono pubblici."
              testID="media-identity-public-note"
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
            l'immagine con cui la realtà firma i propri contenuti, quindi si
            sostituisce e basta — rimuoverlo la lascerebbe senza identità
            visiva, e il fallback sarebbe comunque il monogramma, non la foto
            personale dell'owner.
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
        title={pickerTarget === "cover" ? "Copertina" : "Logo della realtà"}
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
