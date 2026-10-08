/**
 * Salvataggio per sezione della Modifica profilo Procuratore (REV-PROF-16).
 *
 * Il profilo completo è già letto da `useCompleteProfileQuery`, la stessa
 * query del Master Profile e degli altri editor: riusarla è ciò che fa
 * apparire una modifica ovunque senza refetch a catena e senza una seconda
 * copia dei dati.
 *
 * Qui ci sono **due** salvataggi, non uno, e la ragione è importante:
 *
 *  - i moduli che toccano l'utente — foto e dati personali, bio e lingue,
 *    contatti pubblici — passano dal salvataggio condiviso degli altri ruoli,
 *    che scrive `profiles`, `profile_contacts` e `profile_private_contacts`.
 *    Per un Procuratore quel payload non contiene `agentProfile`, quindi
 *    `save_agent_profile_details` non viene nemmeno chiamata: la carriera e il
 *    portfolio restano intatti;
 *  - i moduli che toccano il ruolo — abilitazione, attività, mercati,
 *    opportunità — scrivono con una patch mirata su `agent_profiles`.
 *
 * La seconda via esiste proprio per non usare la prima. `save_agent_profile_details`
 * riscrive la riga intera **e** ricostruisce `agent_managed_player_entries` dal
 * payload: farci passare il salvataggio di due interruttori avrebbe voluto dire
 * rimandare indietro trenta colonne e l'intero portfolio a ogni modifica, con
 * una mutation che sovrascrive quello che non ha cambiato. La RPC resta di chi
 * quei dati li possiede davvero: l'onboarding.
 *
 * Entrambe le vie riscrivono la stessa cache, quindi hub, contatori e Master
 * Profile si aggiornano insieme.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import {
  fetchAgentLicenseNumber,
  getCompleteProfessionalProfile,
  saveAgentProfilePatch,
  type AgentProfilePatchInput,
  type CompleteProfessionalProfile,
} from "../profile-service";
import { useProfileSectionSave } from "../edit/profile-section-save";
import { completeProfileQueryKey } from "../edit/player-profile-edit-service";

export {
  completeProfileQueryKey,
  useCompleteProfileQuery,
} from "../edit/player-profile-edit-service";

/**
 * Salvataggio dei campi che vivono su `profiles` e sui contatti: anagrafica,
 * bio, lingue, recapiti. Identico a quello degli altri ruoli.
 */
export const useAgentSectionSave = useProfileSectionSave;

export function agentLicenseQueryKey(profileId: string | null) {
  return ["agent-license-number", profileId] as const;
}

/**
 * Numero di licenza del proprietario (REV-PROF-16).
 *
 * È una query a parte, non un campo del profilo completo: il numero vive in
 * una tabella owner-only perché `agent_profiles` è leggibile da chiunque sia
 * autenticato. Tenerlo fuori dalla lettura condivisa è ciò che garantisce
 * che non finisca in nessun payload pubblico — non il fatto che l'interfaccia
 * non lo mostri.
 */
export function useAgentLicenseQuery(
  profileId: string | null,
): UseQueryResult<string, Error> {
  return useQuery({
    enabled: Boolean(profileId),
    queryFn: () => fetchAgentLicenseNumber(profileId as string),
    queryKey: agentLicenseQueryKey(profileId),
  });
}

export type SaveAgentProfileVariables = {
  data: CompleteProfessionalProfile;
  patch: AgentProfilePatchInput;
};

/**
 * Patch mirata di `agent_profiles`: scrive soltanto le colonne nominate dal
 * modulo e rilegge il profilo, così la cache condivisa resta la sola fonte.
 */
export function useAgentProfilePatch(
  profileId: string | null,
): UseMutationResult<
  CompleteProfessionalProfile,
  Error,
  SaveAgentProfileVariables
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ data, patch }: SaveAgentProfileVariables) => {
      await saveAgentProfilePatch({ patch, profileId: data.profile.id });

      return getCompleteProfessionalProfile(data.profile.id);
    },
    onSuccess: (fresh, { patch }) => {
      queryClient.setQueryData(
        completeProfileQueryKey(profileId ?? fresh.profile.id),
        fresh,
      );

      if (patch.license_number !== undefined) {
        void queryClient.invalidateQueries({
          queryKey: agentLicenseQueryKey(profileId ?? fresh.profile.id),
        });
      }
    },
  });
}
