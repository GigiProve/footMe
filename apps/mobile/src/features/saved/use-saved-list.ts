/**
 * Una lista del Saved Center, una categoria per query (HOM-07 §160).
 *
 * Paginazione keyset per `saved_at desc` (§120–§121): il cursore lo decide il
 * server, il client non ordina né ricostruisce nulla. Una query per categoria
 * evita di mescolare dati e paginazioni quando si cambia tab, e il Back torna
 * alla stessa lista (§115).
 *
 * Un errore temporaneo non cancella ciò che è già in cache (§159): React Query
 * conserva `data` anche quando il refetch fallisce, e la schermata mostra
 * l'errore a tutta pagina solo se non c'è niente da mostrare.
 */

import { useInfiniteQuery } from "@tanstack/react-query";

import { useSession } from "../auth/use-session";
import { SAVED_QK } from "./saved-keys";
import { fetchSavedPage } from "./saved-service";
import type { SavedCategory, SavedCursor, SavedPage } from "./saved-types";

export function useSavedList(category: SavedCategory) {
  const { profile } = useSession();
  const ownerId = profile?.id ?? null;

  return useInfiniteQuery({
    enabled: !!ownerId,
    getNextPageParam: (lastPage: SavedPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: null as SavedCursor | null,
    queryFn: ({ pageParam }) => fetchSavedPage(category, pageParam),
    queryKey: SAVED_QK.list(category, ownerId),
  });
}
