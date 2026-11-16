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
 * - Cambio o fine sessione: le cache notifiche dell'account precedente si scartano
 *   (§274-§275), anche quando non si passa da `logout()` (sessione scaduta).
 */

import { useQueryClient } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";

import { useSession } from "../../auth/use-session";
import { notificationKeys } from "../notification-keys";
import { extractNotificationId, notificationOpenHref } from "./push-presentation";
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
    handleNotification: async () => ({
      // Su iOS in foreground niente suono forzato. Su Android `shouldPlaySound: false`
      // sopprime anche il banner (doc expo-notifications), quindi lì resta true: il
      // volume lo governa comunque il sistema.
      shouldPlaySound: Platform.OS === "android",
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
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
    const subscription = Notifications.addNotificationReceivedListener(() => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.badgeRoot });
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    });

    return () => subscription.remove();
  }, [queryClient]);

  useEffect(() => {
    if (!lastResponse || !canNavigate || handledResponseRef.current === lastResponse) {
      return;
    }

    if (lastResponse.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
      return;
    }

    const notificationId = extractNotificationId(lastResponse.notification.request.content.data);

    if (!notificationId) {
      handledResponseRef.current = lastResponse;
      return;
    }

    const delay = coldStartPendingRef.current ? COLD_START_NAVIGATION_DELAY_MS : 0;
    const timer = setTimeout(() => {
      handledResponseRef.current = lastResponse;
      coldStartPendingRef.current = false;
      Notifications.clearLastNotificationResponse();
      router.push(notificationOpenHref(notificationId) as never);
    }, delay);

    return () => clearTimeout(timer);
  }, [canNavigate, lastResponse, router]);
}
