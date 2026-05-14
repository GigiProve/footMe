import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";

import { MediaPickerField } from "../../../components/ui/media-picker-field";
import {
  AGENT_OPERATING_MACRO_AREA_OPTIONS,
  AGENT_OPERATIONAL_FOCUS_OPTIONS,
  deriveLegacyMainPlayerRoles,
  deriveLegacyManagedPlayersCount,
  deriveLegacyPlayerTypes,
  type AgentCareerEntryDraft,
  type AgentManagedPlayerEntryDraft,
  type AgentProfileRecord,
} from "../agent-profile";
import { AgentCareerEntriesEditor } from "../agent/AgentCareerEntriesEditor";
import { AgentManagedPlayersEditor } from "../agent/AgentManagedPlayersEditor";
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
import { searchAgentPlayerCandidates, updateCompleteProfessionalProfile, type CompleteProfessionalProfile } from "../profile-service";
import {
  pickAndUploadMedia,
  ProfileMediaUploadError,
  removeMediaFromStorage,
  type UploadedMediaItem,
} from "../media-upload-service";
import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Input, Toggle } from "../../../ui";
import { EditModalShell } from "./EditModalShell";
import { OnboardingBaseFieldsSection } from "./OnboardingBaseFieldsSection";

type EditAgentProfileModalProps = {
  completeProfile: CompleteProfessionalProfile;
  onClose: () => void;
  onSaved: () => void;
  userId: string;
  visible: boolean;
};

type AgentProfileFormState = {
  agencyLogoUrl: string;
  agencyName: string;
  agencyRole: string;
  birthDate: string;
  city: string;
  currentLocationCity: string;
  currentLocationCountry: string;
  federation: string;
  fullName: string;
  hasOtherFootballExperience: boolean;
  hasPlayedFootball: boolean;
  isFederationLicensed: boolean;
  languages: string[];
  legalStatus: string;
  nationality: string;
  openToClubs: boolean;
  openToPlayers: boolean;
  operationalFocuses: string[];
  operationalNote: string;
  operatingMacroAreas: string[];
  operatingRegions: string;
  otherFootballRoles: string;
  periodStartYear: string;
  region: string;
  residence: string;
  residenceCountry: string;
  useResidenceForDomicile: boolean;
};

function getInitialFormState(
  completeProfile: CompleteProfessionalProfile,
): AgentProfileFormState {
  const agentProfile = completeProfile.agentProfile;
  const base = buildInitialState(completeProfile);

  return {
    agencyLogoUrl: agentProfile?.agency_logo_url ?? "",
    agencyName: agentProfile?.agency_name ?? "",
    agencyRole: agentProfile?.agency_role ?? "",
    birthDate: base.birthDate,
    city: base.city,
    currentLocationCity: base.currentLocationCity,
    currentLocationCountry: base.currentLocationCountry,
    federation: agentProfile?.federation ?? "",
    fullName: base.fullName,
    hasOtherFootballExperience: agentProfile?.has_other_football_experience ?? false,
    hasPlayedFootball: agentProfile?.has_played_football ?? false,
    isFederationLicensed: agentProfile?.is_federation_licensed ?? false,
    languages: fromDelimitedString(base.languages),
    legalStatus: base.legalStatus,
    nationality: base.nationality,
    openToClubs: agentProfile?.open_to_clubs ?? true,
    openToPlayers: agentProfile?.open_to_players ?? true,
    operationalFocuses: agentProfile?.operational_focuses ?? [],
    operationalNote: agentProfile?.operational_note ?? "",
    operatingMacroAreas: agentProfile?.operating_macro_areas ?? [],
    operatingRegions: (agentProfile?.operating_regions ?? []).join(", "),
    otherFootballRoles: (agentProfile?.other_football_roles ?? []).join(", "),
    periodStartYear: agentProfile?.period_start_year
      ? String(agentProfile.period_start_year)
      : "",
    region: base.region,
    residence: base.residence,
    residenceCountry: base.residenceCountry,
    useResidenceForDomicile: base.useResidenceForDomicile,
  };
}

function mapCareerEntries(
  completeProfile: CompleteProfessionalProfile,
): AgentCareerEntryDraft[] {
  return completeProfile.agentCareerEntries.length > 0
    ? completeProfile.agentCareerEntries.map((entry) => ({
        agency_logo_url: entry.agency_logo_url,
        agency_name: entry.agency_name,
        id: entry.id,
        period_end_month: entry.period_end_month,
        period_end_year: entry.period_end_year,
        period_start_month: entry.period_start_month,
        period_start_year: entry.period_start_year,
        role: entry.role,
      }))
    : [];
}

function mapManagedPlayers(
  completeProfile: CompleteProfessionalProfile,
): AgentManagedPlayerEntryDraft[] {
  return completeProfile.agentManagedPlayerEntries.map((entry) => ({
    avatar_url: entry.avatar_url,
    birth_year: entry.birth_year,
    category_label: entry.category_label,
    display_name: entry.display_name,
    id: entry.id,
    is_free_agent: entry.is_free_agent,
    linked_profile_id: entry.linked_profile_id,
    primary_position: entry.primary_position,
  }));
}

export function EditAgentProfileModal({
  completeProfile,
  onClose,
  onSaved,
  userId,
  visible,
}: EditAgentProfileModalProps) {
  const [form, setForm] = useState<AgentProfileFormState>(() =>
    getInitialFormState(completeProfile),
  );
  const [careerEntries, setCareerEntries] = useState<AgentCareerEntryDraft[]>(() =>
    mapCareerEntries(completeProfile),
  );
  const [managedPlayers, setManagedPlayers] = useState<AgentManagedPlayerEntryDraft[]>(() =>
    mapManagedPlayers(completeProfile),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setForm(getInitialFormState(completeProfile));
    setCareerEntries(mapCareerEntries(completeProfile));
    setManagedPlayers(mapManagedPlayers(completeProfile));
    setUploadingField(null);
  }, [completeProfile, visible]);

  function patchForm<Key extends keyof AgentProfileFormState>(
    key: Key,
    value: AgentProfileFormState[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
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

  function toggleSelection(
    key: "operationalFocuses" | "operatingMacroAreas",
    value: string,
  ) {
    const currentValues = form[key];
    patchForm(
      key,
      currentValues.includes(value)
        ? currentValues.filter((entry) => entry !== value)
        : [...currentValues, value],
    );
  }

  function handleCitySuggestionPress(suggestion: ItalianCityOption) {
    setForm((current) => ({
      ...current,
      city: suggestion.name,
      region: suggestion.region,
    }));
  }

  function handleResidenceSuggestionPress(suggestion: ItalianCityOption) {
    setForm((current) => ({
      ...current,
      residence: suggestion.name,
    }));
  }

  async function handleAgencyLogoPick() {
    setUploadingField("agencyLogoUrl");

    try {
      const results: UploadedMediaItem[] = await pickAndUploadMedia({
        folder: "agent-logos",
        mediaTypes: ["images"],
        userId,
      });

      if (results.length === 0) {
        setUploadingField(null);
        return;
      }

      const previousUrl = form.agencyLogoUrl;
      patchForm("agencyLogoUrl", results[0].url);

      if (previousUrl) {
        try {
          await removeMediaFromStorage(previousUrl);
        } catch {
          // Best-effort cleanup.
        }
      }
    } catch (error) {
      Alert.alert(
        "Errore",
        error instanceof ProfileMediaUploadError
          ? error.message
          : "Caricamento logo non riuscito.",
      );
    } finally {
      setUploadingField(null);
    }
  }

  async function handleAgencyLogoRemove() {
    const previousUrl = form.agencyLogoUrl;
    patchForm("agencyLogoUrl", "");

    if (previousUrl) {
      try {
        await removeMediaFromStorage(previousUrl);
      } catch {
        // Best-effort cleanup.
      }
    }
  }

  async function handleSave() {
    if (!completeProfile.agentProfile && !form.agencyName.trim()) {
      Alert.alert("Profilo incompleto", "Inserisci almeno il nome dell'agenzia attuale.");
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

    setIsSaving(true);

    try {
      const baseState = buildInitialState(completeProfile);
      const mergedState = {
        ...baseState,
        birthDate: form.birthDate,
        city: form.city,
        currentLocationCity: form.currentLocationCity,
        currentLocationCountry: form.currentLocationCountry,
        fullName: form.fullName,
        languages: toDelimitedString(form.languages),
        legalStatus: form.legalStatus,
        nationality: form.nationality,
        region: form.region,
        residence: form.residence,
        residenceCountry: form.residenceCountry,
        useResidenceForDomicile: form.useResidenceForDomicile,
      };
      const basePayload = buildFullUpdatePayload(completeProfile, mergedState);
      basePayload.profile.birth_date = birthDateResult.isoValue;
      const sanitizedCareerEntries = careerEntries.filter(
        (entry) => entry.agency_name.trim().length > 0,
      );
      const sanitizedManagedPlayers = managedPlayers.filter(
        (entry) => entry.display_name.trim().length > 0,
      );
      const derivedMainRoles = deriveLegacyMainPlayerRoles(sanitizedManagedPlayers);
      const derivedManagedPlayersCount = deriveLegacyManagedPlayersCount(
        sanitizedManagedPlayers,
      );
      const derivedPlayerTypes = deriveLegacyPlayerTypes(sanitizedManagedPlayers);

      await updateCompleteProfessionalProfile({
        agentCareerEntries: sanitizedCareerEntries.map((entry, index) => ({
          agency_logo_url: entry.agency_logo_url,
          agency_name: entry.agency_name.trim(),
          agent_profile_id: userId,
          id: entry.id,
          period_end_month: null,
          period_end_year: entry.period_end_year,
          period_start_month: null,
          period_start_year: entry.period_start_year,
          role: entry.role.trim() || "Agente",
          sort_order: index,
        })),
        agentManagedPlayerEntries: sanitizedManagedPlayers.map((entry, index) => ({
          agent_profile_id: userId,
          avatar_url: entry.avatar_url,
          birth_year: entry.birth_year,
          category_label: entry.category_label,
          display_name: entry.display_name.trim(),
          id: entry.id,
          is_free_agent: entry.is_free_agent,
          linked_profile_id: entry.linked_profile_id,
          primary_position: entry.primary_position,
          sort_order: index,
        })),
        agentProfile: {
          agency_logo_url: form.agencyLogoUrl.trim() || null,
          agency_name: form.agencyName.trim() || null,
          agency_role: form.agencyRole.trim() || null,
          federation: form.isFederationLicensed ? form.federation.trim() || null : null,
          has_other_football_experience: form.hasOtherFootballExperience,
          has_played_football: form.hasPlayedFootball,
          is_federation_licensed: form.isFederationLicensed,
          main_player_roles: derivedMainRoles,
          managed_players_count: derivedManagedPlayersCount
            ? `${sanitizedManagedPlayers.length} giocatori`
            : completeProfile.agentProfile?.managed_players_count ?? null,
          open_to_clubs: form.openToClubs,
          open_to_players: form.openToPlayers,
          operational_focuses: form.operationalFocuses,
          operational_note: form.operationalNote.trim() || null,
          operating_macro_areas: form.operatingMacroAreas,
          operating_regions: parseDelimitedString(form.operatingRegions),
          other_football_roles: form.hasOtherFootballExperience
            ? parseDelimitedString(form.otherFootballRoles)
            : [],
          period_end_month: null,
          period_end_year: null,
          period_start_month: null,
          period_start_year: parseYear(form.periodStartYear),
          player_career_entries: completeProfile.agentProfile?.player_career_entries ?? [],
          player_types: derivedPlayerTypes,
        },
        ...basePayload,
        profileId: userId,
        role: "agent",
      });

      onSaved();
    } catch (error) {
      Alert.alert(
        "Errore",
        error instanceof Error
          ? error.message
          : "Si è verificato un errore durante il salvataggio del profilo agente.",
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
      title="Profilo agente"
      visible={visible}
    >
      <OnboardingBaseFieldsSection
        birthDate={form.birthDate}
        birthDateHelperText={birthDateHelperText}
        city={form.city}
        cityHelperText={cityHelperText}
        citySuggestions={citySuggestions}
        currentLocationCity={form.currentLocationCity}
        currentLocationCountry={form.currentLocationCountry}
        domicile=""
        fullName={form.fullName}
        gender=""
        includeGender={false}
        languages={form.languages}
        legalStatus={form.legalStatus}
        nationality={form.nationality}
        nationalityOptions={nationalityOptions}
        onBirthDateChange={(value) => patchForm("birthDate", value)}
        onCityChange={(value) => patchForm("city", value)}
        onCitySuggestionPress={handleCitySuggestionPress}
        onCurrentLocationCityChange={(value) => patchForm("currentLocationCity", value)}
        onCurrentLocationCountryChange={(value) =>
          patchForm("currentLocationCountry", value)
        }
        onDomicileChange={() => undefined}
        onDomicileSelect={() => undefined}
        onFullNameChange={(value) => patchForm("fullName", value)}
        onGenderChange={() => undefined}
        onLanguagesChange={(value) => patchForm("languages", value)}
        onLegalStatusChange={(value) => patchForm("legalStatus", value)}
        onNationalityChange={(value) => patchForm("nationality", value)}
        onRegionChange={(value) => patchForm("region", value)}
        onResidenceChange={(value) => patchForm("residence", value)}
        onResidenceCountryChange={(value) => patchForm("residenceCountry", value)}
        onResidenceSelect={handleResidenceSuggestionPress}
        onUseResidenceForDomicileChange={(value) =>
          patchForm("useResidenceForDomicile", value)
        }
        region={form.region}
        regionOptions={regionOptions}
        residence={form.residence}
        residenceCountry={form.residenceCountry}
        showItalianDomicile={false}
        useResidenceForDomicile={form.useResidenceForDomicile}
      />

      <MediaPickerField
        buttonLabel="Carica logo"
        helperText="Carica o aggiorna il logo dell'agenzia."
        isUploading={uploadingField === "agencyLogoUrl"}
        label="Logo agenzia"
        onPick={handleAgencyLogoPick}
        onRemove={handleAgencyLogoRemove}
        previewUrl={form.agencyLogoUrl || null}
        removable={Boolean(form.agencyLogoUrl)}
        removeLabel="Rimuovi logo"
      />

      <Input
        label="Agenzia attuale"
        onChangeText={(value) => patchForm("agencyName", value)}
        placeholder="Es. MB Football Management"
        value={form.agencyName}
      />

      <Input
        label="Ruolo in agenzia"
        onChangeText={(value) => patchForm("agencyRole", value)}
        placeholder="Es. Founder, agente, partner"
        value={form.agencyRole}
      />

      <Input
        keyboardType="number-pad"
        label="Anno di inizio"
        onChangeText={(value) => patchForm("periodStartYear", value.replace(/[^\d]/g, "").slice(0, 4))}
        placeholder="2021"
        value={form.periodStartYear}
      />

      <AgentManagedPlayersEditor
        entries={managedPlayers}
        onChange={setManagedPlayers}
        searchPlayers={searchAgentPlayerCandidates}
      />

      <View style={styles.fieldGroup}>
        <AppText variant="titleSm">Modalità operativa</AppText>
        <View style={styles.chipsWrap}>
          {AGENT_OPERATIONAL_FOCUS_OPTIONS.map((option) => {
            const isActive = form.operationalFocuses.includes(option);

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                key={option}
                onPress={() => toggleSelection("operationalFocuses", option)}
                style={[styles.chip, isActive ? styles.chipActive : null]}
              >
                <AppText
                  color={isActive ? "inverse" : "primary"}
                  variant="bodySm"
                >
                  {option}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <AppText variant="titleSm">Zone operative</AppText>
        <View style={styles.chipsWrap}>
          {AGENT_OPERATING_MACRO_AREA_OPTIONS.map((option) => {
            const isActive = form.operatingMacroAreas.includes(option);

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                key={option}
                onPress={() => toggleSelection("operatingMacroAreas", option)}
                style={[styles.chip, isActive ? styles.chipActive : null]}
              >
                <AppText
                  color={isActive ? "inverse" : "primary"}
                  variant="bodySm"
                >
                  {option}
                </AppText>
              </Pressable>
            );
          })}
        </View>
        <Input
          label="Regioni"
          onChangeText={(value) => patchForm("operatingRegions", value)}
          placeholder="Es. Lombardia, Veneto, Emilia-Romagna"
          value={form.operatingRegions}
        />
      </View>

      <Input
        label="Nota operativa"
        multiline
        onChangeText={(value) => patchForm("operationalNote", value)}
        placeholder="Descrivi il modo in cui lavori con club e giocatori."
        value={form.operationalNote}
      />

      <View style={styles.togglesGroup}>
        <Toggle
          label="Disponibile a collaborare con club"
          onValueChange={(value) => patchForm("openToClubs", value)}
          value={form.openToClubs}
        />
        <Toggle
          label="Disponibile a ricevere richieste dai giocatori"
          onValueChange={(value) => patchForm("openToPlayers", value)}
          value={form.openToPlayers}
        />
      </View>

      <View style={styles.togglesGroup}>
        <Toggle
          label="Licenza federale attiva"
          onValueChange={(value) => patchForm("isFederationLicensed", value)}
          value={form.isFederationLicensed}
        />
        {form.isFederationLicensed ? (
          <Input
            label="Federazione"
            onChangeText={(value) => patchForm("federation", value)}
            placeholder="Es. FIGC"
            value={form.federation}
          />
        ) : null}
      </View>

      <View style={styles.togglesGroup}>
        <Toggle
          label="Altre esperienze nel calcio"
          onValueChange={(value) => patchForm("hasOtherFootballExperience", value)}
          value={form.hasOtherFootballExperience}
        />
        {form.hasOtherFootballExperience ? (
          <Input
            label="Ruoli precedenti"
            onChangeText={(value) => patchForm("otherFootballRoles", value)}
            placeholder="Es. Ex calciatore, scout, direttore sportivo"
            value={form.otherFootballRoles}
          />
        ) : null}
        <Toggle
          label="Ha giocato a calcio"
          onValueChange={(value) => patchForm("hasPlayedFootball", value)}
          value={form.hasPlayedFootball}
        />
      </View>

      <View style={styles.fieldGroup}>
        <AppText variant="titleSm">Esperienze precedenti</AppText>
        <AgentCareerEntriesEditor
          addButtonLabel="Aggiungi esperienza precedente"
          entries={careerEntries}
          onChange={setCareerEntries}
        />
      </View>
    </EditModalShell>
  );
}

function parseDelimitedString(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseYear(value: string) {
  const digits = value.replace(/[^\d]/g, "").slice(0, 4);

  if (!digits) {
    return null;
  }

  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : null;
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[8],
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  fieldGroup: {
    gap: spacing[10],
  },
  togglesGroup: {
    gap: spacing[12],
  },
});
