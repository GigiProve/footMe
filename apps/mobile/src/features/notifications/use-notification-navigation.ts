/**
 * HOM-14 — apertura della destinazione di una notifica, dal Centro e dal push
 * (§9, §146, §157, §161, §167, §177–§178).
 *
 *  • `openNotificationTarget` passa SEMPRE dal Target Resolver e dalle
 *    destinazioni esistenti, che rivalidano visibilità e Block (§165–§167): un
 *    target cancellato o bloccato atterra sullo stato neutro della destinazione
 *    («Contenuto non disponibile», «Profilo non disponibile»), mai su un errore
 *    tecnico o una pagina bianca (§157–§159). Senza identificativi non
 *    naviga: la notifica risulta comunque aperta (§161).
 *  • `useOpenNotificationFromPush` gestisce `/notifications?open=<id>`: legge la
 *    riga per id (select puntuale, RLS), la marca APERTA senza revisione (il tap
 *    da push apre la revisione corrente) e poi risolve il target. Quel che va
 *    storto non rompe il Centro: resta aperto, senza errori tecnici (§231).
 */

import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

import { useSession } from "../auth/use-session";
import { trackNotification, type NotificationOpenOrigin } from "./notification-analytics";
import { notificationKeys } from "./notification-keys";
import { fetchNotificationTargetSource, markNotificationOpened } from "./notification-service";
import { resolveNotificationTarget } from "./notification-target-resolver";
import type { NotificationTargetSource } from "./notification-types";

type Router = ReturnType<typeof useRouter>;

/** Risolve e naviga; traccia l'esito (§256) senza mai includere testo della notifica (§261). */
export function openNotificationTarget(
  router: Router,
  source: NotificationTargetSource,
  origin: NotificationOpenOrigin,
): void {
  const destination = resolveNotificationTarget(source);

  if (destination.kind === "route") {
    trackNotification({ name: "notification_target_open_success", notificationType: source.type, origin });
    router.push(destination.href as never);
  } else if (destination.kind === "unavailable") {
    trackNotification({ name: "notification_target_unavailable", notificationType: source.type, origin });
  }
}

/** Il tap su un push porta `open=<notification_id>`: una volta sola per id (§177). */
export function useOpenNotificationFromPush(notificationId: string | null): void {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const profileId = profile?.id ?? "";
  const handledId = useRef<string | null>(null);

  useEffect(() => {
    if (!notificationId || !profileId || handledId.current === notificationId) {
      return;
    }
    handledId.current = notificationId;

    void (async () => {
      try {
        const source = await fetchNotificationTargetSource(notificationId);

        trackNotification({
          name: "notification_open",
          notificationType: source?.type ?? "unknown",
          origin: "push",
          wasOpened: false,
        });

        // Aprire implica vedere (§177): il badge si ricalcola sulle altre ancora NEW (§178).
        // Un guasto qui non deve impedire di arrivare alla destinazione.
        try {
          await markNotificationOpened(notificationId, null);
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: notificationKeys.timeline(profileId) }),
            queryClient.invalidateQueries({ queryKey: notificationKeys.badge(profileId) }),
          ]);
        } catch {
          // La riga resta com'è e si riallinea alla prossima lettura del Centro.
        }

        if (source) {
          openNotificationTarget(router, source, "push");
        }
      } catch {
        // Riga non più leggibile o rete assente: il Centro resta com'è, nessun errore tecnico (§157).
      }
    })();
  }, [notificationId, profileId, queryClient, router]);
}
