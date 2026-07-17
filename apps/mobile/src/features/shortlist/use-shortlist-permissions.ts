import { useQuery } from "@tanstack/react-query";

import { useSession } from "../auth/use-session";
import { fetchMyShortlistPermissions } from "./shortlist-permissions-service";

/**
 * Resolves the caller's effective Shortlist / Scouting permissions. This is
 * the only source of truth for `club_id` in the Shortlist feature — the
 * session provider only populates `club_id` for `club_admin`, so non-owner
 * staff with grants must resolve their club through this RPC instead.
 */
export function useShortlistPermissions() {
  const { profile } = useSession();

  return useQuery({
    enabled: !!profile,
    queryFn: fetchMyShortlistPermissions,
    queryKey: ["shortlist-permissions", profile?.id ?? "anon"],
    staleTime: 5 * 60 * 1000,
  });
}
