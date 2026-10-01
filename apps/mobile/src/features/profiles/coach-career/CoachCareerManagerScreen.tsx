/**
 * Gestisci carriera — Allenatore (REV-PROF-04).
 *
 * Il comportamento vive in `CareerManagerScreen`, condiviso con lo Staff
 * tecnico (REV-PROF-07): qui restano soltanto la sorgente dei dati, la copy
 * dell'Allenatore e i due percorsi di scrittura — assegnazioni e carriera da
 * ex calciatore — che finiscono su `coach_career_entries` e
 * `coach_player_career_entries`.
 */
import { useMemo } from "react";

import {
  formsToPlayerEntries,
  playerEntriesToForms,
} from "../../onboarding/career/player-career-utils";
import { COACH_ROLE_OPTIONS } from "../../onboarding/coach/coach-options";
import {
  CareerManagerScreen,
  type CareerPersistHandlers,
} from "../career-manager/CareerManagerScreen";
import type {
  CareerManagerCopy,
  CareerManagerEvents,
  CareerPathCopy,
} from "../career-manager/career-manager-config";
import {
  recordsToAssignments,
  type CoachAssignment,
} from "./coach-assignment-model";
import {
  useCoachCareerSave,
  useCompleteProfileQuery,
} from "./coach-career-service";
import {
  coachPlayerRecordsToForms,
  formsToCoachPlayerRecords,
} from "./coach-player-career";
import { useCoachCareerGuard } from "./use-coach-career-guard";

const COPY: CareerManagerCopy = {
  additionalEyebrow: "Carriera da calciatore",
  customPeriodSubtitle: "Per subentri, incarichi brevi o periodi non completi.",
  hubTitle: "Gestisci carriera",
  periodHelpMessage:
    "Utile per subentri, incarichi brevi o periodi fuori stagione.",
  primaryEmptyText:
    "Aggiungi le tue esperienze per raccontare il tuo percorso professionale.",
  primaryEmptyTitle: "Completa la tua carriera",
  primaryEyebrow: "Carriera da allenatore",
  summarySubtitle: "Controlla il tuo percorso da allenatore.",
  typeSelectorTitle: "Esperienze da allenatore",
};

const EVENTS: CareerManagerEvents = {
  addTapped: "coach_career_add_tapped",
  cancelled: "coach_career_cancelled",
  completed: "coach_career_completed",
  deleteFailed: "coach_career_delete_failed",
  experienceDeleted: "coach_career_experience_deleted",
  experienceEdited: "coach_career_experience_edited",
  experienceSaved: "coach_career_experience_saved",
  groupDeleted: "coach_career_group_deleted",
  groupEdited: "coach_career_group_edited",
  loadFailed: "coach_career_load_failed",
  opened: "coach_career_manager_opened",
  playerAddTapped: "coach_career_player_add_tapped",
  playerOpened: "coach_career_player_opened",
  saveFailed: "coach_career_save_failed",
  seasonRolesOpened: "coach_career_season_roles_opened",
  typeSelected: "coach_career_type_selected",
  unsavedExit: "coach_career_unsaved_exit",
};

const PATHS: CareerPathCopy[] = [
  {
    appBarTitle: "Carriera da calciatore",
    emptyCtaLabel: "Aggiungi carriera da calciatore",
    emptyText: "Puoi aggiungere questo percorso anche in seguito.",
    emptyTitle: "Nessuna esperienza da calciatore",
    icon: "walk-outline",
    key: "player",
    title: "Calciatore",
  },
];

export function CoachCareerManagerScreen() {
  const { userId } = useCoachCareerGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const save = useCoachCareerSave(userId);
  const data = profileQuery.data;

  const assignments = useMemo<CoachAssignment[]>(
    () => (data ? recordsToAssignments(data.coachCareerEntries ?? []) : []),
    [data],
  );
  const playerEntries = useMemo(
    () =>
      formsToPlayerEntries(
        coachPlayerRecordsToForms(data?.coachPlayerCareerEntries ?? []),
      ),
    [data],
  );
  /*
    `position` non è chiesto dal flusso Calciatore — nel suo modello vive sul
    profilo — quindi il valore già salvato va conservato invece di essere
    azzerato a ogni scrittura.
  */
  const previousPlayerById = useMemo(
    () =>
      new Map(
        (data?.coachPlayerCareerEntries ?? []).map((entry) => [entry.id, entry]),
      ),
    [data],
  );

  return (
    <CareerManagerScreen
      assignments={assignments}
      copy={COPY}
      defaultRole={data?.coachProfile?.primary_role?.trim() ?? ""}
      events={EVENTS}
      isError={profileQuery.isError}
      isLoading={profileQuery.isPending}
      isReady={Boolean(data)}
      isSaving={save.isPending}
      onPersistAssignments={(_lane, next, handlers: CareerPersistHandlers) => {
        if (!data) {
          return;
        }

        save.mutate(
          { data, patch: { assignments: next } },
          { onError: handlers.onError, onSuccess: () => handlers.onSuccess() },
        );
      }}
      onPersistPlayerEntries={(next, handlers) => {
        if (!data) {
          return;
        }

        save.mutate(
          {
            data,
            patch: {
              playerCareerEntries: formsToCoachPlayerRecords(
                playerEntriesToForms(next),
                data.profile.id,
                previousPlayerById,
              ),
            },
          },
          { onError: handlers.onError, onSuccess: () => handlers.onSuccess() },
        );
      }}
      onRetry={() => profileQuery.refetch()}
      paths={PATHS}
      playerEntries={playerEntries}
      primaryRoleOptions={COACH_ROLE_OPTIONS}
      profileType="coach"
      testIDPrefix="coach"
    />
  );
}
