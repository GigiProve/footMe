/**
 * Lettura e uscita di Info gruppo (DAS-REV-33 §9, §26, §27).
 *
 * `useGroupManagement` è l'unica query della proiezione amministrativa: Info,
 * Persone, Aggiungi e Successione la condividono per chiave (actor +
 * conversazione), quindi mostrano le stesse capability senza rileggere cinque
 * volte. Non contiene body, anteprima o unread: il server non li restituisce.
 *
 * `useGroupExit` chiude la superficie quando l'accesso è perso o l'azione ha
 * tolto il gruppo: annulla le richieste in volo e rimuove le cache **prima** di
 * navigare, così una risposta tardiva non ripopola nulla (§17, §26).
 */
import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useToast } from "../../../../ui";
import { useSession } from "../../../auth/use-session";
import { decideMembershipRevocation, toMembershipPeriodChange } from "../../../messaging/group-chat-presentation";
import { subscribeToMyGroupPeriods, unsubscribeFromConversation } from "../../../messaging/messaging-service";
import { STALE_MS } from "../../cache/freshness-policy";
import { trackGroupAccessRevoked } from "../groups-analytics";
import { GROUP_MANAGE_COPY } from "../groups-copy";
import { GROUPS_QK } from "../groups-keys";
import { GROUP_MANAGE_HREFS, GROUPS_HREFS } from "../groups-routes";
import { fetchGroupManagement, toGroupsError, type GroupsError } from "../groups-service";
import type { GroupManageOrigin } from "../groups-types";
import { invalidateGroupQueries, purgeGroupQueries } from "./group-cache";
import type { GroupCommandOutcome } from "./use-group-command";

/**
 * `enabled` si spegne dopo l'uscita/revoca (`onExiting` di `useGroupExit`): la
 * query viene annullata e rimossa, e senza questo guard un refetch (focus,
 * invalidazione tardiva) potrebbe ricrearla prima dello smontaggio (§17, §26).
 */
export function useGroupManagement(conversationId: string, enabled = true) {
  const { profile } = useSession();
  const actorId = profile?.id ?? "";

  const query = useQuery({
    enabled: enabled && !!actorId && !!conversationId,
    queryFn: () => fetchGroupManagement(conversationId),
    queryKey: GROUPS_QK.management(actorId, conversationId),
    /* Un rifiuto di accesso non si ritenta: non è un errore di rete (§24). */
    retry: (count, error) => !toGroupsError(error).isAccessLost && count < 1,
    staleTime: STALE_MS.operational,
  });

  const error: GroupsError | null = query.error ? toGroupsError(query.error) : null;

  return { actorId, error, management: query.data ?? null, query };
}

/**
 * Un errore di comando → messaggio contestuale, oppure `null` se la superficie
 * si chiude da sé (revoca, eliminazione) o va altrove (successione). Rilegge
 * ciò che non è più affidabile (§25, §27). Condiviso da Info, Persone,
 * Aggiungi e Successione: l'esito di un errore non cambia con la schermata.
 */
export function useGroupFailureHandler(input: ExitInput) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const exit = useGroupExit(input);

  function handleFailure(outcome: Extract<GroupCommandOutcome, { ok: false }>): string | null {
    const { failure } = outcome;

    /* Accesso perso: sempre per eliminazione; per periodo chiuso solo dalla
       chat. Un manager dalla Dashboard conserva la proiezione amministrativa e
       ne decide il server alla rilettura (§18, §26). */
    if (failure.accessLost && (failure.accessLost === "deleted" || input.origin === "messages")) {
      void exit(failure.accessLost);

      return null;
    }

    if (failure.kind === "requires_handover") {
      void invalidateGroupQueries(queryClient, input.actorId, input.conversationId);
      router.push(GROUP_MANAGE_HREFS.handover(input.conversationId, input.origin) as never);

      return null;
    }

    if (failure.refetch || failure.accessLost) {
      void invalidateGroupQueries(queryClient, input.actorId, input.conversationId);
    }

    return failure.message;
  }

  return { exit, handleFailure };
}

/**
 * Revoca in tempo reale mentre Info è aperta (§17, §26): la fine del proprio
 * periodo arriva dal canale `society_group_member_access` (la tabella dei
 * periodi è chiusa al client). Dalla chat
 * (origin «messages») la superficie privata si chiude; dalla Dashboard il
 * manager conserva la proiezione amministrativa e la rilettura decide il
 * server. Un periodo non ancora noto si ricontrolla col server (`verify`).
 * Stessa decisione della chat: nessuna logica di revoca duplicata.
 */
export function useGroupPeriodSignals(input: {
  actorId: string;
  conversationId: string;
  exit: (reason: GroupExitReason) => Promise<void>;
  origin: GroupManageOrigin;
  periodId: string | null;
}) {
  const { actorId, conversationId, origin, periodId } = input;
  const queryClient = useQueryClient();
  /* Il canale non si risottoscrive a ogni render: legge l'ultima `exit`. */
  const exitRef = useRef(input.exit);

  useEffect(() => {
    exitRef.current = input.exit;
  });

  useEffect(() => {
    if (!actorId || !conversationId) {
      return undefined;
    }

    const channel = subscribeToMyGroupPeriods(`info:${conversationId}`, actorId, (record) => {
      const decision = decideMembershipRevocation({
        change: toMembershipPeriodChange(record),
        conversationId,
        currentPeriodId: periodId,
        myProfileId: actorId,
      });

      if (decision.action === "revoke") {
        if (origin === "messages") {
          void exitRef.current(decision.reason);
        } else {
          void invalidateGroupQueries(queryClient, actorId, conversationId);
        }
      } else if (decision.action === "verify") {
        void queryClient.invalidateQueries({ queryKey: GROUPS_QK.management(actorId, conversationId) });
      }
    });

    return () => {
      void unsubscribeFromConversation(channel);
    };
  }, [actorId, conversationId, origin, periodId, queryClient]);
}

/** `done`: azione del viewer conclusa; `deleted`/`ended`: revoca osservata (§26, screen 24). */
export type GroupExitReason = "deleted" | "done" | "ended";

type ExitInput = {
  actorId: string;
  conversationId: string;
  /**
   * Chiamata prima di annullare e rimuovere le cache: lo schermo spegne le
   * proprie query (`enabled`) così nulla le ricrea prima dello smontaggio.
   */
  onExiting?: () => void;
  origin: GroupManageOrigin;
};

export function useGroupExit(input: ExitInput) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  /* La revoca scatta una sola volta per schermata: due segnali contemporanei
     (errore della query e del comando) non devono navigare due volte. */
  const exited = useRef(false);

  return async function exit(reason: GroupExitReason): Promise<void> {
    if (exited.current) {
      return;
    }

    exited.current = true;
    input.onExiting?.();

    if (reason !== "done") {
      trackGroupAccessRevoked(reason);
    }

    await purgeGroupQueries(queryClient, input.actorId, input.conversationId);

    if (reason === "deleted") {
      showToast({ id: "group-deleted", message: GROUP_MANAGE_COPY.deleted, tone: "neutral" });
    } else if (reason === "ended") {
      showToast({ id: "group-access-ended", message: GROUP_MANAGE_COPY.notMember, tone: "neutral" });
    }

    /* Si torna al contenitore consentito, non alla chat o a Info appena
       svuotate (§17, §18): Inbox da Messaggi, Centro dalla Dashboard. */
    if (router.canDismiss()) {
      router.dismissAll();
    }

    router.replace((input.origin === "messages" ? GROUP_MANAGE_HREFS.inbox() : GROUPS_HREFS.center()) as never);
  };
}
