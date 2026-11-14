/**
 * Lista «Bozze e programmati», una query per tab (HOM-06.2 §137, §234–§239).
 *
 * `useInfiniteQuery` su `list_content_drafts`, chiave `publishingKeys.list(user,
 * tab)`: Bozze e Programmati si cachano separate (§234). I dati già noti restano
 * visibili durante il refetch e dopo un errore transitorio (§236, §238): lo
 * stato `isPending` (nessuna cache) è l'unico che chiede lo skeleton (§235).
 * La paginazione è a cursore dal server; Post e Articoli insieme (§292–§293).
 */

import { useInfiniteQuery } from "@tanstack/react-query";

import { publishingKeys } from "./publishing-keys";
import { listContentDrafts } from "./publishing-service";
import type { DraftListItem, DraftListPage, DraftsTab } from "./publishing-types";

const PAGE_SIZE = 20;

export function useDraftsList(userId: string, tab: DraftsTab) {
  const query = useInfiniteQuery({
    enabled: userId.length > 0,
    // Il cursore è opaco: lo restituisce il server, il client lo rimanda senza leggerlo.
    getNextPageParam: (lastPage: DraftListPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: null as unknown,
    queryFn: ({ pageParam }): Promise<DraftListPage> => listContentDrafts(tab, pageParam ?? null, PAGE_SIZE),
    queryKey: publishingKeys.list(userId, tab),
    staleTime: 15_000,
  });

  const items: DraftListItem[] = query.data?.pages.flatMap((page) => page.items) ?? [];

  return { items, query };
}
