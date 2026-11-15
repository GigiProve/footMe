/**
 * Ricerca dei destinatari del passo «Invia a» (HOM-09 §44–§57, §74, §222).
 *
 * Una sola lista (§46) servita da `search_share_recipients`: query vuota =
 * conversazioni recenti scrivibili, query ≥ 2 caratteri = ricerca. Cursore e
 * dedup per `recipient_key` (§74). Il debounce è lo stesso della ricerca già
 * esistente (`SEARCH_DEBOUNCE_MS`); durante la digitazione restano i risultati
 * precedenti invece di svuotare la lista a ogni tasto.
 *
 * Il testo cercato non lascia questo hook se non verso la RPC: gli analytics
 * ricevono solo la lunghezza (§264).
 */

import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";

import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from "../post-composer/use-mention-autocomplete";
import { SHARE_QK } from "./share-keys";
import { mergeRecipientPages, SHARE_SEARCH_MIN_LENGTH } from "./share-presentation";
import { fetchShareRecipients } from "./share-service";
import type { ShareRecipientsPage } from "./share-types";

export function useShareRecipients(input: { enabled: boolean; profileId: string; query: string }) {
  const debounced = useDebouncedValue(input.query.trim(), SEARCH_DEBOUNCE_MS);
  const effectiveQuery = debounced.length >= SHARE_SEARCH_MIN_LENGTH ? debounced : "";

  const query = useInfiniteQuery({
    enabled: input.enabled && !!input.profileId,
    getNextPageParam: (lastPage: ShareRecipientsPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: null as string | null,
    placeholderData: keepPreviousData,
    queryFn: ({ pageParam }) => fetchShareRecipients({ cursor: pageParam, query: effectiveQuery }),
    queryKey: SHARE_QK.recipients(input.profileId, effectiveQuery),
  });

  const items = mergeRecipientPages(query.data?.pages ?? []);

  return {
    effectiveQuery,
    hasNextPage: query.hasNextPage,
    isError: query.isError && items.length === 0,
    isFetchingNextPage: query.isFetchingNextPage,
    isLoading: query.isLoading,
    isNextPageError: query.isFetchNextPageError,
    items,
    loadMore: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) {
        void query.fetchNextPage();
      }
    },
    retry: () => void query.refetch(),
  };
}
