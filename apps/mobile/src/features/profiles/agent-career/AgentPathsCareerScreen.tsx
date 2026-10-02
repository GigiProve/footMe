/**
 * Percorsi aggiuntivi del Procuratore (REV-PROF-15, Screen 8).
 *
 * Qui non c'è nessuna carriera nuova: è `CareerManagerScreen` — lo stesso
 * modulo di Allenatore, Staff tecnico e Dirigente — aperto direttamente sul
 * percorso scelto. Le esperienze degli altri ruoli restano nel loro modello e
 * nella loro corsia: non diventano mai incarichi da procuratore, e la carriera
 * da procuratore non entra qui.
 *
 * Le tre corsie ad assegnazione vivono in tre colonne `jsonb` di
 * `agent_profiles`, come per il Dirigente; il percorso da calciatore usa il
 * modello del Calciatore, tradotto e non piegato.
 */
import { useMemo } from "react";
import { useLocalSearchParams } from "expo-router";

import {
  formsToPlayerEntries,
  playerEntriesToForms,
} from "../../onboarding/career/player-career-utils";
import { COACH_ROLE_OPTIONS } from "../../onboarding/coach/coach-options";
import { DIRECTOR_CLUB_ROLE_OPTIONS } from "../../onboarding/director/director-taxonomy";
import { getStaffCareerRoleOptions } from "../../onboarding/staff/staff-options";
import {
  CareerManagerScreen,
  type CareerPersistHandlers,
} from "../career-manager/CareerManagerScreen";
import type {
  CareerManagerCopy,
  CareerManagerEvents,
  CareerPathKey,
} from "../career-manager/career-manager-config";
import {
  collectDirectorHistoricalRoles,
  directorEntriesToAssignments,
} from "../director-career/director-assignment-model";
import { parseDirectorPlayerForms } from "../career/director-career-model";
import { AGENT_CAREER_PATHS } from "./AgentCareerManagerScreen";
import { useCompleteProfileQuery, useSaveAgentPath } from "./agent-career-service";
import { useAgentCareerGuard } from "./use-agent-career-guard";

/**
 * Copy della carriera principale: non viene mai mostrata, perché il modulo si
 * apre sempre su un percorso. Resta richiesta dal contratto del componente, e
 * dichiararla qui è più onesto che renderla opzionale per un caso solo.
 */
const COPY: CareerManagerCopy = {
  additionalDescription:
    "Aggiungi eventuali esperienze svolte in altri ruoli nel calcio. Rimarranno separate dalla carriera da procuratore.",
  additionalEyebrow: "Percorsi aggiuntivi",
  customPeriodSubtitle: "Per subentri, incarichi brevi o periodi non completi.",
  descriptionLabel: "Attività svolte",
  descriptionPlaceholder: "Attività svolte e ambito di lavoro.",
  hubTitle: "Percorsi aggiuntivi",
  periodHelpMessage:
    "Utile per subentri, incarichi brevi o periodi fuori stagione.",
  primaryEmptyText: "Puoi aggiungere questo percorso anche in seguito.",
  primaryEmptyTitle: "Nessuna esperienza",
  primaryEyebrow: "Percorsi aggiuntivi",
  showDescription: true,
  summarySubtitle: "Controlla il tuo percorso.",
  teamLabel: "Società / Club",
  teamPlaceholder: "Cerca la società",
  typeSelectorTitle: "Esperienze",
};

const EVENTS: CareerManagerEvents = {
  addTapped: "agent_career_add_tapped",
  cancelled: "agent_career_cancelled",
  completed: "agent_career_completed",
  deleteFailed: "agent_career_delete_failed",
  experienceDeleted: "agent_career_experience_deleted",
  experienceEdited: "agent_career_experience_edited",
  experienceSaved: "agent_career_experience_saved",
  groupDeleted: "agent_career_experience_deleted",
  groupEdited: "agent_career_experience_edited",
  loadFailed: "agent_career_load_failed",
  opened: "agent_career_manager_opened",
  pathEvents: {
    coach: {
      addTapped: "agent_career_coach_add_tapped",
      opened: "agent_career_coach_opened",
    },
    director: {
      addTapped: "agent_career_director_add_tapped",
      opened: "agent_career_director_opened",
    },
    player: {
      addTapped: "agent_career_player_add_tapped",
      opened: "agent_career_player_opened",
    },
    staff: {
      addTapped: "agent_career_staff_add_tapped",
      opened: "agent_career_staff_opened",
    },
  },
  pathsOpened: "agent_career_paths_opened",
  saveFailed: "agent_career_save_failed",
  seasonRolesOpened: "agent_career_experience_edited",
  typeSelected: "agent_career_type_selected",
  unsavedExit: "agent_career_unsaved_exit",
};

const KNOWN_PATHS: CareerPathKey[] = ["director", "coach", "staff", "player"];

function parsePath(value: string | undefined): CareerPathKey {
  return KNOWN_PATHS.includes(value as CareerPathKey)
    ? (value as CareerPathKey)
    : "director";
}

export function AgentPathsCareerScreen() {
  const { userId } = useAgentCareerGuard();
  const { path } = useLocalSearchParams<{ path?: string }>();
  const profileQuery = useCompleteProfileQuery(userId);
  const save = useSaveAgentPath(userId);

  const data = profileQuery.data;
  const agentProfile = data?.agentProfile ?? null;
  const initialPath = parsePath(path);

  const directorAssignments = useMemo(
    () =>
      directorEntriesToAssignments(
        agentProfile?.director_career_entries,
        "agent-director",
      ),
    [agentProfile],
  );
  const coachAssignments = useMemo(
    () =>
      directorEntriesToAssignments(agentProfile?.coach_career_entries, "agent-coach"),
    [agentProfile],
  );
  const staffAssignments = useMemo(
    () =>
      directorEntriesToAssignments(agentProfile?.staff_career_entries, "agent-staff"),
    [agentProfile],
  );
  const playerEntries = useMemo(
    () =>
      formsToPlayerEntries(
        parseDirectorPlayerForms(agentProfile?.player_career_entries),
      ),
    [agentProfile],
  );

  return (
    <CareerManagerScreen
      // La carriera principale di questo modulo non viene mai mostrata: quella
      // del Procuratore vive nel proprio, che ragiona per periodi.
      assignments={[]}
      copy={COPY}
      events={EVENTS}
      initialPath={initialPath}
      isError={profileQuery.isError}
      isLoading={profileQuery.isPending}
      isReady={Boolean(data)}
      isSaving={save.isPending}
      onPersistAssignments={(lane, next, handlers: CareerPersistHandlers) => {
        if (!data || lane === "primary") {
          return;
        }

        save.mutate(
          { assignments: next, lane, profileId: data.profile.id },
          { onError: handlers.onError, onSuccess: () => handlers.onSuccess() },
        );
      }}
      onPersistPlayerEntries={(next, handlers) => {
        if (!data) {
          return;
        }

        save.mutate(
          {
            playerCareerEntries: playerEntriesToForms(next),
            profileId: data.profile.id,
          },
          { onError: handlers.onError, onSuccess: () => handlers.onSuccess() },
        );
      }}
      onRetry={() => profileQuery.refetch()}
      openSource="agent_career_paths"
      pathAssignments={{
        coach: coachAssignments,
        director: directorAssignments,
        staff: staffAssignments,
      }}
      pathRoleOptions={{
        coach: COACH_ROLE_OPTIONS,
        director: getStaffCareerRoleOptions(
          DIRECTOR_CLUB_ROLE_OPTIONS.map((option) => option.value),
          collectDirectorHistoricalRoles(
            agentProfile?.director_career_entries,
            "agent-director",
          ),
        ),
        staff: getStaffCareerRoleOptions(
          [],
          collectDirectorHistoricalRoles(
            agentProfile?.staff_career_entries,
            "agent-staff",
          ),
        ),
      }}
      paths={AGENT_CAREER_PATHS}
      playerEntries={playerEntries}
      primaryRoleOptions={[]}
      profileType="agent"
      testIDPrefix="agent-paths"
    />
  );
}
