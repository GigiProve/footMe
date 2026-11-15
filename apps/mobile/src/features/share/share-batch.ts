/**
 * Batch di condivisione e idempotenza (HOM-09 §125–§129, §138–§143).
 *
 * Un batch = un'azione dell'utente («Invia a 5» → 1 share action, 5 delivery,
 * §195). Il batch nasce quando si apre il pannello e dura quanto il flusso:
 * doppio tap, retry e timeout ambiguo riusano lo stesso `batchId` e le stesse
 * `delivery_key`, così il server ritorna l'esito già esistente invece di
 * creare un secondo messaggio (§129, §142) e il retry non gonfia il contatore
 * (§200). Il client non somma mai le condivisioni (§208).
 *
 * `delivery_key = <batchId>:<recipientKey>`: una per destinazione (§128),
 * stabile al variare dell'ordine e dei tentativi.
 *
 * `batchId` è un UUID v4 puro: `send_content_share(p_batch_id uuid, …)` lo
 * conserva come `uuid`. Stessa sorgente di entropia di
 * `post-composer/operation-key.ts`.
 */

import type {
  ShareDeliveryOutcome,
  ShareDestinationPayload,
  ShareRecipient,
  ShareSendResult,
} from "./share-types";

function randomHex(length: number): string {
  let out = "";
  for (let index = 0; index < length; index += 1) {
    out += Math.floor(Math.random() * 16).toString(16);
  }
  return out;
}

/** UUID v4: cifra di versione 4, variante 8|9|a|b. */
export function newShareId(): string {
  const globalCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;

  if (typeof globalCrypto?.randomUUID === "function") {
    return globalCrypto.randomUUID();
  }

  const variant = "89ab"[Math.floor(Math.random() * 4)];
  return `${randomHex(8)}-${randomHex(4)}-4${randomHex(3)}-${variant}${randomHex(3)}-${randomHex(12)}`;
}

export function deliveryKeyOf(batchId: string, recipientKey: string): string {
  return `${batchId}:${recipientKey}`;
}

/**
 * La destinazione come la vuole il server (§53): una conversazione esistente
 * (DIRECT o GROUP) oppure un profilo (get-or-create della DIRECT canonica).
 * Un Media è un profilo; una Società è il suo titolare (ponte titolare, D1):
 * la riga club porta `profile_id` = titolare e va come `kind: "profile"`, il
 * server non accetta più `kind: "club"`. `null` se la riga non porta
 * l'identificativo che il suo tipo richiede (una Società senza titolare non ha
 * destinazione: il server la manda già `available: false`).
 */
export function buildDestination(
  recipient: ShareRecipient,
  batchId: string,
): ShareDestinationPayload | null {
  const delivery_key = deliveryKeyOf(batchId, recipient.key);

  if (recipient.conversationId && (recipient.kind === "direct" || recipient.kind === "group")) {
    return { conversation_id: recipient.conversationId, delivery_key, kind: "conversation" };
  }

  if (
    (recipient.kind === "person" || recipient.kind === "media" || recipient.kind === "club") &&
    recipient.profileId
  ) {
    return { delivery_key, kind: "profile", profile_id: recipient.profileId };
  }

  return null;
}

/** Identità reale di una destinazione: due righe diverse possono puntare alla stessa. */
/**
 * La DIRECT con P ha come `profileId` l'altro partecipante: è la stessa persona
 * della riga P e della Società di cui P è titolare, quindi tutte e tre sono
 * `profile:<P>`. Un GROUP non ha profilo: la sua identità è la conversazione.
 */
function recipientIdentity(recipient: ShareRecipient, destination: ShareDestinationPayload): string {
  if (recipient.kind !== "group" && recipient.profileId) {
    return `profile:${recipient.profileId}`;
  }

  return destination.kind === "conversation"
    ? `conv:${destination.conversation_id}`
    : `profile:${destination.profile_id}`;
}

export type DestinationPlan = {
  destinations: ShareDestinationPayload[];
  /**
   * Righe scartate perché già coperte da un'altra: persona P e Società di cui P
   * è titolare sono UNA consegna. `dropped delivery_key → kept delivery_key`.
   */
  aliases: Record<string, string>;
};

/** Destinazioni da spedire, deduplicate per identità (prima riga vince). */
export function planDestinations(
  recipients: readonly ShareRecipient[],
  batchId: string,
): DestinationPlan {
  const kept = new Map<string, ShareDestinationPayload>();
  const aliases: Record<string, string> = {};

  for (const recipient of recipients) {
    const destination = buildDestination(recipient, batchId);

    if (!destination) {
      continue;
    }

    const identity = recipientIdentity(recipient, destination);
    const first = kept.get(identity);

    if (first) {
      aliases[destination.delivery_key] = first.delivery_key;
    } else {
      kept.set(identity, destination);
    }
  }

  return { aliases, destinations: Array.from(kept.values()) };
}

/**
 * Quante consegne rappresenta la selezione: le destinazioni deduplicate più le
 * righe che non hanno destinazione (falliranno, ma sono comunque una voce). È il
 * numero di CTA («Invia a N»), riepilogo, toast e analytics: mai le righe
 * selezionate, che possono essere di più.
 */
export function deliveryCount(recipients: readonly ShareRecipient[], batchId: string): number {
  const plan = planDestinations(recipients, batchId);
  const routable = new Set([
    ...plan.destinations.map((destination) => destination.delivery_key),
    ...Object.keys(plan.aliases),
  ]);
  const unroutable = recipients.filter(
    (recipient) => !routable.has(deliveryKeyOf(batchId, recipient.key)),
  ).length;

  return plan.destinations.length + unroutable;
}

export function buildDestinations(
  recipients: readonly ShareRecipient[],
  batchId: string,
): ShareDestinationPayload[] {
  return planDestinations(recipients, batchId).destinations;
}

/**
 * Le righe scartate dal dedup condividono l'esito della riga che le ha
 * coperte: l'utente le ha selezionate entrambe, il server ne ha vista una.
 */
export function withAliasedOutcomes(
  outcomes: readonly ShareDeliveryOutcome[],
  aliases: Readonly<Record<string, string>>,
): ShareDeliveryOutcome[] {
  const byKey = new Map(outcomes.map((outcome) => [outcome.deliveryKey, outcome]));
  const extra: ShareDeliveryOutcome[] = [];

  for (const [dropped, kept] of Object.entries(aliases)) {
    const outcome = byKey.get(kept);

    if (outcome) {
      extra.push({ ...outcome, deliveryKey: dropped });
    }
  }

  return [...outcomes, ...extra];
}

/** Postgres 22023: input malformato. Non è un guasto transitorio: ritentarlo non serve. */
export function isMalformedInputError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "22023"
  );
}

// ────────────────────────────────────────────────────────────────
// Esiti
// ────────────────────────────────────────────────────────────────

/** Gli esiti già noti del batch, per `delivery_key`. */
export type OutcomeMap = ReadonlyMap<string, ShareDeliveryOutcome>;

/**
 * Un retry restituisce solo le destinazioni rimandate: gli esiti riusciti
 * restano quelli del primo tentativo (§142, nessun reinvio) e non vengono mai
 * sovrascritti da un fallimento successivo.
 */
export function mergeOutcomes(
  previous: OutcomeMap,
  incoming: readonly ShareDeliveryOutcome[],
): Map<string, ShareDeliveryOutcome> {
  const merged = new Map(previous);

  for (const outcome of incoming) {
    if (merged.get(outcome.deliveryKey)?.ok) {
      continue;
    }

    merged.set(outcome.deliveryKey, outcome);
  }

  return merged;
}

/**
 * Un guasto di rete non dice cosa il server abbia fatto: ogni destinazione
 * rimandata risulta fallita e ritentabile. È sicuro perché le chiavi sono le
 * stesse (§129): se il server aveva già consegnato, il retry ritorna lo stesso
 * messaggio. `retryable: false` serve ai fallimenti che il server dichiara
 * definitivi (input malformato 22023, batch_conflict): niente «Riprova» inutile.
 */
export function transientFailureOutcomes(
  destinations: readonly ShareDestinationPayload[],
  retryable = true,
): ShareDeliveryOutcome[] {
  return destinations.map((destination) => ({
    conversationId: null,
    deliveryKey: destination.delivery_key,
    messageId: null,
    ok: false,
    retryable,
  }));
}

/**
 * Una riga senza l'identificativo che il suo tipo richiede non ha una
 * destinazione da spedire: è un fallimento definitivo, non un «riprova».
 */
export function unroutableOutcomes(
  recipients: readonly ShareRecipient[],
  batchId: string,
): ShareDeliveryOutcome[] {
  return recipients
    .filter((recipient) => buildDestination(recipient, batchId) === null)
    .map((recipient) => ({
      conversationId: null,
      deliveryKey: deliveryKeyOf(batchId, recipient.key),
      messageId: null,
      ok: false,
      retryable: false,
    }));
}

export type RecipientStatus = "sent" | "retryable" | "final";

export type BatchEvaluation =
  | { kind: "success"; okCount: number; total: number; statuses: Record<string, RecipientStatus> }
  | {
      kind: "partial";
      okCount: number;
      total: number;
      failedCount: number;
      retryableCount: number;
      statuses: Record<string, RecipientStatus>;
    }
  | {
      kind: "failed";
      okCount: 0;
      total: number;
      retryableCount: number;
      statuses: Record<string, RecipientStatus>;
    };

/**
 * Lo stato del batch sui destinatari selezionati (§135–§139):
 *  • tutte riuscite → successo;
 *  • nessuna → errore totale (§135), con «Riprova» solo se qualcuna è
 *    ritentabile (§216);
 *  • alcune → successo parziale: il batch resta una share action (§143, §199).
 * Una destinazione senza esito (il server l'ha omessa) vale come fallita e
 * ritentabile: non si dichiara inviato ciò che non è confermato.
 */
export function evaluateBatch(
  recipients: readonly ShareRecipient[],
  batchId: string,
  outcomes: OutcomeMap,
): BatchEvaluation {
  const { aliases } = planDestinations(recipients, batchId);
  const statuses: Record<string, RecipientStatus> = {};
  let okCount = 0;
  let retryableCount = 0;
  let total = 0;

  for (const recipient of recipients) {
    const key = deliveryKeyOf(batchId, recipient.key);
    // Una riga coperta dal dedup ha l'esito della riga che la copre e non
    // conta come una consegna in più (persona P + Società di P = una).
    const isAlias = key in aliases;
    const outcome = outcomes.get(isAlias ? aliases[key] : key);
    let status: RecipientStatus;

    if (outcome?.ok) {
      status = "sent";
    } else if (!outcome || outcome.retryable) {
      status = "retryable";
    } else {
      status = "final";
    }

    statuses[recipient.key] = status;

    if (!isAlias) {
      total += 1;
      okCount += status === "sent" ? 1 : 0;
      retryableCount += status === "retryable" ? 1 : 0;
    }
  }

  if (okCount === total && total > 0) {
    return { kind: "success", okCount, statuses, total };
  }

  if (okCount === 0) {
    return { kind: "failed", okCount: 0, retryableCount, statuses, total };
  }

  return {
    failedCount: total - okCount,
    kind: "partial",
    okCount,
    retryableCount,
    statuses,
    total,
  };
}

/**
 * Cosa mostra il passo «Condividi» (§135–§139, §213). `success` non è qui: chiude
 * il flusso. `partial` porta l'esito per destinatario (§140); «Riprova» compare
 * solo se c'è qualcosa di ritentabile (§216).
 */
export type ComposeStatus =
  | { kind: "idle" }
  | { kind: "sending" }
  /**
   * `statuses` non è null solo se prima di questo tentativo qualche consegna era
   * già riuscita (retry su un contenuto sparito nel frattempo): quei successi
   * restano e la UI li elenca, non vengono cancellati.
   */
  | { kind: "unavailable"; statuses: Record<string, RecipientStatus> | null }
  | { kind: "failed"; canRetry: boolean }
  | {
      kind: "partial";
      okCount: number;
      total: number;
      failedCount: number;
      retryCount: number;
      statuses: Record<string, RecipientStatus>;
    };

export function composeStatusOf(evaluation: BatchEvaluation): ComposeStatus {
  switch (evaluation.kind) {
    case "success":
      return { kind: "idle" };
    case "failed":
      return { canRetry: evaluation.retryableCount > 0, kind: "failed" };
    case "partial":
      return {
        failedCount: evaluation.failedCount,
        kind: "partial",
        okCount: evaluation.okCount,
        retryCount: evaluation.retryableCount,
        statuses: evaluation.statuses,
        total: evaluation.total,
      };
  }
}

/** §141: «Riprova N invii» rimanda solo le destinazioni fallite e ritentabili. */
export function recipientsToRetry(
  recipients: readonly ShareRecipient[],
  evaluation: BatchEvaluation,
): ShareRecipient[] {
  return recipients.filter((recipient) => evaluation.statuses[recipient.key] === "retryable");
}

/** Gli esiti riusciti di un risultato: servono a invalidare solo le chat toccate. */
export function deliveredConversationIds(result: ShareSendResult): string[] {
  const ids = result.outcomes
    .filter((outcome) => outcome.ok && outcome.conversationId)
    .map((outcome) => outcome.conversationId as string);

  return Array.from(new Set(ids));
}
