/**
 * Evidenza ed eliminazione dei contenuti Dirigente dentro Modifica profilo
 * (REV-PROF-11, voce "Media e contenuti").
 *
 * La persistenza non nasce qui: è `saveDirectorProfileMedia`, la stessa
 * funzione che usa il Master Profile. Quello che cambia è soltanto come si
 * aggiorna lo schermo dopo la scrittura — la cache condivisa di TanStack
 * invece del caricamento imperativo della tab Profilo — così hub, conteggio e
 * Master Profile si allineano senza refetch a catena.
 *
 * L'eliminazione rimuove anche il file dallo storage, ma solo **dopo** che il
 * profilo è stato riscritto: se la riga non si salva, il contenuto resta
 * intero invece di perdere il file e tenere il record.
 */
import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";

import type { DirectorMediaItemRecord } from "../director-media";
import { removeMediaFromStorage } from "../media-upload-service";
import {
  getCompleteProfessionalProfile,
  saveDirectorProfileMedia,
  type CompleteProfessionalProfile,
} from "../profile-service";
import { completeProfileQueryKey } from "../edit/player-profile-edit-service";

export type DirectorMediaAction =
  | { itemId: string; type: "delete" }
  | { itemId: string; type: "toggleFeatured" };

export type SaveDirectorMediaVariables = {
  action: DirectorMediaAction;
  data: CompleteProfessionalProfile;
};

function applyAction(
  items: readonly DirectorMediaItemRecord[],
  action: DirectorMediaAction,
): DirectorMediaItemRecord[] {
  if (action.type === "delete") {
    return items.filter((item) => item.id !== action.itemId);
  }

  return items.map((item) =>
    item.id === action.itemId
      ? { ...item, is_featured: !item.is_featured }
      : item,
  );
}

export function useDirectorMediaAction(
  profileId: string | null,
): UseMutationResult<
  CompleteProfessionalProfile,
  Error,
  SaveDirectorMediaVariables
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ action, data }: SaveDirectorMediaVariables) => {
      const directorProfile = data.directorProfile;

      if (!directorProfile) {
        throw new Error("Profilo Dirigente non disponibile.");
      }

      const removed =
        action.type === "delete"
          ? (directorProfile.media_items.find(
              (item) => item.id === action.itemId,
            ) ?? null)
          : null;

      await saveDirectorProfileMedia({
        directorProfile,
        mediaItems: applyAction(directorProfile.media_items, action),
        profileId: data.profile.id,
      });

      if (removed) {
        // Il file se ne va solo a riga salvata, e un fallimento qui non
        // rimette in piedi un contenuto che l'utente ha già visto sparire.
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
