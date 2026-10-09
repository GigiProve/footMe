import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useToast } from "../../../ui";
import { toggleSavedAd } from "../../recruiting/recruiting-service";
import { DASHBOARD_QK } from "../dashboard-keys";
import type { PersonalSavedPositionsData } from "../adapters/personal-adapter";

/**
 * Bookmark della preview "Posizioni salvate" (DAS-REV-03 §10, §18).
 *
 * Riusa `toggleSavedAd`, cioè il Saved globale del progetto: §10 chiede di
 * riutilizzare feedback, optimistic update e rollback già disponibili, non di
 * costruire un secondo sistema di salvataggio per la Dashboard.
 *
 * Tre cose che l'implementazione deve garantire e che è facile perdere:
 *
 *   · la rimozione **non** elimina la risorsa né la candidatura (§10): tocca
 *     solo `saved_ads`, cioè l'interesse personale;
 *   · un errore ripristina lo stato coerente, non uno stato inventato: la
 *     riga torna dov'era, nella posizione in cui era;
 *   · dopo una mutazione confermata il segnale temporale va ricalcolato
 *     (§18), perché una posizione non più salvata non può restare promossa.
 *
 * DAS-REV-05 §19 aggiunge una regola al rollback ottimistico: la row esce
 * dalla preview **e** il conteggio delle disponibili scende, perché quella
 * posizione contribuiva al conteggio. Le due cose devono muoversi insieme,
 * altrimenti il riepilogo contraddice la lista fino al prossimo refetch.
 */
export function useToggleDashboardSavedAd(input: {
  actorId: string;
  identityId: string;
}) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const queryKey = DASHBOARD_QK.module(
    input.actorId,
    input.identityId,
    "personal_saved_positions",
  );

  return useMutation({
    mutationFn: ({ adId, isSaved }: { adId: string; isSaved: boolean }) => {
      if (!input.actorId) {
        throw new Error("Sessione non disponibile.");
      }

      return toggleSavedAd(input.actorId, adId, !isSaved);
    },

    onMutate: async ({ adId }) => {
      await queryClient.cancelQueries({ queryKey });

      const previous =
        queryClient.getQueryData<PersonalSavedPositionsData>(queryKey);

      if (previous) {
        const removed = previous.preview.some((item) => item.adId === adId);

        queryClient.setQueryData<PersonalSavedPositionsData>(queryKey, {
          ...previous,
          // §19: la risorsa rimossa non contribuisce più al conteggio delle
          // disponibili. Un unsave **dallo storico** non lo tocca, perché
          // quella posizione non vi contribuiva: qui si decrementa solo se la
          // row era davvero fra le disponibili.
          availableCount: removed
            ? Math.max(0, previous.availableCount - 1)
            : previous.availableCount,
          preview: previous.preview.filter((item) => item.adId !== adId),
          // L'aggiornamento informativo riguarda la disponibilità, non il
          // bookmark: senza la risorsa salvata non ha più destinazione (§14).
          recentUpdates: previous.recentUpdates.filter(
            (update) => update.adId !== adId,
          ),
        });
      }

      return { previous };
    },

    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }

      showToast({
        message:
          error instanceof Error
            ? error.message
            : "Impossibile aggiornare l'elemento salvato",
        tone: "neutral",
      });
    },

    onSuccess: () => {
      showToast({ message: "Rimosso dai Salvati", tone: "neutral" });
    },

    onSettled: () => {
      // Il conteggio del riepilogo e i segnali di scadenza vivono nell'altro
      // provider: senza questa invalidazione il reminder di una posizione
      // appena rimossa resterebbe a schermo (§18).
      void queryClient.invalidateQueries({
        queryKey: DASHBOARD_QK.module(
          input.actorId,
          input.identityId,
          "personal",
        ),
      });
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey: ["saved-items"] });
      void queryClient.invalidateQueries({ queryKey: ["saved-counts"] });
    },
  });
}
