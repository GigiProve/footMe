/**
 * Gestisci carriera — Staff tecnico (REV-PROF-07).
 *
 * Il comportamento vive in `CareerManagerScreen`, lo stesso modulo che serve
 * l'Allenatore: qui restano la sorgente dei dati, la copy dello Staff tecnico
 * e i tre percorsi di scrittura — carriera nello staff, percorso da allenatore
 * e percorso da calciatore — che finiscono su `staff_career_entries`,
 * `staff_coach_career_entries` e `staff_player_career_entries`.
 *
 * Le tre carriere restano separate dalla tabella su cui vengono scritte, non
 * dal ruolo testuale: un Preparatore atletico che ha anche allenato non rischia
 * di vedere le due cose confuse.
 */
import { useMemo } from "react";
import { useLocalSearchParams } from "expo-router";

import {
  formsToPlayerEntries,
  playerEntriesToForms,
} from "../../onboarding/career/player-career-utils";
import { COACH_ROLE_OPTIONS } from "../../onboarding/coach/coach-options";
import { getStaffCareerRoleOptions } from "../../onboarding/staff/staff-options";
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
} from "../coach-career/coach-assignment-model";
import {
  useCompleteProfileQuery,
  useStaffCareerSave,
} from "./staff-career-service";
import {
  formsToStaffPlayerRecords,
  staffPlayerRecordsToForms,
} from "./staff-player-career";
import { useStaffCareerGuard } from "./use-staff-career-guard";

const COPY: CareerManagerCopy = {
  additionalEyebrow: "Percorsi aggiuntivi",
  customPeriodSubtitle: "Per incarichi brevi o periodi non completi.",
  hubTitle: "Gestisci carriera",
  periodHelpMessage: "Utile per incarichi brevi o periodi fuori stagione.",
  primaryEmptyText: "Aggiungi le esperienze maturate nello staff tecnico.",
  primaryEmptyTitle: "Completa la tua carriera",
  primaryEyebrow: "Carriera nello staff tecnico",
  summarySubtitle: "Controlla il tuo percorso nello staff tecnico.",
  typeSelectorTitle: "Esperienze nello staff",
};

const EVENTS: CareerManagerEvents = {
  addTapped: "staff_career_add_tapped",
  cancelled: "staff_career_cancelled",
  completed: "staff_career_completed",
  deleteFailed: "staff_career_delete_failed",
  experienceDeleted: "staff_career_experience_deleted",
  experienceEdited: "staff_career_experience_edited",
  experienceSaved: "staff_career_experience_saved",
  groupDeleted: "staff_career_group_deleted",
  groupEdited: "staff_career_group_edited",
  loadFailed: "staff_career_load_failed",
  opened: "staff_career_manager_opened",
  pathEvents: {
    coach: {
      addTapped: "staff_career_coach_add_tapped",
      opened: "staff_career_coach_opened",
    },
    player: {
      addTapped: "staff_career_player_add_tapped",
      opened: "staff_career_player_opened",
    },
  },
  pathsOpened: "staff_career_paths_opened",
  saveFailed: "staff_career_save_failed",
  seasonRolesOpened: "staff_career_season_roles_opened",
  typeSelected: "staff_career_type_selected",
  unsavedExit: "staff_career_unsaved_exit",
};

const PATHS: CareerPathCopy[] = [
  {
    appBarTitle: "Carriera da allenatore",
    emptyCtaLabel: "Aggiungi carriera da allenatore",
    emptyText: "Puoi aggiungere questo percorso anche in seguito.",
    emptyTitle: "Nessuna esperienza da allenatore",
    icon: "clipboard-outline",
    key: "coach",
    title: "Allenatore",
  },
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

export function StaffCareerManagerScreen() {
  const { userId } = useStaffCareerGuard();
  const { section } = useLocalSearchParams<{ section?: string }>();
  const profileQuery = useCompleteProfileQuery(userId);
  const save = useStaffCareerSave(userId);
  const data = profileQuery.data;

  const assignments = useMemo<CoachAssignment[]>(
    () => (data ? recordsToAssignments(data.staffCareerEntries ?? []) : []),
    [data],
  );
  const coachAssignments = useMemo<CoachAssignment[]>(
    () => (data ? recordsToAssignments(data.staffCoachCareerEntries ?? []) : []),
    [data],
  );
  const playerEntries = useMemo(
    () =>
      formsToPlayerEntries(
        staffPlayerRecordsToForms(data?.staffPlayerCareerEntries ?? []),
      ),
    [data],
  );
  const previousPlayerById = useMemo(
    () =>
      new Map(
        (data?.staffPlayerCareerEntries ?? []).map((entry) => [entry.id, entry]),
      ),
    [data],
  );

  /*
    I ruoli dichiarati nel profilo aprono l'elenco, ma non lo chiudono: la
    tassonomia canonica c'è tutta, più gli eventuali ruoli storici già presenti
    nelle esperienze. Un Match analyst che oggi si dichiara solo Preparatore
    atletico non vede sparire il ruolo dalle stagioni passate.
  */
  const primaryRoleOptions = useMemo(
    () =>
      getStaffCareerRoleOptions(
        [
          data?.staffProfile?.primary_staff_role ?? "",
          ...(data?.staffProfile?.staff_roles ?? []),
        ].filter(Boolean),
        assignments.map((assignment) => assignment.role).filter(Boolean),
      ),
    [assignments, data],
  );

  return (
    <CareerManagerScreen
      assignments={assignments}
      copy={COPY}
      // Il ruolo principale precompila e basta: cambiare il ruolo di una
      // stagione non tocca il profilo, e il profilo non riscrive le stagioni.
      defaultRole={data?.staffProfile?.primary_staff_role?.trim() ?? ""}
      events={EVENTS}
      initialStep={section === "paths" ? "paths" : "hub"}
      isError={profileQuery.isError}
      isLoading={profileQuery.isPending}
      isReady={Boolean(data)}
      isSaving={save.isPending}
      onPersistAssignments={(lane, next, handlers: CareerPersistHandlers) => {
        if (!data) {
          return;
        }

        save.mutate(
          {
            data,
            patch:
              lane === "primary"
                ? { assignments: next }
                : { coachAssignments: next },
          },
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
              playerCareerEntries: formsToStaffPlayerRecords(
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
      openSource={section === "paths" ? "additional_paths" : "career_tab"}
      pathAssignments={{ coach: coachAssignments }}
      pathRoleOptions={{ coach: COACH_ROLE_OPTIONS }}
      paths={PATHS}
      playerEntries={playerEntries}
      primaryRoleOptions={primaryRoleOptions}
      profileType="staff"
      testIDPrefix="staff"
    />
  );
}
