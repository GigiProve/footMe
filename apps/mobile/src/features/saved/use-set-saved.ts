/**
 * L'unica mutation di salvataggio dell'app (HOM-07 §94–§99, §130–§137, B2).
 *
 * Ogni superficie — Feed •••, bookmark Articolo/Video, dettaglio, Cerca,
 * profilo pubblico, Salvati — chiama questa e nessun'altra: scrive lo store
 * normalizzato in modo ottimistico (nessun modal, nessun reload della Home),
 * poi `set_saved`, e su errore torna allo stato confermato con il copy dei
 * §97–§98.
 *
 * Feedback: «Contenuto salvato» al salvataggio (§95), «Rimosso dai salvati»
 * alla rimozione (§96). Dal Saved Center la rimozione offre «Annulla»
 * (§118–§119): l'Annulla riscrive il salvataggio, non è un'altra azione, e
 * vale solo se nessuno ha toccato il target dopo la rimozione (`canUndo`).
 *
 * `invalidate` serve ai chiamanti che hanno cache proprie dello stesso target
 * (la tab Salvate di Posizioni): la lista dei Salvati e i contatori si
 * invalidano sempre, a meno di `keepLists`, usato dal Saved Center per non far
 * saltare la riga appena rimossa prima che l'utente possa annullare.
 */

import {
  useMutation,
  useQueryClient,
  type QueryKey,
  type UseMutationResult,
} from "@tanstack/react-query";

import { useToast } from "../../ui";
import { trackSaved, type SavedSurface } from "./saved-analytics";
import { beginSetSaved, setSavedTracked, type SavedTicket } from "./saved-commands";
import { SAVED_QK } from "./saved-keys";
import { saveFailureMessage, SAVED_CONFIRMATION, SAVED_COPY } from "./saved-copy";
import { getSavedEntry, getSavedEpoch, getSavedValue } from "./saved-store";
import type { SavedCategory, SavedTarget } from "./saved-types";

export type SetSavedInput = {
  target: SavedTarget;
  /** Lo stato voluto, non quello attuale. */
  saved: boolean;
  surface: SavedSurface;
  /** Altre cache dello stesso target da ricalcolare a fine scrittura. */
  invalidate?: readonly QueryKey[];
  /** Non invalidare le liste dei Salvati (Saved Center, §117). */
  keepLists?: boolean;
  /** Nessun toast di successo: il chiamante ha già il proprio feedback. */
  silent?: boolean;
  /** Rimozione dal Saved Center: toast con «Annulla» (§118) e analytics di categoria. */
  undoCategory?: SavedCategory;
};

/**
 * L'«Annulla» ripristina solo la rimozione che l'ha mostrato: se nel frattempo
 * il target è stato salvato di nuovo, ritoccato da un'altra superficie (numero
 * d'ordine diverso), ha una scrittura in volo o lo store è stato svuotato
 * (logout), non fa nulla invece di resuscitare uno stato superato.
 */
export function canUndo(ticket: SavedTicket): boolean {
  const entry = getSavedEntry(ticket.key);

  return (
    ticket.epoch === getSavedEpoch() &&
    entry !== undefined &&
    !entry.value &&
    entry.pending === 0 &&
    entry.seq === ticket.seq
  );
}

/** Interno: il biglietto dell'aggiornamento ottimistico, aperto al tap da `mutate`. */
type QueuedInput = SetSavedInput & { ticket: SavedTicket };

export function useSetSaved() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  // Annotato: l'«Annulla» richiama `mutate` dentro la definizione della mutation.
  const mutation: UseMutationResult<void, Error, QueuedInput> = useMutation({
    // RPC e gli eventi tentativo/successo/fallimento (§189); lo store è già stato scritto.
    mutationFn: (input: QueuedInput) =>
      setSavedTracked(input.target, input.saved, input.surface, input.ticket),
    onError: (_error, input) => {
      // `id`: più errori ravvicinati non accodano più snackbar.
      showToast({
        id: "saved-error",
        message: saveFailureMessage(input.target.type, input.saved),
      });
    },
    onSettled: (_data, _error, input) => {
      if (!input.keepLists) {
        void queryClient.invalidateQueries({ queryKey: SAVED_QK.lists });
      }
      void queryClient.invalidateQueries({ queryKey: SAVED_QK.counts });
      for (const key of input.invalidate ?? []) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    },
    onSuccess: (_data, input) => {
      if (input.undoCategory && !input.saved) {
        trackSaved({
          category: input.undoCategory,
          name: "saved_target_removed",
          targetType: input.target.type,
        });
      }

      if (input.silent) {
        return;
      }

      if (input.saved) {
        showToast({
          icon: "bookmark",
          message: SAVED_CONFIRMATION[input.target.type] ?? SAVED_COPY.saved,
          tone: "success",
        });
        return;
      }

      const category = input.undoCategory;
      showToast({
        action: category
          ? {
              label: SAVED_COPY.removedUndo,
              onPress: () => {
                if (!canUndo(input.ticket)) {
                  return;
                }
                trackSaved({
                  category,
                  name: "saved_remove_undo",
                  targetType: input.target.type,
                });
                mutate({ ...input, saved: true, undoCategory: undefined });
              },
            }
          : undefined,
        message: SAVED_COPY.removed,
      });
    },
  });

  /**
   * Lo store si aggiorna qui, nello stesso tick del tap (§94): una mutation
   * esegue `mutationFn` dopo alcuni microtask, e l'interfaccia non deve
   * aspettarli.
   */
  const mutate = (input: SetSavedInput) => {
    mutation.mutate({ ...input, ticket: beginSetSaved(input.target, input.saved) });
  };

  /**
   * Inverte lo stato corrente del target. `seed` è il valore che la superficie
   * ha dal proprio payload: lo store, se ne sa di più, vince (§133).
   */
  const toggle = (
    target: SavedTarget,
    seed: boolean | undefined,
    options: Omit<SetSavedInput, "target" | "saved">,
  ) => {
    mutate({ ...options, saved: !getSavedValue(target, seed), target });
  };

  return { isPending: mutation.isPending, mutate, toggle };
}
