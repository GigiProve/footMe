/**
 * Accesso ai dati della carriera Staff tecnico (REV-PROF-07).
 *
 * Onboarding, Gestisci carriera e Master Profile leggono e scrivono gli stessi
 * record: qui non nasce nessuna seconda copia della carriera, solo un modo
 * diverso di comporre lo stesso payload.
 *
 * Due trappole del backend vivono in questo file, e solo qui:
 *
 * 1. `save_staff_career_details` **cancella** tutte le esperienze che non
 *    trova nel payload. Partire sempre da `buildFullUpdatePayload` garantisce
 *    che salvare la carriera nello staff non azzeri il percorso da allenatore,
 *    e viceversa.
 * 2. `buildFullUpdatePayload` lascia di proposito `birth_date` a `null`
 *    aspettandosi che sia il chiamante a reimpostarla.
 *
 * Il salvataggio rilegge il profilo e riscrive la cache condivisa: tab
 * Carriera, informazioni rapide, situazione attuale e conteggi dei percorsi
 * aggiuntivi si aggiornano senza refetch a catena e senza riavviare l'app.
 */
import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";

import {
  buildFullUpdatePayload,
  buildInitialState,
} from "../profile-edit-helpers";
import { parseBirthDateInput } from "../profile-form-utils";
import {
  getCompleteProfessionalProfile,
  updateCompleteProfessionalProfile,
  type CompleteProfessionalProfile,
  type StaffPlayerCareerEntryRecord,
} from "../profile-service";
import { completeProfileQueryKey } from "../edit/player-profile-edit-service";
import type { CoachAssignment } from "../coach-career/coach-assignment-model";
import {
  assignmentsToStaffRecords,
  indexStaffRecords,
} from "./staff-assignment-model";

export { useCompleteProfileQuery } from "../edit/player-profile-edit-service";

export type StaffCareerPatch = {
  /** Assegnazioni nello staff tecnico. `undefined` le lascia come sono. */
  assignments?: readonly CoachAssignment[];
  /** Percorso aggiuntivo da allenatore. `undefined` lo lascia come è. */
  coachAssignments?: readonly CoachAssignment[];
  /** Percorso aggiuntivo da calciatore. `undefined` lo lascia come è. */
  playerCareerEntries?: readonly StaffPlayerCareerEntryRecord[];
};

export function buildStaffCareerPayload(
  data: CompleteProfessionalProfile,
  patch: StaffCareerPatch,
) {
  const baseState = buildInitialState(data);
  const payload = buildFullUpdatePayload(data, baseState);

  payload.profile.birth_date =
    parseBirthDateInput(baseState.birthDate)?.isoValue ??
    data.profile.birth_date;

  if (patch.assignments) {
    payload.staffCareerEntries = assignmentsToStaffRecords(
      patch.assignments,
      data.profile.id,
      indexStaffRecords(data.staffCareerEntries ?? []),
    );
  }

  if (patch.coachAssignments) {
    payload.staffCoachCareerEntries = assignmentsToStaffRecords(
      patch.coachAssignments,
      data.profile.id,
      indexStaffRecords(data.staffCoachCareerEntries ?? []),
    );
  }

  if (patch.playerCareerEntries) {
    payload.staffPlayerCareerEntries = patch.playerCareerEntries.map(
      (entry, index) => ({ ...entry, sort_order: index }),
    );
  }

  return payload;
}

export type SaveStaffCareerVariables = {
  data: CompleteProfessionalProfile;
  patch: StaffCareerPatch;
};

/**
 * Un'unica mutation per creazione, modifica ed eliminazione: il backend
 * riscrive l'intero insieme in una sola transazione, quindi un gruppo
 * multi-stagione entra tutto o non entra affatto. Non esistono salvataggi
 * parziali da ricucire lato client.
 */
export function useStaffCareerSave(
  profileId: string | null,
): UseMutationResult<
  CompleteProfessionalProfile,
  Error,
  SaveStaffCareerVariables
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ data, patch }: SaveStaffCareerVariables) => {
      await updateCompleteProfessionalProfile(
        buildStaffCareerPayload(data, patch),
      );

      return getCompleteProfessionalProfile(data.profile.id);
    },
    onSuccess: (fresh) => {
      queryClient.setQueryData(
        completeProfileQueryKey(profileId ?? fresh.profile.id),
        fresh,
      );
    },
  });
}
