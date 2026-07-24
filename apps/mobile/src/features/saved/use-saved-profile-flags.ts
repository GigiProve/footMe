import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";

import { useSession } from "../auth/use-session";
import { useToast } from "../../ui";
import { fetchSavedProfileIds, saveProfile, unsaveProfile } from "./saved-service";

/**
 * Batch save-state lookup for the pages of profile ids loaded by an infinite
 * list (e.g. Cerca > Profili). One query per page so results merge
 * incrementally as pages load, without a giant re-fetch on every page.
 */
export function useSavedProfileFlags(pageIds: string[][]) {
  const { profile } = useSession();
  const ownerId = profile?.id ?? null;

  const results = useQueries({
    queries: pageIds.map((ids) => ({
      enabled: !!ownerId && ids.length > 0,
      queryFn: () => fetchSavedProfileIds(ownerId as string, ids),
      queryKey: ["saved-profile-flags", ownerId, ids],
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

type ToggleSavedProfileInput = {
  targetId: string;
  saved: boolean;
};

/**
 * Optimistically toggles the saved state of a profile, updating every cached
 * `["saved-profile-flags", ownerId, ...]` page in place. Never invalidates
 * `["search-profiles"]` — the search list itself is untouched by save state.
 */
export function useToggleSavedProfile() {
  const { profile } = useSession();
  const ownerId = profile?.id ?? null;
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async ({ targetId, saved }: ToggleSavedProfileInput) => {
      if (!ownerId) {
        throw new Error("Sessione non disponibile.");
      }
      if (saved) {
        await unsaveProfile(ownerId, targetId);
      } else {
        await saveProfile(ownerId, targetId);
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
            : "Impossibile aggiornare il profilo salvato",
        tone: "neutral",
      });
    },
    onMutate: async ({ targetId, saved }: ToggleSavedProfileInput) => {
      await queryClient.cancelQueries({
        queryKey: ["saved-profile-flags", ownerId],
      });

      const previous = queryClient.getQueriesData<Set<string>>({
        queryKey: ["saved-profile-flags", ownerId],
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
        showToast({ message: "Profilo salvato", tone: "success", icon: "bookmark" });
      }
    },
  });
}
