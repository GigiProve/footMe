import { useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors } from "../../../theme/tokens";
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
import { validateBirthDateInput } from "../profile-form-utils";
import type {
  CoachCareerEntryRecord,
  CompleteProfessionalProfile,
} from "../profile-service";
import {
  searchTeams,
  updateCompleteProfessionalProfile,
} from "../profile-service";
import { EditModalShell } from "./EditModalShell";

type FlowScreen =
  | { type: "list" }
  | { type: "select-type" }
  | { type: "form"; editIndex: number | null; entry: CoachCareerEntry };

type EditCoachExperiencesModalProps = {
  completeProfile: CompleteProfessionalProfile;
  onClose: () => void;
  onSaved: () => void;
  visible: boolean;
};

function recordToForm(entry: CoachCareerEntryRecord): CoachCareerEntry {
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
            startYear: entry.period_start_year ? String(entry.period_start_year) : "",
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

function formToRecord(
  entry: CoachCareerEntry,
  index: number,
  previous?: CoachCareerEntryRecord,
): CoachCareerEntryRecord {
  return {
    category: entry.category || previous?.category || null,
    club_id: entry.clubId ?? previous?.club_id ?? null,
    coach_profile_id: previous?.coach_profile_id ?? "",
    description: previous?.description ?? null,
    experience_type: entry.type,
    id: entry.id || generateCoachEntryId(),
    period_end_month: entry.period?.endMonth || null,
    period_end_year: entry.period?.endYear ? Number(entry.period.endYear) : null,
    period_start_month: entry.period?.startMonth || null,
    period_start_year: entry.period?.startYear ? Number(entry.period.startYear) : null,
    results: previous?.results ?? [],
    role: entry.role,
    season_details: entry.seasonDetails,
    seasons: entry.seasons,
    sort_order: index,
    team_logo_url: entry.teamLogoUrl ?? previous?.team_logo_url ?? null,
    team_name: entry.teamName,
  };
}

export function EditCoachExperiencesModal({
  completeProfile,
  onClose,
  onSaved,
  visible,
}: EditCoachExperiencesModalProps) {
  const [careerEntries, setCareerEntries] = useState<CoachCareerEntry[]>(() =>
    sortCoachCareerEntriesBySeason(completeProfile.coachCareerEntries.map(recordToForm)),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [screen, setScreen] = useState<FlowScreen>({ type: "list" });

  const previousEntriesById = useMemo(
    () =>
      new Map(completeProfile.coachCareerEntries.map((entry) => [entry.id, entry])),
    [completeProfile.coachCareerEntries],
  );

  useEffect(() => {
    if (visible) {
      setCareerEntries(
        sortCoachCareerEntriesBySeason(
          completeProfile.coachCareerEntries.map(recordToForm),
        ),
      );
      setScreen({ type: "list" });
    }
  }, [visible, completeProfile]);

  async function handleSave() {
    setIsSaving(true);

    try {
      const baseState = buildInitialState(completeProfile);
      const payload = buildFullUpdatePayload(completeProfile, baseState);
      payload.profile.birth_date = validateBirthDateInput(baseState.birthDate).isoValue;
      payload.coachCareerEntries = sortCoachCareerEntriesBySeason(careerEntries).map(
        (entry, index) =>
          formToRecord(entry, index, previousEntriesById.get(entry.id)),
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

  function handleSelectType(type: CoachCareerEntry["type"]) {
    setScreen({
      type: "form",
      editIndex: null,
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

  function handleEdit(index: number) {
    setScreen({
      type: "form",
      editIndex: index,
      entry: { ...careerEntries[index] },
    });
  }

  function handleDelete(index: number) {
    setCareerEntries((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  }

  function handleFormSave(saved: CoachCareerEntry) {
    const splitEntries = splitCoachEntryBySeasonDetails(saved);
    const editIndex = screen.type === "form" ? screen.editIndex : null;
    const nextEntries =
      editIndex === null
        ? [...careerEntries, ...splitEntries]
        : [
            ...careerEntries.slice(0, editIndex),
            ...splitEntries,
            ...careerEntries.slice(editIndex + 1),
          ];

    setCareerEntries(sortCoachCareerEntriesBySeason(nextEntries));
    setScreen({ type: "list" });
  }

  return (
    <EditModalShell
      isSaving={isSaving}
      onClose={onClose}
      onSave={handleSave}
      saveDisabled={screen.type !== "list"}
      title="Esperienze da allenatore"
      visible={visible}
    >
      {screen.type === "select-type" ? (
        <CoachExperienceTypeSelector
          onSelect={handleSelectType}
          subtitle="Scegli come vuoi inserire questa esperienza."
          title="Aggiungi esperienza"
        />
      ) : null}

      {screen.type === "form" ? (
        <>
          <Card variant="muted">
            <AppText color="secondary" variant="caption">
              {screen.entry.type === "MULTI_SEASON"
                ? "PIU' STAGIONI"
                : screen.entry.type === "SINGLE_SEASON"
                  ? "SINGOLA STAGIONE"
                  : "PERIODO PERSONALIZZATO"}
            </AppText>
          </Card>
          <CoachExperienceForm
            entry={screen.entry}
            existingEntries={careerEntries}
            isEditing={screen.editIndex !== null}
            onCancel={() => setScreen({ type: "list" })}
            onSave={handleFormSave}
            searchTeams={searchTeams}
          />
        </>
      ) : null}

      {screen.type === "list" ? (
        <>
          {careerEntries.length === 0 ? (
            <Card variant="muted">
              <AppText color="secondary">
                Aggiungi le tue esperienze in panchina. Puoi inserirle come più
                stagioni, singola stagione o periodo personalizzato.
              </AppText>
            </Card>
          ) : null}

          {careerEntries.map((entry, index) => (
            <CoachCareerExperienceCard
              entry={entry}
              key={entry.id}
              onDelete={() => handleDelete(index)}
              onEdit={() => handleEdit(index)}
            />
          ))}

          <Button
            label="Aggiungi esperienza"
            leftIcon={<Ionicons color={colors.accent} name="add-outline" size={20} />}
            onPress={() => setScreen({ type: "select-type" })}
            variant="secondary"
          />
        </>
      ) : null}
    </EditModalShell>
  );
}
