/**
 * Ritorno all'evento dopo accesso, registrazione e onboarding (DAS-REV-29
 * §12, QA-046/047/048).
 *
 * Stesso gancio degli inviti del prodotto — il layout delle tab — perché è
 * l'unico punto che login e onboarding attraversano entrambi. Riapre solo il
 * link: il dettaglio rilegge disponibilità, profilo e stato personale dal
 * server. Mai un'iscrizione automatica (§3.9).
 *
 * L'identificatore viene rivalidato con la stessa allowlist del server prima
 * di navigare: un valore manomesso nello storage non diventa una route
 * arbitraria (QA-040).
 */
import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";

import { SELECTION_EVENTS_HREFS } from "../events-routes";
import { isValidPublicId, pendingEventLink } from "./event-link";

export function usePendingEventLink(isReady: boolean): void {
  const router = useRouter();
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (!isReady || hasRunRef.current) {
      return;
    }

    hasRunRef.current = true;

    void pendingEventLink.consume().then((publicId) => {
      if (isValidPublicId(publicId)) {
        router.push(SELECTION_EVENTS_HREFS.link(publicId) as never);
      }
    });
  }, [isReady, router]);
}
