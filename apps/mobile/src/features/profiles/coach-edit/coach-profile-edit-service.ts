/**
 * Salvataggio per sezione della Modifica profilo Allenatore (REV-PROF-05).
 *
 * Il profilo completo è già letto da `useCompleteProfileQuery`, la stessa
 * query del Master Profile e dell'editor Calciatore: riusarla è ciò che fa
 * apparire una modifica ovunque senza refetch a catena e senza una seconda
 * copia dei dati.
 *
 * Qui vivono le due trappole del salvataggio dell'Allenatore, e solo qui:
 *
 * 1. `save_coach_career_details` **cancella** le esperienze di carriera che non
 *    trova in `p_career_entries`. Ogni payload parte quindi dal profilo appena
 *    letto: una sezione che non c'entra nulla con la carriera la riscrive
 *    identica invece di azzerarla.
 * 2. `buildFullUpdatePayload` lascia di proposito `birth_date` a `null`,
 *    aspettandosi che sia il chiamante a reimpostarla. Una sezione che se ne
 *    dimentica cancella la data di nascita.
 *
 * Il palmarès non passa da qui: `coach_achievements` è una tabella a parte,
 * con CRUD per singolo riconoscimento.
 */
import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";

import type { ProfileFormState } from "../profile-edit-helpers";
import {
  deleteCoachAchievement,
  upsertCoachAchievement,
  type CoachAchievementRecord,
  type CompleteProfessionalProfile,
  type CompleteProfessionalProfileUpdate,
} from "../profile-service";
import { completeProfileQueryKey } from "../edit/player-profile-edit-service";
import {
  buildProfileSectionPayload,
  useProfileSectionSave,
  type SaveProfileSectionVariables,
} from "../edit/profile-section-save";

export {
  completeProfileQueryKey,
  useCompleteProfileQuery,
} from "../edit/player-profile-edit-service";

/**
 * Campi di `coach_profiles` che `ProfileFormState` non rappresenta.
 *
 * Non vengono aggiunti allo stato condiviso — che serve ai form storici di
 * sette ruoli — ma applicati sul payload già costruito. Ciò che non è nel
 * patch resta com'era: `buildFullUpdatePayload` lo rilegge dal profilo.
 */
export type CoachProfilePatch = {
  play_styles?: string[];
  preferred_formation?: string | null;
};

export type CoachSectionPatch = Partial<ProfileFormState> & {
  coachProfile?: CoachProfilePatch;
};

export function buildCoachSectionPayload(
  data: CompleteProfessionalProfile,
  patch: CoachSectionPatch,
): CompleteProfessionalProfileUpdate {
  const { coachProfile: coachPatch, ...formPatch } = patch;
  const payload = buildProfileSectionPayload(
    data,
    formPatch as Partial<ProfileFormState>,
  );

  if (coachPatch && payload.coachProfile) {
    payload.coachProfile = { ...payload.coachProfile, ...coachPatch };
  }

  return payload;
}

export type SaveCoachSectionVariables =
  SaveProfileSectionVariables<CoachSectionPatch>;

/**
 * Salvataggio di una sezione. Rilegge il profilo e riscrive la cache
 * condivisa, così hub e Master Profile sono aggiornati senza reload manuale.
 */
export function useCoachSectionSave(
  profileId: string | null,
): UseMutationResult<
  CompleteProfessionalProfile,
  Error,
  SaveCoachSectionVariables
> {
  return useProfileSectionSave<CoachSectionPatch>(profileId, {
    buildPayload: buildCoachSectionPayload,
  });
}

// ---------------------------------------------------------------------------
// Palmarès
// ---------------------------------------------------------------------------
// `coach_achievements` è una tabella a parte, con la sua RLS owner-only: non
// passa da `save_coach_career_details` e si salva un riconoscimento alla
// volta, come nel mockup. Dopo ogni scrittura si invalida il profilo completo,
// così il conteggio dell hub e il Master Profile si aggiornano da soli.

export type CoachAwardInput = {
  achievement_type: CoachAchievementRecord["achievement_type"];
  club_id: string | null;
  club_name: string | null;
  competition_name: string;
  /** Titolo composto dai campi: non è digitato dall utente. */
  label: string;
  season_label: string;
  sort_order: number;
};

export function useSaveCoachAward(profileId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CoachAwardInput & { id?: string }) => {
      if (!profileId) {
        throw new Error("Profilo non disponibile.");
      }

      return upsertCoachAchievement({
        ...input,
        coach_profile_id: profileId,
        description: null,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: completeProfileQueryKey(profileId ?? ""),
      });
    },
  });
}

export function useDeleteCoachAward(profileId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (awardId: string) => deleteCoachAchievement(awardId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: completeProfileQueryKey(profileId ?? ""),
      });
    },
  });
}
