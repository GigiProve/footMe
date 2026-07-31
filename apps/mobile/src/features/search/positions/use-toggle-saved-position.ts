import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";

import { useToast } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { toggleSavedAd } from "../../recruiting/recruiting-service";
import type { ForYouPositions, PositionSearchPage } from "../search-service";
import type { PositionSearchRow } from "../search-types";
import { POSITIONS_QK } from "./positions-criteria";

type ToggleInput = {
  adId: string;
  /** The row's CURRENT saved state; the tap flips it. */
  saved: boolean;
};

function flipRows(
  rows: PositionSearchRow[],
  adId: string,
  nextSaved: boolean,
): PositionSearchRow[] {
  return rows.map((row) =>
    row.ad_id === adId ? { ...row, is_saved: nextSaved } : row,
  );
}

/** Flip is_saved in place across both list shapes (infinite pages + for-you). */
function applyToData(data: unknown, adId: string, nextSaved: boolean): unknown {
  if (!data || typeof data !== "object") {
    return data;
  }

  if (Array.isArray((data as { pages?: unknown }).pages)) {
    const infinite = data as { pages: PositionSearchPage[]; pageParams: unknown[] };
    return {
      ...infinite,
      pages: infinite.pages.map((page) => ({
        ...page,
        rows: flipRows(page.rows, adId, nextSaved),
      })),
    };
  }

  if ("primary" in data || "suggestions" in data) {
    const forYou = data as ForYouPositions;
    return {
      primary: flipRows(forYou.primary, adId, nextSaved),
      suggestions: flipRows(forYou.suggestions, adId, nextSaved),
    };
  }

  return data;
}

/**
 * Instant, non-interrupting bookmark toggle for position previews. Optimistically
 * updates every cached `["positions", ...]` list in place (no modal, no refetch
 * of the visible list) and syncs the Salvati counters on settle.
 */
export function useToggleSavedPosition() {
  const { profile } = useSession();
  const ownerId = profile?.id ?? null;
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async ({ adId, saved }: ToggleInput) => {
      if (!ownerId) {
        throw new Error("Sessione non disponibile.");
      }
      await toggleSavedAd(ownerId, adId, !saved);
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        for (const [key, data] of context.previous) {
          queryClient.setQueryData(key, data);
        }
      }
      showToast({
        message:
          error instanceof Error
            ? error.message
            : "Impossibile aggiornare il salvataggio",
        tone: "neutral",
      });
    },
    onMutate: async ({ adId, saved }: ToggleInput) => {
      await queryClient.cancelQueries({ queryKey: [POSITIONS_QK] });
      const previous = queryClient.getQueriesData({ queryKey: [POSITIONS_QK] }) as [
        QueryKey,
        unknown,
      ][];
      const nextSaved = !saved;
      for (const [key, data] of previous) {
        queryClient.setQueryData(key, applyToData(data, adId, nextSaved));
      }
      return { previous };
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-items"] });
      queryClient.invalidateQueries({ queryKey: ["saved-counts"] });
      // The Salvate tab drops unsaved rows on refetch.
      queryClient.invalidateQueries({ queryKey: [POSITIONS_QK, "saved"] });
    },
    onSuccess: (_data, { saved }) => {
      if (saved) {
        showToast({ message: "Rimosso dai Salvati", tone: "neutral" });
      } else {
        showToast({ message: "Posizione salvata", tone: "success", icon: "bookmark" });
      }
    },
  });
}
