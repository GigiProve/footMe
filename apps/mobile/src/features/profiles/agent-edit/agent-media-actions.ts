/**
 * Eliminazione dei contenuti Procuratore dentro Modifica profilo
 * (REV-PROF-16, voce "Media e contenuti").
 *
 * La persistenza non nasce qui: è `saveAgentProfileMedia`, la stessa funzione
 * che usa il Master Profile. Quello che cambia è soltanto come si aggiorna lo
 * schermo dopo la scrittura — la cache condivisa di TanStack invece del
 * caricamento imperativo della tab Profilo — così hub, conteggio e Master
 * Profile si allineano senza refetch a catena.
 *
 * L'eliminazione rimuove anche il file dallo storage, ma solo **dopo** che il
 * profilo è stato riscritto: se la riga non si salva, il contenuto resta
 * intero invece di perdere il file e tenere il record.
 *
 * Non c'è un'azione "metti in evidenza": i contenuti del Procuratore non
 * hanno ancora un'evidenza persistita (REV-PROF-13), e inventarla qui avrebbe
 * creato uno stato che il Master Profile non sa leggere.
 */
import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";

import { removeMediaFromStorage } from "../media-upload-service";
import {
  getCompleteProfessionalProfile,
  saveAgentProfileMedia,
  type CompleteProfessionalProfile,
} from "../profile-service";
import { completeProfileQueryKey } from "../edit/player-profile-edit-service";

export type DeleteAgentMediaVariables = {
  data: CompleteProfessionalProfile;
  itemId: string;
};

export function useDeleteAgentMedia(
  profileId: string | null,
): UseMutationResult<
  CompleteProfessionalProfile,
  Error,
  DeleteAgentMediaVariables
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ data, itemId }: DeleteAgentMediaVariables) => {
      const agentProfile = data.agentProfile;

      if (!agentProfile) {
        throw new Error("Profilo Procuratore non disponibile.");
      }

      const removed =
        agentProfile.media_items.find((item) => item.id === itemId) ?? null;

      await saveAgentProfileMedia({
        agentProfile,
        mediaItems: agentProfile.media_items.filter(
          (item) => item.id !== itemId,
        ),
        profileId: data.profile.id,
      });

      if (removed) {
        // Il file se ne va solo a riga salvata, e un fallimento qui non
        // rimette in piedi un contenuto che l'utente ha gia visto sparire.
        await Promise.allSettled([removeMediaFromStorage(removed.url)]);
      }

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
