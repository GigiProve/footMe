/**
 * Derivazioni pure del flusso di invito (DAS-REV-30 §13–§17, §29).
 *
 * La selezione è un insieme di persone indicizzato per `personId` (§15:
 * «person_id unico»): cambiare pagina o query nella stessa sorgente la
 * preserva, cambiare sorgente con selezioni chiede conferma e poi la
 * azzera, una sorgente revocata la svuota. Tutto qui è testabile senza
 * montare la schermata.
 */
import { formatPosition, formatRole } from "../../../profiles/profile-display-helpers";
import { EVENT_TYPE_LABELS } from "../events-copy";
import { formatCivilDate } from "../events-presentation";
import { SelectionEventsError } from "../events-service";
import { timeRange } from "../detail/event-detail-presentation";
import type {
  CandidateReason,
  InvitableEvent,
  InviteCandidate,
  InviteOutcome,
  InviteResult,
  InviteSource,
  SelectedPerson,
} from "./invite-types";

export const INVITE_COPY = {
  title: "Invita profili",
  search: "Cerca profili",
  sourceAll: "Tutti i profili",
  sourceTitle: "Mostra profili da",
  sourcePositions: "Per posizione",
  sourceCustom: "Liste personalizzate",
  sourceA11y: (label: string) => `Mostra profili da: ${label}`,
  continue: "Continua",
  changeSourceTitle: "Cambiare elenco?",
  changeSourceBody: "La selezione corrente verrà azzerata.",
  changeSourceConfirm: "Cambia elenco",
  cancel: "Annulla",
  sourceRevoked: "Non hai più accesso a questo elenco. La selezione è stata azzerata.",
  emptyAll: "Nessun profilo trovato",
  emptyAllBody: "Prova a cercare con un altro nome.",
  emptyList: "Nessun profilo in questo elenco",
  emptyListBody: "Questa lista non contiene profili invitabili.",
  loadError: "Impossibile caricare i profili.",
  retry: "Riprova",

  confirmTitle: "Invia invito",
  messageLabel: "Messaggio — opzionale",
  messagePlaceholder: "Aggiungi un breve messaggio…",
  messageHelper: "Il messaggio verrà inviato insieme all’invito.",
  messageTooLong: (limit: number) => `Il messaggio può contenere al massimo ${limit} caratteri.`,
  send: "Invia invito",
  back: "Indietro",
  sendError: "Impossibile inviare gli inviti. Riprova.",
  fullError: "L’evento ha raggiunto il numero massimo di partecipanti. Non è possibile inviare nuovi inviti.",
  notOperational: "L’evento non accetta più nuovi inviti.",
  notAuthorized: "Non hai più i permessi per invitare profili a questo evento.",
  rateLimited: "Hai inviato troppi inviti in poco tempo. Riprova tra qualche minuto.",
  uncertain: "Stiamo verificando l’esito dell’invio. Riprova: gli inviti già inviati non verranno duplicati.",
  offline: "Connessione assente. Riprova quando sei online.",

  sentAll: "Inviti inviati.",
  sentOne: "Invito inviato.",
  backToEvent: "Torna all’evento",
  backToSelection: "Torna alla selezione",
  close: "Chiudi",

  pickTitle: "Invita a evento",
  pickSubtitle: (club: string) => `Seleziona un evento di ${club}.`,
  pickEmptyTitle: "Nessun evento disponibile",
  pickEmptyBody: "Non ci sono eventi a cui puoi invitare questo profilo.",
  pickError: "Impossibile caricare gli eventi.",
  invitedProfile: "Profilo invitato",
} as const;

// ── Righe candidato ────────────────────────────────────────────────────────

/** §13: «Stati non selezionabili». */
export const CANDIDATE_REASON_LABELS: Record<CandidateReason, string> = {
  already_invited: "Già invitato",
  already_confirmed: "Già confermato",
  pending_request: "Richiesta in attesa",
};

/** «Calciatore · Attaccante» (screen 02). */
export function candidateSubtitle(candidate: Pick<InviteCandidate, "primaryPosition" | "role">): string {
  return [
    candidate.role ? formatRole(candidate.role) : null,
    candidate.primaryPosition ? formatPosition(candidate.primaryPosition) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function candidateMeta(candidate: InviteCandidate): string {
  return candidate.reason ? CANDIDATE_REASON_LABELS[candidate.reason] : candidateSubtitle(candidate);
}

// ── Selezione (§15) ────────────────────────────────────────────────────────

export type Selection = ReadonlyMap<string, SelectedPerson>;

export const EMPTY_SELECTION: Selection = new Map();

/** Una persona non selezionabile non entra mai nella selezione. */
export function toggleCandidate(selection: Selection, candidate: InviteCandidate): Selection {
  const next = new Map(selection);

  if (next.has(candidate.personId)) {
    next.delete(candidate.personId);
  } else if (candidate.selectable) {
    next.set(candidate.personId, {
      avatarUrl: candidate.avatarUrl,
      fullName: candidate.fullName,
      personId: candidate.personId,
      primaryPosition: candidate.primaryPosition,
      role: candidate.role,
    });
  }

  return next;
}

/**
 * Una persona selezionata che una lettura successiva mostra come non più
 * selezionabile (nel frattempo invitata o confermata) esce dalla selezione:
 * il contatore non promette un invio che il server salterebbe.
 */
export function reconcileSelection(selection: Selection, visible: readonly InviteCandidate[]): Selection {
  let changed = false;
  const next = new Map(selection);

  for (const candidate of visible) {
    if (!candidate.selectable && next.has(candidate.personId)) {
      next.delete(candidate.personId);
      changed = true;
    }
  }

  return changed ? next : selection;
}

export function selectedCountLabel(count: number): string {
  return `${count} ${count === 1 ? "selezionato" : "selezionati"}`;
}

export function selectedProfilesLabel(count: number): string {
  return `${count} ${count === 1 ? "profilo selezionato" : "profili selezionati"}`;
}

export function sourceKey(source: InviteSource): string {
  return source ? source.shortlistId : "all";
}

export function sourceLabel(source: InviteSource): string {
  if (!source) {
    return INVITE_COPY.sourceAll;
  }

  return source.listType === "position" && source.scopeLabel
    ? `${source.name} · ${source.scopeLabel}`
    : source.name;
}

/**
 * §15: «Cambio sorgente con selezioni: “Cambiare elenco?” … Senza selezioni
 * il cambio è immediato.» Stessa sorgente: nessun cambio.
 */
export function sourceChangeDecision(
  current: InviteSource,
  next: InviteSource,
  selectionSize: number,
): "none" | "immediate" | "confirm" {
  if (sourceKey(current) === sourceKey(next)) {
    return "none";
  }

  return selectionSize > 0 ? "confirm" : "immediate";
}

// ── Messaggio (§15) ────────────────────────────────────────────────────────

export function normalizeInviteMessage(value: string): string | null {
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

export function inviteMessageError(value: string, limit: number): string | null {
  const normalized = normalizeInviteMessage(value);

  return normalized && normalized.length > limit ? INVITE_COPY.messageTooLong(limit) : null;
}

// ── Esito (§16) ────────────────────────────────────────────────────────────

export const OUTCOME_LABELS: Record<InviteOutcome, string> = {
  sent: "Invito inviato",
  already_invited: "Già invitato",
  already_confirmed: "Già confermato",
  pending_request: "Richiesta in attesa",
  unavailable: "Profilo non più disponibile",
};

export type OutcomeView =
  | { kind: "success"; message: string }
  /** Parziale o zero: righe essenziali e ritorno esplicito (screen 20). */
  | { kind: "partial" | "none"; lines: { label: string; name: string }[]; summary: [string, string] };

function profilesLine(count: number): string {
  return count === 1
    ? "1 profilo non era più disponibile."
    : `${count} profili non erano più disponibili.`;
}

/**
 * §16: «Successo completo: “Inviti inviati.” … Parziale: “1 invito inviato.
 * 1 profilo non era più disponibile.” … Zero successi non è “Inviti
 * inviati”.»
 */
export function outcomeView(result: InviteResult): OutcomeView {
  if (result.skippedCount === 0 && result.sentCount > 0) {
    return { kind: "success", message: result.sentCount === 1 ? INVITE_COPY.sentOne : INVITE_COPY.sentAll };
  }

  const lines = result.items.map((item) => ({
    label: OUTCOME_LABELS[item.outcome],
    /* §16: identità non più visibile → indicazione generica. */
    name: item.fullName ?? "Profilo",
  }));

  return {
    kind: result.sentCount > 0 ? "partial" : "none",
    lines,
    summary: [
      result.sentCount === 1
        ? "1 invito inviato."
        : result.sentCount === 0
          ? "Nessun invito inviato."
          : `${result.sentCount} inviti inviati.`,
      profilesLine(result.skippedCount),
    ],
  };
}

/** Errore del comando di invio: dominio, permesso e rete restano distinti. */
export function sendErrorCopy(error: unknown): { field: boolean; message: string; uncertain: boolean } {
  const code = error instanceof SelectionEventsError ? error.code : null;
  const fields = error instanceof SelectionEventsError ? error.fields : [];

  switch (code) {
    case "SELECTION_EVENT_FULL":
      return { field: false, message: INVITE_COPY.fullError, uncertain: false };
    case "SELECTION_EVENT_NOT_OPERATIONAL":
      return { field: false, message: INVITE_COPY.notOperational, uncertain: false };
    case "SELECTION_EVENT_NOT_AUTHORIZED":
    case "SELECTION_EVENT_NOT_AVAILABLE":
      return { field: false, message: INVITE_COPY.notAuthorized, uncertain: false };
    case "RATE_LIMIT":
      return { field: false, message: INVITE_COPY.rateLimited, uncertain: false };
    case "SELECTION_EVENT_INVALID":
      return fields.includes("message_too_long")
        ? { field: true, message: INVITE_COPY.messageTooLong(500), uncertain: false }
        : { field: false, message: INVITE_COPY.sendError, uncertain: false };
    case "TIMEOUT":
      return { field: false, message: INVITE_COPY.uncertain, uncertain: true };
    case "NETWORK":
      return { field: false, message: INVITE_COPY.offline, uncertain: true };
    default:
      return { field: false, message: INVITE_COPY.sendError, uncertain: false };
  }
}

// ── Evento (screen 04, 06) ─────────────────────────────────────────────────

/** «30 settembre 2026», «15:00 – 18:00». */
export function invitableEventLines(event: Pick<InvitableEvent, "endTime" | "startDate" | "startTime">): string[] {
  return [formatCivilDate(event.startDate, { withYear: true }), timeRange(event.startTime, event.endTime)].filter(
    (line): line is string => !!line,
  );
}

/** «Open day · Primavera». */
export function invitableEventSubtitle(event: Pick<InvitableEvent, "eventType" | "teamName">): string {
  return [event.eventType ? EVENT_TYPE_LABELS[event.eventType] : null, event.teamName || null]
    .filter(Boolean)
    .join(" · ");
}
