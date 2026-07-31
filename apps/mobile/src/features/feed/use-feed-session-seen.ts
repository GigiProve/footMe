/**
 * Deduplica delle impression (§25) e stato "già visualizzato" (§27).
 *
 * Il registro vive a livello di MODULO, non di componente: deve sopravvivere ai
 * cambi tab e ai remount dentro la stessa sessione JS, altrimenti la stessa card
 * emetterebbe una impression ogni volta che si torna sulla Home e il dato
 * diventerebbe inutilizzabile.
 *
 * Per il Blocco 1 lo stato visualizzato è solo locale: la spina espone `is_seen`
 * costante false e nessuna tabella server viene toccata.
 */

import { useCallback, useEffect, useRef } from "react";

import { saveFeedCacheScope } from "./feed-cache";
import type { FeedScope } from "./feed-types";

const seenByScope = new Map<FeedScope, Set<string>>();

function seenSet(scope: FeedScope): Set<string> {
  const existing = seenByScope.get(scope);
  if (existing) {
    return existing;
  }

  const created = new Set<string>();
  seenByScope.set(scope, created);
  return created;
}

const PERSIST_DEBOUNCE_MS = 2000;

export function useFeedSessionSeen({
  scope,
  profileId,
  initialSeenIds,
}: {
  scope: FeedScope;
  profileId: string;
  initialSeenIds: string[];
}) {
  const hydratedRef = useRef(false);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!hydratedRef.current && initialSeenIds.length > 0) {
    hydratedRef.current = true;
    const set = seenSet(scope);
    for (const id of initialSeenIds) {
      set.add(id);
    }
  }

  useEffect(() => {
    return () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
      }
    };
  }, []);

  const schedulePersist = useCallback(() => {
    if (!profileId) {
      return;
    }

    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
    }

    persistTimerRef.current = setTimeout(() => {
      void saveFeedCacheScope(profileId, scope, {
        seenIds: Array.from(seenSet(scope)),
      });
    }, PERSIST_DEBOUNCE_MS);
  }, [profileId, scope]);

  /** true la prima volta che l'id viene visto in questa sessione. */
  const markSeen = useCallback(
    (itemId: string): boolean => {
      const set = seenSet(scope);
      if (set.has(itemId)) {
        return false;
      }

      set.add(itemId);
      schedulePersist();
      return true;
    },
    [schedulePersist, scope],
  );

  const hasSeen = useCallback(
    (itemId: string): boolean => seenSet(scope).has(itemId),
    [scope],
  );

  return { hasSeen, markSeen };
}

/** Solo per i test. */
export function resetFeedSessionSeen(): void {
  seenByScope.clear();
}
