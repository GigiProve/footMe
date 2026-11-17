/**
 * Riconciliazione dei Messaggi con il server (DAS-REV-34 §9, §10, §22).
 *
 * Montato una volta dal layout delle tab, quindi vivo per tutta la sessione:
 *  · realtime sulle **proprie** righe di `conversation_actor_states`: un mute
 *    fatto da un altro dispositivo rilegge lo stato Notifiche della
 *    conversazione, l'Inbox (icona) e il badge (QA-035). Nessun polling;
 *  · ritorno in foreground: stato Notifiche, Inbox, Comunicazioni e badge si
 *    rileggono (la scadenza di un mute è lazy sul server e un mute scaduto a
 *    telefono spento deve tornare Attive senza riaprire nulla, QA-032).
 * Le cache sono per profilo: nessun dato di un altro account viene toccato (§25).
 */
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useRefetchOnActive } from "../blocking/use-refetch-on-active";
import { NOTIFICATION_STATE_QK_PREFIX, MESSAGING_QK } from "./messaging-keys";
import { unsubscribeFromConversation } from "./messaging-service";
import { subscribeToMyActorStates } from "./mute/mute-service";

export function useMessagingReconciliation(profileId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!profileId) {
      return undefined;
    }

    const channel = subscribeToMyActorStates(profileId, ({ conversationId }) => {
      void queryClient.invalidateQueries({
        queryKey: conversationId
          ? MESSAGING_QK.notificationState(conversationId)
          : NOTIFICATION_STATE_QK_PREFIX,
      });
      void queryClient.invalidateQueries({ queryKey: MESSAGING_QK.inbox(profileId) });
      void queryClient.invalidateQueries({ queryKey: MESSAGING_QK.badge(profileId) });
    });

    return () => {
      void unsubscribeFromConversation(channel);
    };
  }, [profileId, queryClient]);

  useRefetchOnActive(() => {
    if (!profileId) {
      return;
    }

    void queryClient.invalidateQueries({ queryKey: NOTIFICATION_STATE_QK_PREFIX });
    void queryClient.invalidateQueries({ queryKey: MESSAGING_QK.inbox(profileId) });
    void queryClient.invalidateQueries({ queryKey: MESSAGING_QK.communications(profileId) });
    void queryClient.invalidateQueries({ queryKey: MESSAGING_QK.badge(profileId) });
  });
}
