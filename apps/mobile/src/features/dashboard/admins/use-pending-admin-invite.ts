/**
 * Riprende l'invito amministrativo messo da parte prima dell'accesso (§14).
 *
 * «Preserva un riferimento sicuro all'invito durante l'autenticazione …
 * risolvi nuovamente Society, destinatario, ruolo, scope e stato dal backend
 * al ritorno.» Qui si riapre solo il link: la risoluzione la fa la landing,
 * che chiama `resolve_admin_invite_binding`.
 *
 * Stesso gancio degli altri due inviti del prodotto — il layout delle tab —
 * perché l'onboarding non passa da `app/index.tsx` e le tab sono l'unico
 * punto che login e registrazione attraversano entrambi.
 *
 * Il token viene consumato una volta sola: §14 dice che «chiudere l'app,
 * abbandonare login o rinviare l'installazione non rifiuta l'invito», e
 * riproporre la stessa schermata a ogni avvio sarebbe solo rumore. Il link
 * originale resta valido e riapribile.
 */
import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";

import { pendingAdminInvite } from "./admin-invite-link";

export function usePendingAdminInvite(isReady: boolean): void {
  const router = useRouter();
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (!isReady || hasRunRef.current) {
      return;
    }

    hasRunRef.current = true;

    void pendingAdminInvite.consume().then((token) => {
      if (token) {
        router.push(`/admin-invite/${token}` as never);
      }
    });
  }, [isReady, router]);
}
