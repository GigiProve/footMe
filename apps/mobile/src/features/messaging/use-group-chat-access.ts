/**
 * Revoca dell'accesso alla chat di gruppo (DAS-REV-33 §23, §26).
 *
 * Quando il periodo di appartenenza del viewer finisce (uscita, rimozione,
 * fine titolo, eliminazione) la chat deve: smettere di leggere, svuotare ciò
 * che non è più autorizzato, tornare all'Inbox e dirlo con un avviso
 * discreto. Nessun evento nella timeline e nessuna riga in campanella.
 *
 * La revoca arriva da due fonti, entrambe qui:
 *   · realtime su `society_group_member_access` (UPDATE del proprio
 *     periodo): fine periodo osservato → revoca; periodo non ancora noto →
 *     si ricontrolla col server (verify);
 *   · errore del server (meta o invio) che dice «non membro»/«eliminato»,
 *     per deep link e cache stantie.
 *
 * Le risposte tardive non ripopolano la cache: `revoked` spegne ogni query
 * della conversazione (`enabled`) PRIMA di cancellare e rimuovere, e la
 * revoca scatta una sola volta per conversazione.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigation, useRouter } from "expo-router";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";

import { useToast } from "../../ui";
import {
  classifyGroupAccessError,
  decideMembershipRevocation,
  revocationMessage,
  shouldNavigateOnRevoke,
  toMembershipPeriodChange,
  type RevocationReason,
} from "./group-chat-presentation";
import { isChatMediaQueryOf, MESSAGING_QK } from "./messaging-keys";
import { MESSAGES_INBOX_ROUTE } from "./messaging-routes";
import { subscribeToMyGroupPeriods, unsubscribeFromConversation } from "./messaging-service";

/** Cancella le richieste in volo e rimuove tutto ciò che la conversazione aveva in cache. */
export async function purgeConversationCache(queryClient: QueryClient, conversationId: string) {
  const keys = [
    MESSAGING_QK.conversationMessages(conversationId),
    MESSAGING_QK.groupMeta(conversationId),
    MESSAGING_QK.conversationMeta(conversationId),
    MESSAGING_QK.conversationType(conversationId),
  ];
  const mediaFilter = {
    predicate: (query: { queryKey: readonly unknown[] }) =>
      isChatMediaQueryOf(query.queryKey, conversationId),
  };

  await Promise.all([
    ...keys.map((queryKey) => queryClient.cancelQueries({ queryKey })),
    queryClient.cancelQueries(mediaFilter),
  ]);

  keys.forEach((queryKey) => queryClient.removeQueries({ queryKey }));
  queryClient.removeQueries(mediaFilter);
}

/**
 * Stato e comando di revoca. Va chiamato PRIMA delle query della chat: le
 * query si spengono con `isRevoked`. I segnali che possono scatenare la
 * revoca (realtime, errore del meta) dipendono invece dalle query e stanno in
 * `useGroupAccessSignals`, chiamato dopo.
 */
export function useGroupChatAccess({
  conversationId,
  myProfileId,
}: {
  conversationId: string;
  myProfileId: string;
}) {
  const router = useRouter();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  // La revoca vale per la conversazione, non per la schermata: un'altra
  // conversazione aperta nello stesso componente riparte da accesso valido.
  const [revokedConversationId, setRevokedConversationId] = useState<string | null>(null);
  const revokedRef = useRef<string | null>(null);
  const revoked = revokedConversationId === conversationId;

  async function revoke(reason: RevocationReason) {
    if (revokedRef.current === conversationId) {
      return;
    }

    revokedRef.current = conversationId;
    setRevokedConversationId(conversationId);

    await purgeConversationCache(queryClient, conversationId);

    // L'Inbox si riallinea: il gruppo non c'è più (o è eliminato).
    queryClient.invalidateQueries({ queryKey: MESSAGING_QK.inbox(myProfileId) });

    // Un solo navigatore vince: con Info gruppo sopra la chat, la navigazione
    // e l'avviso spettano a Info (vedi `shouldNavigateOnRevoke`).
    if (!shouldNavigateOnRevoke(navigation.isFocused?.())) {
      return;
    }

    showToast({ id: "group-access-revoked", message: revocationMessage(reason), tone: "neutral" });

    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace(MESSAGES_INBOX_ROUTE as never);
  }

  /**
   * Per gli errori di invio. `archived` → ricarica il meta (la chat mostra lo
   * stato Archiviato); accesso perso → revoca. Ritorna true se ha gestito
   * l'errore, e il chiamante non mostra il toast generico.
   */
  function handleAccessError(error: unknown): boolean {
    const kind = classifyGroupAccessError(error);

    if (kind === "archived") {
      queryClient.invalidateQueries({ queryKey: MESSAGING_QK.groupMeta(conversationId) });
      return true;
    }

    if (kind === "ended" || kind === "deleted") {
      void revoke(kind);
      return true;
    }

    return false;
  }

  return { handleAccessError, isRevoked: revoked, revoke };
}

type GroupAccessSignalsInput = {
  conversationId: string;
  isGroup: boolean;
  isRevoked: boolean;
  /** Errore dell'ultima lettura del meta del gruppo (accesso perso → revoca). */
  metaError: unknown;
  myProfileId: string;
  /** Periodo di accesso osservato (meta); null finché non è caricato. */
  periodId: string | null;
  revoke: (reason: RevocationReason) => Promise<void>;
};

export function useGroupAccessSignals({
  conversationId,
  isGroup,
  isRevoked,
  metaError,
  myProfileId,
  periodId,
  revoke,
}: GroupAccessSignalsInput) {
  const queryClient = useQueryClient();
  // Gli effetti leggono sempre l'ultima revoke senza ri-sottoscrivere a ogni render.
  const revokeRef = useRef(revoke);

  useEffect(() => {
    revokeRef.current = revoke;
  });

  useEffect(() => {
    if (!isGroup || !conversationId || !myProfileId || isRevoked) {
      return undefined;
    }

    const channel = subscribeToMyGroupPeriods(`chat:${conversationId}`, myProfileId, (record) => {
      const decision = decideMembershipRevocation({
        change: toMembershipPeriodChange(record),
        conversationId,
        currentPeriodId: periodId,
        myProfileId,
      });

      if (decision.action === "revoke") {
        void revokeRef.current(decision.reason);
      } else if (decision.action === "verify") {
        queryClient.invalidateQueries({ queryKey: MESSAGING_QK.groupMeta(conversationId) });
      }
    });

    return () => {
      void unsubscribeFromConversation(channel);
    };
  }, [conversationId, isGroup, isRevoked, myProfileId, periodId, queryClient]);

  useEffect(() => {
    const kind = classifyGroupAccessError(metaError);

    if (isGroup && (kind === "ended" || kind === "deleted")) {
      void revokeRef.current(kind);
    }
  }, [isGroup, metaError]);
}
