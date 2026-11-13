/**
 * Dettagli e statistiche di un contenuto: tutto tranne il grafico (HOM-05 §27,
 * §125–128, §131–132, §137–138).
 *
 *  • cache per viewer + contenuto (§132), `staleTime` 60 s e `gcTime` 30 min: al
 *    ritorno dal contenuto originale la pagina è già lì e si aggiorna in
 *    background solo se serve (§27, §126). Nessuno spinner a schermo intero se
 *    c'è cache;
 *  • il 42501 non si riprova: è una risposta (permesso revocato), non un guasto;
 *  • permesso revocato (§137): `useInsightsPermissionGuard` toglie dalla cache
 *    dettaglio e trend di quel contenuto, così riaprire la pagina non mostra
 *    nemmeno per un frame i KPI di prima.
 */

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { isContentPermissionError } from "../feed/content-manage-service";
import type { FeedContentType } from "../feed/feed-types";
import { INSIGHTS_QK, isInsightsKeyFor } from "./insights-keys";
import { fetchContentInsights } from "./insights-service";

export const INSIGHTS_STALE_TIME_MS = 60_000;
export const INSIGHTS_GC_TIME_MS = 30 * 60_000;

export function useContentInsights({
  contentType,
  postId,
  viewerProfileId,
}: {
  contentType: FeedContentType | null;
  postId: string;
  viewerProfileId: string | null;
}) {
  const enabled = contentType !== null && postId.length > 0 && !!viewerProfileId;

  return useQuery({
    enabled,
    gcTime: INSIGHTS_GC_TIME_MS,
    queryFn: () => fetchContentInsights(contentType as FeedContentType, postId),
    queryKey: INSIGHTS_QK.detail(viewerProfileId ?? "", contentType ?? "profile_post", postId),
    retry: (failureCount, error) => !isContentPermissionError(error) && failureCount < 1,
    staleTime: INSIGHTS_STALE_TIME_MS,
  });
}

/**
 * §137–138: a permesso revocato i dati non restano accessibili. Toglie dalla
 * cache ogni query di insights del contenuto (dettaglio e trend, qualunque
 * metrica e periodo).
 */
export function useInsightsPermissionGuard({
  contentType,
  postId,
  revoked,
}: {
  contentType: FeedContentType | null;
  postId: string;
  revoked: boolean;
}) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!revoked || contentType === null) {
      return;
    }

    const forContent = (query: { queryKey: readonly unknown[] }) =>
      isInsightsKeyFor(query.queryKey, contentType, postId);

    // Le query osservate dalla schermata non si rimuovono qui: verrebbero
    // ricreate vuote e rilanciate (flicker "loading" e un nuovo 42501 a ogni
    // giro). Finché la pagina è aperta lo stato "revocato" ha già precedenza sui
    // dati (`resolveInsightsScreenState`); le altre (periodi/metriche non a
    // schermo) si tolgono subito, tutto il resto all'uscita.
    queryClient.removeQueries({
      predicate: (query) => forContent(query) && query.getObserversCount() === 0,
    });

    return () => {
      queryClient.removeQueries({ predicate: forContent });
    };
  }, [contentType, postId, queryClient, revoked]);
}
