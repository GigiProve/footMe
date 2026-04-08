import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, TextInput as RNTextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button, Card } from "../../../ui";
import type { CoachCareerEntry } from "../../onboarding/coach/coach-career-types";
import {
  generateCoachEntryId,
  sortCoachCareerEntriesBySeason,
  splitCoachEntryBySeasonDetails,
} from "../../onboarding/coach/coach-career-utils";
import { CoachCareerExperienceCard } from "../../onboarding/coach/CoachCareerExperienceCard";
import { CoachExperienceForm } from "../../onboarding/coach/CoachExperienceForm";
import { CoachExperienceTypeSelector } from "../../onboarding/coach/CoachExperienceTypeSelector";
import {
  buildFullUpdatePayload,
  buildInitialState,
} from "../profile-edit-helpers";
import {
  type PlayerExperienceForm,
  SENIOR_CATEGORY_OPTIONS,
  YOUTH_CATEGORY_OPTIONS,
} from "../player-sports";
import { TeamAutocompleteInput } from "../player-sports-section";
import { mapStaffPlayerEntriesToPlayerExperiences } from "../career/staff-career-grouping";
import type {
  CompleteProfessionalProfile,
  StaffCareerEntryRecord,
  StaffPlayerCareerEntryRecord,
} from "../profile-service";
import {
  searchTeams,
  updateCompleteProfessionalProfile,
} from "../profile-service";
import { SelectField } from "../../../components/ui/select-field";
import { EditModalShell } from "./EditModalShell";
import { StaffExperienceFormFields } from "./StaffExperienceFormFields";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FlowScreen =
  | { type: "list" }
  | { type: "select-type"; section: "technical" | "coach" }
  | {
      type: "form-technical";
      editIndex: number | null;
      entry: CoachCareerEntry;
      headCoachName: string;
    }
  | {
      type: "form-coach";
      editIndex: number | null;
      entry: CoachCareerEntry;
      headCoachName: string;
    }
  | {
      type: "form-player";
      editIndex: number | null;
      entry: PlayerExperienceForm;
    };

type EditStaffExperiencesModalProps = {
  completeProfile: CompleteProfessionalProfile;
  onClose: () => void;
  onSaved: () => void;
  visible: boolean;
};

// ---------------------------------------------------------------------------
// Converters
// ---------------------------------------------------------------------------

function staffRecordToForm(entry: StaffCareerEntryRecord): CoachCareerEntry {
  return {
    category: entry.category ?? "",
    clubId: entry.club_id,
    id: entry.id,
    period:
      entry.experience_type === "CUSTOM_PERIOD"
        ? {
            endMonth: entry.period_end_month ?? "",
            endYear: entry.period_end_year ? String(entry.period_end_year) : "",
            startMonth: entry.period_start_month ?? "",
            startYear: entry.period_start_year
              ? String(entry.period_start_year)
              : "",
          }
        : null,
    role: entry.role,
    seasonDetails: Object.fromEntries(
      Object.entries(entry.season_details ?? {}).map(([season, detail]) => [
        season,
        {
          category: detail?.category ?? entry.category ?? "",
          role: detail?.role ?? entry.role,
        },
      ]),
    ),
    seasons: entry.seasons,
    teamLogoUrl: entry.team_logo_url,
    teamName: entry.team_name,
    type: entry.experience_type,
  };
}

function formToStaffRecord(
  entry: CoachCareerEntry,
  index: number,
  previous: StaffCareerEntryRecord | undefined,
  staffProfileId: string,
  headCoachName: string,
): StaffCareerEntryRecord {
  return {
    category: entry.category || previous?.category || null,
    club_id: entry.clubId ?? previous?.club_id ?? null,
    description: previous?.description ?? null,
    experience_type: entry.type,
    head_coach_name: headCoachName.trim() || previous?.head_coach_name || null,
    id: entry.id || generateCoachEntryId(),
    period_end_month: entry.period?.endMonth || null,
    period_end_year: entry.period?.endYear ? Number(entry.period.endYear) : null,
    period_start_month: entry.period?.startMonth || null,
    period_start_year: entry.period?.startYear
      ? Number(entry.period.startYear)
      : null,
    results: previous?.results ?? [],
    role: entry.role,
    season_details: entry.seasonDetails,
    seasons: entry.seasons,
    sort_order: index,
    staff_profile_id: previous?.staff_profile_id ?? staffProfileId,
    team_logo_url: entry.teamLogoUrl ?? previous?.team_logo_url ?? null,
    team_name: entry.teamName,
  };
}

function playerFormToRecord(
  entry: PlayerExperienceForm,
  index: number,
  staffProfileId: string,
): StaffPlayerCareerEntryRecord {
  return {
    appearances: entry.appearances ? Number(entry.appearances) : 0,
    assists: entry.assists ? Number(entry.assists) : 0,
    category: entry.category || null,
    goals: entry.goals ? Number(entry.goals) : 0,
    id: entry.id || generateCoachEntryId(),
    position: null,
    season: entry.seasonLabel,
    sort_order: index,
    staff_profile_id: staffProfileId,
    team_logo_url: entry.teamLogoUrl || null,
    team_name: entry.clubName,
  };
}

function emptyPlayerEntry(): PlayerExperienceForm {
  return {
    appearances: "",
    assists: "",
    awards: "",
    category: "",
    clubId: null,
    clubName: "",
    goals: "",
    id: generateCoachEntryId(),
    minutesPlayed: "",
    periodEndMonth: "",
    periodStartMonth: "",
    seasonLabel: "",
    seasonPeriod: "full",
    teamCity: "",
    teamLogoUrl: "",
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EditStaffExperiencesModal({
  completeProfile,
  onClose,
  onSaved,
  visible,
}: EditStaffExperiencesModalProps) {
  const [technicalEntries, setTechnicalEntries] = useState<CoachCareerEntry[]>(
    () =>
      sortCoachCareerEntriesBySeason(
        completeProfile.staffCareerEntries.map(staffRecordToForm),
      ),
  );
  const [coachRoleEntries, setCoachRoleEntries] = useState<CoachCareerEntry[]>(
    () =>
      sortCoachCareerEntriesBySeason(
        completeProfile.staffCoachCareerEntries.map(staffRecordToForm),
      ),
  );
  const [playerEntries, setPlayerEntries] = useState<PlayerExperienceForm[]>(
    () =>
      mapStaffPlayerEntriesToPlayerExperiences(
        completeProfile.staffPlayerCareerEntries,
      ),
  );

  const [isSaving, setIsSaving] = useState(false);
  const [screen, setScreen] = useState<FlowScreen>({ type: "list" });

  const prevTechnicalById = useMemo(
    () =>
      new Map(completeProfile.staffCareerEntries.map((entry) => [entry.id, entry])),
    [completeProfile.staffCareerEntries],
  );

  const prevCoachById = useMemo(
    () =>
      new Map(
        completeProfile.staffCoachCareerEntries.map((entry) => [entry.id, entry]),
      ),
    [completeProfile.staffCoachCareerEntries],
  );

  useEffect(() => {
    if (visible) {
      setTechnicalEntries(
        sortCoachCareerEntriesBySeason(
          completeProfile.staffCareerEntries.map(staffRecordToForm),
        ),
      );
      setCoachRoleEntries(
        sortCoachCareerEntriesBySeason(
          completeProfile.staffCoachCareerEntries.map(staffRecordToForm),
        ),
      );
      setPlayerEntries(
        mapStaffPlayerEntriesToPlayerExperiences(
          completeProfile.staffPlayerCareerEntries,
        ),
      );
      setScreen({ type: "list" });
    }
  }, [visible, completeProfile]);

  const staffProfileId = completeProfile.staffProfile?.profile_id ?? "";

  async function handleSave() {
    setIsSaving(true);

    try {
      const baseState = buildInitialState(completeProfile);
      const payload = buildFullUpdatePayload(completeProfile, baseState);

      payload.staffCareerEntries = sortCoachCareerEntriesBySeason(
        technicalEntries,
      ).map((entry, index) =>
        formToStaffRecord(
          entry,
          index,
          prevTechnicalById.get(entry.id),
          staffProfileId,
          "",
        ),
      );

      payload.staffCoachCareerEntries = sortCoachCareerEntriesBySeason(
        coachRoleEntries,
      ).map((entry, index) =>
        formToStaffRecord(
          entry,
          index,
          prevCoachById.get(entry.id),
          staffProfileId,
          "",
        ),
      );

      payload.staffPlayerCareerEntries = playerEntries.map((entry, index) =>
        playerFormToRecord(entry, index, staffProfileId),
      );

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

  // ---------------------------------------------------------------------------
  // Technical section handlers
  // ---------------------------------------------------------------------------

  function handleSelectTypeTechnical(type: CoachCareerEntry["type"]) {
    setScreen({
      type: "form-technical",
      editIndex: null,
      headCoachName: "",
      entry: {
        category: "",
        id: generateCoachEntryId(),
        period: null,
        role: "",
        seasonDetails: {},
        seasons: [],
        teamName: "",
        type,
      },
    });
  }

  function handleEditTechnical(index: number) {
    const entry = technicalEntries[index];
    const prev = prevTechnicalById.get(entry.id);
    setScreen({
      type: "form-technical",
      editIndex: index,
      headCoachName: prev?.head_coach_name ?? "",
      entry: { ...entry },
    });
  }

  function handleDeleteTechnical(index: number) {
    setTechnicalEntries((prev) =>
      prev.filter((_, currentIndex) => currentIndex !== index),
    );
  }

  function handleFormSaveTechnical(saved: CoachCareerEntry) {
    const splitEntries = splitCoachEntryBySeasonDetails(saved);
    const headCoachName =
      screen.type === "form-technical" ? screen.headCoachName : "";
    const editIndex =
      screen.type === "form-technical" ? screen.editIndex : null;

    const nextEntries =
      editIndex === null
        ? [...technicalEntries, ...splitEntries]
        : [
            ...technicalEntries.slice(0, editIndex),
            ...splitEntries,
            ...technicalEntries.slice(editIndex + 1),
          ];

    // Carry the head coach name into the prev map so save picks it up
    splitEntries.forEach((e) => {
      const existing = prevTechnicalById.get(e.id);
      prevTechnicalById.set(e.id, {
        ...(existing ?? ({} as StaffCareerEntryRecord)),
        head_coach_name: headCoachName.trim() || null,
      } as StaffCareerEntryRecord);
    });

    setTechnicalEntries(sortCoachCareerEntriesBySeason(nextEntries));
    setScreen({ type: "list" });
  }

  // ---------------------------------------------------------------------------
  // Coach-role section handlers
  // ---------------------------------------------------------------------------

  function handleSelectTypeCoach(type: CoachCareerEntry["type"]) {
    setScreen({
      type: "form-coach",
      editIndex: null,
      headCoachName: "",
      entry: {
        category: "",
        id: generateCoachEntryId(),
        period: null,
        role: "",
        seasonDetails: {},
        seasons: [],
        teamName: "",
        type,
      },
    });
  }

  function handleEditCoach(index: number) {
    const entry = coachRoleEntries[index];
    const prev = prevCoachById.get(entry.id);
    setScreen({
      type: "form-coach",
      editIndex: index,
      headCoachName: prev?.head_coach_name ?? "",
      entry: { ...entry },
    });
  }

  function handleDeleteCoach(index: number) {
    setCoachRoleEntries((prev) =>
      prev.filter((_, currentIndex) => currentIndex !== index),
    );
  }

  function handleFormSaveCoach(saved: CoachCareerEntry) {
    const splitEntries = splitCoachEntryBySeasonDetails(saved);
    const headCoachName =
      screen.type === "form-coach" ? screen.headCoachName : "";
    const editIndex =
      screen.type === "form-coach" ? screen.editIndex : null;

    const nextEntries =
      editIndex === null
        ? [...coachRoleEntries, ...splitEntries]
        : [
            ...coachRoleEntries.slice(0, editIndex),
            ...splitEntries,
            ...coachRoleEntries.slice(editIndex + 1),
          ];

    splitEntries.forEach((e) => {
      const existing = prevCoachById.get(e.id);
      prevCoachById.set(e.id, {
        ...(existing ?? ({} as StaffCareerEntryRecord)),
        head_coach_name: headCoachName.trim() || null,
      } as StaffCareerEntryRecord);
    });

    setCoachRoleEntries(sortCoachCareerEntriesBySeason(nextEntries));
    setScreen({ type: "list" });
  }

  // ---------------------------------------------------------------------------
  // Player section handlers
  // ---------------------------------------------------------------------------

  function handleEditPlayer(index: number) {
    setScreen({
      type: "form-player",
      editIndex: index,
      entry: { ...playerEntries[index] },
    });
  }

  function handleDeletePlayer(index: number) {
    setPlayerEntries((prev) =>
      prev.filter((_, currentIndex) => currentIndex !== index),
    );
  }

  function handleFormSavePlayer(saved: PlayerExperienceForm) {
    const editIndex =
      screen.type === "form-player" ? screen.editIndex : null;

    const nextEntries =
      editIndex === null
        ? [...playerEntries, saved]
        : [
            ...playerEntries.slice(0, editIndex),
            saved,
            ...playerEntries.slice(editIndex + 1),
          ];

    setPlayerEntries(nextEntries);
    setScreen({ type: "list" });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function updateScreenHeadCoachName(value: string) {
    if (screen.type === "form-technical") {
      setScreen({ ...screen, headCoachName: value });
    } else if (screen.type === "form-coach") {
      setScreen({ ...screen, headCoachName: value });
    }
  }

  function getTypeLabel(type: CoachCareerEntry["type"]) {
    if (type === "MULTI_SEASON") return "PIU' STAGIONI";
    if (type === "SINGLE_SEASON") return "SINGOLA STAGIONE";
    return "PERIODO PERSONALIZZATO";
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <EditModalShell
      isSaving={isSaving}
      onClose={onClose}
      onSave={handleSave}
      saveDisabled={screen.type !== "list"}
      title="Esperienze staff"
      visible={visible}
    >
      {/* ---- Select type screen (technical) ---- */}
      {screen.type === "select-type" && screen.section === "technical" ? (
        <CoachExperienceTypeSelector
          onSelect={handleSelectTypeTechnical}
          subtitle="Scegli come vuoi inserire questa esperienza da staff tecnico."
          title="Aggiungi esperienza staff tecnico"
        />
      ) : null}

      {/* ---- Select type screen (coach role) ---- */}
      {screen.type === "select-type" && screen.section === "coach" ? (
        <CoachExperienceTypeSelector
          onSelect={handleSelectTypeCoach}
          subtitle="Scegli come vuoi inserire questa esperienza da allenatore."
          title="Aggiungi esperienza allenatore"
        />
      ) : null}

      {/* ---- Form screen (technical) ---- */}
      {screen.type === "form-technical" ? (
        <>
          <Card variant="muted">
            <AppText color="secondary" variant="caption">
              {getTypeLabel(screen.entry.type)}
            </AppText>
          </Card>
          <CoachExperienceForm
            entry={screen.entry}
            existingEntries={technicalEntries}
            isEditing={screen.editIndex !== null}
            onCancel={() => setScreen({ type: "list" })}
            onSave={handleFormSaveTechnical}
            roleLabel="Ruolo staff *"
            rolePlaceholder="Es. Preparatore atletico"
            searchTeams={searchTeams}
            title={
              screen.editIndex !== null
                ? "Modifica esperienza staff"
                : "Dettagli esperienza staff"
            }
          />
          <StaffExperienceFormFields
            headCoachName={screen.headCoachName}
            onHeadCoachNameChange={updateScreenHeadCoachName}
          />
        </>
      ) : null}

      {/* ---- Form screen (coach role) ---- */}
      {screen.type === "form-coach" ? (
        <>
          <Card variant="muted">
            <AppText color="secondary" variant="caption">
              {getTypeLabel(screen.entry.type)}
            </AppText>
          </Card>
          <CoachExperienceForm
            entry={screen.entry}
            existingEntries={coachRoleEntries}
            isEditing={screen.editIndex !== null}
            onCancel={() => setScreen({ type: "list" })}
            onSave={handleFormSaveCoach}
            searchTeams={searchTeams}
            title={
              screen.editIndex !== null
                ? "Modifica esperienza allenatore"
                : "Dettagli esperienza allenatore"
            }
          />
          <StaffExperienceFormFields
            headCoachName={screen.headCoachName}
            onHeadCoachNameChange={updateScreenHeadCoachName}
          />
        </>
      ) : null}

      {/* ---- Form screen (player) ---- */}
      {screen.type === "form-player" ? (
        <PlayerEntryForm
          entry={screen.entry}
          isEditing={screen.editIndex !== null}
          onCancel={() => setScreen({ type: "list" })}
          onSave={handleFormSavePlayer}
        />
      ) : null}

      {/* ---- List screen ---- */}
      {screen.type === "list" ? (
        <>
          {/* Staff tecnico section */}
          <AppText variant="titleMd">Staff tecnico</AppText>

          {technicalEntries.length === 0 ? (
            <Card variant="muted">
              <AppText color="secondary">
                Aggiungi le tue esperienze come staff tecnico (preparatore
                atletico, match analyst, ecc.).
              </AppText>
            </Card>
          ) : null}

          {technicalEntries.map((entry, index) => (
            <CoachCareerExperienceCard
              entry={entry}
              key={entry.id}
              onDelete={() => handleDeleteTechnical(index)}
              onEdit={() => handleEditTechnical(index)}
            />
          ))}

          <Button
            label="Aggiungi staff tecnico"
            leftIcon={<Ionicons color={colors.accent} name="add-outline" size={20} />}
            onPress={() =>
              setScreen({ type: "select-type", section: "technical" })
            }
            variant="secondary"
          />

          {/* Allenatore section */}
          <AppText variant="titleMd">Allenatore</AppText>

          {coachRoleEntries.length === 0 ? (
            <Card variant="muted">
              <AppText color="secondary">
                Aggiungi le tue esperienze come allenatore (se applicabile al
                tuo percorso).
              </AppText>
            </Card>
          ) : null}

          {coachRoleEntries.map((entry, index) => (
            <CoachCareerExperienceCard
              entry={entry}
              key={entry.id}
              onDelete={() => handleDeleteCoach(index)}
              onEdit={() => handleEditCoach(index)}
            />
          ))}

          <Button
            label="Aggiungi esperienza allenatore"
            leftIcon={<Ionicons color={colors.accent} name="add-outline" size={20} />}
            onPress={() =>
              setScreen({ type: "select-type", section: "coach" })
            }
            variant="secondary"
          />

          {/* Ex giocatore section */}
          <AppText variant="titleMd">Ex giocatore</AppText>

          {playerEntries.length === 0 ? (
            <Card variant="muted">
              <AppText color="secondary">
                Aggiungi le tue esperienze come calciatore.
              </AppText>
            </Card>
          ) : null}

          {playerEntries.map((entry, index) => (
            <PlayerEntryCard
              entry={entry}
              key={entry.id ?? String(index)}
              onDelete={() => handleDeletePlayer(index)}
              onEdit={() => handleEditPlayer(index)}
            />
          ))}

          <Button
            label="Aggiungi esperienza giocatore"
            leftIcon={<Ionicons color={colors.accent} name="add-outline" size={20} />}
            onPress={() =>
              setScreen({
                type: "form-player",
                editIndex: null,
                entry: emptyPlayerEntry(),
              })
            }
            variant="secondary"
          />
        </>
      ) : null}
    </EditModalShell>
  );
}

// ---------------------------------------------------------------------------
// PlayerEntryCard — compact card for player entries in list view
// ---------------------------------------------------------------------------

function PlayerEntryCard({
  entry,
  onEdit,
  onDelete,
}: {
  entry: PlayerExperienceForm;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const meta = [entry.category, entry.seasonLabel].filter(Boolean).join(" · ");

  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.content}>
        <View style={cardStyles.header}>
          <AppText variant="titleMd" style={cardStyles.teamName}>
            {entry.clubName || "Squadra da definire"}
          </AppText>
          <View style={cardStyles.actions}>
            <Pressable
              accessibilityLabel="Modifica esperienza"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onEdit}
              style={cardStyles.editButton}
            >
              <Ionicons name="pencil" size={14} color={colors.textSecondary} />
            </Pressable>
            <Pressable
              accessibilityLabel="Elimina esperienza"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onDelete}
              style={cardStyles.deleteButton}
            >
              <Ionicons name="trash-outline" size={14} color={colors.danger} />
            </Pressable>
          </View>
        </View>
        {meta ? (
          <AppText variant="bodySm" color="secondary">
            {meta}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    gap: spacing[8],
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[8],
    borderWidth: 1,
    padding: spacing[16],
  },
  content: {
    gap: spacing[4],
  },
  deleteButton: {
    alignItems: "center",
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.full,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  editButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  teamName: {
    flex: 1,
  },
});

// ---------------------------------------------------------------------------
// PlayerEntryForm — minimal inline form for player entries
// ---------------------------------------------------------------------------

const ALL_CATEGORY_OPTIONS = [
  ...SENIOR_CATEGORY_OPTIONS,
  ...YOUTH_CATEGORY_OPTIONS,
];

function PlayerEntryForm({
  entry,
  isEditing,
  onCancel,
  onSave,
}: {
  entry: PlayerExperienceForm;
  isEditing: boolean;
  onCancel: () => void;
  onSave: (entry: PlayerExperienceForm) => void;
}) {
  const [form, setForm] = useState<PlayerExperienceForm>(entry);
  const [errors, setErrors] = useState<{
    clubName?: string;
    seasonLabel?: string;
  }>({});

  function update<K extends keyof PlayerExperienceForm>(
    key: K,
    value: PlayerExperienceForm[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function handleSave() {
    const nextErrors: { clubName?: string; seasonLabel?: string } = {};
    if (!form.clubName.trim()) {
      nextErrors.clubName = "La squadra è obbligatoria.";
    }
    if (!form.seasonLabel.trim()) {
      nextErrors.seasonLabel = "La stagione è obbligatoria.";
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    onSave({ ...form, id: form.id || generateCoachEntryId() });
  }

  return (
    <View style={playerFormStyles.container}>
      <AppText variant="headingMd">
        {isEditing ? "Modifica esperienza" : "Dettagli esperienza"}
      </AppText>

      <View style={playerFormStyles.fieldGroup}>
        <TeamAutocompleteInput
          label="Squadra *"
          onChangeText={(val) => update("clubName", val)}
          onSelectTeam={(team) => {
            update("clubName", team.name);
            update("clubId", team.id);
            update("teamLogoUrl", team.logoUrl ?? "");
          }}
          placeholder="Es. ASD Pro Calcio"
          searchTeams={searchTeams}
          value={form.clubName}
        />
        {errors.clubName ? (
          <AppText variant="caption" color="danger">
            {errors.clubName}
          </AppText>
        ) : null}
      </View>

      <View style={playerFormStyles.fieldGroup}>
        <AppText variant="caption" color="secondary">
          Stagione *
        </AppText>
        <RNTextInput
          onChangeText={(val) => update("seasonLabel", val)}
          placeholder="Es. 2023/2024"
          placeholderTextColor={colors.textMuted}
          style={playerFormStyles.input}
          value={form.seasonLabel}
        />
        {errors.seasonLabel ? (
          <AppText variant="caption" color="danger">
            {errors.seasonLabel}
          </AppText>
        ) : null}
      </View>

      <View style={playerFormStyles.fieldGroup}>
        <SelectField
          label="Categoria"
          onChange={(val) => update("category", val)}
          options={ALL_CATEGORY_OPTIONS}
          placeholder="Seleziona categoria"
          searchable
          searchPlaceholder="Cerca categoria..."
          value={form.category}
        />
      </View>

      <Button
        label={isEditing ? "Salva modifiche" : "Salva esperienza"}
        onPress={handleSave}
        variant="primary"
      />
      <Button label="Annulla" onPress={onCancel} variant="tertiary" />
    </View>
  );
}

const playerFormStyles = StyleSheet.create({
  container: {
    gap: spacing[18],
  },
  fieldGroup: {
    gap: spacing[8],
  },
  input: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.textPrimary,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[10],
  },
});
