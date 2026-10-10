/**
 * Riprende l'invito di collegamento messo da parte prima dell'accesso (§19).
 *
 * Stesso gancio dell'invito procuratore→assistito — il layout delle tab —
 * per la stessa ragione: l'onboarding non passa da `app/index.tsx`, fa
 * `router.replace` direttamente su una tab, e le tab sono l'unico punto che
 * entrambi i percorsi attraversano.
 *
 * Il token viene consumato una volta sola. Riproporre a ogni avvio una
 * schermata che dice "non più disponibile" sarebbe solo rumore.
 */
import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";

import { pendingSocietyInvite } from "./network-invite-link";

export function usePendingSocietyInvite(isReady: boolean): void {
  const router = useRouter();
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (!isReady || hasRunRef.current) {
      return;
    }

    hasRunRef.current = true;

    void pendingSocietyInvite.consume().then((token) => {
      if (token) {
        router.push(`/society-invite/${token}` as never);
      }
    });
  }, [isReady, router]);
}
