/**
 * Foto e dati personali (REV-PROF-05 e REV-PROF-08, schermata 2).
 *
 * Una sola schermata, due nature: in alto caricamenti (copertina e avatar), in
 * basso un form anagrafico. Stanno insieme perché il mockup le mette insieme,
 * ma restano separate nel comportamento — l'immagine viene caricata subito
 * sullo storage, mentre il profilo cambia solo alla CTA.
 *
 * Conseguenza voluta: uscendo senza salvare, il profilo continua a puntare
 * all'immagine di prima. Per questo la vecchia immagine viene rimossa dallo
 * storage **dopo** il salvataggio riuscito, mai al momento dell'upload.
 *
 * Allenatore e Staff tecnico condividono l'intera schermata: cambia soltanto
 * il tipo di profilo tracciato, il prefisso dei testID e l'eventuale nota in
 * fondo al form.
 */
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";

import { NationalityAutocompleteInput } from "../../../../components/ui/nationality-autocomplete-input";
import { ResidenceCityInput } from "../../../../components/ui/residence-city-input";
import { colors, spacing } from "../../../../theme/tokens";
import { ActionSheet, AppText } from "../../../../ui";
import {
  DateSelector,
  InfoMessage,
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
import {
  buildInitialState,
  type ProfileFormState,
} from "../../profile-edit-helpers";
import {
  formatBirthDateInputValue,
  getRegionFromCity,
  joinFullName,
  parseBirthDateInput,
  splitFullName,
  validateBirthDateInput,
  type ItalianCityOption,
} from "../../profile-form-utils";
import type { CompleteProfessionalProfile } from "../../profile-service";
import { ProfileCoverAvatarEditor } from "../ProfileCoverAvatarEditor";
import { ProfileEditScaffold } from "../ProfileEditScaffold";
import {
  ProfileEditErrorState,
  ProfileEditFieldsSkeleton,
} from "../ProfileEditStates";
import { useUnsavedChangesGuard } from "../use-unsaved-changes-guard";

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
  /** REV-PROF-22: numero privato dell'account, mai un contatto pubblico. */
  phone: string;
  region: string;
  residence: string;
  useResidenceForDomicile: boolean;
};

/** Un numero plausibile: almeno otto cifre, prefisso facoltativo. */
function isPhoneValid(value: string): boolean {
  return /^\+?\d{8,15}$/.test(value.trim().replace(/[\s.\-()]/g, ""));
}

const GENERIC_SAVE_ERROR =
  "Non è stato possibile salvare le modifiche. Riprova.";
const GENERIC_UPLOAD_ERROR =
  "Non è stato possibile caricare l'immagine. Riprova.";

/**
 * Campi che un ruolo può non avere. Non si tolgono per gusto: si tolgono
 * quando il modello approvato di quel ruolo non li prevede (REV-PROF-20
 * §"Foto e dati personali" per il Tifoso). Il valore esistente non viene
 * toccato — il patch lo rimanda indietro così com'era letto — quindi
 * nascondere un campo non lo cancella.
 */
export type ProfilePersonalDataHiddenField =
  | "domicile"
  | "gender"
  /**
   * REV-PROF-22: copertina e logo del Media/Creator appartengono alla realtà
   * editoriale e si modificano da "Identità editoriale". Qui si modificano i
   * dati della persona, e la persona non ha una testata da mostrare.
   */
  | "images";

export type ProfilePersonalDataConfig = {
  /** Nota in fondo al form. Omessa quando il mockup non la prevede. */
  footerHint?: string;
  hiddenFields?: readonly ProfilePersonalDataHiddenField[];
  /**
   * REV-PROF-22: il telefono privato dell'account. Si dichiara solo per i
   * ruoli il cui hub non ha un modulo Contatti, altrimenti il numero
   * sarebbe modificabile da due posti.
   */
  includePhone?: boolean;
  /**
   * Etichetta in evidenza sopra il form, con il lucchetto. Dice a chi sono
   * visibili i dati; non è la protezione, che resta nel backend.
   */
  privacyBadge?: string;
  /**
   * Avviso di privacy associato ai campi, reso con il riquadro informativo
   * condiviso. Non sostituisce l'esclusione lato backend: la dice.
   */
  privacyNotice?: string;
  profileType: string;
  testIDPrefix: string;
  /** Titolo della app bar. Default: il modulo con copertina e avatar. */
  title?: string;
};

type ProfilePersonalDataScreenProps = {
  config: ProfilePersonalDataConfig;
  data: CompleteProfessionalProfile | undefined;
  isError: boolean;
  isPending: boolean;
  onRetry: () => void;
  onSave: (
    data: CompleteProfessionalProfile,
    patch: Partial<ProfileFormState>,
    handlers: { onError: (error: Error) => void; onSuccess: () => void },
  ) => void;
  saving: boolean;
  userId: string | null;
};

export function ProfilePersonalDataScreen({
  config,
  data,
  isError,
  isPending,
  onRetry,
  onSave,
  saving,
  userId,
}: ProfilePersonalDataScreenProps) {
  const {
    footerHint,
    hiddenFields,
    includePhone = false,
    privacyBadge,
    privacyNotice,
    profileType,
    testIDPrefix,
    title = "Foto e dati personali",
  } = config;
  const showsGender = !hiddenFields?.includes("gender");
  const showsDomicile = !hiddenFields?.includes("domicile");
  const showsImages = !hiddenFields?.includes("images");

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
      phone: base.contactPhone,
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
    isSaving: saving || uploading !== null,
    onLeave: () => {
      if (isDirty) {
        trackProfileEvent("profile_edit_unsaved_exit", {
          profileType,
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
        { profileType, section: "personal" },
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
          { profileType, section: "personal" },
        );
      } catch (error) {
        trackProfileEvent("profile_image_upload_failed", {
          profileType,
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
    [patch, profileType, userId],
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

    if (
      showsDomicile &&
      !form.useResidenceForDomicile &&
      !form.domicile.trim()
    ) {
      setErrorMessage("Seleziona il domicilio.");
      return;
    }

    /*
      Il numero è facoltativo: cancellarlo è legittimo. Non lo è lasciarne uno
      che non si può chiamare.
    */
    if (includePhone && form.phone.trim() && !isPhoneValid(form.phone)) {
      setErrorMessage("Inserisci un numero di telefono valido.");
      return;
    }

    const previousAvatar = data.profile.avatar_url ?? "";
    const previousCover = data.profile.cover_url ?? "";

    setErrorMessage(null);
    onSave(
      data,
      {
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
        /*
          Il numero viaggia solo per i ruoli che lo modificano da qui, e la
          sua preferenza di visibilità non viene toccata: resta quella che
          era, spenta per default. Un numero privato non diventa pubblico
          perché è stato corretto.
        */
        ...(includePhone ? { contactPhone: form.phone } : {}),
      },
      {
        onError: (error) => {
          trackProfileEvent("profile_edit_section_save_failed", {
            profileType,
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
            profileType,
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
      saving={saving}
      testID={`${testIDPrefix}-profile-edit-personal`}
      title={title}
    >
      {isPending ? (
        <ProfileEditFieldsSkeleton
          rows={6}
          testID={`${testIDPrefix}-edit-skeleton`}
        />
      ) : null}

      {isError ? (
        <ProfileEditErrorState
          onRetry={onRetry}
          testID={`${testIDPrefix}-edit-error`}
        />
      ) : null}

      {form && data ? (
        <>
          {showsImages ? (
            <ProfileCoverAvatarEditor
              avatarUrl={form.avatarUrl || null}
              coverUrl={form.coverUrl || null}
              fullName={data.profile.full_name}
              onEditAvatar={() => setPickerTarget("avatar")}
              onEditCover={() => setPickerTarget("cover")}
              testIDPrefix={testIDPrefix}
              uploading={uploading}
            />
          ) : null}

          {/*
            La privacy è scritta, non solo disegnata: il lucchetto da solo non
            direbbe niente a chi usa uno screen reader.
          */}
          {privacyBadge ? (
            <View
              accessible
              style={styles.privacyBadge}
              testID={`${testIDPrefix}-personal-privacy-badge`}
            >
              <Ionicons color={colors.accent} name="lock-closed" size={14} />
              <AppText color="accent" variant="metaStrong">
                {privacyBadge}
              </AppText>
            </View>
          ) : null}

          <View style={styles.fields}>
            <OnboardingTextField
              label="Nome"
              onChangeText={(value) => patch({ firstName: value })}
              placeholder="Nome"
              testID={`${testIDPrefix}-personal-first-name`}
              value={form.firstName}
            />

            <OnboardingTextField
              label="Cognome"
              onChangeText={(value) => patch({ lastName: value })}
              placeholder="Cognome"
              testID={`${testIDPrefix}-personal-last-name`}
              value={form.lastName}
            />

            <DateSelector
              label="Data di nascita"
              mode="date"
              onChange={(value) =>
                patch({ birthDate: formatBirthDateInputValue(value) })
              }
              placeholder="Seleziona la data"
              testID={`${testIDPrefix}-personal-birth-date`}
              value={parseBirthDateInput(form.birthDate)?.isoValue ?? ""}
            />

            {showsGender ? (
              <OnboardingSelectField
                label="Sesso"
                onChange={(value) => patch({ gender: value as ProfileGender })}
                options={[...GENDER_OPTIONS]}
                placeholder="Seleziona"
                sheetTitle="Sesso"
                testID={`${testIDPrefix}-personal-gender`}
                value={form.gender}
              />
            ) : null}

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
              zone in cui si accetta un incarico restano in "Opportunità".
            */}
            {showsDomicile ? (
              <ToggleRow
                label="Domicilio diverso dalla residenza"
                onValueChange={(value) =>
                  patch({ useResidenceForDomicile: !value })
                }
                testID={`${testIDPrefix}-personal-domicile-toggle`}
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
            ) : null}

            {includePhone ? (
              <OnboardingTextField
                autoCapitalize="none"
                errorMessage={
                  form.phone.trim() && !isPhoneValid(form.phone)
                    ? "Inserisci un numero di telefono valido."
                    : undefined
                }
                keyboardType="phone-pad"
                label="Telefono"
                onChangeText={(value) => patch({ phone: value })}
                optional
                placeholder="+39 000 000 0000"
                testID={`${testIDPrefix}-personal-phone`}
                value={form.phone}
              />
            ) : null}

            {privacyNotice ? (
              <InfoMessage
                message={privacyNotice}
                testID={`${testIDPrefix}-personal-privacy-note`}
              />
            ) : null}

            {footerHint ? (
              <AppText color="muted" variant="meta">
                {footerHint}
              </AppText>
            ) : null}
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
  privacyBadge: {
    alignItems: "center",
    alignSelf: "center",
    flexDirection: "row",
    gap: spacing[4],
  },
});
