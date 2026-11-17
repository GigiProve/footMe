/**
 * Derivazioni pure del selector Notifiche (DAS-REV-34 §8, §9, §25, §29).
 * Niente rete e niente supabase: testabile senza render.
 *
 *  · §9 le cinque opzioni V1, esatte e nell'ordine della tavola (PNG 02);
 *    nessuna «Solo menzioni», priorità, keyword o orario (QA-022);
 *  · §8 valore della riga Info «Attive» / «Silenziose» e label accessibile con
 *    lo stato (non solo colore o icona, §29);
 *  · §9 una risposta si applica solo se la sua `state_version` non è minore di
 *    quella in cache: una risposta tardiva non ripristina la scelta
 *    precedente. Un periodo diverso (GROUP, nuovo ingresso) riparte da zero;
 *  · §9, §25 esito di un comando: un rifiuto del server (non membro, periodo
 *    finito, gruppo eliminato) è definitivo e chiude l'intento; ogni altro
 *    errore è incerto e conserva l'operation id (il retry non ricalcola la durata).
 */
import type {
  ConversationKind,
  ConversationNotificationState,
  MuteChoice,
  MuteOption,
} from "./mute-types";

export const NOTIFICATIONS_COPY = {
  active: "Attive",
  error: "Non è stato possibile aggiornare le notifiche. Riprova.",
  helper: "I messaggi continueranno ad arrivare.",
  muted: "Silenziose",
  rowLabel: "Notifiche",
  saving: "Salvataggio in corso",
  title: "Notifiche",
} as const;

/** Le cinque opzioni V1, nell'ordine della tavola. Una sola è selezionata. */
export const MUTE_OPTIONS: readonly { label: string; value: MuteChoice }[] = [
  { label: "Attive", value: "active" },
  { label: "Silenzia per 1 ora", value: "1h" },
  { label: "Silenzia per 8 ore", value: "8h" },
  { label: "Silenzia per 1 settimana", value: "1w" },
  { label: "Silenzia finché non le riattivi", value: "indefinite" },
];

const MUTE_OPTION_VALUES: readonly string[] = ["1h", "8h", "1w", "indefinite"];

/** Scelta che lo stato del server rappresenta. Un mute scaduto (`isMuted` false) è Attive. */
export function muteChoiceOf(state: ConversationNotificationState | null): MuteChoice {
  if (!state || !state.isMuted) {
    return "active";
  }

  return state.muteOption ?? "indefinite";
}

/** Valore della riga Info (§8). */
export function muteValueLabel(state: ConversationNotificationState | null): string {
  return state?.isMuted ? NOTIFICATIONS_COPY.muted : NOTIFICATIONS_COPY.active;
}

/** «Notifiche, Silenziose»: lo stato si annuncia, non si lascia al solo colore (§29). */
export function muteRowA11yLabel(state: ConversationNotificationState | null): string {
  return `${NOTIFICATIONS_COPY.rowLabel}, ${muteValueLabel(state)}`;
}

/** La preferenza personale resta modificabile anche in ARCHIVED (§8): lo decide `can_change` del server. */
export function canChangeMute(state: ConversationNotificationState | null): boolean {
  return !!state && state.canChange;
}

/* -------------------------------------------------------------------------- */
/* Lettura della risposta                                                     */
/* -------------------------------------------------------------------------- */

function text(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function version(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  // Un bigint può arrivare serializzato come stringa.
  return typeof value === "string" && /^\d+$/.test(value) ? Number(value) : 0;
}

/**
 * jsonb del server → forma interna. Null se il payload non è interpretabile
 * (mai uno stato inventato: l'assenza di stato nasconde la riga, non la finge).
 */
export function parseNotificationState(
  raw: unknown,
  fallbackConversationId: string,
): ConversationNotificationState | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const row = raw as Record<string, unknown>;
  const kind = String(row.conversation_type ?? "").toLowerCase();
  const option = text(row.mute_option);
  const conversationType: ConversationKind = kind === "group" ? "group" : "direct";

  return {
    canChange: row.can_change === true,
    conversationId: text(row.conversation_id) ?? fallbackConversationId,
    conversationType,
    isMuted: row.is_muted === true,
    muteOption: option && MUTE_OPTION_VALUES.includes(option) ? (option as MuteOption) : null,
    mutedUntil: text(row.muted_until),
    periodId: text(row.period_id),
    stateVersion: version(row.state_version),
  };
}

/* -------------------------------------------------------------------------- */
/* Versioni                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * §9: «una risposta vecchia non sovrascrive una nuova». Si applica se non c'è
 * niente in cache, se la versione non è minore, o se il periodo è cambiato (un
 * nuovo periodo riparte da zero: la sua versione non è confrontabile, §14).
 */
export function shouldApplyState(
  cached: ConversationNotificationState | null | undefined,
  incoming: ConversationNotificationState,
): boolean {
  if (!cached) {
    return true;
  }

  if (cached.periodId !== incoming.periodId) {
    return true;
  }

  return incoming.stateVersion >= cached.stateVersion;
}

/**
 * Un tap che non cambia nulla non è un comando: «Attive» su Attive, «finché non
 * le riattivi» su indefinito. Una durata temporanea invece è sempre un comando:
 * «una nuova scelta esplicita può impostare una nuova durata» (§9).
 */
export function isNoopChoice(
  state: ConversationNotificationState | null,
  choice: MuteChoice,
): boolean {
  if (choice === "1h" || choice === "8h" || choice === "1w") {
    return false;
  }

  return muteChoiceOf(state) === choice;
}

/** Lo stato riletto dal server realizza la scelta che l'utente voleva? */
export function stateMatchesChoice(
  state: ConversationNotificationState,
  choice: MuteChoice,
): boolean {
  return muteChoiceOf(state) === choice;
}

/* -------------------------------------------------------------------------- */
/* Errori                                                                     */
/* -------------------------------------------------------------------------- */

export type MuteErrorKind =
  | "deleted"
  | "forbidden"
  | "invalid_operation"
  | "invalid_option"
  | "not_member"
  | "period_ended"
  /** Rete, timeout, 5xx: il comando può essere stato eseguito (§9). */
  | "uncertain";

function errorText(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message: unknown }).message;

    return typeof message === "string" ? message : "";
  }

  return "";
}

export function classifyMuteError(error: unknown): MuteErrorKind {
  const message = errorText(error);

  if (message.includes("NOT_MEMBER")) {
    return "not_member";
  }

  if (message.includes("PERIOD_ENDED")) {
    return "period_ended";
  }

  if (message.includes("GROUP_DELETED")) {
    return "deleted";
  }

  if (message.includes("INVALID_OPTION")) {
    return "invalid_option";
  }

  // Id dell'intento rifiutato dal server: un retry con lo stesso id fallirebbe all'infinito.
  if (message.includes("INVALID_OPERATION_ID")) {
    return "invalid_operation";
  }

  if (error && typeof error === "object" && (error as { code?: unknown }).code === "42501") {
    return "forbidden";
  }

  return "uncertain";
}

/** Un rifiuto definitivo chiude l'intento: il tentativo dopo è un comando nuovo. */
export function isSettledMuteError(kind: MuteErrorKind): boolean {
  return kind !== "uncertain";
}

/** Accesso perso: la superficie privata si chiude con i segnali di revoca già esistenti (33). */
export function isMuteAccessLost(kind: MuteErrorKind): boolean {
  return kind === "not_member" || kind === "period_ended" || kind === "deleted";
}
