/**
 * Cattura e ripristino della posizione di lettura (§18).
 *
 * Due scelte non ovvie:
 *
 *  • `onScroll` scrive SOLO su un ref, mai in stato. Scorrere non deve causare
 *    re-render: con un `setState` per evento la lista rirenderizzerebbe decine
 *    di volte al secondo e il Feed sembrerebbe lento.
 *  • Il ripristino avviene su `onContentSizeChange` (primo evento con altezza
 *    > 0) e non in un effect di mount: al mount la lista non ha ancora
 *    contenuto misurabile e `scrollToOffset` non avrebbe effetto.
 *
 * La condizione per applicare l'offset vive in feed-scroll-rules.ts, testata
 * senza renderer.
 *
 * HOM-01.1 §45–47: il ripristino non mostra più alcun banner "Riprendi da dove
 * eri". Se funziona deve essere invisibile: stessa tab, stessa posizione,
 * nessuna spiegazione.
 */

import { useCallback, useEffect, useRef } from "react";
import { useFocusEffect } from "expo-router";
import type {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";

import { saveFeedCacheScope, type FeedScrollState } from "./feed-cache";
import { shouldRestoreOffset } from "./feed-scroll-rules";
import type { FeedItem, FeedScope } from "./feed-types";

const PERSIST_DEBOUNCE_MS = 800;

export function useFeedScrollRestore({
  scope,
  profileId,
  listRef,
  itemCount,
  hydratedFromCache,
  savedScroll,
}: {
  scope: FeedScope;
  profileId: string;
  listRef: React.RefObject<FlatList<FeedItem> | null>;
  itemCount: number;
  hydratedFromCache: boolean;
  savedScroll: FeedScrollState | null;
}) {
  const offsetRef = useRef(0);
  const hasRestoredRef = useRef(false);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback(() => {
    if (!profileId) {
      return;
    }

    void saveFeedCacheScope(profileId, scope, {
      scroll: {
        itemCount,
        offset: offsetRef.current,
        savedAt: new Date().toISOString(),
      },
    });
  }, [itemCount, profileId, scope]);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      offsetRef.current = event.nativeEvent.contentOffset.y;

      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
      }
      persistTimerRef.current = setTimeout(persist, PERSIST_DEBOUNCE_MS);
    },
    [persist],
  );

  // Uscendo dalla schermata si salva subito: il debounce potrebbe non scattare.
  useFocusEffect(
    useCallback(() => {
      return () => {
        if (persistTimerRef.current) {
          clearTimeout(persistTimerRef.current);
          persistTimerRef.current = null;
        }
        persist();
      };
    }, [persist]),
  );

  useEffect(() => {
    return () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
      }
    };
  }, []);

  const onContentSizeChange = useCallback(
    (_width: number, height: number) => {
      if (hasRestoredRef.current || height <= 0) {
        return;
      }

      if (!shouldRestoreOffset(savedScroll, itemCount, hydratedFromCache)) {
        // Anche un mancato ripristino conta come tentativo: senza il latch,
        // ogni crescita della lista riproverebbe e potrebbe strappare lo scroll
        // sotto il dito dell'utente.
        hasRestoredRef.current = true;
        return;
      }

      hasRestoredRef.current = true;
      const target = Math.max(0, Math.min(savedScroll?.offset ?? 0, height));
      offsetRef.current = target;
      listRef.current?.scrollToOffset({ animated: false, offset: target });
    },
    [hydratedFromCache, itemCount, listRef, savedScroll],
  );

  const scrollToTop = useCallback(
    (animated = true) => {
      offsetRef.current = 0;
      listRef.current?.scrollToOffset({ animated, offset: 0 });
    },
    [listRef],
  );

  return {
    onContentSizeChange,
    onScroll,
    scrollToTop,
  };
}
