/**
 * Accesso ai dati della carriera Allenatore (REV-PROF-04).
 *
 * Onboarding, Gestisci carriera e Master Profile leggono e scrivono gli stessi
 * record: qui non nasce nessuna seconda copia della carriera, solo un modo
 * diverso di comporre lo stesso payload.
 *
 * Due trappole del backend vivono in questo file, e solo qui:
 *
 * 1. `save_coach_career_details` **cancella** tutte le esperienze che non
 *    trova nel payload. Partire sempre da `buildFullUpdatePayload` garantisce
 *    che salvare la carriera da allenatore non azzeri quella da calciatore, e
 *    viceversa.
 * 2. `buildFullUpdatePayload` lascia di proposito `birth_date` a `null`
 *    aspettandosi che sia il chiamante a reimpostarla.
 *
 * Il salvataggio rilegge il profilo e riscrive la cache condivisa: tab
 * Carriera, informazioni rapide e situazione attuale del Master Profile si
 * aggiornano senza refetch a catena e senza riavviare l'app.
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
  type CoachCareerEntryRecord,
  type CoachPlayerCareerEntryRecord,
  type CompleteProfessionalProfile,
} from "../profile-service";
import { completeProfileQueryKey } from "../edit/player-profile-edit-service";
import {
  assignmentsToRecords,
  type CoachAssignment,
} from "./coach-assignment-model";

export { useCompleteProfileQuery } from "../edit/player-profile-edit-service";

export type CoachCareerPatch = {
  /** Assegnazioni da allenatore. `undefined` le lascia come sono. */
  assignments?: readonly CoachAssignment[];
  /** Carriera da ex calciatore. `undefined` la lascia come è. */
  playerCareerEntries?: readonly CoachPlayerCareerEntryRecord[];
};

export function buildCoachCareerPayload(
  data: CompleteProfessionalProfile,
  patch: CoachCareerPatch,
) {
  const baseState = buildInitialState(data);
  const payload = buildFullUpdatePayload(data, baseState);

  payload.profile.birth_date =
    parseBirthDateInput(baseState.birthDate)?.isoValue ??
    data.profile.birth_date;

  if (patch.assignments) {
    payload.coachCareerEntries = assignmentsToRecords(
      patch.assignments,
      data.profile.id,
    ) satisfies CoachCareerEntryRecord[];
  }

  if (patch.playerCareerEntries) {
    payload.coachPlayerCareerEntries = patch.playerCareerEntries.map(
      (entry, index) => ({ ...entry, sort_order: index }),
    );
  }

  return payload;
}

export type SaveCoachCareerVariables = {
  data: CompleteProfessionalProfile;
  patch: CoachCareerPatch;
};

/**
 * Un'unica mutation per creazione, modifica ed eliminazione: il backend
 * riscrive l'intero insieme in una sola transazione, quindi un gruppo
 * multi-stagione entra tutto o non entra affatto. Non esistono salvataggi
 * parziali da ricucire lato client.
 */
export function useCoachCareerSave(
  profileId: string | null,
): UseMutationResult<
  CompleteProfessionalProfile,
  Error,
  SaveCoachCareerVariables
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ data, patch }: SaveCoachCareerVariables) => {
      await updateCompleteProfessionalProfile(
        buildCoachCareerPayload(data, patch),
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
