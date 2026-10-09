/**
 * Rimozione del salvataggio dalla lista Salvate (DAS-REV-05 §19).
 *
 * Riusa la mutazione Saved globale (`toggleSavedAd`): non esiste una seconda
 * relazione di salvataggio e questa superficie non ne introduce una.
 *
 * Tre regole che è facile perdere:
 *
 *   · la rimozione **non** tocca la candidatura collegata: scrive solo
 *     `saved_ads`;
 *   · un unsave dallo storico non fa scendere il conteggio delle disponibili,
 *     perché quella posizione non vi contribuiva — qui si ottiene gratis,
 *     perché il conteggio arriva dal backend per gruppo;
 *   · un rollback non deve reinserire come disponibile una posizione nel
 *     frattempo chiusa: la riga torna dove stava e l'invalidazione lascia
 *     l'ultima parola allo stato canonico.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useToast } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { DASHBOARD_QK_PREFIXES } from "../../dashboard/dashboard-keys";
import { toggleSavedAd } from "../../recruiting/recruiting-service";
import { POSITIONS_QK } from "./positions-criteria";
import {
  removeAdFromPages,
  savedGroupQueryKey,
  type SavedGroup,
  type SavedPositionsPage,
} from "./saved-positions-service";

type InfinitePages = {
  pageParams: unknown[];
  pages: SavedPositionsPage[];
};

const GROUPS: SavedGroup[] = ["available", "unavailable"];

export function useUnsavePosition() {
  const { profile } = useSession();
  const profileId = profile?.id ?? null;
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async (adId: string) => {
      if (!profileId) {
        throw new Error("Sessione non disponibile.");
      }

      await toggleSavedAd(profileId, adId, false);
    },

    onMutate: async (adId: string) => {
      const keys = GROUPS.map((group) => savedGroupQueryKey(profileId, group));

      await Promise.all(
        keys.map((key) => queryClient.cancelQueries({ queryKey: key })),
      );

      const previous = keys.map(
        (key) => [key, queryClient.getQueryData<InfinitePages>(key)] as const,
      );

      for (const [key, data] of previous) {
        if (!data) {
          continue;
        }

        queryClient.setQueryData<InfinitePages>(key, {
          ...data,
          pages: removeAdFromPages(data.pages, adId),
        });
      }

      return { previous };
    },

    onError: (error, _adId, context) => {
      for (const [key, data] of context?.previous ?? []) {
        if (data) {
          queryClient.setQueryData(key, data);
        }
      }

      showToast({
        message:
          error instanceof Error
            ? error.message
            : "Impossibile aggiornare il salvataggio",
        tone: "neutral",
      });
    },

    onSuccess: () => {
      showToast({ message: "Rimosso dai Salvati", tone: "neutral" });
    },

    onSettled: () => {
      // §24: la stessa relazione Saved non può restare in cache incoerenti fra
      // Cerca, dettaglio e Dashboard. L'ultima parola è del backend, anche sul
      // gruppo di appartenenza.
      void queryClient.invalidateQueries({ queryKey: [POSITIONS_QK] });
      void queryClient.invalidateQueries({ queryKey: ["saved-items"] });
      void queryClient.invalidateQueries({ queryKey: ["saved-counts"] });

      for (const prefix of DASHBOARD_QK_PREFIXES) {
        void queryClient.invalidateQueries({ queryKey: [prefix] });
      }
    },
  });
}
