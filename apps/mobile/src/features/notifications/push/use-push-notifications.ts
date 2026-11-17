/**
 * HOM-14 §176-§179, §231, §274-§275 — ciclo di vita del client Push, montato una
 * sola volta dal root layout (`PushNotificationsHost`), dentro SessionProvider.
 *
 * - Registrazione: a ogni accesso e a ogni ritorno in primo piano, solo se il permesso
 *   OS è già concesso. Il prompt non parte mai da qui (vedi `push-service.ts`).
 * - Ricezione in foreground: il banner si mostra, il conteggio del Centro si ricarica
 *   dal server (il client non calcola e non crea notifiche, §171).
 * - Tap (anche con app avviata dalla notifica): `/notifications?open=<id>`. Il Centro
 *   marca OPENED, aggiorna SEEN ed esegue il Target Resolver (§177, §167): qui non si
 *   decide nulla sul target, così le Push non bypassano visibility e Block.
 * - DAS-REV-34 §20, §25, §293: le push di chat/lifecycle portano `{conversation_id,
 *   period_id, kind}` e nessuna riga del Centro. Il tap le passa da
 *   `resolve_conversation_target` e naviga all'esito, senza markOpened. Senza sessione
 *   il tap si conserva come path opaco (`pendingAuthTarget`) e riparte dopo il login.
 *   In foreground la push della conversazione visibile non mostra banner; alla ricezione
 *   di una push chat si rileggono Inbox e badge Messaggi dal server.
 * - Cambio o fine sessione: le cache notifiche dell'account precedente si scartano
 *   (§274-§275), anche quando non si passa da `logout()` (sessione scaduta).
 */

import { useQueryClient } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";

import { useToast } from "../../../ui";
import { pendingAuthTarget } from "../../auth/pending-auth-target";
import { useSession } from "../../auth/use-session";
import { MESSAGING_QK } from "../../messaging/messaging-keys";
import { getVisibleConversationId } from "../../messaging/visible-conversation";
import { conversationPendingHref } from "../conversation-target-presentation";
import { notificationKeys } from "../notification-keys";
import { openConversation } from "../use-notification-navigation";
import {
  conversationPushLink,
  extractConversationPush,
  extractNotificationId,
  foregroundPresentation,
  isConversationPush,
  notificationOpenHref,
} from "./push-presentation";
import { registerPushDevice } from "./push-service";

/** Radice delle preferenze, senza profilo: serve a scartarle per qualunque account. */
const PREFERENCES_ROOT_KEY = ["notification-preferences"] as const;

/**
 * Su cold start la navigazione iniziale (`app/index.tsx` fa un Redirect a /(tabs))
 * finisce dopo il montaggio del layout: un push immediato verrebbe sovrascritto.
 */
const COLD_START_NAVIGATION_DELAY_MS = 300;

function configureForegroundPresentation() {
  Notifications.setNotificationHandler({
    // DAS-REV-34 §20: la push della conversazione che l'utente sta guardando non produce
    // banner né voce in lista; ogni altra si presenta (regole in `foregroundPresentation`).
    handleNotification: async (notification) =>
      foregroundPresentation(
        notification.request.content.data,
        getVisibleConversationId(),
        Platform.OS === "android",
      ),
  });

  if (Platform.OS === "android") {
    // Il backend invia con channelId "default" (send-push/expo-push.ts).
    void Notifications.setNotificationChannelAsync("default", {
      importance: Notifications.AndroidImportance.DEFAULT,
      name: "Notifiche",
    }).catch((error) => console.warn("[push] canale Android non creato", error));
  }
}

export function usePushNotifications() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { showToast } = useToast();
  const { isLoading, profile, session } = useSession();
  const userId = session?.user.id ?? null;
  const canNavigate = !isLoading && profile !== null;

  const lastResponse = Notifications.useLastNotificationResponse();
  const handledResponseRef = useRef<unknown>(null);
  const coldStartPendingRef = useRef(true);
  const previousUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    configureForegroundPresentation();
  }, []);

  useEffect(() => {
    const previous = previousUserIdRef.current;
    previousUserIdRef.current = userId;

    if (previous !== null && previous !== userId) {
      queryClient.removeQueries({ queryKey: notificationKeys.all });
      queryClient.removeQueries({ queryKey: notificationKeys.badgeRoot });
      queryClient.removeQueries({ queryKey: PREFERENCES_ROOT_KEY });
    }
  }, [queryClient, userId]);

  useEffect(() => {
    if (userId === null) {
      return;
    }

    void registerPushDevice();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void registerPushDevice();
      }
    });

    return () => subscription.remove();
  }, [userId]);

  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.badgeRoot });
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });

      // DAS-REV-34 §10, §20: una push chat cambia unread e badge Messaggi. Il client non li
      // calcola: rilegge l'Inbox e l'aggregato dal server, anche se il banner è soppresso.
      if (userId !== null && isConversationPush(notification.request.content.data)) {
        void queryClient.invalidateQueries({ queryKey: MESSAGING_QK.inbox(userId) });
        void queryClient.invalidateQueries({ queryKey: MESSAGING_QK.badge(userId) });
      }
    });

    return () => subscription.remove();
  }, [queryClient, userId]);

  useEffect(() => {
    if (!lastResponse || handledResponseRef.current === lastResponse) {
      return;
    }

    if (lastResponse.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
      return;
    }

    const data = lastResponse.notification.request.content.data;
    const notificationId = extractNotificationId(data);
    // Il payload con `notification_id` resta il ramo HOM-14, invariato.
    const conversation = notificationId ? null : extractConversationPush(data);
    const link = conversation ? conversationPushLink(conversation) : null;

    // §293: senza sessione il target si conserva opaco e riparte dopo login/onboarding.
    if (link && !isLoading && session === null) {
      handledResponseRef.current = lastResponse;
      Notifications.clearLastNotificationResponse();
      void pendingAuthTarget.store(conversationPendingHref(link));
      return;
    }

    if (!canNavigate) {
      return;
    }

    if (!notificationId && !link) {
      handledResponseRef.current = lastResponse;
      return;
    }

    const delay = coldStartPendingRef.current ? COLD_START_NAVIGATION_DELAY_MS : 0;
    const timer = setTimeout(() => {
      handledResponseRef.current = lastResponse;
      coldStartPendingRef.current = false;
      Notifications.clearLastNotificationResponse();

      if (link) {
        // Nessun markOpened: la push chat non ha una riga del Centro. Prima il server, poi la route.
        void openConversation(router, link, "push", (message) =>
          showToast({ id: "notification-unavailable", message }),
        );
      } else if (notificationId) {
        router.push(notificationOpenHref(notificationId) as never);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [canNavigate, isLoading, lastResponse, router, session, showToast]);
}
