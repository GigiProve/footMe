/**
 * Accesso ai dati della carriera Dirigente (REV-PROF-10).
 *
 * Onboarding, Gestisci carriera e Master Profile leggono e scrivono le stesse
 * cinque colonne di `director_profiles`: qui non nasce nessuna seconda copia
 * della carriera, nessun `careerProfile` accanto a un `careerOnboarding`, e
 * nessuna aggregazione persistita da tenere allineata a mano.
 *
 * Due proprietà di questo file contano più del resto:
 *
 * 1. **Il salvataggio è atomico perché è una riga sola.** Le corsie sono
 *    colonne della stessa riga, quindi `saveDirectorProfileCareer` le scrive
 *    con un solo `upsert`: un gruppo multi-stagione entra tutto o non entra
 *    affatto, e un retry riscrive lo stesso insieme invece di duplicarlo.
 * 2. **Dopo la scrittura il profilo viene riletto e messo in cache.** Tab
 *    Carriera, informazioni rapide, situazione attuale, categorie e conteggi
 *    dei percorsi si aggiornano senza refetch a catena, senza riavviare l'app
 *    e senza che l'utente ricarichi niente.
 *
 * La patch è parziale per corsia: una corsia assente resta com'è. Salvare la
 * carriera dirigenziale non può quindi azzerare il percorso da calciatore,
 * che è l'errore che `buildFullUpdatePayload` ha già fatto una volta sullo
 * Staff tecnico (REV-PROF-07).
 */
import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";

import { completeProfileQueryKey } from "../edit/player-profile-edit-service";
import {
  getCompleteProfessionalProfile,
  saveDirectorProfileCareer,
  type CompleteProfessionalProfile,
  type DirectorCareerColumns,
} from "../profile-service";
import type { CoachAssignment } from "../coach-career/coach-assignment-model";
import type { AssignmentLane } from "../career-manager/career-manager-config";
import { assignmentsToDirectorEntries } from "./director-assignment-model";

export { useCompleteProfileQuery } from "../edit/player-profile-edit-service";

/** Colonna di `director_profiles` su cui scrive ciascuna corsia. */
const LANE_COLUMNS: Record<AssignmentLane, keyof DirectorCareerColumns> = {
  coach: "coach_career_entries",
  other: "other_career_entries",
  primary: "career_entries",
  staff: "staff_career_entries",
};

export type DirectorCareerPatch = {
  /** Assegnazioni di una corsia ad assegnazione. `undefined` la lascia com'è. */
  lane?: AssignmentLane;
  assignments?: readonly CoachAssignment[];
  /** Percorso da calciatore, già nella forma che il Calciatore legge. */
  playerCareerEntries?: readonly unknown[];
};

export function buildDirectorCareerColumns(
  data: CompleteProfessionalProfile,
  patch: DirectorCareerPatch,
): DirectorCareerColumns {
  const directorProfile = data.directorProfile;
  const columns: DirectorCareerColumns = {
    career_entries: [...(directorProfile?.career_entries ?? [])],
    coach_career_entries: [...(directorProfile?.coach_career_entries ?? [])],
    other_career_entries: [...(directorProfile?.other_career_entries ?? [])],
    player_career_entries: [...(directorProfile?.player_career_entries ?? [])],
    staff_career_entries: [...(directorProfile?.staff_career_entries ?? [])],
  };

  if (patch.lane && patch.assignments) {
    columns[LANE_COLUMNS[patch.lane]] = assignmentsToDirectorEntries(
      patch.assignments,
    );
  }

  if (patch.playerCareerEntries) {
    columns.player_career_entries = [...patch.playerCareerEntries];
  }

  return columns;
}

export type SaveDirectorCareerVariables = {
  data: CompleteProfessionalProfile;
  patch: DirectorCareerPatch;
};

/**
 * Un'unica mutation per creazione, modifica ed eliminazione: il client
 * consegna l'insieme completo di una corsia e il backend riscrive la riga in
 * una sola operazione. Non esistono salvataggi parziali da ricucire, e nessun
 * percorso di scrittura separato da tenere allineato.
 */
export function useDirectorCareerSave(
  profileId: string | null,
): UseMutationResult<
  CompleteProfessionalProfile,
  Error,
  SaveDirectorCareerVariables
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ data, patch }: SaveDirectorCareerVariables) => {
      if (!data.directorProfile) {
        throw new Error("Profilo Dirigente non disponibile.");
      }

      await saveDirectorProfileCareer({
        career: buildDirectorCareerColumns(data, patch),
        directorProfile: data.directorProfile,
        profileId: data.profile.id,
      });

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
