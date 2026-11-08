/**
 * Modello puro del wizard «Crea evento» (DAS-REV-28 §13–§17, §19, §25).
 *
 * Tre insiemi di regole, tenuti separati come lo spec li separa:
 *
 *   * **Continua** (§13): valida solo i campi necessari a lasciare lo step
 *     corrente — «non pubblica e non applica le regole complete dei passaggi
 *     successivi»;
 *   * **Salva bozza** (§13): permissiva, ma squadra obbligatoria e regole
 *     strutturali sempre (un intervallo d'anni invertito non è mai salvabile);
 *   * **Pubblica** (§19): tutti i requisiti.
 *
 * Il server rivalida tutto al commit e restituisce gli stessi codici: il
 * client li anticipa per l'errore inline, non decide al posto suo.
 */
import { VALIDATION_COPY, type ValidationCode } from "../events-copy";
import type { EventDraftValues, EventLimits } from "../events-types";

export type ComposeStep = 1 | 2 | 3;

export type ComposeField =
  | "eventType"
  | "title"
  | "teamId"
  | "startDate"
  | "startTime"
  | "endTime"
  | "venueName"
  | "venueAddress"
  | "description"
  | "requirements"
  | "years"
  | "maxParticipants"
  | "participationMode"
  | "confirmationMode"
  | "deadline"
  | "flyer"
  | "general";

export type FieldErrors = Partial<Record<ComposeField, ValidationCode>>;

export const FIELD_STEP: Record<ComposeField, ComposeStep> = {
  confirmationMode: 3,
  deadline: 3,
  description: 2,
  endTime: 1,
  eventType: 1,
  flyer: 2,
  general: 1,
  maxParticipants: 2,
  participationMode: 3,
  requirements: 2,
  startDate: 1,
  startTime: 1,
  teamId: 1,
  title: 1,
  venueAddress: 1,
  venueName: 1,
  years: 2,
};

/** Codice di dominio → campo che lo mostra. */
export function fieldOfCode(code: string): ComposeField {
  if (code.startsWith("title")) return "title";
  if (code === "type_missing") return "eventType";
  if (code.startsWith("team")) return "teamId";
  if (code === "start_missing") return "startDate";
  if (code.startsWith("start")) return "startTime";
  if (code.startsWith("end") || code === "multi_day") return "endTime";
  if (code.startsWith("venue")) return "venueName";
  if (code.startsWith("address")) return "venueAddress";
  if (code.startsWith("description")) return "description";
  if (code.startsWith("requirements")) return "requirements";
  if (code.startsWith("years")) return "years";
  if (code.startsWith("capacity")) return "maxParticipants";
  if (code === "mode_missing") return "participationMode";
  if (code === "confirmation_missing") return "confirmationMode";
  if (code.startsWith("deadline")) return "deadline";
  if (code.startsWith("flyer")) return "flyer";

  return "general";
}

function isKnownCode(code: string): code is ValidationCode {
  return code in VALIDATION_COPY;
}

/** Codici del server → errori per campo. Il primo per campo vince. */
export function errorsFromCodes(codes: readonly string[]): FieldErrors {
  const errors: FieldErrors = {};

  for (const code of codes) {
    const field = fieldOfCode(code);

    if (!errors[field]) {
      errors[field] = isKnownCode(code) ? code : "malformed";
    }
  }

  return errors;
}

/** Il primo step che contiene un errore: §13 «riprendi uno step sensato». */
export function firstStepWithError(errors: FieldErrors): ComposeStep | null {
  const steps = (Object.keys(errors) as ComposeField[]).map((field) => FIELD_STEP[field]);

  return steps.length ? (Math.min(...steps) as ComposeStep) : null;
}

export function emptyValues(): EventDraftValues {
  return {
    birthYearFrom: "",
    birthYearTo: "",
    confirmationMode: null,
    deadlineDate: null,
    deadlineTime: null,
    description: "",
    endTime: null,
    eventType: null,
    maxParticipants: "",
    participationMode: null,
    requirements: "",
    startDate: null,
    startTime: null,
    teamId: null,
    title: "",
    venueAddress: "",
    venueName: "",
    flyerMediaId: null,
  };
}

/** Lunghezza in code point, come `char_length` del server. */
function length(value: string): number {
  return Array.from(value.trim()).length;
}

/** `HH:MM` confrontabili come stringhe a larghezza fissa. */
function minutesOf(value: string | null): number | null {
  const match = value ? /^(\d{2}):(\d{2})/.exec(value) : null;

  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/**
 * Anni (§16). Interi a quattro cifre, entro i limiti, mai invertiti. Un solo
 * anno inserito si normalizza a entrambi gli estremi: lo fa
 * `normalizeYears`, prima della validazione.
 */
export function yearsError(
  from: string,
  to: string,
  limits: Pick<EventLimits, "birthYearMax" | "birthYearMin">,
): ValidationCode | null {
  const a = from.trim();
  const b = to.trim();

  if (!a && !b) {
    return null;
  }

  const valid = (value: string) => {
    if (!/^\d{4}$/.test(value)) {
      return false;
    }

    const year = Number(value);

    return year >= limits.birthYearMin && year <= limits.birthYearMax;
  };

  if ((a && !valid(a)) || (b && !valid(b)) || !a || !b) {
    return "years_invalid";
  }

  return Number(a) > Number(b) ? "years_inverted" : null;
}

/**
 * §16: «Un solo anno inserito può essere normalizzato al medesimo anno ai due
 * estremi rendendo il risultato visibile nel draft.» L'intervallo invertito
 * **non** si scambia: è un errore.
 */
export function normalizeYears(from: string, to: string): { from: string; to: string } {
  const a = from.trim();
  const b = to.trim();

  if (a && !b) return { from: a, to: a };
  if (!a && b) return { from: b, to: b };

  return { from: a, to: b };
}

/** «2008 - 2009», «2009» per l'anno singolo, `null` senza riferimento. */
export function yearsLabel(from: string, to: string): string | null {
  if (!from || !to) {
    return null;
  }

  return from === to ? from : `${from} - ${to}`;
}

/** §16: intero positivo ≥ 1, mai troncato. Vuoto = senza limite. */
export function capacityError(value: string, limits: Pick<EventLimits, "maxParticipants">): ValidationCode | null {
  const raw = value.trim();

  if (!raw) {
    return null;
  }

  if (!/^\d+$/.test(raw)) {
    return "capacity_invalid";
  }

  const parsed = Number(raw);

  return parsed >= 1 && parsed <= limits.maxParticipants ? null : "capacity_invalid";
}

/** Regole strutturali: valgono anche per la bozza. */
export function structuralErrors(values: EventDraftValues, limits: EventLimits): FieldErrors {
  const errors: FieldErrors = {};

  if (length(values.title) > limits.title) errors.title = "title_too_long";
  if (length(values.venueName) > limits.venueName) errors.venueName = "venue_too_long";
  if (length(values.venueAddress) > limits.venueAddress) errors.venueAddress = "address_too_long";
  if (length(values.description) > limits.description) errors.description = "description_too_long";
  if (length(values.requirements) > limits.requirements) errors.requirements = "requirements_too_long";

  const start = minutesOf(values.startTime);
  const end = minutesOf(values.endTime);

  if (end !== null && start === null) {
    errors.endTime = "end_without_start";
  } else if (end !== null && start !== null && end <= start) {
    errors.endTime = "end_before_start";
  }

  const years = yearsError(values.birthYearFrom, values.birthYearTo, limits);
  if (years) errors.years = years;

  const capacity = capacityError(values.maxParticipants, limits);
  if (capacity) errors.maxParticipants = capacity;

  if (
    values.participationMode !== "invite_only" &&
    values.deadlineDate &&
    values.deadlineTime &&
    values.startDate &&
    values.startTime &&
    `${values.deadlineDate}T${values.deadlineTime}` > `${values.startDate}T${values.startTime}`
  ) {
    errors.deadline = "deadline_after_start";
  }

  return errors;
}

/** Regole per lasciare lo step corrente con «Continua» (§13). */
export function stepErrors(
  step: ComposeStep,
  values: EventDraftValues,
  limits: EventLimits,
): FieldErrors {
  const structural = structuralErrors(values, limits);
  const errors: FieldErrors = {};

  for (const [field, code] of Object.entries(structural) as [ComposeField, ValidationCode][]) {
    if (FIELD_STEP[field] === step) {
      errors[field] = code;
    }
  }

  if (step === 1) {
    if (!values.eventType) errors.eventType = "type_missing";
    if (!values.title.trim()) errors.title = errors.title ?? "title_missing";
    if (!values.teamId) errors.teamId = "team_missing";
    if (!values.startDate || !values.startTime) errors.startDate = "start_missing";
    if (!values.venueName.trim()) errors.venueName = errors.venueName ?? "venue_missing";
    if (!values.venueAddress.trim()) errors.venueAddress = errors.venueAddress ?? "address_missing";
  }

  return errors;
}

/** Salva bozza (§13): squadra obbligatoria più regole strutturali. */
export function draftErrors(values: EventDraftValues, limits: EventLimits): FieldErrors {
  const errors = structuralErrors(values, limits);

  if (!values.teamId) {
    errors.teamId = "team_missing";
  }

  return errors;
}

/**
 * «Adesso» come giorno e ora civili nel fuso dell'evento. Indicativo: il
 * server rivalida l'inizio futuro con il proprio orologio (§15).
 */
export function nowInZone(timeZone: string, now: Date = new Date()): { date: string; time: string } {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
      minute: "2-digit",
      month: "2-digit",
      timeZone,
      year: "numeric",
    }).formatToParts(now);
    const read = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";

    return {
      date: `${read("year")}-${read("month")}-${read("day")}`,
      time: `${read("hour")}:${read("minute")}`,
    };
  } catch {
    const pad = (value: number) => String(value).padStart(2, "0");

    return {
      date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    };
  }
}

/** Pubblica (§19): tutti i requisiti, inizio futuro compreso. */
export function publishErrors(
  values: EventDraftValues,
  limits: EventLimits,
  timeZone: string,
  now: Date = new Date(),
): FieldErrors {
  const errors: FieldErrors = {
    ...stepErrors(3, values, limits),
    ...stepErrors(2, values, limits),
    ...stepErrors(1, values, limits),
  };

  if (values.startDate && values.startTime && !errors.startDate) {
    const current = nowInZone(timeZone, now);

    if (`${values.startDate}T${values.startTime}` <= `${current.date}T${current.time}`) {
      errors.startTime = "start_past";
    }
  }

  if (!values.participationMode) {
    errors.participationMode = "mode_missing";
  } else if (values.participationMode === "open_registration" && !values.confirmationMode) {
    errors.confirmationMode = "confirmation_missing";
  }

  return errors;
}

/** §15: termine già trascorso → avviso, mai spostato. */
export function deadlinePassed(
  values: EventDraftValues,
  timeZone: string,
  now: Date = new Date(),
): boolean {
  if (values.participationMode !== "open_registration" || !values.deadlineDate || !values.deadlineTime) {
    return false;
  }

  const current = nowInZone(timeZone, now);

  return `${values.deadlineDate}T${values.deadlineTime}` <= `${current.date}T${current.time}`;
}

/**
 * Valori del form → colonne del server.
 *
 * Testo vuoto → `null` (§8: nessun valore inventato, nessun «Evento senza
 * titolo» salvato nel titolo). Con Solo su invito conferma e termine vanno a
 * `null` (§17); il server li normalizza comunque.
 */
export function toServerFields(values: EventDraftValues): Record<string, unknown> {
  const textOrNull = (value: string) => (value.trim() ? value.trim() : null);
  const intOrNull = (value: string) => (/^\d+$/.test(value.trim()) ? Number(value.trim()) : null);
  const inviteOnly = values.participationMode === "invite_only";

  return {
    birth_year_from: intOrNull(values.birthYearFrom),
    birth_year_to: intOrNull(values.birthYearTo),
    description: values.description.trim() ? values.description : null,
    end_time: values.endTime,
    event_type: values.eventType,
    max_participants: intOrNull(values.maxParticipants),
    participation_mode: values.participationMode,
    registration_confirmation_mode: inviteOnly ? null : values.confirmationMode,
    registration_deadline_date: inviteOnly ? null : values.deadlineDate,
    registration_deadline_time: inviteOnly ? null : values.deadlineTime,
    requirements_info: values.requirements.trim() ? values.requirements : null,
    start_date: values.startDate,
    start_time: values.startTime,
    team_id: values.teamId,
    title: textOrNull(values.title),
    venue_address: textOrNull(values.venueAddress),
    venue_name: textOrNull(values.venueName),
    /* DAS-REV-29 §8: la locandina viaggia nella stessa patch del form. */
    flyer_media_id: values.flyerMediaId,
  };
}

/**
 * La patch da inviare: solo i campi cambiati rispetto all'ultima versione
 * salvata (§20: «Patch parziali non cancellano dati non caricati o non
 * modificati»). Senza una versione salvata — prima creazione — si mandano i
 * campi valorizzati, squadra compresa.
 */
export function buildPatch(
  values: EventDraftValues,
  baseline: EventDraftValues | null,
): Record<string, unknown> {
  const next = toServerFields(values);

  if (!baseline) {
    return Object.fromEntries(
      Object.entries(next).filter(([key, value]) => value !== null || key === "team_id"),
    );
  }

  const previous = toServerFields(baseline);

  return Object.fromEntries(
    Object.entries(next).filter(([key, value]) => previous[key] !== value),
  );
}

/** Un form è «sporco» se differisce dall'ultima versione salvata (§24). */
export function isDirty(values: EventDraftValues, baseline: EventDraftValues | null): boolean {
  return Object.keys(buildPatch(values, baseline ?? emptyValues())).length > 0;
}

/** Impronta stabile della richiesta: stessa patch e versione → stessa chiave. */
export function commandSignature(input: {
  eventId: string | null;
  kind: "publish" | "save";
  patch?: Record<string, unknown>;
  version: number | null;
}): string {
  const patch = input.patch
    ? Object.keys(input.patch)
        .sort()
        .map((key) => `${key}=${JSON.stringify(input.patch?.[key])}`)
        .join("&")
    : "";

  return `${input.kind}|${input.eventId ?? "-"}|${input.version ?? "-"}|${patch}`;
}

/**
 * Riesame dopo un conflitto di versione (§19, §21: «nessun overwrite
 * silenzioso»).
 *
 * Merge a tre vie per campo: ciò che l'utente ha modificato rispetto alla
 * versione da cui era partito resta suo; tutto il resto prende il valore
 * attuale del server. Così il salvataggio successivo manda **solo** le sue
 * modifiche, e un campo cambiato da un altro dispositivo e mai toccato qui
 * non viene riportato indietro.
 */
export function mergeAfterConflict(
  local: EventDraftValues,
  startedFrom: EventDraftValues,
  server: EventDraftValues,
): EventDraftValues {
  const merged = { ...server };

  for (const key of Object.keys(local) as (keyof EventDraftValues)[]) {
    if (local[key] !== startedFrom[key]) {
      (merged as Record<string, unknown>)[key] = local[key];
    }
  }

  return merged;
}

/** I campi cambiati da entrambe le parti: il riesame li mostra all'utente. */
export function conflictingFields(
  local: EventDraftValues,
  startedFrom: EventDraftValues,
  server: EventDraftValues,
): (keyof EventDraftValues)[] {
  return (Object.keys(local) as (keyof EventDraftValues)[]).filter(
    (key) =>
      local[key] !== startedFrom[key] &&
      server[key] !== startedFrom[key] &&
      server[key] !== local[key],
  );
}
