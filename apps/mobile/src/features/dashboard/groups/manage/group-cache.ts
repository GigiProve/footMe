/**
 * Invalidazioni di gestione dei Gruppi (DAS-REV-33 §26).
 *
 * «Nome/avatar aggiornano Info, Dashboard, Inbox e header; add/remove/role
 * aggiornano count, Persone e capability; archive/reactivate aggiornano liste e
 * composer. Le superfici condividono l'ID canonico, senza essere cache
 * private indistinte.» Le proiezioni restano chiavi separate (amministrativa
 * vs conversazionale); qui si elencano tutte, non si deducono.
 *
 * Due casi distinti:
 *  · comando riuscito → si **invalida**: ogni superficie rilegge dalla sua
 *    sorgente, e finché non arriva il dato nuovo resta quello autorizzato. La
 *    promise si risolve quando le query attive hanno riletto: chi vuole
 *    mostrare il dato nuovo (rename, archivia) la attende;
 *  · accesso perso (uscita, eliminazione) → si **rimuove**: query in volo
 *    annullate prima, così una risposta tardiva non ripopola la cache (§17).
 */
import type { QueryClient } from "@tanstack/react-query";

import { MESSAGING_QK } from "../../../messaging/messaging-keys";
import { purgeConversationCache } from "../../../messaging/use-group-chat-access";
import { GROUPS_QK_CONVERSATION_PREFIXES, GROUPS_QK_LIST_PREFIXES } from "../groups-keys";

/** Il dettaglio 32 ha la Società nella chiave: `[prefisso, actor, club, conversation]`. */
const isDetailOf = (conversationId: string) => (query: { queryKey: readonly unknown[] }) =>
  query.queryKey[0] === "society-group-detail" && query.queryKey[3] === conversationId;

export async function invalidateGroupQueries(
  queryClient: QueryClient,
  actorId: string,
  conversationId: string,
): Promise<void> {
  await Promise.all([
    ...GROUPS_QK_CONVERSATION_PREFIXES.map((prefix) =>
      queryClient.invalidateQueries({ queryKey: [prefix, actorId, conversationId] }),
    ),
    queryClient.invalidateQueries({ predicate: isDetailOf(conversationId) }),
    ...GROUPS_QK_LIST_PREFIXES.map((prefix) => queryClient.invalidateQueries({ queryKey: [prefix, actorId] })),
    // Inbox, header chat e messaggi (evento di sistema) leggono la stessa Conversation.
    queryClient.invalidateQueries({ queryKey: MESSAGING_QK.inbox(actorId) }),
    queryClient.invalidateQueries({ queryKey: MESSAGING_QK.groupMeta(conversationId) }),
    queryClient.invalidateQueries({ queryKey: MESSAGING_QK.conversationMessages(conversationId) }),
  ]);
}

/**
 * Il viewer non ha più accesso (uscita, eliminazione, fine periodo): le query
 * amministrative della conversazione si annullano e si rimuovono, insieme a
 * quelle della chat. Le liste per Società si rileggono: l'eventuale
 * proiezione amministrativa residua (manager) la decide il server.
 */
export async function purgeGroupQueries(queryClient: QueryClient, actorId: string, conversationId: string): Promise<void> {
  const detail = { predicate: isDetailOf(conversationId) };
  const conversationKeys = GROUPS_QK_CONVERSATION_PREFIXES.map((prefix) => [prefix, actorId, conversationId] as const);

  await Promise.all([
    ...conversationKeys.map((queryKey) => queryClient.cancelQueries({ queryKey })),
    queryClient.cancelQueries(detail),
    purgeConversationCache(queryClient, conversationId),
  ]);

  conversationKeys.forEach((queryKey) => queryClient.removeQueries({ queryKey }));
  queryClient.removeQueries(detail);

  GROUPS_QK_LIST_PREFIXES.forEach((prefix) => {
    void queryClient.invalidateQueries({ queryKey: [prefix, actorId] });
  });
  void queryClient.invalidateQueries({ queryKey: MESSAGING_QK.inbox(actorId) });
}
