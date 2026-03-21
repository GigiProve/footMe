import { useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";

import type { ItalianCityOption } from "../profile-form-utils";
import type { CompleteProfessionalProfile } from "../profile-service";

import { PersonalInfoSection } from "../personal-info-section";
import { buildFullUpdatePayload, buildInitialState } from "../profile-edit-helpers";
import {
  ensureOption,
  getRegionFromCity,
  isRegionConsistentWithCity,
  NATIONALITY_OPTIONS,
  REGION_OPTIONS,
  searchItalianCities,
  validateBirthDateInput,
} from "../profile-form-utils";
import { updateCompleteProfessionalProfile } from "../profile-service";
import { EditModalShell } from "./EditModalShell";

type PersonalInfoFormState = {
  birthDate: string;
  city: string;
  fullName: string;
  nationality: string;
  region: string;
};

type EditPersonalInfoModalProps = {
  completeProfile: CompleteProfessionalProfile;
  onClose: () => void;
  onSaved: () => void;
  userId: string;
  visible: boolean;
};

function getInitialFormState(
  completeProfile: CompleteProfessionalProfile,
): PersonalInfoFormState {
  const base = buildInitialState(completeProfile);
  return {
    birthDate: base.birthDate,
    city: base.city,
    fullName: base.fullName,
    nationality: base.nationality,
    region: base.region,
  };
}

export function EditPersonalInfoModal({
  completeProfile,
  onClose,
  onSaved,
  userId,
  visible,
}: EditPersonalInfoModalProps) {
  const [form, setForm] = useState<PersonalInfoFormState>(() =>
    getInitialFormState(completeProfile),
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setForm(getInitialFormState(completeProfile));
    }
  }, [visible, completeProfile]);

  const nationalityOptions = useMemo(
    () => ensureOption(NATIONALITY_OPTIONS, form.nationality),
    [form.nationality],
  );

  const regionOptions = useMemo(
    () => ensureOption(REGION_OPTIONS, form.region),
    [form.region],
  );

  const citySuggestions = useMemo(
    () => searchItalianCities(form.city),
    [form.city],
  );

  const birthDateHelperText = useMemo(() => {
    const result = validateBirthDateInput(form.birthDate);
    if (!result.isValid) {
      return result.message ?? undefined;
    }
    return undefined;
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

  function updateField<K extends keyof PersonalInfoFormState>(
    key: K,
    value: PersonalInfoFormState[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleCitySuggestionPress(suggestion: ItalianCityOption) {
    setForm((prev) => ({
      ...prev,
      city: suggestion.name,
      region: suggestion.region,
    }));
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

    const birthDateValidation = validateBirthDateInput(form.birthDate);
    if (!birthDateValidation.isValid) {
      Alert.alert(
        "Data di nascita non valida",
        birthDateValidation.message ?? "Controlla il formato della data.",
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
    }

    if (form.city.trim() && form.region.trim()) {
      if (!isRegionConsistentWithCity(form.city, form.region)) {
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
        fullName: trimmedName,
        birthDate: form.birthDate,
        city: form.city,
        nationality: form.nationality,
        region: form.region,
      };

      const payload = buildFullUpdatePayload(completeProfile, mergedState);
      payload.profile.birth_date = birthDateValidation.isoValue;

      await updateCompleteProfessionalProfile(payload);
      onSaved();
    } catch (error) {
      Alert.alert(
        "Errore",
        error instanceof Error
          ? error.message
          : "Si è verificato un errore durante il salvataggio.",
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
      title="Informazioni personali"
      visible={visible}
    >
      <PersonalInfoSection
        birthDate={form.birthDate}
        birthDateHelperText={birthDateHelperText}
        city={form.city}
        cityHelperText={cityHelperText}
        citySuggestions={citySuggestions}
        editable
        fullName={form.fullName}
        nationality={form.nationality}
        nationalityOptions={nationalityOptions}
        onBirthDateChange={(value) => updateField("birthDate", value)}
        onCityChange={(value) => updateField("city", value)}
        onCitySuggestionPress={handleCitySuggestionPress}
        onFullNameChange={(value) => updateField("fullName", value)}
        onNationalityChange={(value) => updateField("nationality", value)}
        onRegionChange={(value) => updateField("region", value)}
        region={form.region}
        regionOptions={regionOptions}
      />
    </EditModalShell>
  );
}
