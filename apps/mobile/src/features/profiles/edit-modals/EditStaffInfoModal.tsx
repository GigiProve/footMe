import { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { InterestCategoriesSelector } from "../../../components/ui/interest-categories-selector";
import { MediaPickerField } from "../../../components/ui/media-picker-field";
import { SelectField } from "../../../components/ui/select-field";
import { colors, spacing } from "../../../theme/tokens";
import { AppText, Button, Input, SectionCard } from "../../../ui";
import type { ProfileGender } from "../../onboarding/create-initial-profile";
import type { AvailabilityType } from "../../onboarding/onboarding-form";
import { STAFF_ROLE_OPTIONS } from "../../onboarding/onboarding-types";
import { AVAILABLE_FROM_OPTIONS } from "../../onboarding/coach/CoachRoleStep";
import { WhereToPlaySection } from "../../onboarding/where-to-play-section";
import {
  pickAndUploadMedia,
  ProfileMediaUploadError,
  removeMediaFromStorage,
  type UploadedMediaItem,
} from "../media-upload-service";
import {
  buildFullUpdatePayload,
  buildInitialState,
  fromDelimitedString,
  toDelimitedString,
} from "../profile-edit-helpers";
import {
  ensureOption,
  getRegionFromCity,
  isRegionConsistentWithCity,
  NATIONALITY_OPTIONS,
  REGION_OPTIONS,
  searchItalianCities,
  validateBirthDateInput,
  type ItalianCityOption,
} from "../profile-form-utils";
import { withDefaultProfileAvatar } from "../profile-avatar";
import type { CompleteProfessionalProfile } from "../profile-service";
import { updateCompleteProfessionalProfile } from "../profile-service";
import { EditModalShell } from "./EditModalShell";
import { OnboardingBaseFieldsSection } from "./OnboardingBaseFieldsSection";

type EditStaffInfoModalProps = {
  completeProfile: CompleteProfessionalProfile;
  onClose: () => void;
  onSaved: () => void;
  userId: string;
  visible: boolean;
};

type StaffInfoFormState = {
  avatarUrl: string;
  birthDate: string;
  city: string;
  currentLocationCity: string;
  currentLocationCountry: string;
  domicile: string;
  experienceSummary: string;
  fullName: string;
  gender: ProfileGender | "";
  languages: string[];
  legalStatus: string;
  nationality: string;
  region: string;
  residence: string;
  residenceCountry: string;
  staffPrimaryRole: string;
  staffRoles: string[];
  useResidenceForDomicile: boolean;
};

function getInitialFormState(
  completeProfile: CompleteProfessionalProfile,
): StaffInfoFormState {
  const initial = buildInitialState(completeProfile);

  return {
    avatarUrl: initial.avatarUrl,
    birthDate: initial.birthDate,
    city: initial.city,
    currentLocationCity: initial.currentLocationCity,
    currentLocationCountry: initial.currentLocationCountry,
    domicile: initial.domicile,
    experienceSummary: initial.experienceSummary,
    fullName: initial.fullName,
    gender: initial.gender,
    languages: fromDelimitedString(initial.languages),
    legalStatus: initial.legalStatus,
    nationality: initial.nationality,
    region: initial.region,
    residence: initial.residence,
    residenceCountry: initial.residenceCountry,
    staffPrimaryRole: initial.staffPrimaryRole,
    staffRoles: fromDelimitedString(initial.staffRoles),
    useResidenceForDomicile: initial.useResidenceForDomicile,
  };
}

export function EditStaffInfoModal({
  completeProfile,
  onClose,
  onSaved,
  userId,
  visible,
}: EditStaffInfoModalProps) {
  const [form, setForm] = useState<StaffInfoFormState>(() =>
    getInitialFormState(completeProfile),
  );
  const [certifications, setCertifications] = useState("");
  const [preferredCategories, setPreferredCategories] = useState<string[]>([]);
  const [preferredRegions, setPreferredRegions] = useState<string[]>([]);
  const [availabilityType, setAvailabilityType] = useState<AvailabilityType>("ITALY");
  const [availableFrom, setAvailableFrom] = useState("");
  const [preferredProvinces, setPreferredProvinces] = useState<string[]>([]);
  const [openToWork, setOpenToWork] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      const initial = buildInitialState(completeProfile);
      setForm(getInitialFormState(completeProfile));
      setCertifications(initial.certifications);
      setPreferredCategories(fromDelimitedString(initial.staffPreferredCategories));
      setPreferredRegions(fromDelimitedString(initial.preferredRegions));
      setAvailabilityType((initial.staffAvailabilityType as AvailabilityType) || "ITALY");
      setAvailableFrom(initial.staffAvailableFrom);
      setPreferredProvinces(fromDelimitedString(initial.staffPreferredProvinces));
      setOpenToWork(initial.openToWork);
      setUploadingField(null);
    }
  }, [visible, completeProfile]);

  function patch<Key extends keyof StaffInfoFormState>(
    key: Key,
    value: StaffInfoFormState[Key],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleStaffRole(role: string) {
    setForm((prev) => {
      const nextRoles = prev.staffRoles.includes(role)
        ? prev.staffRoles.filter((entry) => entry !== role)
        : [...prev.staffRoles, role];
      const nextPrimaryRole =
        nextRoles.length === 1
          ? nextRoles[0]
          : nextRoles.includes(prev.staffPrimaryRole)
            ? prev.staffPrimaryRole
            : "";

      return {
        ...prev,
        staffPrimaryRole: nextPrimaryRole,
        staffRoles: nextRoles,
      };
    });
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

  async function handleSave() {
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

    setIsSaving(true);

    try {
      const baseState = buildInitialState(completeProfile);
      const mergedState = {
        ...baseState,
        avatarUrl: form.avatarUrl,
        birthDate: form.birthDate,
        certifications,
        city: form.city,
        currentLocationCity: form.currentLocationCity,
        currentLocationCountry: form.currentLocationCountry,
        domicile: form.domicile,
        experienceSummary: form.experienceSummary,
        fullName: form.fullName,
        gender: form.gender,
        languages: toDelimitedString(form.languages),
        legalStatus: form.legalStatus,
        nationality: form.nationality,
        openToWork,
        preferredRegions: preferredRegions.join(", "),
        region: form.region,
        residence: form.residence,
        residenceCountry: form.residenceCountry,
        staffAvailabilityType: availabilityType,
        staffAvailableFrom: availableFrom,
        staffPreferredCategories: preferredCategories.join(", "),
        staffPreferredProvinces: preferredProvinces.join(", "),
        staffPrimaryRole: form.staffPrimaryRole,
        staffRoles: form.staffRoles.join(", "),
        useResidenceForDomicile: form.useResidenceForDomicile,
      };

      const payload = buildFullUpdatePayload(completeProfile, mergedState);
      payload.profile.birth_date = birthDateResult.isoValue;

      await updateCompleteProfessionalProfile(payload);
      onSaved();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Errore durante il salvataggio.";
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
      title="Informazioni staff"
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

      <SectionCard title="Ruoli staff">
        <View style={styles.fieldGroup}>
          <AppText style={styles.fieldLabel}>Ruoli coperti</AppText>
          <View style={styles.pillRow}>
            {STAFF_ROLE_OPTIONS.map((option) => (
              <Button
                key={option.value}
                label={option.label}
                onPress={() => toggleStaffRole(option.value)}
                variant={
                  form.staffRoles.includes(option.value) ? "primary" : "chipAction"
                }
              />
            ))}
          </View>
        </View>

        <SelectField
          allowClear
          clearLabel="Rimuovi ruolo principale"
          label="Ruolo principale"
          onChange={(value) => patch("staffPrimaryRole", value)}
          options={STAFF_ROLE_OPTIONS}
          placeholder="Seleziona ruolo principale"
          value={form.staffPrimaryRole}
        />
      </SectionCard>

      <SectionCard title="Profilo staff">
        <Input
          label="Esperienza"
          multiline
          onChangeText={(value) => patch("experienceSummary", value)}
          placeholder="Descrivi brevemente il tuo profilo tecnico."
          value={form.experienceSummary}
        />
        <Input
          label="Certificazioni"
          onChangeText={setCertifications}
          placeholder="Es. UEFA B, Preparatore atletico"
          value={certifications}
        />
      </SectionCard>

      <SectionCard title="Disponibilità">
        <WhereToPlaySection
          availabilityType={availabilityType}
          categories={[]}
          hideCategories
          infoMessages={{
            ITALY: "",
            REGIONS: "Indica una o più regioni in cui sei disponibile a collaborare con club e staff tecnici.",
            PROVINCES: "Indica una o più province in cui sei disponibile a collaborare con club e staff tecnici.",
          }}
          isAvailable={openToWork}
          onAvailabilityTypeChange={setAvailabilityType}
          onCategoriesChange={() => undefined}
          onIsAvailableChange={(value) => {
            setOpenToWork(value);
            if (!value) {
              setAvailableFrom("");
              setPreferredCategories([]);
              setPreferredRegions([]);
              setPreferredProvinces([]);
              setAvailabilityType("ITALY");
            }
          }}
          onProvincesChange={setPreferredProvinces}
          onRegionsChange={setPreferredRegions}
          provinces={preferredProvinces}
          provincesHelperText="Puoi selezionare più province in cui collaborare."
          provincesLabel="Province di interesse"
          regions={preferredRegions}
          regionsHelperText="Puoi selezionare più regioni in cui collaborare."
          regionsLabel="Regioni di interesse"
          toggleLabel="Disponibile a nuove collaborazioni"
          toggleSubtitle="Il tuo profilo può comparire tra gli staff tecnici disponibili."
        />
        {openToWork ? (
          <InterestCategoriesSelector
            label="Categorie di interesse"
            onChange={setPreferredCategories}
            value={preferredCategories}
          />
        ) : null}
        {openToWork ? (
          <SelectField
            label="Disponibile da"
            onChange={setAvailableFrom}
            options={AVAILABLE_FROM_OPTIONS}
            placeholder="Seleziona disponibilità"
            value={availableFrom}
          />
        ) : null}
      </SectionCard>
    </EditModalShell>
  );
}

const styles = StyleSheet.create({
  fieldGroup: {
    gap: spacing[8],
  },
  fieldLabel: {
    color: colors.textPrimary,
    fontWeight: "600",
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
});
