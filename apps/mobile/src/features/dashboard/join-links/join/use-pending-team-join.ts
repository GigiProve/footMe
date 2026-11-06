/**
 * Continuità del Link di invito oltre l'accesso (DAS-REV-20, screen 06).
 *
 * Specchia `use-pending-admin-invite.ts`: la landing pubblica (screen 06)
 * mette da parte il token con `pendingTeamJoin.store` prima di mandare chi
 * non ha sessione verso l'accesso globale; una volta tornati autenticati
 * questo hook consuma quel token una sola volta e riapre il percorso del
 * destinatario sul link, invece di lasciare la persona nella home.
 */
import { useEffect, useRef } from "react";
import { router } from "expo-router";

import { pendingTeamJoin } from "../join-link-url";
import { JOIN_LINKS_HREFS } from "../join-links-routes";

export function usePendingTeamJoin(isReady: boolean): void {
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (!isReady || hasRunRef.current) {
      return;
    }

    hasRunRef.current = true;

    void (async () => {
      const token = await pendingTeamJoin.consume();

      if (token) {
        router.push(JOIN_LINKS_HREFS.join(token) as never as Parameters<typeof router.push>[0]);
      }
    })();
  }, [isReady]);
}
