/**
 * Eliminazione di un contenuto dal punto di vista dell'app (HOM-04 §45–53, §70–76).
 *
 *  • un solo delete per volta e per contenuto: la guardia è un ref, non lo
 *    stato, perché due tap nello stesso istante vedrebbero entrambi `isPending`
 *    ancora falso (§45, §145);
 *  • niente delete ottimistico (§46, §163): la UI cambia solo dopo la risposta
 *    del server. Fallimento = il contenuto resta, il loading si chiude, il
 *    dialogo resta aperto (§69);
 *  • `deleted`, `already_deleted` e `unavailable` hanno la stessa conseguenza:
 *    il contenuto non c'è più (§75), quindi si toglie ovunque con
 *    `setQueryData` — senza refetch e senza perdere lo scroll (§105–107) — e
 *    si invalidano Salvati, Profilo e Cerca (§50–53);
 *  • permesso revocato (§70–72): messaggio e capability di gestione a falso
 *    subito in cache, così «Elimina» non resta finché non si riavvia l'app.
 */

import { useRef } from "react";
import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";

import { isInsightsKeyFor } from "../content-insights/insights-keys";
import { useToast } from "../../ui";
import {
  CONTENT_KIND_COPY,
  CONTENT_NO_LONGER_AVAILABLE,
  CONTENT_PERMISSION_LOST,
  NO_MANAGE_CAPABILITIES,
  contentAnalyticsProps,
  type ContentVisibleKind,
} from "./content-actions-presentation";
import {
  CONTENT_DELETE_INVALIDATIONS,
  patchContentCapabilities,
  removeContentFromFeed,
} from "./content-lifecycle-cache";
import { deleteContent, isContentPermissionError } from "./content-manage-service";
import type { ContentManageTarget } from "./content-routes";
import { trackFeed } from "./feed-analytics";
import { FEED_QK } from "./feed-keys";
import type { FeedPage, FeedPageParam, FeedPostItem, FeedScope } from "./feed-types";

type FeedData = InfiniteData<FeedPage, FeedPageParam>;

const SCOPES: readonly FeedScope[] = ["per_te", "seguiti"];

export type DeleteContentTarget = ContentManageTarget & {
  /** Chiave globale del Feed, `<content_type>:<uuid>`. */
  itemId: string;
  visibleKind: ContentVisibleKind;
};

/** `removed`: il contenuto non c'è più. `permission_denied`/`failed`: è rimasto. */
export type DeleteContentOutcome = "removed" | "permission_denied" | "failed";

export function useDeleteContent({ profileId }: { profileId: string }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const inFlight = useRef(new Set<string>());

  const mutation = useMutation({
    mutationFn: (target: DeleteContentTarget) => deleteContent(target.contentType, target.contentId),
  });

  const removeEverywhere = (target: DeleteContentTarget) => {
    for (const scope of SCOPES) {
      queryClient.setQueryData<FeedData>(FEED_QK.feed(scope, profileId), (data) =>
        removeContentFromFeed(data, target.itemId),
      );
    }
    // Dettaglio persona: `null` è lo stato «non disponibile», non una cache vuota.
    queryClient.setQueryData<FeedPostItem | null>(FEED_QK.postDetail(target.contentId), null);
    queryClient.removeQueries({
      queryKey: FEED_QK.interaction(target.contentType, target.contentId),
    });
    // HOM-05 §141: nessun KPI stale di un contenuto che non c'è più.
    queryClient.removeQueries({
      predicate: (query) =>
        isInsightsKeyFor(query.queryKey, target.contentType, target.contentId),
    });
    for (const queryKey of CONTENT_DELETE_INVALIDATIONS) {
      void queryClient.invalidateQueries({ queryKey: [...queryKey] });
    }
  };

  const revokeCapabilities = (target: DeleteContentTarget) => {
    for (const scope of SCOPES) {
      queryClient.setQueryData<FeedData>(FEED_QK.feed(scope, profileId), (data) =>
        patchContentCapabilities(data, target.itemId, NO_MANAGE_CAPABILITIES),
      );
    }
    queryClient.setQueryData<FeedPostItem | null>(FEED_QK.postDetail(target.contentId), (detail) =>
      detail && detail.id === target.itemId
        ? {
            ...detail,
            payload: {
              ...detail.payload,
              capabilities: { ...detail.payload.capabilities, ...NO_MANAGE_CAPABILITIES },
            },
          }
        : detail,
    );
  };

  const run = async (target: DeleteContentTarget): Promise<DeleteContentOutcome | null> => {
    // Un secondo tap mentre il primo è in volo non produce una seconda chiamata.
    if (inFlight.current.has(target.itemId)) {
      return null;
    }
    inFlight.current.add(target.itemId);

    const props = contentAnalyticsProps(target);
    trackFeed({ ...props, name: "delete_confirmed" });

    try {
      const { status } = await mutation.mutateAsync(target);
      trackFeed({ ...props, name: "delete_success" });
      removeEverywhere(target);
      showToast(
        status === "unavailable"
          ? { message: CONTENT_NO_LONGER_AVAILABLE }
          : { message: CONTENT_KIND_COPY[target.visibleKind].deleted, tone: "success" },
      );
      return "removed";
    } catch (error) {
      trackFeed({ ...props, name: "delete_failed" });
      if (isContentPermissionError(error)) {
        revokeCapabilities(target);
        showToast({ message: CONTENT_PERMISSION_LOST });
        return "permission_denied";
      }
      showToast({ message: CONTENT_KIND_COPY[target.visibleKind].deleteFailed });
      return "failed";
    } finally {
      inFlight.current.delete(target.itemId);
    }
  };

  return { deleteContent: run, isDeleting: mutation.isPending };
}
