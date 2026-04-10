import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";

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
import { validateBirthDateInput } from "../profile-form-utils";
import {
  searchAgentPlayerCandidates,
  updateCompleteProfessionalProfile,
  type CompleteProfessionalProfile,
} from "../profile-service";
import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Input, Toggle } from "../../../ui";
import { EditModalShell } from "./EditModalShell";

type EditAgentProfileModalProps = {
  completeProfile: CompleteProfessionalProfile;
  onClose: () => void;
  onSaved: () => void;
  userId: string;
  visible: boolean;
};

type AgentProfileFormState = {
  agencyName: string;
  agencyRole: string;
  federation: string;
  hasOtherFootballExperience: boolean;
  hasPlayedFootball: boolean;
  isFederationLicensed: boolean;
  openToClubs: boolean;
  openToPlayers: boolean;
  operationalFocuses: string[];
  operationalNote: string;
  operatingMacroAreas: string[];
  operatingRegions: string;
  otherFootballRoles: string;
  periodStartYear: string;
};

function getInitialFormState(agentProfile: AgentProfileRecord | null): AgentProfileFormState {
  return {
    agencyName: agentProfile?.agency_name ?? "",
    agencyRole: agentProfile?.agency_role ?? "",
    federation: agentProfile?.federation ?? "",
    hasOtherFootballExperience: agentProfile?.has_other_football_experience ?? false,
    hasPlayedFootball: agentProfile?.has_played_football ?? false,
    isFederationLicensed: agentProfile?.is_federation_licensed ?? false,
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
    getInitialFormState(completeProfile.agentProfile),
  );
  const [careerEntries, setCareerEntries] = useState<AgentCareerEntryDraft[]>(() =>
    mapCareerEntries(completeProfile),
  );
  const [managedPlayers, setManagedPlayers] = useState<AgentManagedPlayerEntryDraft[]>(() =>
    mapManagedPlayers(completeProfile),
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setForm(getInitialFormState(completeProfile.agentProfile));
    setCareerEntries(mapCareerEntries(completeProfile));
    setManagedPlayers(mapManagedPlayers(completeProfile));
  }, [completeProfile, visible]);

  function patchForm<Key extends keyof AgentProfileFormState>(
    key: Key,
    value: AgentProfileFormState[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

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

  async function handleSave() {
    if (!completeProfile.agentProfile && !form.agencyName.trim()) {
      Alert.alert("Profilo incompleto", "Inserisci almeno il nome dell'agenzia attuale.");
      return;
    }

    setIsSaving(true);

    try {
      const birthDate = validateBirthDateInput(completeProfile.profile.birth_date).isoValue;
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
          agency_logo_url: completeProfile.agentProfile?.agency_logo_url ?? null,
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
        club: null,
        clubSeasonEntries: [],
        coachProfile: null,
        playerCareerEntries: [],
        playerProfile: null,
        profile: {
          avatar_url: completeProfile.profile.avatar_url,
          bio: completeProfile.profile.bio,
          birth_date: birthDate,
          city: completeProfile.profile.city,
          full_name: completeProfile.profile.full_name,
          is_open_to_transfer: completeProfile.profile.is_open_to_transfer,
          languages: completeProfile.profile.languages,
          nationality: completeProfile.profile.nationality,
          region: completeProfile.profile.region,
        },
        profileId: userId,
        role: "agent",
        staffProfile: null,
        userContacts: completeProfile.userContacts,
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
