/**
 * Comando mute di una conversazione (DAS-REV-34 §9, §25; QA-036..QA-038).
 *
 *  · **un operation id per intento**: lo stesso intento (conversazione, periodo,
 *    scelta) ritentato dopo una risposta persa riusa l'id, e il server restituisce
 *    l'esito senza ricalcolare né estendere la durata. Un rifiuto definitivo o un
 *    successo chiudono l'intento;
 *  · **mutazioni serializzate**: mentre un comando è in volo un tap nuovo non
 *    parte; l'ultimo viene accodato (i precedenti si coalescono) e parte alla
 *    conclusione. Nessuna risposta tardiva ripristina una scelta precedente:
 *    ogni risposta passa da `shouldApplyState` (`state_version`);
 *  · **esito incerto → rilettura**: errore di rete/timeout non è un fallimento
 *    finché `fetch_conversation_notification_state` non dice che la scelta non
 *    c'è. Se c'è, è un successo recuperato. Se la rilettura fallisce (offline)
 *    non si dichiara mai un successo;
 *  · nessun optimistic update dello stato: la selezione «in invio» è locale allo
 *    sheet, il valore confermato cambia solo con la risposta del server;
 *  · nessuna coda offline (§25).
 */
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { MESSAGING_QK } from "../messaging-keys";
import { conversationTypeProp, trackMute } from "./mute-analytics";
import {
  classifyMuteError,
  isMuteAccessLost,
  isNoopChoice,
  muteChoiceOf,
  shouldApplyState,
  stateMatchesChoice,
  type MuteErrorKind,
} from "./mute-presentation";
import { fetchConversationNotificationState, setConversationMute } from "./mute-service";
import type { ConversationKind, ConversationNotificationState, MuteChoice } from "./mute-types";
import { newOperationId } from "./operation-id";
import { useConversationNotificationState } from "./use-conversation-notification-state";

type Options = {
  conversationId: string;
  conversationType: ConversationKind;
  /** Lettura attiva solo con lo sheet aperto. */
  enabled?: boolean;
  /** L'accesso alla conversazione è finito: la superficie privata si chiude con i segnali del modulo gruppi. */
  onAccessLost?: (kind: MuteErrorKind) => void;
  /** GROUP: periodo osservato (meta chat o stato letto); DIRECT: null. */
  periodId: string | null;
  profileId: string;
};

export type MuteSelectResult =
  /** Scelta applicata (o già in vigore): lo sheet può chiudersi. */
  | "applied"
  | "failed"
  /** Un altro comando è in volo: la scelta è accodata, il risultato lo darà il comando in corso. */
  | "queued";

type Attempt =
  | { kind: "ok"; recovered: boolean; state: ConversationNotificationState }
  | { errorKind: MuteErrorKind; kind: "failed" };

type Intent = { operationId: string; signature: string };

export function useConversationMute(options: Options) {
  const queryClient = useQueryClient();
  const stateQuery = useConversationNotificationState(options.conversationId, options.enabled ?? true);
  const state = stateQuery.data ?? null;

  const [pendingChoice, setPendingChoice] = useState<MuteChoice | null>(null);
  const [failed, setFailed] = useState(false);

  /* Il ciclo di invio legge sempre le ultime opzioni e l'ultimo stato. */
  const optionsRef = useRef(options);
  const stateRef = useRef(state);

  useEffect(() => {
    optionsRef.current = options;
    stateRef.current = state;
  });

  const intent = useRef<Intent | null>(null);
  const inFlight = useRef(false);
  const queued = useRef<MuteChoice | null>(null);

  function applyState(next: ConversationNotificationState) {
    queryClient.setQueryData<ConversationNotificationState>(
      MESSAGING_QK.notificationState(next.conversationId),
      (current) => (shouldApplyState(current, next) ? next : current),
    );
  }

  async function attempt(choice: MuteChoice): Promise<Attempt> {
    const { conversationId, periodId } = optionsRef.current;
    const signature = `${conversationId}:${periodId ?? ""}:${choice}`;

    const current: Intent =
      intent.current?.signature === signature
        ? intent.current
        : { operationId: newOperationId(), signature };

    intent.current = current;

    try {
      const next = await setConversationMute({
        choice,
        conversationId,
        operationId: current.operationId,
        periodId,
      });

      intent.current = null;
      applyState(next);

      return { kind: "ok", recovered: false, state: next };
    } catch (raw) {
      const errorKind = classifyMuteError(raw);

      if (errorKind !== "uncertain") {
        intent.current = null;

        return { errorKind, kind: "failed" };
      }

      /* §9: il comando può essere stato eseguito. Si rilegge prima di dire che è fallito. */
      try {
        const reread = await fetchConversationNotificationState(conversationId);

        applyState(reread);

        if (stateMatchesChoice(reread, choice)) {
          intent.current = null;

          return { kind: "ok", recovered: true, state: reread };
        }
      } catch {
        /* Offline o rifiuto: nessun falso successo; l'intento resta per il retry. */
      }

      return { errorKind, kind: "failed" };
    }
  }

  function settled(attemptResult: Attempt, choice: MuteChoice) {
    const { conversationType } = optionsRef.current;

    if (attemptResult.kind === "ok") {
      trackMute({
        conversationType: conversationTypeProp(conversationType),
        duration: choice,
        name: "conversation_mute_changed",
        outcome: attemptResult.recovered ? "recovered" : "applied",
      });
    } else if (isMuteAccessLost(attemptResult.errorKind)) {
      optionsRef.current.onAccessLost?.(attemptResult.errorKind);
    }
  }

  async function select(choice: MuteChoice): Promise<MuteSelectResult> {
    if (inFlight.current) {
      queued.current = choice;
      setPendingChoice(choice);

      return "queued";
    }

    // Senza uno stato noto non si può dire che la scelta sia già in vigore: si manda il comando.
    if (stateRef.current && isNoopChoice(stateRef.current, choice) && !intent.current) {
      return "applied";
    }

    inFlight.current = true;
    setFailed(false);

    let current: MuteChoice | null = choice;
    let last: Attempt | null = null;

    try {
      while (current) {
        setPendingChoice(current);
        const result: Attempt = await attempt(current);

        settled(result, current);
        last = result;

        if (result.kind === "failed") {
          queued.current = null;
          break;
        }

        current = queued.current;
        queued.current = null;
      }
    } finally {
      inFlight.current = false;
      setPendingChoice(null);
    }

    if (last?.kind === "ok") {
      // L'Inbox mostra l'icona mute; il badge non cambia col mute ma si rilegge per coerenza (§10).
      const { profileId } = optionsRef.current;

      void queryClient.invalidateQueries({ queryKey: MESSAGING_QK.inbox(profileId) });
      void queryClient.invalidateQueries({ queryKey: MESSAGING_QK.badge(profileId) });

      return "applied";
    }

    setFailed(true);

    return "failed";
  }

  /** Al chiudersi dello sheet l'errore locale non resta per la prossima apertura. */
  function reset() {
    setFailed(false);
  }

  return {
    failed,
    isPending: pendingChoice !== null,
    reset,
    select,
    /** Scelta mostrata: quella in invio, altrimenti quella confermata dal server. */
    selected: pendingChoice ?? muteChoiceOf(state),
    state,
  };
}
