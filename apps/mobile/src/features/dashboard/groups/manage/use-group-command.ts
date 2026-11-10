/**
 * Esecuzione di un comando di gestione (DAS-REV-33 §25, §27, §28).
 *
 * Un solo posto per ciò che ogni comando condivide:
 *  · **una chiave di idempotenza per intenzione**, riusata nei retry. Un esito
 *    incerto (rete, timeout) conserva la chiave: il server restituisce
 *    l'esito già registrato e non si crea una seconda membership, un secondo
 *    evento, una seconda nomina o una seconda eliminazione (§25). Un esito
 *    definitivo chiude l'intenzione: lo stesso gesto ripetuto dopo è nuovo;
 *  · **nessun doppio invio**: mentre un comando è in volo un secondo tap non
 *    parte (§27);
 *  · errore → `GroupFailure` (copy, rilettura, accesso perso) e analytics con
 *    la sola classe d'errore (§28);
 *  · nessun optimistic update: il chiamante rilegge dal server (§27).
 */
import { useRef, useState } from "react";

import { newInviteSessionNonce } from "../../invites/operation-key";
import { trackGroupCommandResult } from "../groups-analytics";
import { groupFailureOf, intentFor, type GroupFailure, type Intent } from "../groups-manage-presentation";
import { toGroupsError, type GroupsError } from "../groups-service";
import type { GroupCommandName, GroupCommandResult, GroupLimits, GroupManageOrigin } from "../groups-types";

export type GroupCommandOutcome =
  | { ok: true; value: GroupCommandResult }
  | { error: GroupsError; failure: GroupFailure; ok: false };

type Options = {
  limits: Pick<GroupLimits, "maxPeople" | "nameMax">;
  origin: GroupManageOrigin;
};

export function useGroupCommand({ limits, origin }: Options) {
  const intent = useRef<Intent | null>(null);
  const inFlight = useRef(false);
  const [pending, setPending] = useState<GroupCommandName | null>(null);

  /**
   * `signature` identifica il contenuto dell'intenzione (ID, versione, periodo).
   * Ritorna `null` se un altro comando è già in volo: il chiamante non fa nulla.
   */
  async function run(input: {
    command: GroupCommandName;
    /** Numero aggregato di selezioni, per analytics (mai gli ID). */
    count?: number;
    exec: (operationKey: string) => Promise<GroupCommandResult>;
    signature: string;
  }): Promise<GroupCommandOutcome | null> {
    if (inFlight.current) {
      return null;
    }

    inFlight.current = true;
    setPending(input.command);

    const current = intentFor(intent.current, `${input.command}:${input.signature}`, newInviteSessionNonce);

    intent.current = current;
    trackGroupCommandResult({ command: input.command, count: input.count, origin, outcome: "started" });

    try {
      const value = await input.exec(current.key);

      intent.current = null;
      /* §28: un retry dello stesso intento non è una seconda azione conclusa. */
      trackGroupCommandResult({
        command: input.command,
        count: input.count,
        origin,
        outcome: value.replayed ? "recovered" : "succeeded",
      });

      return { ok: true, value };
    } catch (raw) {
      const error = toGroupsError(raw);
      const failure = groupFailureOf(error, input.command, limits);

      if (failure.settled) {
        intent.current = null;
      }

      trackGroupCommandResult({
        command: input.command,
        count: input.count,
        errorCategory: failure.kind,
        origin,
        outcome: "failed",
      });

      return { error, failure, ok: false };
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  }

  return { pending, run };
}
