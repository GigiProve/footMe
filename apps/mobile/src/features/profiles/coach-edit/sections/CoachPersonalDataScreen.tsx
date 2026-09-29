/**
 * Foto e dati personali dell'Allenatore (REV-PROF-05, schermata 2).
 *
 * Una sola schermata, due nature: in alto caricamenti (copertina e avatar), in
 * basso un form anagrafico. Stanno insieme perché il mockup le mette insieme,
 * ma restano separate nel comportamento — l'immagine viene caricata subito
 * sullo storage, mentre il profilo cambia solo alla CTA.
 *
 * Conseguenza voluta: uscendo senza salvare, il profilo continua a puntare
 * all'immagine di prima. Per questo la vecchia immagine viene rimossa dallo
 * storage **dopo** il salvataggio riuscito, mai al momento dell'upload.
 */
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";

import { NationalityAutocompleteInput } from "../../../../components/ui/nationality-autocomplete-input";
import { ResidenceCityInput } from "../../../../components/ui/residence-city-input";
import { spacing } from "../../../../theme/tokens";
import { ActionSheet, AppText } from "../../../../ui";
import {
  DateSelector,
  OnboardingSelectField,
  OnboardingTextField,
  ToggleRow,
} from "../../../onboarding/ui";
import type { ProfileGender } from "../../../onboarding/onboarding-types";
import {
  captureAndUploadPhoto,
  pickAndUploadMedia,
  ProfileMediaUploadError,
  removeMediaFromStorage,
} from "../../media-upload-service";
import { trackProfileEvent } from "../../profile-analytics";
import { buildInitialState } from "../../profile-edit-helpers";
import {
  formatBirthDateInputValue,
  getRegionFromCity,
  joinFullName,
  parseBirthDateInput,
  splitFullName,
  validateBirthDateInput,
  type ItalianCityOption,
} from "../../profile-form-utils";
import { ProfileEditScaffold } from "../../edit/ProfileEditScaffold";
import { useUnsavedChangesGuard } from "../../edit/use-unsaved-changes-guard";
import { CoachCoverAvatarEditor } from "../CoachCoverAvatarEditor";
import {
  CoachEditErrorState,
  CoachEditFieldsSkeleton,
} from "../CoachEditStates";
import {
  useCoachSectionSave,
  useCompleteProfileQuery,
} from "../coach-profile-edit-service";
import { useCoachEditorGuard } from "../use-coach-editor-guard";

/** Stesse opzioni dell'onboarding: nessuna tassonomia nuova. */
const GENDER_OPTIONS = [
  { label: "Uomo", value: "male" },
  { label: "Donna", value: "female" },
] as const;

type UploadTarget = "avatar" | "cover";

type PersonalForm = {
  avatarUrl: string;
  birthDate: string;
  coverUrl: string;
  domicile: string;
  firstName: string;
  gender: ProfileGender | "";
  lastName: string;
  nationality: string;
  region: string;
  residence: string;
  useResidenceForDomicile: boolean;
};

const GENERIC_SAVE_ERROR =
  "Non è stato possibile salvare le modifiche. Riprova.";
const GENERIC_UPLOAD_ERROR =
  "Non è stato possibile caricare l'immagine. Riprova.";

export function CoachPersonalDataScreen() {
  const { userId } = useCoachEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const save = useCoachSectionSave(userId);
  const data = profileQuery.data;

  const initialForm = useMemo<PersonalForm | null>(() => {
    if (!data) {
      return null;
    }

    const base = buildInitialState(data);
    const { firstName, lastName } = splitFullName(base.fullName);

    return {
      avatarUrl: data.profile.avatar_url ?? "",
      birthDate: base.birthDate,
      coverUrl: data.profile.cover_url ?? "",
      domicile: base.domicile,
      firstName,
      gender: base.gender,
      lastName,
      nationality: base.nationality,
      region: base.region,
      residence: base.residence,
      useResidenceForDomicile: base.useResidenceForDomicile,
    };
  }, [data]);

  const [draft, setDraft] = useState<PersonalForm | null>(null);
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
          profileType: "coach",
          section: "personal",
        });
      }

      router.back();
    },
  });

  const patch = useCallback(
    (changes: Partial<PersonalForm>) => {
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
    si esce mai da qui con un'anteprima che sul server non esiste. Il crop è
    quadrato per l'avatar e panoramico per la copertina, come nel Master
    Profile.
  */
  const uploadImage = useCallback(
    async (target: UploadTarget, source: "library" | "camera") => {
      if (!userId) {
        return;
      }

      trackProfileEvent(
        target === "avatar"
          ? "profile_photo_change_tapped"
          : "profile_cover_change_tapped",
        { profileType: "coach", section: "personal" },
      );

      setUploading(target);
      setErrorMessage(null);

      try {
        const options = {
          aspect: (target === "avatar" ? [1, 1] : [16, 9]) as [number, number],
          folder: target === "avatar" ? "avatars" : "profile-cover",
          userId,
        };

        const uploaded =
          source === "camera"
            ? await captureAndUploadPhoto(options)
            : await pickAndUploadMedia({
                ...options,
                mediaTypes: ["images"],
              });

        const next = uploaded[0]?.url;

        if (!next) {
          return;
        }

        patch(target === "avatar" ? { avatarUrl: next } : { coverUrl: next });
        trackProfileEvent(
          target === "avatar"
            ? "profile_photo_change_completed"
            : "profile_cover_change_completed",
          { profileType: "coach", section: "personal" },
        );
      } catch (error) {
        trackProfileEvent("profile_image_upload_failed", {
          profileType: "coach",
          section: "personal",
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

    if (!form.firstName.trim()) {
      setErrorMessage("Inserisci il nome.");
      return;
    }

    if (!form.lastName.trim()) {
      setErrorMessage("Inserisci il cognome.");
      return;
    }

    const birthDateResult = validateBirthDateInput(form.birthDate);

    if (!birthDateResult.isValid) {
      setErrorMessage("Inserisci una data di nascita valida.");
      return;
    }

    if (!form.nationality.trim()) {
      setErrorMessage("Seleziona la nazionalità.");
      return;
    }

    if (!form.residence.trim()) {
      setErrorMessage("Seleziona la residenza.");
      return;
    }

    if (!getRegionFromCity(form.residence)) {
      setErrorMessage(
        "La città inserita non è stata trovata. Selezionala dai suggerimenti.",
      );
      return;
    }

    if (!form.useResidenceForDomicile && !form.domicile.trim()) {
      setErrorMessage("Seleziona il domicilio.");
      return;
    }

    const previousAvatar = data.profile.avatar_url ?? "";
    const previousCover = data.profile.cover_url ?? "";

    setErrorMessage(null);
    save.mutate(
      {
        data,
        patch: {
          avatarUrl: form.avatarUrl,
          birthDate: form.birthDate,
          coverUrl: form.coverUrl,
          domicile: form.domicile,
          fullName: joinFullName(form.firstName, form.lastName),
          gender: form.gender,
          nationality: form.nationality,
          region: form.region,
          residence: form.residence,
          useResidenceForDomicile: form.useResidenceForDomicile,
        },
      },
      {
        onError: (error) => {
          trackProfileEvent("profile_edit_section_save_failed", {
            profileType: "coach",
            section: "personal",
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
            profileType: "coach",
            section: "personal",
            success: true,
          });

          /*
            Solo ora la vecchia immagine è davvero orfana. Rimuoverla al
            momento dell'upload avrebbe lasciato il profilo a puntare a un file
            cancellato, per chi poi esce senza salvare.
          */
          for (const [previous, next] of [
            [previousAvatar, form.avatarUrl],
            [previousCover, form.coverUrl],
          ]) {
            if (previous && previous !== next) {
              void removeMediaFromStorage(previous).catch(() => undefined);
            }
          }

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
      testID="coach-profile-edit-personal"
      title="Foto e dati personali"
    >
      {profileQuery.isPending ? <CoachEditFieldsSkeleton rows={6} /> : null}

      {profileQuery.isError ? (
        <CoachEditErrorState onRetry={() => void profileQuery.refetch()} />
      ) : null}

      {form && data ? (
        <>
          <CoachCoverAvatarEditor
            avatarUrl={form.avatarUrl || null}
            coverUrl={form.coverUrl || null}
            fullName={data.profile.full_name}
            onEditAvatar={() => setPickerTarget("avatar")}
            onEditCover={() => setPickerTarget("cover")}
            uploading={uploading}
          />

          <View style={styles.fields}>
            <OnboardingTextField
              label="Nome"
              onChangeText={(value) => patch({ firstName: value })}
              placeholder="Nome"
              testID="coach-personal-first-name"
              value={form.firstName}
            />

            <OnboardingTextField
              label="Cognome"
              onChangeText={(value) => patch({ lastName: value })}
              placeholder="Cognome"
              testID="coach-personal-last-name"
              value={form.lastName}
            />

            <DateSelector
              label="Data di nascita"
              mode="date"
              onChange={(value) =>
                patch({ birthDate: formatBirthDateInputValue(value) })
              }
              placeholder="Seleziona la data"
              testID="coach-personal-birth-date"
              value={parseBirthDateInput(form.birthDate)?.isoValue ?? ""}
            />

            <OnboardingSelectField
              label="Sesso"
              onChange={(value) => patch({ gender: value as ProfileGender })}
              options={[...GENDER_OPTIONS]}
              placeholder="Seleziona"
              sheetTitle="Sesso"
              testID="coach-personal-gender"
              value={form.gender}
            />

            <NationalityAutocompleteInput
              label="Nazionalità"
              onChange={(value) => patch({ nationality: value })}
              value={form.nationality}
            />

            <ResidenceCityInput
              label="Residenza"
              onChangeText={(value) => patch({ residence: value })}
              onSelectCity={(city: ItalianCityOption) =>
                patch({ region: city.region, residence: city.name })
              }
              value={form.residence}
            />

            {/*
              Il domicilio non è la disponibilità geografica: vive qui, e le
              zone in cui l'Allenatore accetta un incarico restano in
              "Opportunità".
            */}
            <ToggleRow
              label="Domicilio diverso dalla residenza"
              onValueChange={(value) =>
                patch({ useResidenceForDomicile: !value })
              }
              testID="coach-personal-domicile-toggle"
              value={!form.useResidenceForDomicile}
            >
              <ResidenceCityInput
                label="Domicilio"
                onChangeText={(value) => patch({ domicile: value })}
                onSelectCity={(city: ItalianCityOption) =>
                  patch({ domicile: city.name })
                }
                value={form.domicile}
              />
            </ToggleRow>

            <AppText color="muted" variant="meta">
              Nome, foto e copertina compaiono nel tuo profilo pubblico.
            </AppText>
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
            label: "Scegli dalla galleria",
            onPress: () => {
              const target = pickerTarget;
              setPickerTarget(null);

              if (target) {
                void uploadImage(target, "library");
              }
            },
          },
          ...(pickerTarget === "avatar" && form?.avatarUrl
            ? [
                {
                  destructive: true,
                  label: "Rimuovi foto profilo",
                  onPress: () => {
                    setPickerTarget(null);
                    patch({ avatarUrl: "" });
                  },
                },
              ]
            : []),
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
          pickerTarget === "avatar" ? "Foto profilo" : "Immagine di copertina"
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
