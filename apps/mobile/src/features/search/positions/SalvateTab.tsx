import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";

import { useSession } from "../../auth/use-session";
import { SEARCH_PAGE_SIZE, searchPositionsPage } from "../search-service";
import { EmptyState } from "../../../ui";
import { savedQueryKey } from "./positions-criteria";
import { PositionsList } from "./PositionsList";

export function SalvateTab() {
  const { profile } = useSession();
  const profileId = profile?.id ?? null;

  const query = useInfiniteQuery({
    enabled: !!profileId,
    queryKey: savedQueryKey(profileId),
    queryFn: ({ pageParam }) =>
      searchPositionsPage({ savedOnly: true, page: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.rows.length === SEARCH_PAGE_SIZE ? allPages.length : undefined,
    placeholderData: keepPreviousData,
  });

  const items = query.data?.pages.flatMap((page) => page.rows) ?? [];

  return (
    <PositionsList
      isFetchingNextPage={query.isFetchingNextPage}
      isLoading={query.isLoading}
      items={items}
      ListEmptyComponent={
        <EmptyState
          description="Salva le opportunità che vuoi rivedere più avanti. Tocca il bookmark nelle anteprime delle posizioni."
          icon="bookmark-outline"
          title="Nessuna posizione salvata"
        />
      }
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage) {
          query.fetchNextPage();
        }
      }}
    />
  );
}
