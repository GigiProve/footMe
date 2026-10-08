/**
 * Paginazione della tab Media del Tifoso (REV-PROF-19, Screen 4).
 *
 * Estratto da `FanProfileView` perché REV-PROF-20 monta la stessa griglia
 * dentro la voce "Media e contenuti" dell'hub Modifica profilo: la logica di
 * cursore, dedup e stato d'errore è una sola, e due copie divergono.
 *
 * Il cursore è doppio — contenuti nuovi e bacheca storica hanno offset
 * indipendenti — e il dedup per id resta necessario: pubblicare qualcosa
 * durante lo scroll può far ricomparire la coda della pagina precedente.
 */
import { useCallback, useEffect, useState } from "react";

import type { MediaContentItem } from "../career/MediaTabContent";
import { dedupeFanContentById } from "./fan-master-profile";
import {
  FAN_MEDIA_INITIAL_CURSOR,
  fetchFanMediaPage,
  type FanMediaCursor,
} from "./fan-media-tab-service";

const LOAD_ERROR = "Non è stato possibile caricare i contenuti. Riprova.";

export type FanMediaFeed = {
  errorMessage: string | null;
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  items: MediaContentItem[];
  loadMore: () => void;
  reload: () => void;
};

export function useFanMediaFeed({
  onLoadFailed,
  profileId,
  viewerProfileId,
}: {
  /** Traccia l'errore di caricamento con la superficie del chiamante. */
  onLoadFailed?: () => void;
  profileId: string;
  viewerProfileId: string | null | undefined;
}): FanMediaFeed {
  const [items, setItems] = useState<MediaContentItem[]>([]);
  const [cursor, setCursor] = useState<FanMediaCursor>(FAN_MEDIA_INITIAL_CURSOR);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const page = await fetchFanMediaPage(
        profileId,
        viewerProfileId,
        FAN_MEDIA_INITIAL_CURSOR,
      );
      setItems(page.items);
      setCursor(page.cursor);
      setHasMore(page.hasMore);
    } catch {
      // Una griglia già caricata non viene sostituita da un elenco vuoto:
      // l'errore è locale e il resto della pagina resta quello che era.
      setErrorMessage(LOAD_ERROR);
      onLoadFailed?.();
    } finally {
      setIsLoading(false);
    }
  }, [onLoadFailed, profileId, viewerProfileId]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const page = await fetchFanMediaPage(profileId, viewerProfileId, cursor);
      setItems((current) => dedupeFanContentById([...current, ...page.items]));
      setCursor(page.cursor);
      setHasMore(page.hasMore);
    } catch {
      setErrorMessage(LOAD_ERROR);
    } finally {
      setIsLoadingMore(false);
    }
  }, [cursor, hasMore, isLoadingMore, profileId, viewerProfileId]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    errorMessage,
    hasMore,
    isLoading,
    isLoadingMore,
    items,
    loadMore: () => {
      void loadMore();
    },
    reload: () => {
      void load();
    },
  };
}
