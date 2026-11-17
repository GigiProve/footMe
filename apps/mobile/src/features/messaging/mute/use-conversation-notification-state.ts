/**
 * Lettura dello stato Notifiche di una conversazione (DAS-REV-34 §8, §9, §25).
 *
 * Una sola query per conversazione, condivisa da riga Info, menu della DIRECT e
 * sheet. Una rilettura che porta una `state_version` minore di quella in cache
 * non la sovrascrive (§9): i dati più nuovi, scritti da un comando o da una
 * rilettura precedente, restano. Il server risponde `NOT_MEMBER` ai non
 * partecipanti (manager non membri inclusi): la query fallisce e la riga Notifiche
 * non compare (QA-004), senza creare stato (§5).
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { MESSAGING_QK } from "../messaging-keys";
import { classifyMuteError, shouldApplyState } from "./mute-presentation";
import { fetchConversationNotificationState } from "./mute-service";
import type { ConversationNotificationState } from "./mute-types";

export function useConversationNotificationState(conversationId: string, enabled = true) {
  const queryClient = useQueryClient();
  const queryKey = MESSAGING_QK.notificationState(conversationId);

  return useQuery({
    enabled: enabled && !!conversationId,
    queryFn: async () => {
      const incoming = await fetchConversationNotificationState(conversationId);
      const cached = queryClient.getQueryData<ConversationNotificationState>(queryKey);

      return cached && !shouldApplyState(cached, incoming) ? cached : incoming;
    },
    queryKey,
    // Un rifiuto (non membro, periodo finito, eliminato) non si ritenta.
    retry: (count, error) => classifyMuteError(error) === "uncertain" && count < 1,
  });
}
