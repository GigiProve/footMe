/**
 * Pool paginato di una lista Shortlist, POSITION o CUSTOM (DAS-REV-25 §13,
 * §14, §24; DAS-REV-27 §9, §15).
 *
 * Estratto da `PositionShortlistScreen` quando la 27 ha chiesto lo stesso
 * pool per le liste personalizzate: «Righe profili, filtri e dettaglio entry
 * condivisi con 25». Un solo posto per la query, la chiave di cache e
 * l'avanzamento verso la entry da raggiungere — due copie avrebbero potuto
 * divergere nei cursori o nei filtri.
 */
import { useEffect } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";

import { STALE_MS } from "../cache/freshness-policy";
import { SHORTLIST_QK } from "./shortlist-keys";
import { filtersKey } from "./shortlist-presentation";
import { fetchShortlistPoolPage } from "./shortlist-service";
import {
  ShortlistError,
  type ShortlistFilters,
  type ShortlistPoolPage,
} from "./shortlist-types";

export function useShortlistPool({
  actorId,
  filters,
  focusEntryId,
  listId,
}: {
  actorId: string;
  filters: ShortlistFilters;
  focusEntryId: string | null;
  listId: string | null;
}) {
  const appliedKey = filtersKey(filters);

  /**
   * §14: paginazione server-side con cursore. La chiave di cache porta i
   * filtri **normalizzati**, quindi due selezioni equivalenti condividono
   * una pagina sola; e «Dopo applicazione azzera il cursore della lista»
   * viene gratis, perché cambiando chiave cambia la query.
   */
  const poolQuery = useInfiniteQuery<
    ShortlistPoolPage,
    Error,
    { pageParams: (string | null)[]; pages: ShortlistPoolPage[] },
    readonly unknown[],
    string | null
  >({
    enabled: !!listId,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null,
    queryFn: ({ pageParam }) =>
      fetchShortlistPoolPage(listId as string, filters, pageParam),
    queryKey: SHORTLIST_QK.pool(actorId, listId ?? "", appliedKey),
    retry: (failureCount, error) =>
      !(error instanceof ShortlistError && error.kind !== "network") &&
      failureCount < 1,
    staleTime: STALE_MS.operational,
  });

  const pages = poolQuery.data?.pages ?? [];
  const head = pages[0] ?? null;
  const rows = pages.flatMap((page) => page.rows);

  /**
   * §24: «Raggiungere la entry tramite cursore/ancora autorizzata o lookup
   * paginato compatibile: non scaricare l'intera lista e non alterare
   * l'ordinamento.» Si avanza di una pagina per volta finché la persona non
   * compare o le pagine finiscono.
   */
  const focusReached =
    !focusEntryId || rows.some((row) => row.entryId === focusEntryId);

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = poolQuery;

  useEffect(() => {
    if (!focusReached && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [fetchNextPage, focusReached, hasNextPage, isFetchingNextPage]);

  return { appliedKey, head, poolQuery, rows };
}
