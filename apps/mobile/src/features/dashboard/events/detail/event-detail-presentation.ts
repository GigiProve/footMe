/**
 * Derivazioni pure del dettaglio evento, dello stato personale e delle
 * richieste (DAS-REV-29 §10, §14, §16, §18, §19, §20, §25).
 *
 * Qui sta la logica che la matrice QA verifica riga per riga — quale stato
 * prevale, quale CTA compare, quando l'avviso sugli anni si mostra, come si
 * normalizza il messaggio — perché si prova senza montare la schermata.
 *
 * Nessuna capability viene **dedotta** qui: `register`, `withdraw` e
 * `register_again` arrivano dal server (§20: «Non derivare tutto da label o
 * colore»). Questo file decide solo le parole e l'ordine.
 *
 * Date e orari sono civili nel fuso dell'evento: si formattano, mai si
 * convertono (§11).
 */
import { formatRole } from "../../../profiles/profile-display-helpers";
import { yearsLabel } from "../compose/event-compose-model";
import { EVENT_TYPE_LABELS } from "../events-copy";
import { formatCivilDate, formatTime } from "../events-presentation";
import { SelectionEventsError, type SelectionEventsErrorCode } from "../events-service";
import type {
  EventPublicProjection,
  EventRequestDetail,
  ParticipationStatus,
  SelectionEventDetail,
} from "./event-detail-types";

export const DETAIL_COPY = {
  // Società (screen 01)
  share: "Condividi evento",
  copyLink: "Copia link evento",
  edit: "Modifica evento",
  linkCopied: "Link copiato.",
  copyFailed: "Impossibile copiare il link. Riprova.",
  shareUnavailable: "Il link pubblico non è disponibile per questo evento.",
  pendingEyebrow: "Richieste da valutare",
  confirmedSuffix: "confermati",

  // Contenuti
  yearsTitle: "Anni di nascita di riferimento",
  descriptionTitle: "Descrizione",
  requirementsTitle: "Requisiti",
  modeAutomatic: "Conferma automatica",
  modeManual: "Conferma della Società",
  modeManualHelper: "La Società deve confermare ogni partecipazione.",

  // Persona (screen 08–15)
  register: "Iscriviti",
  registerAgain: "Iscriviti di nuovo",
  withdrawRequest: "Ritira richiesta",
  cancelParticipation: "Annulla partecipazione",
  confirmedTitle: "Iscrizione confermata",
  confirmedBody: "La tua partecipazione è confermata.",
  pendingTitle: "Richiesta inviata",
  pendingBody: "La Società deve ancora confermare la tua partecipazione.",
  pendingNoSeat: "La richiesta non riserva un posto.",
  rejectedTitle: "Richiesta non accettata",
  withdrawnRequestTitle: "Richiesta ritirata",
  cancelledParticipationTitle: "Partecipazione annullata",
  registerAgainBody: "Puoi iscriverti di nuovo finché le iscrizioni sono aperte.",
  clubMessageTitle: (club: string) => `Messaggio di ${club}`,
  fullTitle: "Posti esauriti",
  fullAutomaticBody: "L’evento ha raggiunto il numero massimo di partecipanti.",
  /* §10: copy obbligatoria per manuale pieno, identica in dettaglio e sheet. */
  fullManualBody:
    "Puoi inviare una richiesta. La partecipazione richiede un posto libero e la conferma della Società.",
  closedTitle: "Iscrizioni chiuse",
  closedBody: "Il termine per inviare nuove richieste è trascorso.",
  cancelledTitle: "Evento annullato",
  cancelledBody: "Questo evento non è più disponibile per la partecipazione.",
  completedTitle: "Evento concluso",
  completedBody: "Le iscrizioni a questo evento sono terminate.",
  notEligible: "Non puoi eseguire questa azione con il profilo attuale.",

  // Sheet di iscrizione (screen 09–10)
  sheetTitle: "Iscriviti all’evento",
  sheetProfileNote: "L’iscrizione utilizzerà il tuo profilo PROLINK.",
  sheetManualNote: "La Società dovrà confermare la tua partecipazione.",
  sheetYearsWarning: "Il tuo anno di nascita non rientra tra quelli indicati dalla Società.",
  sheetYearsProceed: "Puoi comunque procedere con l’iscrizione.",
  sheetConfirm: "Conferma iscrizione",
  cancel: "Annulla",

  // Ritiro (screen 13)
  withdrawTitle: "Ritirare la richiesta?",
  withdrawBody: "La tua richiesta non sarà più in valutazione per questo evento.",
  cancelParticipationTitle: "Annullare la partecipazione?",
  cancelParticipationBody: "Non risulterai più tra i partecipanti confermati all’evento.",

  // Società: richiesta (screen 16–17)
  requestTitle: "Richiesta di partecipazione",
  requestEvent: "Evento",
  requestStatus: "Stato",
  requestConfirmed: "Partecipanti confermati",
  viewProfile: "Visualizza profilo",
  confirmParticipation: "Conferma partecipazione",
  reject: "Non accettare",
  noSeats: "Non ci sono posti disponibili.",
  rejectTitle: "Non accettare la richiesta?",
  rejectBody: (name: string) => `${name} non risulterà tra i partecipanti all’evento.`,
  rejectMessageLabel: (firstName: string) => `Messaggio per ${firstName} — opzionale`,
  rejectPlaceholder: "Aggiungi un breve messaggio…",
  rejectHelper: "Il messaggio verrà inviato insieme all’aggiornamento della richiesta.",
  rejectTooLong: (limit: number) => `Il messaggio può contenere al massimo ${limit} caratteri.`,

  // Errori (§25)
  registerError: "Impossibile completare l’iscrizione. Riprova.",
  requestError: "Impossibile aggiornare la richiesta. Riprova.",
  participationError: "Impossibile aggiornare la partecipazione. Riprova.",
  changed: "La richiesta è stata aggiornata. Controlla lo stato corrente.",
  offline: "Connessione assente. Riprova quando sei online.",
  closedShort: "Iscrizioni chiuse.",
  loadError: "Impossibile caricare l’evento. Riprova.",
  unavailableTitle: "Contenuto non disponibile",
  unavailableBody: "Questo contenuto non è disponibile.",
  retry: "Riprova",
  uncertain: "Stiamo verificando l’esito. Controlla lo stato tra un momento.",
  loginToContinue: "Accedi per continuare",
} as const;

// ── Formattazione condivisa ────────────────────────────────────────────────

/** «Open day · Primavera». */
export function eventSubtitle(event: Pick<EventPublicProjection, "eventType" | "teamName">): string {
  return [event.eventType ? EVENT_TYPE_LABELS[event.eventType] : null, event.teamName || null]
    .filter(Boolean)
    .join(" · ");
}

/** «15:00 – 18:00», o solo l'inizio. */
export function timeRange(start: string | null, end: string | null): string | null {
  const from = formatTime(start);
  const to = formatTime(end);

  return from ? (to ? `${from} – ${to}` : from) : null;
}

/** Due righe del blocco data: giorno con anno, poi orari (screen 01, 08). */
export function whenLines(
  event: Pick<EventPublicProjection, "endTime" | "startDate" | "startTime">,
): string[] {
  return [
    formatCivilDate(event.startDate, { withYear: true }),
    timeRange(event.startTime, event.endTime),
  ].filter((line): line is string => !!line);
}

/** «30 settembre 2026 · 15:00 – 18:00» per sheet e richiesta. */
export function whenInline(
  event: Pick<EventPublicProjection, "endTime" | "startDate" | "startTime">,
): string | null {
  const lines = whenLines(event);

  return lines.length > 0 ? lines.join(" · ") : null;
}

export function venueLines(event: Pick<EventPublicProjection, "venueAddress" | "venueName">): string[] {
  return [event.venueName, event.venueAddress].filter((line): line is string => !!line);
}

/**
 * Riga capienza.
 *
 *   · Società: «32 / 50 confermati» o «32 confermati» senza limite (il suo
 *     count privato non ha bisogno di un denominatore);
 *   · persona: solo con un limite, perché la proiezione pubblica omette il
 *     count senza limite (§11: niente «illimitati»).
 */
export function capacityLine(detail: SelectionEventDetail): string | null {
  if (detail.management) {
    const confirmed = detail.management.confirmedCount;

    return detail.maxParticipants !== null
      ? `${confirmed} / ${detail.maxParticipants} ${DETAIL_COPY.confirmedSuffix}`
      : `${confirmed} ${DETAIL_COPY.confirmedSuffix}`;
  }

  return detail.maxParticipants !== null && detail.confirmedCount !== null
    ? `${detail.confirmedCount} / ${detail.maxParticipants} ${DETAIL_COPY.confirmedSuffix}`
    : null;
}

export function eventYearsLabel(from: number | null, to: number | null): string | null {
  return from !== null && to !== null ? yearsLabel(String(from), String(to)) : null;
}

/** «Calciatore · Classe 2008». */
export function personMeta(role: string | null, birthYear: number | null): string {
  return [role ? formatRole(role) : null, birthYear ? `Classe ${birthYear}` : null]
    .filter(Boolean)
    .join(" · ");
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

// ── Stato personale (§20) ──────────────────────────────────────────────────

export type NoticeTone = "neutral" | "warning";
export type NoticeIcon =
  | "checkmark-circle"
  | "time-outline"
  | "refresh-outline"
  | "close-circle"
  | "people-outline"
  | "warning-outline"
  | "lock-closed-outline"
  | "alert-circle-outline"
  | "flag-outline"
  | "person-outline";

export type Notice = {
  icon: NoticeIcon;
  lines: string[];
  title: string;
  tone: NoticeTone;
};

export type PersonalAction = "register" | "register_again" | "withdraw_request" | "cancel_participation";

/**
 * Cosa mostra la parte personale del dettaglio, in ordine di precedenza
 * (§20):
 *
 *   1. un evento annullato o concluso è **dominante** (notice di evento),
 *      ma lo storico personale resta leggibile senza azioni;
 *   2. con una partecipazione, lo stato personale prevale sulla CTA generica
 *      (§3.7: un confermato non vede «Posti esauriti»);
 *   3. senza partecipazione, la matrice di §10.
 */
export type PersonalView = {
  action: { kind: PersonalAction; label: string } | null;
  /** Avviso sull'evento: chiuso, pieno, annullato, concluso, non eleggibile. */
  eventNotice: Notice | null;
  /** «Messaggio di AC Como», solo se il testo esiste (§18, QA-103). */
  message: { body: string; title: string } | null;
  /** Riga «Conferma automatica» / «Conferma della Società» prima della CTA. */
  modeLine: { helper: string | null; label: string } | null;
  /** Lo stato della propria partecipazione. */
  status: Notice | null;
};

function statusNotice(detail: SelectionEventDetail): Notice | null {
  const participation = detail.personal.participation;

  if (!participation) {
    return null;
  }

  switch (participation.status) {
    case "confirmed":
      return {
        icon: "checkmark-circle",
        lines: [DETAIL_COPY.confirmedBody],
        title: DETAIL_COPY.confirmedTitle,
        tone: "neutral",
      };
    case "pending":
      return {
        icon: "time-outline",
        lines: [
          DETAIL_COPY.pendingBody,
          ...(detail.availability.isFull ? [DETAIL_COPY.pendingNoSeat] : []),
        ],
        title: DETAIL_COPY.pendingTitle,
        tone: "neutral",
      };
    case "rejected":
      return { icon: "close-circle", lines: [], title: DETAIL_COPY.rejectedTitle, tone: "neutral" };
    case "withdrawn":
      return {
        icon: "refresh-outline",
        lines: detail.personal.capabilities.registerAgain ? [DETAIL_COPY.registerAgainBody] : [],
        title:
          participation.withdrawnFrom === "confirmed"
            ? DETAIL_COPY.cancelledParticipationTitle
            : DETAIL_COPY.withdrawnRequestTitle,
        tone: "neutral",
      };
    default:
      return null;
  }
}

function lifecycleNotice(detail: SelectionEventDetail): Notice | null {
  if (detail.status === "cancelled") {
    return {
      icon: "alert-circle-outline",
      lines: [DETAIL_COPY.cancelledBody],
      title: DETAIL_COPY.cancelledTitle,
      tone: "neutral",
    };
  }

  if (detail.status === "completed") {
    return {
      icon: "flag-outline",
      lines: [DETAIL_COPY.completedBody],
      title: DETAIL_COPY.completedTitle,
      tone: "neutral",
    };
  }

  return null;
}

function modeLine(detail: SelectionEventDetail): PersonalView["modeLine"] {
  const mode = detail.availability.confirmationMode ?? detail.confirmationMode;

  if (mode === "automatic") {
    return { helper: null, label: DETAIL_COPY.modeAutomatic };
  }

  if (mode === "manual") {
    return { helper: DETAIL_COPY.modeManualHelper, label: DETAIL_COPY.modeManual };
  }

  return null;
}

/**
 * `canActPersonally` = la Dashboard opera come persona. §13: «Se l'actor sta
 * operando come Società/Media, non inviare l'iscrizione come quella identity
 * e non cambiare contesto silenziosamente.» Il server non conosce l'identità
 * scelta nel client, quindi il gate è qui: lo stato personale resta
 * leggibile, ogni azione sparisce con la spiegazione.
 */
export function personalView(
  detail: SelectionEventDetail,
  options: { canActPersonally?: boolean } = {},
): PersonalView {
  const view = personalViewFor(detail);

  if (options.canActPersonally === false && view.action) {
    return {
      ...view,
      action: null,
      eventNotice: view.eventNotice ?? {
        icon: "person-outline",
        lines: [DETAIL_COPY.notEligible],
        title: view.action.label,
        tone: "neutral",
      },
    };
  }

  return view;
}

function personalViewFor(detail: SelectionEventDetail): PersonalView {
  const { capabilities, participation } = detail.personal;
  const terminal = lifecycleNotice(detail);
  const status = statusNotice(detail);
  const message =
    participation?.status === "rejected" && participation.decisionMessage
      ? {
          body: participation.decisionMessage,
          title: DETAIL_COPY.clubMessageTitle(detail.club.name),
        }
      : null;

  // 1. Evento terminato: dominante, storico personale senza azioni.
  if (terminal) {
    return { action: null, eventNotice: terminal, message, modeLine: null, status };
  }

  // 2. Partecipazione esistente: lo stato personale prevale.
  if (participation) {
    let action: PersonalView["action"] = null;

    if (participation.status === "confirmed" && capabilities.withdraw) {
      action = { kind: "cancel_participation", label: DETAIL_COPY.cancelParticipation };
    } else if (participation.status === "pending" && capabilities.withdraw) {
      action = { kind: "withdraw_request", label: DETAIL_COPY.withdrawRequest };
    } else if (participation.status === "withdrawn" && capabilities.registerAgain) {
      action = { kind: "register_again", label: DETAIL_COPY.registerAgain };
    }

    /* Dopo un ritiro, se la reiscrizione non è possibile, si dice perché con
       la stessa matrice della CTA generica. */
    const eventNotice =
      participation.status === "withdrawn" && !capabilities.registerAgain
        ? availabilityNotice(detail)
        : null;

    return { action, eventNotice, message, modeLine: null, status };
  }

  // 3. Nessuna partecipazione: matrice di §10.
  const notice = availabilityNotice(detail);

  return {
    action: capabilities.register ? { kind: "register", label: DETAIL_COPY.register } : null,
    eventNotice: notice,
    message: null,
    modeLine: detail.availability.registrationOpen ? modeLine(detail) : null,
    status: null,
  };
}

/** La riga di §10 per chi non ha una partecipazione attiva. */
export function availabilityNotice(detail: SelectionEventDetail): Notice | null {
  const { availability, personal } = detail;

  switch (availability.publicState) {
    case "closed":
      return { icon: "lock-closed-outline", lines: [DETAIL_COPY.closedBody], title: DETAIL_COPY.closedTitle, tone: "neutral" };
    case "full":
      return { icon: "people-outline", lines: [DETAIL_COPY.fullAutomaticBody], title: DETAIL_COPY.fullTitle, tone: "neutral" };
    case "open_full_manual":
      return { icon: "warning-outline", lines: [DETAIL_COPY.fullManualBody], title: DETAIL_COPY.fullTitle, tone: "neutral" };
    case "cancelled":
    case "completed":
      return lifecycleNotice(detail);
    case "open":
    default:
      /* §13: la persona non autorizzata legge l'evento e capisce perché non
         può iscriversi; non vede una CTA che il server rifiuterebbe. */
      return personal.ineligibleReason
        ? { icon: "person-outline", lines: [DETAIL_COPY.notEligible], title: DETAIL_COPY.register, tone: "neutral" }
        : null;
  }
}

/** Contenuti del sheet di iscrizione (§14, screen 09–10). */
export type RegisterSheetModel = {
  confirmLabel: string;
  notes: string[];
  yearsWarning: { lines: [string, string] } | null;
};

export function registerSheetModel(detail: SelectionEventDetail): RegisterSheetModel {
  const manual = (detail.availability.confirmationMode ?? detail.confirmationMode) === "manual";
  const notes: string[] = [DETAIL_COPY.sheetProfileNote];

  if (manual) {
    notes.push(DETAIL_COPY.sheetManualNote);

    if (detail.availability.isFull) {
      notes.push(DETAIL_COPY.fullManualBody);
    }
  }

  return {
    confirmLabel: DETAIL_COPY.sheetConfirm,
    notes,
    /* §14: solo con un intervallo e un anno nel profilo; mai «Idoneo». */
    yearsWarning: detail.personal.birthYearMismatch
      ? { lines: [DETAIL_COPY.sheetYearsWarning, DETAIL_COPY.sheetYearsProceed] }
      : null,
  };
}

/** Sheet di ritiro (§19, screen 13). */
export function withdrawSheetCopy(status: ParticipationStatus) {
  return status === "confirmed"
    ? {
        body: DETAIL_COPY.cancelParticipationBody,
        confirm: DETAIL_COPY.cancelParticipation,
        title: DETAIL_COPY.cancelParticipationTitle,
      }
    : {
        body: DETAIL_COPY.withdrawBody,
        confirm: DETAIL_COPY.withdrawRequest,
        title: DETAIL_COPY.withdrawTitle,
      };
}

// ── Società ─────────────────────────────────────────────────────────────────

/**
 * Azioni dirette dello screen 01 (§9): Condividi primaria, Copia link
 * secondaria, Modifica solo con permesso effettivo. Nessun menu intermedio.
 */
export function societyActions(detail: SelectionEventDetail, url: string | null) {
  const management = detail.management;

  return {
    canCopy: !!management?.canShare && !!url,
    canEdit: !!management?.canEdit,
    canShare: !!management?.canShare && !!url,
    /* §9: per lo storico pubblico wording neutro; nessuna promessa di
       iscrizioni nel messaggio condiviso. */
    shareMessage: (clubName: string) =>
      [detail.title ?? "", clubName, url ?? ""].filter(Boolean).join("\n"),
  };
}

export const REQUEST_STATUS_LABELS: Record<ParticipationStatus, string> = {
  confirmed: "Confermata",
  pending: "In attesa",
  rejected: "Non accettata",
  withdrawn: "Ritirata",
};

export function requestCapacityLine(request: EventRequestDetail): string {
  return request.event.maxParticipants !== null
    ? `${request.event.confirmedCount} / ${request.event.maxParticipants}`
    : String(request.event.confirmedCount);
}

// ── Messaggio della non accettazione (§18) ─────────────────────────────────

/** Solo spazi → null; il server applica la stessa regola. */
export function normalizeDecisionMessage(value: string): string | null {
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

export function decisionMessageError(value: string, limit: number): string | null {
  const normalized = normalizeDecisionMessage(value);

  return normalized && normalized.length > limit ? DETAIL_COPY.rejectTooLong(limit) : null;
}

// ── Errori dei comandi (§21, §25) ──────────────────────────────────────────

export type CommandKind = "register" | "withdraw" | "decision";

/**
 * Validation, conflitto, permesso e rete restano distinguibili (§21). Il
 * chiamante usa `refresh` per rileggere lo stato reale invece di insistere
 * con una CTA non più valida (§25).
 */
export function commandErrorCopy(
  error: unknown,
  kind: CommandKind,
): { message: string; refresh: boolean; uncertain: boolean } {
  const code: SelectionEventsErrorCode | null =
    error instanceof SelectionEventsError ? error.code : null;
  const fallback =
    kind === "register"
      ? DETAIL_COPY.registerError
      : kind === "withdraw"
        ? DETAIL_COPY.participationError
        : DETAIL_COPY.requestError;

  switch (code) {
    case "NETWORK":
      return { message: DETAIL_COPY.offline, refresh: false, uncertain: true };
    case "TIMEOUT":
      return { message: DETAIL_COPY.uncertain, refresh: true, uncertain: true };
    case "SELECTION_EVENT_FULL":
      return {
        message: kind === "decision" ? DETAIL_COPY.noSeats : `${DETAIL_COPY.fullTitle}. ${DETAIL_COPY.fullAutomaticBody}`,
        refresh: true,
        uncertain: false,
      };
    case "SELECTION_EVENT_REGISTRATION_CLOSED":
      return { message: DETAIL_COPY.closedShort, refresh: true, uncertain: false };
    case "SELECTION_EVENT_NOT_ELIGIBLE":
    case "SELECTION_EVENT_NOT_AUTHORIZED":
    case "SELECTION_EVENT_REGISTRATION_REJECTED":
      return { message: DETAIL_COPY.notEligible, refresh: true, uncertain: false };
    case "SELECTION_EVENT_PARTICIPATION_CHANGED":
    case "SELECTION_EVENT_NOT_OPERATIONAL":
    case "OPERATION_CONTENT_CHANGED":
      return { message: DETAIL_COPY.changed, refresh: true, uncertain: false };
    case "SELECTION_EVENT_NOT_AVAILABLE":
      return { message: DETAIL_COPY.unavailableBody, refresh: true, uncertain: false };
    default:
      return { message: fallback, refresh: false, uncertain: false };
  }
}
