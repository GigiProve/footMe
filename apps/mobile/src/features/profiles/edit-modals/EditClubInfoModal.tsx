import { useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";

import { MediaPickerField } from "../../../components/ui/media-picker-field";
import { SelectField } from "../../../components/ui/select-field";
import {
  pickAndUploadMedia,
  ProfileMediaUploadError,
  removeMediaFromStorage,
  type UploadedMediaItem,
} from "../media-upload-service";
import { PLAYER_CATEGORY_OPTIONS } from "../player-sports";
import {
  buildFullUpdatePayload,
  buildInitialState,
  fromDelimitedString,
  toDelimitedString,
} from "../profile-edit-helpers";
import {
  ensureOption,
  REGION_OPTIONS,
  validateBirthDateInput,
} from "../profile-form-utils";
import { ProfileField as Field } from "../profile-screen-components";
import type { CompleteProfessionalProfile } from "../profile-service";
import { updateCompleteProfessionalProfile } from "../profile-service";
import { EditModalShell } from "./EditModalShell";

type ClubFormState = {
  clubCategory: string;
  clubCity: string;
  clubColors: string;
  clubCountry: string;
  clubDescription: string;
  clubEmail: string;
  clubFieldAddress: string;
  clubFoundingYear: string;
  clubGalleryUrls: string;
  clubHeadquartersAddress: string;
  clubId: string | null;
  clubLeague: string;
  clubLogoUrl: string;
  clubName: string;
  clubPhone: string;
  clubRegion: string;
  clubWebsite: string;
};

type EditClubInfoModalProps = {
  completeProfile: CompleteProfessionalProfile;
  onClose: () => void;
  onSaved: () => void;
  userId: string;
  visible: boolean;
};

function buildClubFormState(
  completeProfile: CompleteProfessionalProfile,
): ClubFormState {
  const state = buildInitialState(completeProfile);

  return {
    clubCategory: state.clubCategory,
    clubCity: state.clubCity,
    clubColors: state.clubColors,
    clubCountry: state.clubCountry,
    clubDescription: state.clubDescription,
    clubEmail: state.clubEmail,
    clubFieldAddress: state.clubFieldAddress,
    clubFoundingYear: state.clubFoundingYear,
    clubGalleryUrls: state.clubGalleryUrls,
    clubHeadquartersAddress: state.clubHeadquartersAddress,
    clubId: state.clubId,
    clubLeague: state.clubLeague,
    clubLogoUrl: state.clubLogoUrl,
    clubName: state.clubName,
    clubPhone: state.clubPhone,
    clubRegion: state.clubRegion,
    clubWebsite: state.clubWebsite,
  };
}

export function EditClubInfoModal({
  completeProfile,
  onClose,
  onSaved,
  userId,
  visible,
}: EditClubInfoModalProps) {
  const [formState, setFormState] = useState<ClubFormState>(() =>
    buildClubFormState(completeProfile),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setFormState(buildClubFormState(completeProfile));
      setIsSaving(false);
      setUploadingField(null);
    }
  }, [visible, completeProfile]);

  const regionOptions = useMemo(
    () => ensureOption(REGION_OPTIONS, formState.clubRegion),
    [formState.clubRegion],
  );

  const existingGalleryUrls = fromDelimitedString(formState.clubGalleryUrls);

  function updateField<K extends keyof ClubFormState>(
    key: K,
    value: ClubFormState[K],
  ) {
    setFormState((prev) => ({ ...prev, [key]: value }));
  }

  async function handleLogoPick() {
    setUploadingField("logo");

    try {
      const results: UploadedMediaItem[] = await pickAndUploadMedia({
        folder: "club-logos",
        mediaTypes: ["images"],
        userId,
      });

      if (results.length === 0) {
        setUploadingField(null);
        return;
      }

      const previousUrl = formState.clubLogoUrl;
      updateField("clubLogoUrl", results[0].url);

      if (previousUrl) {
        try {
          await removeMediaFromStorage(previousUrl);
        } catch {
          // Best-effort cleanup
        }
      }
    } catch (error) {
      const message =
        error instanceof ProfileMediaUploadError
          ? error.message
          : "Caricamento logo non riuscito.";
      Alert.alert("Errore", message);
    } finally {
      setUploadingField(null);
    }
  }

  async function handleLogoRemove() {
    const previousUrl = formState.clubLogoUrl;
    updateField("clubLogoUrl", "");

    if (previousUrl) {
      try {
        await removeMediaFromStorage(previousUrl);
      } catch {
        // Best-effort cleanup
      }
    }
  }

  async function handleGalleryPick() {
    setUploadingField("gallery");

    try {
      const results: UploadedMediaItem[] = await pickAndUploadMedia({
        allowsMultipleSelection: true,
        folder: "club-gallery",
        mediaTypes: ["images"],
        userId,
      });

      if (results.length === 0) {
        setUploadingField(null);
        return;
      }

      const newUrls = results.map((item) => item.url);
      const merged = [...existingGalleryUrls, ...newUrls];
      updateField("clubGalleryUrls", toDelimitedString(merged));
    } catch (error) {
      const message =
        error instanceof ProfileMediaUploadError
          ? error.message
          : "Caricamento galleria non riuscito.";
      Alert.alert("Errore", message);
    } finally {
      setUploadingField(null);
    }
  }

  async function handleGalleryRemove() {
    const previousUrls = existingGalleryUrls;
    updateField("clubGalleryUrls", "");

    for (const url of previousUrls) {
      try {
        await removeMediaFromStorage(url);
      } catch {
        // Best-effort cleanup
      }
    }
  }

  async function handleSave() {
    const trimmedName = formState.clubName.trim();
    const trimmedCity = formState.clubCity.trim();
    const trimmedRegion = formState.clubRegion.trim();

    if (!trimmedName || !trimmedCity || !trimmedRegion) {
      Alert.alert(
        "Attenzione",
        "Per la pagina società servono nome club, città e regione.",
      );
      return;
    }

    setIsSaving(true);

    try {
      const baseState = buildInitialState(completeProfile);
      const mergedState = {
        ...baseState,
        clubCategory: formState.clubCategory,
        clubCity: formState.clubCity,
        clubColors: formState.clubColors,
        clubCountry: formState.clubCountry,
        clubDescription: formState.clubDescription,
        clubEmail: formState.clubEmail,
        clubFieldAddress: formState.clubFieldAddress,
        clubFoundingYear: formState.clubFoundingYear,
        clubGalleryUrls: formState.clubGalleryUrls,
        clubHeadquartersAddress: formState.clubHeadquartersAddress,
        clubId: formState.clubId,
        clubLeague: formState.clubLeague,
        clubLogoUrl: formState.clubLogoUrl,
        clubName: formState.clubName,
        clubPhone: formState.clubPhone,
        clubRegion: formState.clubRegion,
        clubWebsite: formState.clubWebsite,
      };
      const payload = buildFullUpdatePayload(completeProfile, mergedState);
      payload.profile.birth_date = validateBirthDateInput(
        baseState.birthDate,
      ).isoValue;

      await updateCompleteProfessionalProfile(payload);
      onSaved();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Salvataggio non riuscito.";
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
      title="Dati club"
      visible={visible}
    >
      <Field
        editable
        label="Nome club"
        onChangeText={(v) => updateField("clubName", v)}
        placeholder="Nome della società"
        value={formState.clubName}
      />

      <Field
        editable
        label="Città"
        onChangeText={(v) => updateField("clubCity", v)}
        placeholder="Città del club"
        value={formState.clubCity}
      />

      <SelectField
        label="Regione"
        onChange={(v) => updateField("clubRegion", v)}
        options={regionOptions}
        placeholder="Seleziona regione"
        value={formState.clubRegion}
      />

      <SelectField
        label="Categoria"
        onChange={(v) => updateField("clubCategory", v)}
        options={PLAYER_CATEGORY_OPTIONS}
        placeholder="Seleziona categoria"
        value={formState.clubCategory}
      />

      <Field
        editable
        label="Girone"
        onChangeText={(v) => updateField("clubLeague", v)}
        placeholder="Es. Eccellenza Girone A"
        value={formState.clubLeague}
      />

      <Field
        editable
        label="Descrizione"
        multiline
        onChangeText={(v) => updateField("clubDescription", v)}
        placeholder="Descrizione del club"
        value={formState.clubDescription}
      />

      <MediaPickerField
        buttonLabel="Carica logo"
        isUploading={uploadingField === "logo"}
        label="Logo club"
        onPick={handleLogoPick}
        onRemove={handleLogoRemove}
        previewUrl={formState.clubLogoUrl || null}
        removable={Boolean(formState.clubLogoUrl)}
        removeLabel="Rimuovi logo"
      />

      <MediaPickerField
        buttonLabel="Aggiungi foto"
        isUploading={uploadingField === "gallery"}
        label="Galleria"
        onPick={handleGalleryPick}
        onRemove={handleGalleryRemove}
        removable={existingGalleryUrls.length > 0}
        removeLabel="Rimuovi tutte"
        selectedCount={existingGalleryUrls.length}
      />

      <Field
        editable
        label="Colori sociali"
        onChangeText={(v) => updateField("clubColors", v)}
        placeholder="Es. Rosso e nero"
        value={formState.clubColors}
      />

      <Field
        editable
        label="Anno di fondazione"
        onChangeText={(v) => updateField("clubFoundingYear", v)}
        placeholder="Es. 1920"
        value={formState.clubFoundingYear}
      />

      <Field
        editable
        label="Indirizzo campo"
        onChangeText={(v) => updateField("clubFieldAddress", v)}
        placeholder="Via e numero civico del campo"
        value={formState.clubFieldAddress}
      />

      <Field
        editable
        label="Indirizzo sede"
        onChangeText={(v) => updateField("clubHeadquartersAddress", v)}
        placeholder="Via e numero civico della sede"
        value={formState.clubHeadquartersAddress}
      />

      <Field
        editable
        label="Email club"
        onChangeText={(v) => updateField("clubEmail", v)}
        placeholder="email@club.it"
        value={formState.clubEmail}
      />

      <Field
        editable
        label="Telefono club"
        onChangeText={(v) => updateField("clubPhone", v)}
        placeholder="+39 ..."
        value={formState.clubPhone}
      />

      <Field
        editable
        label="Sito web"
        onChangeText={(v) => updateField("clubWebsite", v)}
        placeholder="https://www.club.it"
        value={formState.clubWebsite}
      />
    </EditModalShell>
  );
}
