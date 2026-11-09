/**
 * Derivazioni pure del lifecycle evento (DAS-REV-31 §13–§20, §28; screen
 * 07–12, 18, 19).
 *
 * Le voci del menu «Gestisci evento» vengono **solo** dalle capability del
 * server (§15: «Il resolver backend restituisce le azioni valide; la UI non
 * le ricostruisce da ruolo o clock locale»). Qui si decidono parole, ordine e
 * tono: Concludi non è mai rosso (§17), Annulla è l'unica voce distruttiva
 * (§18).
 *
 * Gli stati terminali sono COMPLETED e CANCELLED (§13); «Evento iniziato» è
 * una label derivata di un PUBLISHED, non uno stato.
 */
import { SelectionEventsError, type SelectionEventsErrorCode } from "../events-service";
import type { SelectionEventStatus } from "../events-types";
import {
  PARTICIPANTS_COPY,
  messageError,
  normalizeMessage,
} from "../participants/participants-presentation";
import { DETAIL_COPY } from "./event-detail-presentation";
import type { LifecycleCommandResult, SelectionEventDetail } from "./event-detail-types";

export const LIFECYCLE_COPY = {
  // Menu (screen 07–08)
  manageTitle: "Gestisci evento",
  edit: "Modifica evento",
  complete: "Concludi evento",
  cancel: "Annulla evento",
  started: "Evento iniziato",

  // Conclusione (screen 09, §17)
  completeTitle: "Concludere l’evento?",
  completeBody: "L’evento passerà nello storico. Potrai continuare a consultare partecipanti e profili.",
  back: "Torna indietro",

  // Annullamento (screen 11, §18)
  cancelTitle: "Annullare l’evento?",
  cancelBody:
    "Le persone coinvolte verranno informate e l’evento non sarà più disponibile per la partecipazione.",
  cancelMessageLabel: "Messaggio ai partecipanti — opzionale",
  cancelPlaceholder: "Aggiungi un breve messaggio…",

  // Storico (screen 10, 12, §19)
  completedPill: "Evento concluso",
  cancelledPill: "Evento annullato",
  viewParticipants: "Visualizza partecipanti",
  historyFootnote: "Lo stato delle partecipazioni è conservato nello storico.",

  // Aggiornamento (screen 18, §20)
  updatedBanner: "Informazioni aggiornate",

  // Bozza (screen 19, §17)
  deleteDraft: "Elimina bozza",
  deleteDraftTitle: "Eliminare la bozza?",
  deleteDraftBody: "Questa bozza verrà eliminata definitivamente.",

  // Errori (§15, §28)
  startedError: "L’evento è già iniziato. Questa operazione non è più disponibile.",
  completedError: "L’evento è concluso.",
  cancelledError: "L’evento è stato annullato.",
  cancelError: "Impossibile annullare l’evento. Riprova.",
  completeError: "Impossibile concludere l’evento. Riprova.",
  deleteError: "Impossibile eliminare la bozza. Riprova.",
} as const;

/**
 * §18: «limite centrale 500 caratteri coerente con messaggi brevi 29/30».
 * Il dettaglio non riceve i limiti del Centro; il server applica comunque il
 * proprio (`SELECTION_EVENT_MESSAGE_TOO_LONG`).
 */
export const CANCELLATION_MESSAGE_LIMIT = 500;

// ── Menu «Gestisci evento» (screen 07–08) ──────────────────────────────────

export type ManageActionKind = "edit" | "complete" | "cancel";

export type ManageAction = {
  kind: ManageActionKind;
  label: string;
  /** `accent` = contorno blu; `destructive` = contorno rosso (solo Annulla). */
  tone: "accent" | "destructive";
};

/**
 * Prima dell'inizio: Modifica e Annulla, Concludi assente (screen 07). Dopo
 * l'inizio: Concludi e Annulla, la modifica non è più operativa (screen 08).
 * Lo decide il server con `can_edit` / `can_complete` / `can_cancel`.
 */
export function manageMenuActions(detail: Pick<SelectionEventDetail, "management">): ManageAction[] {
  const management = detail.management;

  if (!management) {
    return [];
  }

  const actions: ManageAction[] = [];

  if (management.canEdit) {
    actions.push({ kind: "edit", label: LIFECYCLE_COPY.edit, tone: "accent" });
  }

  if (management.canComplete) {
    actions.push({ kind: "complete", label: LIFECYCLE_COPY.complete, tone: "accent" });
  }

  if (management.canCancel) {
    actions.push({ kind: "cancel", label: LIFECYCLE_COPY.cancel, tone: "destructive" });
  }

  return actions;
}

// ── Stato a schermo ────────────────────────────────────────────────────────

/** §13: terminale = COMPLETED o CANCELLED. */
export function isTerminal(status: SelectionEventStatus): boolean {
  return status === "completed" || status === "cancelled";
}

/**
 * La pillola sopra il titolo: «Evento concluso» / «Evento annullato» per lo
 * storico (screen 10, 12), «Evento iniziato» per un PUBLISHED già partito
 * (screen 08, solo nella vista gestionale). Null altrimenti.
 */
export function lifecyclePill(
  detail: Pick<SelectionEventDetail, "lifecycle" | "status">,
  options: { society: boolean },
): string | null {
  if (detail.status === "completed") {
    return LIFECYCLE_COPY.completedPill;
  }

  if (detail.status === "cancelled") {
    return LIFECYCLE_COPY.cancelledPill;
  }

  return options.society && detail.status === "published" && detail.lifecycle.isStarted
    ? LIFECYCLE_COPY.started
    : null;
}

/**
 * Screen 18, §20: il banner compare solo se il dettaglio arriva dalla
 * notifica di aggiornamento **e** l'evento è ancora operativo. Un annullamento
 * successivo prevale (§24: «la cancellation resta informazione prevalente»).
 */
export function showUpdatedBanner(
  detail: Pick<SelectionEventDetail, "status">,
  fromUpdateNotification: boolean,
): boolean {
  return fromUpdateNotification && detail.status === "published";
}

/** `?updated=1` dalla route; qualunque altro valore è assente. */
export function parseUpdatedParam(value: unknown): boolean {
  return value === "1" || value === "true";
}

// ── Messaggio di annullamento (§18) ────────────────────────────────────────

/** Testo semplice; solo spazi → null. Il server applica la stessa regola. */
export const normalizeCancellationMessage = normalizeMessage;

export function cancellationMessageError(value: string, limit = CANCELLATION_MESSAGE_LIMIT): string | null {
  return messageError(value, limit);
}

/**
 * §28: l'impronta della chiave idempotente. Lo stesso intento (evento,
 * versione vista, messaggio) produce la stessa chiave anche dopo un esito
 * incerto; un messaggio cambiato è un intento nuovo.
 */
export function lifecycleSignature(
  kind: "complete" | "cancel" | "delete",
  eventId: string,
  version: number,
  message: string | null = null,
): string {
  return kind === "cancel"
    ? `cancel|${eventId}|${version}|${message ?? ""}`
    : `${kind}|${eventId}|${version}`;
}

// ── Esiti ed errori (§15, §17, §18, §28) ───────────────────────────────────

/**
 * §17: il worker può aver concluso l'evento prima del tap; §18: un
 * annullamento oltre la scadenza diventa una conclusione. In entrambi i casi
 * la UI lo dice, invece di dichiarare l'azione richiesta.
 */
export function lifecycleOutcomeNotice(
  kind: "complete" | "cancel",
  result: Pick<LifecycleCommandResult, "outcome">,
): string | null {
  return kind === "cancel" && result.outcome === "completed" ? LIFECYCLE_COPY.completedError : null;
}

/**
 * §15: «L’evento è già iniziato. Questa operazione non è più disponibile.»,
 * oppure «L’evento è concluso.» / «L’evento è stato annullato.» secondo lo
 * stato **reale**. I comandi di partecipazione della 29/30 rispondono
 * `SELECTION_EVENT_NOT_OPERATIONAL` senza dire perché: il copy si sceglie
 * dal dettaglio riletto dopo l'errore. Null se l'evento è ancora operativo
 * (il motivo era un altro cambiamento della partecipazione).
 */
export function notOperationalCopy(
  detail: Pick<SelectionEventDetail, "lifecycle"> | null | undefined,
): string | null {
  if (!detail) {
    return null;
  }

  if (detail.lifecycle.status === "cancelled") {
    return LIFECYCLE_COPY.cancelledError;
  }

  if (detail.lifecycle.status === "completed") {
    return LIFECYCLE_COPY.completedError;
  }

  return detail.lifecycle.isStarted ? LIFECYCLE_COPY.startedError : null;
}

export type LifecycleErrorCopy = {
  message: string;
  /** Rileggere il dettaglio: lo stato reale è cambiato. */
  refresh: boolean;
  /** Esito sconosciuto: tenere chiave e testo per il retry. */
  uncertain: boolean;
};

export function lifecycleErrorCopy(
  error: unknown,
  kind: "complete" | "cancel" | "delete",
): LifecycleErrorCopy {
  const code: SelectionEventsErrorCode | null =
    error instanceof SelectionEventsError ? error.code : null;
  const fallback =
    kind === "complete"
      ? LIFECYCLE_COPY.completeError
      : kind === "cancel"
        ? LIFECYCLE_COPY.cancelError
        : LIFECYCLE_COPY.deleteError;

  switch (code) {
    case "NETWORK":
      return { message: DETAIL_COPY.offline, refresh: false, uncertain: true };
    case "TIMEOUT":
      return { message: DETAIL_COPY.uncertain, refresh: true, uncertain: true };
    case "RATE_LIMIT":
      return { message: DETAIL_COPY.rateLimited, refresh: false, uncertain: false };
    case "SELECTION_EVENT_STARTED":
    case "SELECTION_EVENT_NOT_STARTED":
      return { message: LIFECYCLE_COPY.startedError, refresh: true, uncertain: false };
    case "SELECTION_EVENT_COMPLETED":
      return { message: LIFECYCLE_COPY.completedError, refresh: true, uncertain: false };
    case "SELECTION_EVENT_CANCELLED":
      return { message: LIFECYCLE_COPY.cancelledError, refresh: true, uncertain: false };
    case "SELECTION_EVENT_MESSAGE_TOO_LONG":
      /* Il testo resta nel campo: l'errore inline lo spiega già. */
      return {
        message: PARTICIPANTS_COPY.messageTooLong(CANCELLATION_MESSAGE_LIMIT),
        refresh: false,
        uncertain: false,
      };
    case "SELECTION_EVENT_LIFECYCLE_CONFLICT":
    case "OPERATION_CONTENT_CHANGED":
      return { message: fallback, refresh: true, uncertain: false };
    case "SELECTION_EVENT_NOT_AUTHORIZED":
    case "SELECTION_EVENT_NOT_AVAILABLE":
      return { message: DETAIL_COPY.unavailableBody, refresh: true, uncertain: false };
    default:
      return { message: fallback, refresh: false, uncertain: false };
  }
}
