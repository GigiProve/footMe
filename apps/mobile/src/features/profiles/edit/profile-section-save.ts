/**
 * Salvataggio per sezione dei moduli "Modifica profilo" (REV-PROF-05,
 * REV-PROF-08 §"Salvataggio e persistenza").
 *
 * Il profilo completo è già letto da `useCompleteProfileQuery`, la stessa
 * query del Master Profile: riusarla è ciò che fa apparire una modifica
 * ovunque senza refetch a catena e senza una seconda copia dei dati.
 *
 * Qui vivono le due trappole del salvataggio per sezione, e solo qui:
 *
 * 1. le RPC `save_*_career_details` **cancellano** le esperienze di carriera
 *    che non trovano nel payload. Ogni payload parte quindi dal profilo appena
 *    letto: una sezione che non c'entra nulla con la carriera la riscrive
 *    identica invece di azzerarla.
 * 2. `buildFullUpdatePayload` lascia di proposito `birth_date` a `null`,
 *    aspettandosi che sia il chiamante a reimpostarla. Una sezione che se ne
 *    dimentica cancella la data di nascita.
 *
 * `decorate` esiste per i campi che `ProfileFormState` non rappresenta (per
 * esempio il modulo preferito dell'Allenatore): si applicano sul payload già
 * costruito, senza allargare lo stato condiviso dei sette ruoli.
 */
import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";

import {
  buildFullUpdatePayload,
  buildInitialState,
  type ProfileFormState,
} from "../profile-edit-helpers";
import { parseBirthDateInput } from "../profile-form-utils";
import {
  getCompleteProfessionalProfile,
  updateCompleteProfessionalProfile,
  type CompleteProfessionalProfile,
  type CompleteProfessionalProfileUpdate,
} from "../profile-service";
import { completeProfileQueryKey } from "./player-profile-edit-service";

export function buildProfileSectionPayload(
  data: CompleteProfessionalProfile,
  patch: Partial<ProfileFormState>,
): CompleteProfessionalProfileUpdate {
  const merged: ProfileFormState = { ...buildInitialState(data), ...patch };
  const payload = buildFullUpdatePayload(data, merged);

  payload.profile.birth_date =
    parseBirthDateInput(merged.birthDate)?.isoValue ?? data.profile.birth_date;

  return payload;
}

export type SaveProfileSectionVariables<TPatch> = {
  data: CompleteProfessionalProfile;
  patch: TPatch;
};

export type ProfileSectionSaveOptions<TPatch> = {
  /**
   * Trasforma il patch della sezione nel patch dello stato condiviso, e può
   * ritoccare il payload per i campi che lo stato non rappresenta.
   */
  buildPayload: (
    data: CompleteProfessionalProfile,
    patch: TPatch,
  ) => CompleteProfessionalProfileUpdate;
};

/**
 * Salvataggio di una sezione. Rilegge il profilo e riscrive la cache
 * condivisa, così hub e Master Profile sono aggiornati senza reload manuale.
 */
export function useProfileSectionSave<TPatch = Partial<ProfileFormState>>(
  profileId: string | null,
  options?: ProfileSectionSaveOptions<TPatch>,
): UseMutationResult<
  CompleteProfessionalProfile,
  Error,
  SaveProfileSectionVariables<TPatch>
> {
  const queryClient = useQueryClient();
  const buildPayload =
    options?.buildPayload ??
    ((data: CompleteProfessionalProfile, patch: TPatch) =>
      buildProfileSectionPayload(data, patch as Partial<ProfileFormState>));

  return useMutation({
    mutationFn: async ({ data, patch }: SaveProfileSectionVariables<TPatch>) => {
      await updateCompleteProfessionalProfile(buildPayload(data, patch));

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
