import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { MediaPickerField } from "../../../components/ui/media-picker-field";
import { WheelPicker } from "../../../components/ui/wheel-picker";
import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button, Input, SectionCard, Toggle } from "../../../ui";
import type { ProfileGender } from "../../onboarding/create-initial-profile";
import { BioInput } from "../bio-section";
import { ContactSection } from "../contact-section";
import {
  pickAndUploadMedia,
  ProfileMediaUploadError,
  removeMediaFromStorage,
  type UploadedMediaItem,
} from "../media-upload-service";
import { withDefaultProfileAvatar } from "../profile-avatar";
import {
  buildFullUpdatePayload,
  buildInitialState,
  fromDelimitedString,
  parseWheelValue,
  toDelimitedString,
  type ProfileFormState,
} from "../profile-edit-helpers";
import {
  ensureOption,
  getRegionFromCity,
  isRegionConsistentWithCity,
  NATIONALITY_OPTIONS,
  REGION_OPTIONS,
  normalizeContactEmail,
  normalizeFacebookInput,
  normalizeInstagramInput,
  normalizePhoneInput,
  normalizeProfileBioInput,
  searchItalianCities,
  validateBirthDateInput,
  validateProfileBio,
  type ItalianCityOption,
} from "../profile-form-utils";
import {
  excludePrimaryFromSecondaryPositions,
  type PlayerPosition,
  type PreferredFoot,
} from "../player-sports";
import { PlayerCharacteristicsSection } from "../player-sports-section";
import {
  type CompleteProfessionalProfile,
  updateCompleteProfessionalProfile,
  type PlayerPalmaresRecord,
} from "../profile-service";
import { supabase } from "../../../lib/supabase";
import { WhereToPlaySection } from "../../onboarding/where-to-play-section";
import type { AvailabilityType } from "../../onboarding/onboarding-form";
import { EditModalShell } from "./EditModalShell";
import { OnboardingBaseFieldsSection } from "./OnboardingBaseFieldsSection";

// ────────────────────────────────
// Types
// ────────────────────────────────

type PalmaresType = "trophy" | "medal" | "top_scorer";

type PalmaresEntry = {
  id: string;
  clubName: string;
  competitionName: string;
  palmaresType: PalmaresType;
  seasonLabel: string;
};

type UnifiedPlayerFormState = {
  avatarUrl: string;
  fullName: string;
  birthDate: string;
  city: string;
  currentLocationCity: string;
  currentLocationCountry: string;
  domicile: string;
  gender: ProfileGender | "";
  legalStatus: string;
  region: string;
  residence: string;
  residenceCountry: string;
  useResidenceForDomicile: boolean;
  nationality: string;
  languages: string[];
  primaryPosition: PlayerPosition;
  secondaryPositions: PlayerPosition[];
  preferredFoot: PreferredFoot | "";
  heightCm: string;
  weightKg: string;
  willingToChangeClub: boolean;
  availabilityType: AvailabilityType;
  transferRegions: string[];
  transferProvinces: string[];
  showTransferBadge: boolean;
  showRegionsBadge: boolean;
  preferredCategories: string[];
  palmaresEntries: PalmaresEntry[];
  bio: string;
  contactPhone: string;
  contactEmail: string;
  contactInstagram: string;
  contactFacebook: string;
  showContactEmail: boolean;
  showContactInstagram: boolean;
  showContactFacebook: boolean;
};

type Props = {
  completeProfile: CompleteProfessionalProfile;
  onClose: () => void;
  onSaved: () => void;
  userId: string;
  visible: boolean;
};

// ────────────────────────────────
// Constants
// ────────────────────────────────

const TYPE_OPTIONS: { label: string; value: PalmaresType }[] = [
  { label: "Trofeo", value: "trophy" },
  { label: "Medaglia", value: "medal" },
  { label: "Capocannoniere", value: "top_scorer" },
];

// ────────────────────────────────
// Helpers
// ────────────────────────────────

function recordToEntry(r: PlayerPalmaresRecord): PalmaresEntry {
  return {
    id: r.id,
    clubName: r.club_name,
    competitionName: r.competition_name,
    palmaresType: (r.palmares_type as PalmaresType) || "trophy",
    seasonLabel: r.season_label,
  };
}

function newPalmaresEntry(): PalmaresEntry {
  return {
    id: `new-${Date.now()}`,
    clubName: "",
    competitionName: "",
    palmaresType: "trophy",
    seasonLabel: "",
  };
}

function buildFormFromProfile(
  completeProfile: CompleteProfessionalProfile,
): UnifiedPlayerFormState {
  const base = buildInitialState(completeProfile);
  return {
    avatarUrl: base.avatarUrl,
    fullName: base.fullName,
    birthDate: base.birthDate,
    city: base.city,
    currentLocationCity: base.currentLocationCity,
    currentLocationCountry: base.currentLocationCountry,
    domicile: base.domicile,
    region: base.region,
    gender: base.gender,
    legalStatus: base.legalStatus,
    nationality: base.nationality,
    residence: base.residence,
    residenceCountry: base.residenceCountry,
    useResidenceForDomicile: base.useResidenceForDomicile,
    languages: fromDelimitedString(base.languages),
    primaryPosition: base.primaryPosition,
    secondaryPositions: base.secondaryPositions,
    preferredFoot: base.preferredFoot,
    heightCm: base.heightCm,
    weightKg: base.weightKg,
    willingToChangeClub: base.willingToChangeClub,
    availabilityType: (base.availabilityType as AvailabilityType) || "ITALY",
    transferRegions: fromDelimitedString(base.transferRegions),
    transferProvinces: fromDelimitedString(base.transferProvinces),
    showTransferBadge: base.showTransferBadge,
    showRegionsBadge: base.showRegionsBadge,
    preferredCategories: fromDelimitedString(base.preferredCategories),
    palmaresEntries: completeProfile.playerPalmares.map(recordToEntry),
    bio: base.bio,
    contactPhone: base.contactPhone,
    contactEmail: base.contactEmail,
    contactInstagram: base.contactInstagram,
    contactFacebook: base.contactFacebook,
    showContactEmail: base.showContactEmail,
    showContactInstagram: base.showContactInstagram,
    showContactFacebook: base.showContactFacebook,
  };
}

// ────────────────────────────────
// Component
// ────────────────────────────────

export function EditPlayerProfileModal({
  completeProfile,
  onClose,
  onSaved,
  userId,
  visible,
}: Props) {
  const [form, setForm] = useState<UnifiedPlayerFormState>(() =>
    buildFormFromProfile(completeProfile),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isBioTouched, setIsBioTouched] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setForm(buildFormFromProfile(completeProfile));
      setIsBioTouched(false);
      setUploadingField(null);
    }
  }, [visible, completeProfile]);

  function patch<K extends keyof UnifiedPlayerFormState>(
    key: K,
    value: UnifiedPlayerFormState[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // ── Computed helpers ──
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
    if (!form.city.trim()) return undefined;
    if (!isRegionConsistentWithCity(form.city, form.region))
      return "La regione selezionata non corrisponde alla città.";
    return undefined;
  }, [form.city, form.region]);
  const bioValidation = validateProfileBio(form.bio);
  const bioError =
    isBioTouched && !bioValidation.isValid ? bioValidation.message : null;

  // ── Handlers ──
  function handleCitySuggestionPress(suggestion: ItalianCityOption) {
    setForm((prev) => ({ ...prev, city: suggestion.name, region: suggestion.region }));
  }

  function handleResidenceSuggestionPress(suggestion: ItalianCityOption) {
    setForm((prev) => ({ ...prev, residence: suggestion.name }));
  }

  function handleDomicileSuggestionPress(suggestion: ItalianCityOption) {
    setForm((prev) => ({ ...prev, domicile: suggestion.name }));
  }

  function handlePrimaryPositionChange(value: PlayerPosition) {
    setForm((prev) => ({
      ...prev,
      primaryPosition: value,
      secondaryPositions: excludePrimaryFromSecondaryPositions(
        prev.secondaryPositions,
        value,
      ),
    }));
  }

  function handleSecondaryPositionsChange(value: PlayerPosition[]) {
    setForm((prev) => ({
      ...prev,
      secondaryPositions: excludePrimaryFromSecondaryPositions(
        value,
        prev.primaryPosition,
      ),
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
          // Best-effort cleanup
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
        // Best-effort cleanup
      }
    }
  }

  function handlePalmaresUpdate(index: number, patch_: Partial<PalmaresEntry>) {
    setForm((prev) => ({
      ...prev,
      palmaresEntries: prev.palmaresEntries.map((e, i) =>
        i === index ? { ...e, ...patch_ } : e,
      ),
    }));
  }

  function handlePalmaresRemove(index: number) {
    setForm((prev) => ({
      ...prev,
      palmaresEntries: prev.palmaresEntries.filter((_, i) => i !== index),
    }));
  }

  async function handleSave() {
    // Validate bio
    const bioResult = validateProfileBio(form.bio);
    if (!bioResult.isValid) {
      setIsBioTouched(true);
      Alert.alert("Attenzione", bioResult.message ?? "Bio non valida.");
      return;
    }

    // Validate birth date
    const birthDateResult = validateBirthDateInput(form.birthDate);
    if (!birthDateResult.isValid) {
      Alert.alert(
        "Data di nascita non valida",
        birthDateResult.message ?? "Controlla il formato della data.",
      );
      return;
    }

    // Validate city
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

    // Validate palmares
    const hasEmptyPalmares = form.palmaresEntries.some(
      (e) =>
        !e.competitionName.trim() || !e.seasonLabel.trim() || !e.clubName.trim(),
    );
    if (hasEmptyPalmares) {
      Alert.alert(
        "Campi mancanti",
        "Compila tutti i campi per ogni riconoscimento nel palmares.",
      );
      return;
    }

    setIsSaving(true);
    try {
      // Build merged profile form state
      const base = buildInitialState(completeProfile);
      const normalizedInstagram = normalizeInstagramInput(form.contactInstagram);
      const normalizedFacebook = normalizeFacebookInput(form.contactFacebook);
      const normalizedEmail = normalizeContactEmail(form.contactEmail);
      const normalizedPhone = normalizePhoneInput(form.contactPhone);

      const merged: ProfileFormState = {
        ...base,
        avatarUrl: form.avatarUrl,
        fullName: form.fullName,
        birthDate: form.birthDate,
        city: form.city,
        currentLocationCity: form.currentLocationCity,
        currentLocationCountry: form.currentLocationCountry,
        domicile: form.domicile,
        region: form.region,
        gender: form.gender,
        legalStatus: form.legalStatus,
        nationality: form.nationality,
        residence: form.residence,
        residenceCountry: form.residenceCountry,
        useResidenceForDomicile: form.useResidenceForDomicile,
        languages: toDelimitedString(form.languages),
        primaryPosition: form.primaryPosition,
        secondaryPositions: form.secondaryPositions,
        preferredFoot: form.preferredFoot,
        heightCm: form.heightCm,
        weightKg: form.weightKg,
        willingToChangeClub: form.willingToChangeClub,
        availabilityType: form.availabilityType,
        transferRegions: toDelimitedString(form.transferRegions),
        transferProvinces: toDelimitedString(form.transferProvinces),
        showTransferBadge: form.showTransferBadge,
        showRegionsBadge: form.showRegionsBadge,
        preferredCategories: toDelimitedString(form.preferredCategories),
        bio: form.bio,
        contactPhone: normalizedPhone,
        contactEmail: normalizedEmail,
        contactInstagram: normalizedInstagram ?? "",
        contactFacebook: normalizedFacebook ?? "",
        showContactEmail: form.showContactEmail,
        showContactInstagram: form.showContactInstagram,
        showContactFacebook: form.showContactFacebook,
      };

      const payload = buildFullUpdatePayload(completeProfile, merged);
      payload.profile.birth_date = birthDateResult.isoValue;

      // Normalize contacts on payload
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

      // Save palmares separately
      const { error: palmaresError } = await supabase.rpc("save_player_palmares", {
        p_profile_id: userId,
        p_entries: form.palmaresEntries.map((e, i) => ({
          club_name: e.clubName,
          competition_name: e.competitionName,
          palmares_type: e.palmaresType,
          season_label: e.seasonLabel,
          sort_order: i,
        })),
      });
      if (palmaresError) throw palmaresError;

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

  // ── Render ──
  return (
    <EditModalShell
      isSaving={isSaving}
      onClose={onClose}
      onSave={handleSave}
      title="Modifica profilo"
      visible={visible}
    >
      {/* Foto profilo */}
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

      {/* Dati personali */}
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
          onCurrentLocationCountryChange={(value) => patch("currentLocationCountry", value)}
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

      {/* Info calcistiche */}
      <SectionCard title="Info calcistiche">
        <PlayerCharacteristicsSection
          editable
          onPreferredFootChange={(v) => patch("preferredFoot", v)}
          onPrimaryPositionChange={handlePrimaryPositionChange}
          onSecondaryPositionsChange={handleSecondaryPositionsChange}
          preferredFoot={form.preferredFoot}
          primaryPosition={form.primaryPosition}
          secondaryPositions={form.secondaryPositions}
        />
        <View style={styles.wheelRow}>
          <View style={styles.wheelCell}>
            <WheelPicker
              label="Altezza"
              max={220}
              min={140}
              onChange={(v) => patch("heightCm", String(v))}
              unit="cm"
              value={parseWheelValue(form.heightCm)}
            />
          </View>
          <View style={styles.wheelCell}>
            <WheelPicker
              label="Peso"
              max={130}
              min={40}
              onChange={(v) => patch("weightKg", String(v))}
              unit="kg"
              value={parseWheelValue(form.weightKg)}
            />
          </View>
        </View>
      </SectionCard>

      {/* Disponibilità */}
      <SectionCard title="Disponibilità">
        <WhereToPlaySection
          availabilityType={form.availabilityType}
          categories={form.preferredCategories}
          isAvailable={form.willingToChangeClub}
          onAvailabilityTypeChange={(v) => patch("availabilityType", v)}
          onCategoriesChange={(v) => patch("preferredCategories", v)}
          onIsAvailableChange={(v) => patch("willingToChangeClub", v)}
          onProvincesChange={(v) => patch("transferProvinces", v)}
          onRegionsChange={(v) => patch("transferRegions", v)}
          provinces={form.transferProvinces}
          regions={form.transferRegions}
          toggleLabel="Disponibile a cambiare squadra"
        />
        <Toggle
          label="Mostra 'Disponibile' come badge nel profilo"
          subtitle="Appare come badge sotto il tuo nome"
          onValueChange={(v) => patch("showTransferBadge", v)}
          value={form.showTransferBadge}
        />
        <Toggle
          label="Mostra zone di interesse come badge"
          subtitle="Le regioni selezionate appaiono sotto il tuo nome"
          onValueChange={(v) => patch("showRegionsBadge", v)}
          value={form.showRegionsBadge}
        />
      </SectionCard>

      {/* Palmares */}
      <SectionCard title="Palmares">
        <AppText variant="bodySm" color="secondary">
          Aggiungi i premi individuali o i campionati vinti nella tua carriera.
        </AppText>
        {form.palmaresEntries.map((entry, index) => (
          <View key={entry.id} style={styles.palmaresCard}>
            <View style={styles.palmaresCardHeader}>
              <AppText variant="titleSm">Riconoscimento {index + 1}</AppText>
              <Pressable
                accessibilityLabel="Rimuovi"
                hitSlop={8}
                onPress={() => handlePalmaresRemove(index)}
              >
                <Ionicons color={colors.danger} name="trash-outline" size={20} />
              </Pressable>
            </View>
            <Input
              label="Competizione"
              placeholder="es. Campionato Eccellenza"
              value={entry.competitionName}
              onChangeText={(v) => handlePalmaresUpdate(index, { competitionName: v })}
            />
            <Input
              label="Stagione"
              placeholder="es. 2023/2024"
              value={entry.seasonLabel}
              onChangeText={(v) => handlePalmaresUpdate(index, { seasonLabel: v })}
            />
            <Input
              label="Squadra"
              placeholder="es. ASD Vittoria"
              value={entry.clubName}
              onChangeText={(v) => handlePalmaresUpdate(index, { clubName: v })}
            />
            <View style={styles.typeRow}>
              {TYPE_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => handlePalmaresUpdate(index, { palmaresType: opt.value })}
                  style={[
                    styles.typeChip,
                    entry.palmaresType === opt.value
                      ? styles.typeChipSelected
                      : styles.typeChipDefault,
                  ]}
                >
                  <AppText
                    variant="bodySm"
                    style={[
                      styles.typeChipText,
                      entry.palmaresType === opt.value
                        ? styles.typeChipTextSelected
                        : styles.typeChipTextDefault,
                    ]}
                  >
                    {opt.label}
                  </AppText>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
        <Button
          label="+ Aggiungi riconoscimento"
          onPress={() =>
            setForm((prev) => ({
              ...prev,
              palmaresEntries: [...prev.palmaresEntries, newPalmaresEntry()],
            }))
          }
          variant="outline"
        />
      </SectionCard>

      {/* Bio */}
      <SectionCard title="Bio">
        <BioInput
          errorMessage={bioError}
          onChangeText={(v) => {
            setIsBioTouched(true);
            patch("bio", normalizeProfileBioInput(v));
          }}
          value={form.bio}
        />
      </SectionCard>

      {/* Contatti */}
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
          onEmailChange={(v) => patch("contactEmail", v)}
          onFacebookChange={(v) => patch("contactFacebook", v)}
          onInstagramChange={(v) => patch("contactInstagram", v)}
          onPhoneChange={(v) => patch("contactPhone", v)}
          onShowEmailChange={(v) => patch("showContactEmail", v)}
          onShowFacebookChange={(v) => patch("showContactFacebook", v)}
          onShowInstagramChange={(v) => patch("showContactInstagram", v)}
        />
      </SectionCard>
    </EditModalShell>
  );
}

const styles = StyleSheet.create({
  wheelRow: {
    flexDirection: "row",
    gap: spacing[12],
  },
  wheelCell: {
    flex: 1,
  },
  palmaresCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[8],
    gap: spacing[12],
    padding: spacing[16],
  },
  palmaresCardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  typeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  typeChip: {
    borderRadius: radius[6],
    borderWidth: 1,
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[6],
  },
  typeChipDefault: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  typeChipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  typeChipText: {
    fontWeight: "600",
  },
  typeChipTextDefault: {
    color: colors.textPrimary,
  },
  typeChipTextSelected: {
    color: "#fff",
  },
});
