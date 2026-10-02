/**
 * Riprende l'invito messo da parte prima di login o registrazione.
 *
 * Il gancio sta nel layout delle tab e non in `app/index.tsx` perché
 * l'onboarding non passa dall'indice: a fine registrazione fa `router.replace`
 * direttamente su una tab. Le tab sono l'unico punto che entrambi i percorsi
 * attraversano davvero.
 *
 * Il token viene consumato una volta sola: se la schermata di invito dicesse
 * "non più valido", riproporla a ogni avvio sarebbe solo rumore.
 */
import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";

import { consumePendingInviteToken } from "./assistiti-invite-link";

export function usePendingAssistitoInvite(isReady: boolean): void {
  const router = useRouter();
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (!isReady || hasRunRef.current) {
      return;
    }

    hasRunRef.current = true;

    void consumePendingInviteToken().then((token) => {
      if (token) {
        router.push(`/assistito-invite/${token}` as never);
      }
    });
  }, [isReady, router]);
}
