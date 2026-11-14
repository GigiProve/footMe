/**
 * Il bookmark del dettaglio contenuto (HOM-07 §91–§93, §133, mockup 5).
 *
 * Il dettaglio `/content/[type]/[id]` non riceve il payload del Feed: legge lo
 * stato Salvato dal server, lo semina nello store normalizzato e da lì in poi
 * lo store è la verità — salvato nel dettaglio, ritorno al Feed: il segnalibro
 * è già pieno, senza patchare nessuna pagina.
 *
 * Senza il dato (`can_save` non vero o stato non arrivato) il segnalibro non
 * compare: meglio nessun controllo di uno che mente sullo stato.
 */

import { useQuery } from "@tanstack/react-query";

import type { FeedContentType } from "../feed/feed-types";
import { SAVED_QK } from "./saved-keys";
import { fetchContentSaveState } from "./saved-service";
import { contentSavedTarget, useIsSaved } from "./saved-store";
import { useSetSaved } from "./use-set-saved";

export function useContentSaved(
  contentType: FeedContentType,
  postId: string,
  opts: { enabled: boolean },
) {
  const query = useQuery({
    enabled: opts.enabled && postId.length > 0,
    queryFn: () => fetchContentSaveState(contentType, postId),
    queryKey: SAVED_QK.contentState(contentType, postId),
  });
  const setSaved = useSetSaved();
  const state = query.data ?? null;
  const target = contentSavedTarget(contentType, postId);
  const isSaved = useIsSaved(state ? target : null, state?.isSaved, state?.fetchedAt ?? 0);

  return {
    canSave: state?.canSave === true,
    isSaved,
    toggle: () => {
      if (!state?.canSave) {
        return;
      }
      setSaved.mutate({ saved: !isSaved, surface: "content_detail", target });
    },
  };
}
