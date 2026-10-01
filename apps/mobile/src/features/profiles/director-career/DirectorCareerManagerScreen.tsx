/**
 * Gestisci carriera — Dirigente (REV-PROF-10).
 *
 * Il comportamento vive in `CareerManagerScreen`, lo stesso modulo che serve
 * Allenatore e Staff tecnico: le otto schermate del mockup sono già quelle, e
 * questa task non ne ha aggiunta nessuna. Qui restano la sorgente dei dati, la
 * copy del Dirigente e le cinque corsie di scrittura — carriera dirigenziale,
 * percorso da allenatore, nello staff tecnico, da calciatore e in altri ruoli
 * — che finiscono nelle cinque colonne `jsonb` di `director_profiles`.
 *
 * I percorsi aggiuntivi restano quattro e sempre accessibili, anche a zero
 * esperienze: la task chiede che le opzioni supportate restino raggiungibili,
 * non che compaiano solo quando sono già popolate. Il conteggio invece è
 * sempre calcolato, mai memorizzato.
 *
 * Le carriere restano separate dalla colonna su cui vengono scritte, non dal
 * ruolo testuale: un Direttore sportivo che ha anche allenato non rischia di
 * vedere le due cose confuse, e nessuna statistica da giocatore entra nella
 * carriera dirigenziale.
 */
import { useMemo } from "react";
import { useLocalSearchParams } from "expo-router";

import {
  formsToPlayerEntries,
  playerEntriesToForms,
} from "../../onboarding/career/player-career-utils";
import { COACH_ROLE_OPTIONS } from "../../onboarding/coach/coach-options";
import {
  getDirectorGenericRoleOptions,
  readDirectorPreviousRoles,
} from "../../onboarding/director/director-previous-roles";
import {
  DIRECTOR_CLUB_ROLE_OPTIONS,
  DIRECTOR_OTHER_ROLE_VALUE,
} from "../../onboarding/director/director-taxonomy";
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
  collectDirectorRoles,
  parseDirectorPlayerForms,
  resolveDirectorPrimaryRole,
} from "../career/director-career-model";
import {
  collectDirectorHistoricalRoles,
  directorEntriesToAssignments,
} from "./director-assignment-model";
import {
  useCompleteProfileQuery,
  useDirectorCareerSave,
} from "./director-career-service";
import { useDirectorCareerGuard } from "./use-director-career-guard";

const COPY: CareerManagerCopy = {
  additionalDescription:
    "Aggiungi eventuali esperienze svolte in altri ruoli nel calcio. Rimarranno separate dalla carriera dirigenziale.",
  additionalEyebrow: "Percorsi aggiuntivi",
  customPeriodSubtitle: "Per subentri, incarichi brevi o periodi non completi.",
  // §U: la descrizione dell'esperienza esiste già nel modello dell'onboarding
  // e resta facoltativa. Qui diventa modificabile invece di essere solo
  // preservata.
  descriptionLabel: "Attività svolte",
  descriptionPlaceholder:
    "Gestione mercato, scouting, rapporti con allenatori e pianificazione sportiva.",
  hubTitle: "Gestisci carriera",
  periodHelpMessage:
    "Utile per subentri, incarichi brevi o periodi fuori stagione.",
  primaryEmptyText:
    "Aggiungi le tue esperienze per raccontare il tuo percorso professionale.",
  primaryEmptyTitle: "Completa la tua carriera",
  primaryEyebrow: "Carriera dirigenziale",
  showDescription: true,
  summarySubtitle: "Controlla il tuo percorso dirigenziale.",
  // Chi dirige non firma per una "squadra": firma per una società.
  teamLabel: "Società / Club",
  teamPlaceholder: "Cerca la società",
  typeSelectorTitle: "Esperienze dirigenziali",
};

const EVENTS: CareerManagerEvents = {
  addTapped: "director_career_add_tapped",
  cancelled: "director_career_cancelled",
  completed: "director_career_completed",
  deleteFailed: "director_career_delete_failed",
  experienceDeleted: "director_career_experience_deleted",
  experienceEdited: "director_career_experience_edited",
  experienceSaved: "director_career_experience_saved",
  groupDeleted: "director_career_group_deleted",
  groupEdited: "director_career_group_edited",
  loadFailed: "director_career_load_failed",
  opened: "director_career_manager_opened",
  pathEvents: {
    coach: {
      addTapped: "director_career_coach_add_tapped",
      opened: "director_career_coach_opened",
    },
    other: {
      addTapped: "director_career_other_add_tapped",
      opened: "director_career_other_opened",
    },
    player: {
      addTapped: "director_career_player_add_tapped",
      opened: "director_career_player_opened",
    },
    staff: {
      addTapped: "director_career_staff_add_tapped",
      opened: "director_career_staff_opened",
    },
  },
  pathsOpened: "director_career_paths_opened",
  saveFailed: "director_career_save_failed",
  seasonRolesOpened: "director_career_season_roles_opened",
  typeSelected: "director_career_type_selected",
  unsavedExit: "director_career_unsaved_exit",
};

/**
 * I quattro percorsi che il modello del Dirigente supporta (REV-ONB-07
 * §AC–§AG). "Altri ruoli" raccoglie Scout, Procuratore, Arbitro e Altro, che
 * condividono l'editor generico: non hanno un flusso dedicato e questa task
 * non è il posto per inventargliene uno.
 */
const PATHS: CareerPathCopy[] = [
  {
    appBarTitle: "Carriera da allenatore",
    emptyCtaLabel: "Aggiungi carriera da allenatore",
    emptyText: "Puoi aggiungere questo percorso anche in seguito.",
    emptyTitle: "Nessuna esperienza aggiunta",
    icon: "clipboard-outline",
    key: "coach",
    summarySubtitle: "Controlla il tuo percorso da allenatore.",
    title: "Allenatore",
    typeSelectorTitle: "Esperienze da allenatore",
  },
  {
    appBarTitle: "Carriera nello staff tecnico",
    emptyCtaLabel: "Aggiungi carriera nello staff tecnico",
    emptyText: "Puoi aggiungere questo percorso anche in seguito.",
    emptyTitle: "Nessuna esperienza aggiunta",
    icon: "person-outline",
    key: "staff",
    summarySubtitle: "Controlla il tuo percorso nello staff tecnico.",
    title: "Staff tecnico",
    typeSelectorTitle: "Esperienze nello staff",
  },
  {
    appBarTitle: "Carriera da calciatore",
    emptyCtaLabel: "Aggiungi carriera da calciatore",
    emptyText: "Puoi aggiungere questo percorso anche in seguito.",
    emptyTitle: "Nessuna esperienza aggiunta",
    icon: "walk-outline",
    key: "player",
    title: "Calciatore",
  },
  {
    appBarTitle: "Altre esperienze nel calcio",
    emptyCtaLabel: "Aggiungi altre esperienze",
    emptyText: "Puoi aggiungere questi percorsi anche in seguito.",
    emptyTitle: "Nessuna esperienza aggiunta",
    icon: "search-outline",
    key: "other",
    summarySubtitle: "Controlla le tue altre esperienze nel calcio.",
    title: "Altri ruoli",
    typeSelectorTitle: "Altre esperienze",
  },
];

export function DirectorCareerManagerScreen() {
  const { userId } = useDirectorCareerGuard();
  const { section } = useLocalSearchParams<{ section?: string }>();
  const profileQuery = useCompleteProfileQuery(userId);
  const save = useDirectorCareerSave(userId);
  const data = profileQuery.data;
  const directorProfile = data?.directorProfile ?? null;

  const assignments = useMemo(
    () =>
      directorEntriesToAssignments(directorProfile?.career_entries, "director"),
    [directorProfile],
  );
  const coachAssignments = useMemo(
    () =>
      directorEntriesToAssignments(
        directorProfile?.coach_career_entries,
        "director-coach",
      ),
    [directorProfile],
  );
  const staffAssignments = useMemo(
    () =>
      directorEntriesToAssignments(
        directorProfile?.staff_career_entries,
        "director-staff",
      ),
    [directorProfile],
  );
  const otherAssignments = useMemo(
    () =>
      directorEntriesToAssignments(
        directorProfile?.other_career_entries,
        "director-other",
      ),
    [directorProfile],
  );
  const playerEntries = useMemo(
    () =>
      formsToPlayerEntries(
        parseDirectorPlayerForms(directorProfile?.player_career_entries),
      ),
    [directorProfile],
  );

  /*
    I ruoli dichiarati nel profilo aprono l'elenco, ma non lo chiudono: la
    tassonomia dirigenziale c'è tutta, più gli eventuali ruoli storici già
    presenti nelle esperienze. Un Team manager che oggi si dichiara solo
    Direttore sportivo non vede sparire il ruolo dalle stagioni passate.
  */
  const primaryRoleOptions = useMemo(
    () =>
      getStaffCareerRoleOptions(
        [
          // "Altro" non è un ruolo: al suo posto entra l'etichetta libera che
          // l'utente ha scritto (REV-ONB-07 §H), e se non c'è la voce sparisce
          // invece di comparire come "Altro".
          ...collectDirectorRoles(directorProfile),
          ...DIRECTOR_CLUB_ROLE_OPTIONS.map((option) => option.value).filter(
            (role) => role !== DIRECTOR_OTHER_ROLE_VALUE,
          ),
        ],
        collectDirectorHistoricalRoles(
          directorProfile?.career_entries,
          "director",
        ),
      ),
    [directorProfile],
  );

  /*
    "Altri ruoli" propone i ruoli davvero dichiarati come esperienze passate;
    i ruoli già usati restano selezionabili anche se la dichiarazione cambia.
  */
  const otherRoleOptions = useMemo(
    () =>
      getStaffCareerRoleOptions(
        getDirectorGenericRoleOptions(
          readDirectorPreviousRoles({
            directorPreviousRoles: [...(directorProfile?.previous_roles ?? [])],
          }),
        ).map((option) => option.value),
        collectDirectorHistoricalRoles(
          directorProfile?.other_career_entries,
          "director-other",
        ),
      ),
    [directorProfile],
  );

  return (
    <CareerManagerScreen
      assignments={assignments}
      copy={COPY}
      // Il ruolo principale precompila e basta: cambiare il ruolo di una
      // stagione non tocca il profilo, e il profilo non riscrive le stagioni.
      defaultRole={
        directorProfile ? resolveDirectorPrimaryRole(directorProfile) : ""
      }
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
          { data, patch: { assignments: next, lane } },
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
            // Il percorso da calciatore resta nel modello del Calciatore: qui
            // si traduce, non si piega il modello del Dirigente per contenere
            // presenze e gol.
            patch: { playerCareerEntries: playerEntriesToForms(next) },
          },
          { onError: handlers.onError, onSuccess: () => handlers.onSuccess() },
        );
      }}
      onRetry={() => profileQuery.refetch()}
      openSource={section === "paths" ? "additional_paths" : "career_tab"}
      pathAssignments={{
        coach: coachAssignments,
        other: otherAssignments,
        staff: staffAssignments,
      }}
      pathRoleOptions={{
        coach: COACH_ROLE_OPTIONS,
        other: otherRoleOptions,
        staff: getStaffCareerRoleOptions(
          [],
          collectDirectorHistoricalRoles(
            directorProfile?.staff_career_entries,
            "director-staff",
          ),
        ),
      }}
      paths={PATHS}
      playerEntries={playerEntries}
      primaryRoleOptions={primaryRoleOptions}
      profileType="director"
      testIDPrefix="director"
    />
  );
}
