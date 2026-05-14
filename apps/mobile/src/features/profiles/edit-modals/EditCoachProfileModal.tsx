import { useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";

import { SelectField } from "../../../components/ui/select-field";
import { MediaPickerField } from "../../../components/ui/media-picker-field";
import { withDefaultProfileAvatar } from "../profile-avatar";
import { ContactSection } from "../contact-section";
import { BioInput } from "../bio-section";
import {
  buildFullUpdatePayload,
  buildInitialState,
  fromDelimitedString,
  toDelimitedString,
  type ProfileFormState,
} from "../profile-edit-helpers";
import {
  ensureOption,
  getRegionFromCity,
  isEmailValid,
  isPhoneNumberValid,
  isRegionConsistentWithCity,
  NATIONALITY_OPTIONS,
  normalizeContactEmail,
  normalizeFacebookInput,
  normalizeInstagramInput,
  normalizePhoneInput,
  normalizeProfileBioInput,
  REGION_OPTIONS,
  searchItalianCities,
  validateBirthDateInput,
  validateProfileBio,
  type ItalianCityOption,
} from "../profile-form-utils";
import type { CompleteProfessionalProfile } from "../profile-service";
import { updateCompleteProfessionalProfile } from "../profile-service";
import {
  pickAndUploadMedia,
  ProfileMediaUploadError,
  removeMediaFromStorage,
  type UploadedMediaItem,
} from "../media-upload-service";
import { spacing } from "../../../theme/tokens";
import { AppText, Input, SectionCard } from "../../../ui";
import { EditModalShell } from "./EditModalShell";
import { WhereToPlaySection } from "../../onboarding/where-to-play-section";
import type { AvailabilityType } from "../../onboarding/onboarding-form";
import { AVAILABLE_FROM_OPTIONS, COACH_PRIMARY_ROLE_OPTIONS } from "../../onboarding/coach/CoachRoleStep";
import type { ProfileGender } from "../../onboarding/create-initial-profile";
import { OnboardingBaseFieldsSection } from "./OnboardingBaseFieldsSection";

type UnifiedCoachFormState = {
  avatarUrl: string;
  bio: string;
  birthDate: string;
  city: string;
  coachAvailableFrom: string;
  coachPrimaryRole: string;
  coachedCategories: string;
  coachedClubs: string;
  contactEmail: string;
  contactFacebook: string;
  contactInstagram: string;
  contactPhone: string;
  currentLocationCity: string;
  currentLocationCountry: string;
  domicile: string;
  fullName: string;
  gamePhilosophy: string;
  gender: ProfileGender | "";
  legalStatus: string;
  languages: string[];
  licenses: string;
  nationality: string;
  openToNewRole: boolean;
  region: string;
  residence: string;
  residenceCountry: string;
  showContactEmail: boolean;
  showContactFacebook: boolean;
  showContactInstagram: boolean;
  technicalVideoUrl: string;
  useResidenceForDomicile: boolean;
};

type Props = {
  completeProfile: CompleteProfessionalProfile;
  onClose: () => void;
  onSaved: () => void;
  userId: string;
  visible: boolean;
};

function buildFormFromProfile(
  completeProfile: CompleteProfessionalProfile,
): UnifiedCoachFormState {
  const base = buildInitialState(completeProfile);

  return {
    avatarUrl: base.avatarUrl,
    bio: base.bio,
    birthDate: base.birthDate,
    city: base.city,
    coachAvailableFrom: base.coachAvailableFrom,
    coachPrimaryRole: base.coachPrimaryRole,
    coachedCategories: base.coachedCategories,
    coachedClubs: base.coachedClubs,
    contactEmail: base.contactEmail,
    contactFacebook: base.contactFacebook,
    contactInstagram: base.contactInstagram,
    contactPhone: base.contactPhone,
    currentLocationCity: base.currentLocationCity,
    currentLocationCountry: base.currentLocationCountry,
    domicile: base.domicile,
    fullName: base.fullName,
    gamePhilosophy: base.gamePhilosophy,
    gender: base.gender,
    legalStatus: base.legalStatus,
    languages: fromDelimitedString(base.languages),
    licenses: base.licenses,
    nationality: base.nationality,
    openToNewRole: base.openToNewRole,
    region: base.region,
    residence: base.residence,
    residenceCountry: base.residenceCountry,
    showContactEmail: base.showContactEmail,
    showContactFacebook: base.showContactFacebook,
    showContactInstagram: base.showContactInstagram,
    technicalVideoUrl: base.technicalVideoUrl,
    useResidenceForDomicile: base.useResidenceForDomicile,
  };
}

export function EditCoachProfileModal({
  completeProfile,
  onClose,
  onSaved,
  userId,
  visible,
}: Props) {
  const [form, setForm] = useState<UnifiedCoachFormState>(() =>
    buildFormFromProfile(completeProfile),
  );
  const [availabilityType, setAvailabilityType] = useState<AvailabilityType>("ITALY");
  const [preferredRegions, setPreferredRegions] = useState<string[]>([]);
  const [preferredProvinces, setPreferredProvinces] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isBioTouched, setIsBioTouched] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      const base = buildInitialState(completeProfile);
      setForm(buildFormFromProfile(completeProfile));
      setAvailabilityType((base.coachAvailabilityType as AvailabilityType) || "ITALY");
      setPreferredRegions(fromDelimitedString(base.preferredRegions));
      setPreferredProvinces(fromDelimitedString(base.coachPreferredProvinces));
      setIsBioTouched(false);
      setUploadingField(null);
    }
  }, [completeProfile, visible]);

  function patch<K extends keyof UnifiedCoachFormState>(
    key: K,
    value: UnifiedCoachFormState[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const citySuggestions = useMemo(
    () => searchItalianCities(form.city),
    [form.city],
  );
  const nationalityOptions = useMemo(
    () => ensureOption(NATIONALITY_OPTIONS, form.nationality),
    [form.nationality],
  );
  const regionOptions = useMemo(
    () => ensureOption(REGION_OPTIONS, form.region),
    [form.region],
  );
  const birthDateHelperText = useMemo(() => {
    const result = validateBirthDateInput(form.birthDate);
    return !result.isValid ? (result.message ?? undefined) : undefined;
  }, [form.birthDate]);
  const cityHelperText = useMemo(() => {
    if (!form.city.trim()) {
      return undefined;
    }

    if (!isRegionConsistentWithCity(form.city, form.region)) {
      return "La regione selezionata non corrisponde alla città.";
    }

    return undefined;
  }, [form.city, form.region]);
  const bioValidation = validateProfileBio(form.bio);
  const bioError =
    isBioTouched && !bioValidation.isValid ? bioValidation.message : null;

  function handleCitySuggestionPress(suggestion: ItalianCityOption) {
    setForm((prev) => ({
      ...prev,
      city: suggestion.name,
      region: suggestion.region,
    }));
  }

  function handleResidenceSuggestionPress(suggestion: ItalianCityOption) {
    setForm((prev) => ({
      ...prev,
      residence: suggestion.name,
    }));
  }

  function handleDomicileSuggestionPress(suggestion: ItalianCityOption) {
    setForm((prev) => ({
      ...prev,
      domicile: suggestion.name,
    }));
  }

  async function handleAvatarPick() {
    setUploadingField("avatar");

    try {
      const results: UploadedMediaItem[] = await pickAndUploadMedia({
        folder: "avatars",
        mediaTypes: ["images"],
        userId,
      });

      if (results.length === 0) {
        setUploadingField(null);
        return;
      }

      const previousUrl = form.avatarUrl;
      patch("avatarUrl", results[0].url);

      if (previousUrl) {
        try {
          await removeMediaFromStorage(previousUrl);
        } catch {
          // Best-effort cleanup.
        }
      }
    } catch (error) {
      const message =
        error instanceof ProfileMediaUploadError
          ? error.message
          : "Caricamento immagine non riuscito.";
      Alert.alert("Errore", message);
    } finally {
      setUploadingField(null);
    }
  }

  async function handleAvatarRemove() {
    const previousUrl = form.avatarUrl;
    patch("avatarUrl", "");

    if (previousUrl) {
      try {
        await removeMediaFromStorage(previousUrl);
      } catch {
        // Best-effort cleanup.
      }
    }
  }

  async function handleTechnicalVideoPick() {
    setUploadingField("technicalVideoUrl");

    try {
      const results: UploadedMediaItem[] = await pickAndUploadMedia({
        folder: "technical-video",
        mediaTypes: ["videos"],
        userId,
      });

      if (results.length === 0) {
        setUploadingField(null);
        return;
      }

      const previousUrl = form.technicalVideoUrl;
      patch("technicalVideoUrl", results[0].url);

      if (previousUrl) {
        try {
          await removeMediaFromStorage(previousUrl);
        } catch {
          // Best-effort cleanup.
        }
      }
    } catch (error) {
      const message =
        error instanceof ProfileMediaUploadError
          ? error.message
          : "Caricamento del video non riuscito.";
      Alert.alert("Errore", message);
    } finally {
      setUploadingField(null);
    }
  }

  async function handleTechnicalVideoRemove() {
    const previousUrl = form.technicalVideoUrl;
    patch("technicalVideoUrl", "");

    if (previousUrl) {
      try {
        await removeMediaFromStorage(previousUrl);
      } catch {
        // Best-effort cleanup.
      }
    }
  }

  async function handleSave() {
    const trimmedName = form.fullName.trim();

    if (trimmedName.length < 3 || trimmedName.length > 60) {
      Alert.alert(
        "Nome non valido",
        "Il nome deve contenere tra 3 e 60 caratteri.",
      );
      return;
    }

    const bioResult = validateProfileBio(form.bio);
    if (!bioResult.isValid) {
      setIsBioTouched(true);
      Alert.alert("Attenzione", bioResult.message ?? "Bio non valida.");
      return;
    }

    const birthDateResult = validateBirthDateInput(form.birthDate);
    if (!birthDateResult.isValid) {
      Alert.alert(
        "Data di nascita non valida",
        birthDateResult.message ?? "Controlla il formato della data.",
      );
      return;
    }

    if (form.city.trim()) {
      const regionFromCity = getRegionFromCity(form.city);
      if (!regionFromCity) {
        Alert.alert(
          "Città non valida",
          "La città inserita non è stata trovata. Seleziona una città dai suggerimenti.",
        );
        return;
      }

      if (form.region.trim() && !isRegionConsistentWithCity(form.city, form.region)) {
        Alert.alert(
          "Regione non coerente",
          "La regione selezionata non corrisponde alla città inserita.",
        );
        return;
      }
    }

    const normalizedInstagram = normalizeInstagramInput(form.contactInstagram);
    const normalizedFacebook = normalizeFacebookInput(form.contactFacebook);
    const normalizedEmail = normalizeContactEmail(form.contactEmail);
    const normalizedPhone = normalizePhoneInput(form.contactPhone);

    if (form.contactInstagram.trim() && !normalizedInstagram) {
      Alert.alert("Errore", "Inserisci un username o link Instagram valido.");
      return;
    }

    if (form.contactFacebook.trim() && !normalizedFacebook) {
      Alert.alert("Errore", "Inserisci un username o link Facebook valido.");
      return;
    }

    if (normalizedEmail && !isEmailValid(normalizedEmail)) {
      Alert.alert("Errore", "Inserisci un indirizzo email valido.");
      return;
    }

    if (form.contactPhone.trim() && !isPhoneNumberValid(normalizedPhone)) {
      Alert.alert(
        "Errore",
        "Inserisci un numero di telefono valido in formato internazionale E.164.",
      );
      return;
    }

    setIsSaving(true);

    try {
      const base = buildInitialState(completeProfile);
      const merged: ProfileFormState = {
        ...base,
        avatarUrl: form.avatarUrl,
        bio: normalizeProfileBioInput(form.bio),
        birthDate: form.birthDate,
        city: form.city,
        coachAvailableFrom: form.coachAvailableFrom,
        coachPrimaryRole: form.coachPrimaryRole,
        coachedCategories: form.coachedCategories,
        coachedClubs: form.coachedClubs,
        coachAvailabilityType: availabilityType,
        coachPreferredProvinces: toDelimitedString(preferredProvinces),
        contactEmail: normalizedEmail,
        contactFacebook: normalizedFacebook ?? "",
        contactInstagram: normalizedInstagram ?? "",
        contactPhone: normalizedPhone,
        currentLocationCity: form.currentLocationCity,
        currentLocationCountry: form.currentLocationCountry,
        domicile: form.domicile,
        fullName: trimmedName,
        gamePhilosophy: form.gamePhilosophy,
        gender: form.gender,
        legalStatus: form.legalStatus,
        languages: toDelimitedString(form.languages),
        licenses: form.licenses,
        nationality: form.nationality,
        openToNewRole: form.openToNewRole,
        preferredRegions: toDelimitedString(preferredRegions),
        region: form.region,
        residence: form.residence,
        residenceCountry: form.residenceCountry,
        showContactEmail: form.showContactEmail,
        showContactFacebook: form.showContactFacebook,
        showContactInstagram: form.showContactInstagram,
        technicalVideoUrl: form.technicalVideoUrl,
        useResidenceForDomicile: form.useResidenceForDomicile,
      };

      const payload = buildFullUpdatePayload(completeProfile, merged);
      payload.profile.birth_date = birthDateResult.isoValue;
      payload.userContacts = {
        email: normalizedEmail,
        facebook: normalizedFacebook ?? "",
        instagram: normalizedInstagram ?? "",
        phone: normalizedPhone,
        showEmail: form.showContactEmail,
        showFacebook: form.showContactFacebook,
        showInstagram: form.showContactInstagram,
      };

      await updateCompleteProfessionalProfile(payload);
      onSaved();
    } catch (error) {
      Alert.alert(
        "Errore",
        error instanceof Error ? error.message : "Salvataggio non riuscito.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <EditModalShell
      isSaving={isSaving}
      onClose={onClose}
      onSave={handleSave}
      title="Modifica profilo"
      visible={visible}
    >
      <SectionCard title="Foto profilo">
        <MediaPickerField
          buttonLabel="Carica foto"
          isUploading={uploadingField === "avatar"}
          label="Foto profilo"
          onPick={handleAvatarPick}
          onRemove={handleAvatarRemove}
          previewUrl={withDefaultProfileAvatar(form.avatarUrl || null)}
          removable={Boolean(form.avatarUrl)}
          removeLabel="Rimuovi foto"
        />
      </SectionCard>

      <SectionCard title="Dati personali">
        <OnboardingBaseFieldsSection
          birthDate={form.birthDate}
          birthDateHelperText={birthDateHelperText}
          city={form.city}
          cityHelperText={cityHelperText}
          citySuggestions={citySuggestions}
          currentLocationCity={form.currentLocationCity}
          currentLocationCountry={form.currentLocationCountry}
          domicile={form.domicile}
          fullName={form.fullName}
          gender={form.gender}
          languages={form.languages}
          legalStatus={form.legalStatus}
          nationality={form.nationality}
          nationalityOptions={nationalityOptions}
          onBirthDateChange={(value) => patch("birthDate", value)}
          onCityChange={(value) => patch("city", value)}
          onCitySuggestionPress={handleCitySuggestionPress}
          onCurrentLocationCityChange={(value) => patch("currentLocationCity", value)}
          onCurrentLocationCountryChange={(value) =>
            patch("currentLocationCountry", value)
          }
          onDomicileChange={(value) => patch("domicile", value)}
          onDomicileSelect={handleDomicileSuggestionPress}
          onFullNameChange={(value) => patch("fullName", value)}
          onGenderChange={(value) => patch("gender", value)}
          onLanguagesChange={(value) => patch("languages", value)}
          onLegalStatusChange={(value) => patch("legalStatus", value)}
          onNationalityChange={(value) => patch("nationality", value)}
          onRegionChange={(value) => patch("region", value)}
          onResidenceChange={(value) => patch("residence", value)}
          onResidenceCountryChange={(value) => patch("residenceCountry", value)}
          onResidenceSelect={handleResidenceSuggestionPress}
          onUseResidenceForDomicileChange={(value) =>
            patch("useResidenceForDomicile", value)
          }
          region={form.region}
          regionOptions={regionOptions}
          residence={form.residence}
          residenceCountry={form.residenceCountry}
          useResidenceForDomicile={form.useResidenceForDomicile}
        />
      </SectionCard>

      <SectionCard title="Profilo allenatore">
        <SelectField
          allowClear
          clearLabel="Rimuovi ruolo"
          label="Ruolo principale"
          onChange={(value) => patch("coachPrimaryRole", value)}
          options={COACH_PRIMARY_ROLE_OPTIONS}
          placeholder="Seleziona ruolo"
          value={form.coachPrimaryRole}
        />
        <Input
          label="Licenze"
          onChangeText={(value) => patch("licenses", value)}
          placeholder="UEFA B, UEFA A..."
          value={form.licenses}
        />
        <Input
          label="Squadre allenate"
          onChangeText={(value) => patch("coachedClubs", value)}
          placeholder="Nome squadra 1, Nome squadra 2..."
          value={form.coachedClubs}
        />
        <Input
          label="Categorie allenate"
          onChangeText={(value) => patch("coachedCategories", value)}
          placeholder="Juniores, Promozione..."
          value={form.coachedCategories}
        />
      </SectionCard>

      <SectionCard title="Disponibilità">
        <WhereToPlaySection
          availabilityType={availabilityType}
          categories={[]}
          hideCategories
          infoMessages={{
            ITALY: "",
            PROVINCES: "Indica una o più province in cui sei disponibile ad allenare.",
            REGIONS: "Indica una o più regioni in cui sei disponibile ad allenare.",
          }}
          isAvailable={form.openToNewRole}
          onAvailabilityTypeChange={setAvailabilityType}
          onCategoriesChange={() => undefined}
          onIsAvailableChange={(value) => {
            patch("openToNewRole", value);
            if (!value) {
              setAvailabilityType("ITALY");
              setPreferredRegions([]);
              setPreferredProvinces([]);
              patch("coachAvailableFrom", "");
            }
          }}
          onProvincesChange={setPreferredProvinces}
          onRegionsChange={setPreferredRegions}
          provinces={preferredProvinces}
          provincesHelperText="Puoi selezionare più province in cui allenare."
          provincesLabel="Province di interesse"
          regions={preferredRegions}
          regionsHelperText="Puoi selezionare più regioni in cui allenare."
          regionsLabel="Regioni di interesse"
          toggleLabel="Disponibile per nuove panchine"
          toggleSubtitle="Il tuo profilo può comparire tra gli allenatori disponibili."
        />
        {form.openToNewRole ? (
          <SelectField
            allowClear
            clearLabel="Rimuovi disponibilità"
            label="Disponibile da"
            onChange={(value) => patch("coachAvailableFrom", value)}
            options={AVAILABLE_FROM_OPTIONS}
            placeholder="Seleziona disponibilità"
            value={form.coachAvailableFrom}
          />
        ) : null}
      </SectionCard>

      <SectionCard title="Filosofia di gioco">
        <Input
          label="Filosofia di gioco"
          multiline
          onChangeText={(value) => patch("gamePhilosophy", value)}
          placeholder="Descrivi principi, metodologia e obiettivi."
          value={form.gamePhilosophy}
        />
      </SectionCard>

      <SectionCard title="Media">
        <MediaPickerField
          buttonLabel="Carica video"
          helperText="Carica un video tecnico per arricchire il tuo profilo."
          isUploading={uploadingField === "technicalVideoUrl"}
          label="Video tecnico"
          mediaType="video"
          onPick={handleTechnicalVideoPick}
          onRemove={handleTechnicalVideoRemove}
          previewUrl={form.technicalVideoUrl || null}
          removable={Boolean(form.technicalVideoUrl)}
        />
      </SectionCard>

      <SectionCard title="Bio">
        <BioInput
          errorMessage={bioError}
          onChangeText={(value) => {
            setIsBioTouched(true);
            patch("bio", normalizeProfileBioInput(value));
          }}
          value={form.bio}
        />
      </SectionCard>

      <SectionCard title="Contatti">
        <ContactSection
          contacts={{
            email: form.contactEmail,
            facebook: form.contactFacebook,
            instagram: form.contactInstagram,
            phone: form.contactPhone,
            showEmail: form.showContactEmail,
            showFacebook: form.showContactFacebook,
            showInstagram: form.showContactInstagram,
          }}
          editable
          onEmailChange={(value) => patch("contactEmail", value)}
          onFacebookChange={(value) => patch("contactFacebook", value)}
          onInstagramChange={(value) => patch("contactInstagram", value)}
          onPhoneChange={(value) => patch("contactPhone", value)}
          onShowEmailChange={(value) => patch("showContactEmail", value)}
          onShowFacebookChange={(value) => patch("showContactFacebook", value)}
          onShowInstagramChange={(value) => patch("showContactInstagram", value)}
        />
        <AppText color="secondary" style={{ marginTop: spacing[8] }} variant="bodySm">
          La chat interna resta il canale principale. I contatti esterni sono facoltativi.
        </AppText>
      </SectionCard>
    </EditModalShell>
  );
}
