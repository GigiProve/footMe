import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";

import {
  buildFullUpdatePayload,
  buildInitialState,
  type ProfileFormState,
} from "../profile-edit-helpers";
import {
  getCompleteProfessionalProfile,
  updateCompleteProfessionalProfile,
  type CompleteProfessionalProfile,
  type CompleteProfessionalProfileUpdate,
  type PlayerPalmaresInput,
} from "../profile-service";
import { parseBirthDateInput } from "../profile-form-utils";

/**
 * Chiave unica del profilo completo. Il Master Profile e ogni sezione
 * dell'editor leggono da qui, quindi un salvataggio si vede immediatamente
 * ovunque senza refetch a catena (§P, §W).
 */
export function completeProfileQueryKey(profileId: string) {
  return ["complete-profile", profileId] as const;
}

export function useCompleteProfileQuery(profileId: string | null) {
  return useQuery({
    enabled: Boolean(profileId),
    queryFn: () => getCompleteProfessionalProfile(profileId as string),
    queryKey: completeProfileQueryKey(profileId ?? ""),
  });
}

export type PlayerSectionPatch = Partial<ProfileFormState> & {
  /**
   * Presente solo nella sezione Palmarès. `undefined` lascia i riconoscimenti
   * come sono: `updateCompleteProfessionalProfile` tocca la tabella solo
   * quando il campo è definito.
   */
  playerPalmares?: PlayerPalmaresInput[];
};

/**
 * Costruisce il payload di UNA sezione a partire dal profilo appena letto.
 *
 * Due trappole vivono qui, e solo qui:
 *
 * 1. `save_player_profile_details` **cancella** le esperienze di carriera che
 *    non trova in `p_career_entries`. Partire sempre da `buildInitialState`
 *    garantisce che una sezione che non c'entra nulla con la carriera la
 *    riscriva identica invece di azzerarla.
 * 2. `buildFullUpdatePayload` lascia di proposito `birth_date` a `null`
 *    aspettandosi che sia il chiamante a reimpostarla. Una sezione che se ne
 *    dimentica cancella la data di nascita.
 */
export function buildPlayerSectionPayload(
  data: CompleteProfessionalProfile,
  patch: PlayerSectionPatch,
): CompleteProfessionalProfileUpdate {
  const { playerPalmares, ...formPatch } = patch;
  const merged: ProfileFormState = { ...buildInitialState(data), ...formPatch };
  const payload = buildFullUpdatePayload(data, merged);

  payload.profile.birth_date =
    parseBirthDateInput(merged.birthDate)?.isoValue ?? data.profile.birth_date;

  if (playerPalmares !== undefined) {
    payload.playerPalmares = playerPalmares;
  }

  return payload;
}

export type SavePlayerSectionVariables = {
  data: CompleteProfessionalProfile;
  patch: PlayerSectionPatch;
};

/**
 * Salvataggio di una sezione. Rilegge il profilo e riscrive la cache condivisa,
 * così hub e Master Profile sono aggiornati senza reload manuale (§P).
 */
export function usePlayerSectionSave(
  profileId: string | null,
): UseMutationResult<
  CompleteProfessionalProfile,
  Error,
  SavePlayerSectionVariables
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ data, patch }: SavePlayerSectionVariables) => {
      await updateCompleteProfessionalProfile(
        buildPlayerSectionPayload(data, patch),
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
