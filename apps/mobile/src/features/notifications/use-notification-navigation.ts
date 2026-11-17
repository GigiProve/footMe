/**
 * HOM-14 — apertura della destinazione di una notifica, dal Centro e dal push
 * (§9, §146, §157, §161, §167, §177–§178).
 *
 *  • `openNotificationTarget` passa SEMPRE dal Target Resolver e dalle
 *    destinazioni esistenti, che rivalidano visibilità e Block (§165–§167): un
 *    target cancellato o bloccato atterra sullo stato neutro della destinazione
 *    («Contenuto non disponibile», «Profilo non disponibile»), mai su un errore
 *    tecnico o una pagina bianca (§157–§159). Senza identificativi non
 *    naviga: la notifica risulta comunque aperta (§161) e un toast dice
 *    «Contenuto non disponibile» / «Profilo non disponibile» (HOM-15 §149–§150,
 *    §295): non c'è una route da aprire senza id, e un tap muto sembra un guasto.
 *  • `useOpenNotificationFromPush` gestisce `/notifications?open=<id>`: legge la
 *    riga per id (select puntuale, RLS), la marca APERTA senza revisione (il tap
 *    da push apre la revisione corrente) e poi risolve il target. Quel che va
 *    storto non rompe il Centro: resta aperto, senza errori tecnici (§231).
 *  • DAS-REV-34 §25: un target `conversation` non si apre mai dal client. `openConversation`
 *    chiede `resolve_conversation_target` e naviga all'esito (chat, Info gruppo, fallback);
 *    un errore di rete mostra un toast ritentabile, non il fallback di revoca.
 */

import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

import { useToast } from "../../ui";
import { useSession } from "../auth/use-session";
import { trackConversationTarget } from "./conversation-target-analytics";
import { openConversationLink } from "./conversation-target-open";
import { isDeniedOutcome, type ConversationLink } from "./conversation-target-presentation";
import { resolveConversationTarget } from "./conversation-target-service";
import { trackNotification, type NotificationOpenOrigin } from "./notification-analytics";
import { notificationKeys } from "./notification-keys";
import { fetchNotificationTargetSource, markNotificationOpened } from "./notification-service";
import { notificationUnavailableMessage, resolveNotificationTarget } from "./notification-target-resolver";
import type { NotificationTargetSource } from "./notification-types";

type Router = ReturnType<typeof useRouter>;

/** HOM-15 §295: come mostrare il copy neutro di un target non disponibile (il toast dell'app). */
type ShowUnavailable = (message: string) => void;

/**
 * DAS-REV-34 §25: chiede al server dove portare l'utente e poi naviga (chat, Info
 * gruppo o fallback 11/12). `replace` serve al tap ripreso dopo il login, che
 * arriva da `/notifications?conversation=…` e non deve lasciare quella route sotto.
 */
export function openConversation(
  router: Router,
  link: ConversationLink,
  origin: NotificationOpenOrigin,
  showError: ShowUnavailable,
  mode: "push" | "replace" = "push",
) {
  return openConversationLink(link, origin, {
    navigate: (href) => router[mode](href as never),
    resolve: resolveConversationTarget,
    showError,
    track: trackConversationTarget,
  });
}

/** Risolve e naviga; traccia l'esito (§256) senza mai includere testo della notifica (§261). */
export function openNotificationTarget(
  router: Router,
  source: NotificationTargetSource,
  origin: NotificationOpenOrigin,
  showUnavailable: ShowUnavailable,
): void {
  const destination = resolveNotificationTarget(source);

  if (destination.kind === "route") {
    trackNotification({ name: "notification_target_open_success", notificationType: source.type, origin });
    router.push(destination.href as never);
  } else if (destination.kind === "conversation") {
    // Nessuna navigazione prima della risposta del server; un errore di rete non è una revoca.
    void openConversation(router, destination.link, origin, showUnavailable).then((outcome) => {
      if (outcome !== null) {
        trackNotification({
          name: isDeniedOutcome(outcome) ? "notification_target_unavailable" : "notification_target_open_success",
          notificationType: source.type,
          origin,
        });
      }
    });
  } else if (destination.kind === "unavailable") {
    trackNotification({ name: "notification_target_unavailable", notificationType: source.type, origin });
    showUnavailable(notificationUnavailableMessage(source));
  }
}

/**
 * DAS-REV-34 §25, §293: `/notifications?conversation=…` è il path opaco con cui il
 * tap su una push chat sopravvive al login. Una volta sola per conversazione,
 * con l'account che ha davvero fatto accesso; nessun markOpened (non c'è una
 * notifica da aprire).
 */
export function useOpenConversationFromLink(link: ConversationLink | null): void {
  const router = useRouter();
  const { showToast } = useToast();
  const { profile } = useSession();
  const profileId = profile?.id ?? "";
  const handledKey = useRef<string | null>(null);
  const key = link ? `${link.conversationId}:${link.periodId ?? ""}:${link.intent}` : null;

  useEffect(() => {
    if (!link || !key || !profileId || handledKey.current === key) {
      return;
    }
    handledKey.current = key;

    void openConversation(
      router,
      link,
      "push",
      (message) => showToast({ id: "notification-unavailable", message }),
      "replace",
    );
  }, [key, link, profileId, router, showToast]);
}

/** Il tap su un push porta `open=<notification_id>`: una volta sola per id (§177). */
export function useOpenNotificationFromPush(notificationId: string | null): void {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
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
          openNotificationTarget(router, source, "push", (message) =>
            showToast({ id: "notification-unavailable", message }),
          );
        }
      } catch {
        // Riga non più leggibile o rete assente: il Centro resta com'è, nessun errore tecnico (§157).
      }
    })();
  }, [notificationId, profileId, queryClient, router, showToast]);
}
