import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";

import { useSession } from "../auth/use-session";
import { useToast } from "../../ui";
import {
  fetchSavedClubIds,
  fetchSavedTeamIds,
  saveClub,
  saveTeam,
  unsaveClub,
  unsaveTeam,
} from "./saved-service";

export type SavedEntityKind = "club" | "team";

function fetchSavedIds(
  entity: SavedEntityKind,
  ownerId: string,
  targetIds: string[],
): Promise<Set<string>> {
  return entity === "club"
    ? fetchSavedClubIds(ownerId, targetIds)
    : fetchSavedTeamIds(ownerId, targetIds);
}

/**
 * Batch save-state lookup for the pages of club/team ids loaded by an
 * infinite list (e.g. Cerca > Società). One query per page so results merge
 * incrementally as pages load, without a giant re-fetch on every page.
 * Mirrors `useSavedProfileFlags`.
 */
export function useSavedEntityFlags(entity: SavedEntityKind, pageIds: string[][]) {
  const { profile } = useSession();
  const ownerId = profile?.id ?? null;

  const results = useQueries({
    queries: pageIds.map((ids) => ({
      enabled: !!ownerId && ids.length > 0,
      queryFn: () => fetchSavedIds(entity, ownerId as string, ids),
      queryKey: ["saved-entity-flags", entity, ownerId, ids],
    })),
  });

  const savedIds = new Set<string>();
  for (const result of results) {
    if (result.data) {
      for (const id of result.data) {
        savedIds.add(id);
      }
    }
  }

  return { savedIds };
}

type ToggleSavedEntityInput = {
  targetId: string;
  saved: boolean;
};

const SAVED_TOAST_MESSAGE: Record<SavedEntityKind, string> = {
  club: "Società salvata",
  team: "Squadra salvata",
};

/**
 * Optimistically toggles the saved state of a club/team, updating every
 * cached `["saved-entity-flags", entity, ownerId, ...]` page in place. Never
 * invalidates `["search-clubs"]` — the search list itself is untouched by
 * save state.
 */
export function useToggleSavedEntity(entity: SavedEntityKind) {
  const { profile } = useSession();
  const ownerId = profile?.id ?? null;
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async ({ targetId, saved }: ToggleSavedEntityInput) => {
      if (!ownerId) {
        throw new Error("Sessione non disponibile.");
      }

      if (entity === "club") {
        if (saved) {
          await unsaveClub(ownerId, targetId);
        } else {
          await saveClub(ownerId, targetId);
        }
      } else {
        if (saved) {
          await unsaveTeam(ownerId, targetId);
        } else {
          await saveTeam(ownerId, targetId);
        }
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
            : "Impossibile aggiornare l'elemento salvato",
        tone: "neutral",
      });
    },
    onMutate: async ({ targetId, saved }: ToggleSavedEntityInput) => {
      await queryClient.cancelQueries({
        queryKey: ["saved-entity-flags", entity, ownerId],
      });

      const previous = queryClient.getQueriesData<Set<string>>({
        queryKey: ["saved-entity-flags", entity, ownerId],
      });

      for (const [queryKey, data] of previous) {
        const nextSet = new Set(data ?? []);
        if (saved) {
          nextSet.delete(targetId);
        } else {
          nextSet.add(targetId);
        }
        queryClient.setQueryData(queryKey, nextSet);
      }

      return { previous };
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-items"] });
      queryClient.invalidateQueries({ queryKey: ["saved-counts"] });
    },
    onSuccess: (_data, { saved }) => {
      if (saved) {
        showToast({ message: "Rimosso dai Salvati", tone: "neutral" });
      } else {
        showToast({
          message: SAVED_TOAST_MESSAGE[entity],
          tone: "success",
          icon: "bookmark",
        });
      }
    },
  });
}
