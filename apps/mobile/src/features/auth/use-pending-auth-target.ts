/**
 * Ritorno al target originario dopo login e onboarding (HOM-15 §297).
 *
 * Stesso gancio degli inviti (`usePendingEventLink`, `usePendingTeamJoin`…):
 * il layout delle tab è l'unico punto che login e fine onboarding attraversano
 * entrambi. Consuma una volta sola e rivalida il path prima di navigare: un
 * valore manomesso nello storage non diventa una route arbitraria. `push`, non
 * `replace`: sotto resta la Home, e il Back dal target ci torna.
 */
import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";

import { pendingAuthTarget } from "./pending-auth-target";
import { isSafeInternalTarget } from "./session-guard-presentation";

export function usePendingAuthTarget(isReady: boolean): void {
  const router = useRouter();
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (!isReady || hasRunRef.current) {
      return;
    }

    hasRunRef.current = true;

    void pendingAuthTarget.consume().then((target) => {
      if (isSafeInternalTarget(target)) {
        router.push(target as never);
      }
    });
  }, [isReady, router]);
}
