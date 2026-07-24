import { useQueries } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";

import { fetchShortlistedProfileIds } from "./shortlist-service";
import { useShortlistPermissions } from "./use-shortlist-permissions";
import type { MyShortlistPermissions } from "./shortlist-permissions-service";

/**
 * Batch shortlist-membership lookup for the pages of profile ids loaded by
 * an infinite list (e.g. Cerca > Profili). Gated on the caller's Shortlist
 * permissions — only club users with `can_view` and a resolved `club_id`
 * ever query membership.
 */
export function useShortlistMembershipFlags(pageIds: string[][]) {
  const { data: permissions } = useShortlistPermissions();
  const clubId = permissions?.can_view ? (permissions.club_id ?? null) : null;
  const enabled = !!clubId;

  const results = useQueries({
    queries: pageIds.map((ids) => ({
      enabled: enabled && ids.length > 0,
      queryFn: () => fetchShortlistedProfileIds(clubId as string, ids),
      queryKey: ["shortlist-membership-flags", clubId, ids],
    })),
  });

  const shortlistedIds = new Set<string>();
  for (const result of results) {
    if (result.data) {
      for (const id of result.data) {
        shortlistedIds.add(id);
      }
    }
  }

  return {
    clubId,
    enabled,
    permissions: (permissions ?? null) as MyShortlistPermissions | null,
    shortlistedIds,
  };
}

/**
 * Invalidates cached shortlist-membership pages for a club. Call after
 * `AddToShortlistFlow` closes so the affected row(s) reflect the new state.
 */
export function invalidateShortlistMembership(
  queryClient: QueryClient,
  clubId: string,
) {
  queryClient.invalidateQueries({
    queryKey: ["shortlist-membership-flags", clubId],
  });
}
