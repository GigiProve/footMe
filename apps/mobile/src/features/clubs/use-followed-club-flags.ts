import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";

import { useSession } from "../auth/use-session";
import { useToast } from "../../ui";
import { invalidateFollowQueries } from "../following/invalidate-follow-queries";
import { fetchFollowedClubIds, followClub, unfollowClub } from "./club-service";

/**
 * Batch follow-state lookup for the pages of club ids loaded by an infinite
 * list (e.g. Cerca > Società). One query per page so results merge
 * incrementally as pages load, without a giant re-fetch on every page.
 * Mirrors `useSavedProfileFlags`.
 */
export function useFollowedClubFlags(pageIds: string[][]) {
  const { profile } = useSession();
  const profileId = profile?.id ?? null;

  const results = useQueries({
    queries: pageIds.map((ids) => ({
      enabled: !!profileId && ids.length > 0,
      queryFn: () => fetchFollowedClubIds(profileId as string, ids),
      queryKey: ["followed-club-flags", profileId, ids],
    })),
  });

  const followedIds = new Set<string>();
  for (const result of results) {
    if (result.data) {
      for (const id of result.data) {
        followedIds.add(id);
      }
    }
  }

  return { followedIds };
}

type ToggleFollowClubInput = {
  targetId: string;
  followed: boolean;
};

/**
 * Optimistically toggles the follow state of a club, updating every cached
 * `["followed-club-flags", profileId, ...]` page in place. On settle it runs
 * the shared Follow invalidation (`invalidateFollowQueries`, HOM-15 §179), the
 * same list every Follow surface uses — `search-*` included.
 */
export function useToggleFollowClub() {
  const { profile } = useSession();
  const profileId = profile?.id ?? null;
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async ({ targetId, followed }: ToggleFollowClubInput) => {
      if (!profileId) {
        throw new Error("Sessione non disponibile.");
      }
      if (followed) {
        await unfollowClub(profileId, targetId);
      } else {
        await followClub(profileId, targetId);
      }
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        for (const [queryKey, data] of context.previous) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      showToast({
        message:
          error instanceof Error
            ? error.message
            : "Impossibile aggiornare il follow",
        tone: "neutral",
      });
    },
    onMutate: async ({ targetId, followed }: ToggleFollowClubInput) => {
      await queryClient.cancelQueries({
        queryKey: ["followed-club-flags", profileId],
      });

      const previous = queryClient.getQueriesData<Set<string>>({
        queryKey: ["followed-club-flags", profileId],
      });

      for (const [queryKey, data] of previous) {
        const nextSet = new Set(data ?? []);
        if (followed) {
          nextSet.delete(targetId);
        } else {
          nextSet.add(targetId);
        }
        queryClient.setQueryData(queryKey, nextSet);
      }

      return { previous };
    },
    onSettled: (_data, error, { targetId, followed }) => {
      // HOM-15 §179: la lista unica del Follow; il Feed si ritocca solo a server confermato.
      invalidateFollowQueries(
        queryClient,
        profileId ?? "",
        error ? undefined : { following: !followed, source: { id: targetId, kind: "club" } },
      );
    },
    onSuccess: (_data, { followed }) => {
      if (followed) {
        showToast({ message: "Non segui più questa società", tone: "neutral" });
      } else {
        showToast({
          message: "Ora segui questa società",
          tone: "success",
          icon: "checkmark-circle",
        });
      }
    },
  });
}
