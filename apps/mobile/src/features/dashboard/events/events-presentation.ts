/**
 * Derivazioni pure del Centro Provini, stage e open day (DAS-REV-28 §10–§12,
 * §25).
 *
 * Qui stanno le regole che la task verifica riga per riga — quali sezioni si
 * mostrano, cosa dice una riga per ogni stato, quando un conteggio si omette
 * — perché si provano senza montare la schermata.
 *
 * Date e orari sono già **civili nel fuso dell'evento** (§15): questo file li
 * formatta, non li converte. Nessun `new Date(...)` su un giorno civile,
 * che lo interpreterebbe in UTC e potrebbe spostarlo.
 */
import {
  EVENTS_COPY,
  EVENT_TYPE_LABELS,
} from "./events-copy";
import type {
  EventSection,
  SelectionEventRow,
  SelectionEventsPage,
} from "./events-types";

const MONTHS = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
] as const;

type CivilParts = { day: number; month: number; year: number };

export function parseCivilDate(value: string | null | undefined): CivilParts | null {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;

  if (!match) {
    return null;
  }

  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];

  return month >= 1 && month <= 12 && day >= 1 && day <= 31 ? { day, month, year } : null;
}

/**
 * «30 settembre», oppure «30 settembre 2026» quando l'anno serve.
 *
 * `currentYear` è un parametro: il confronto visuale e i test fissano
 * l'orologio (§6: «Le date dei test possono essere spostate»).
 */
export function formatCivilDate(
  value: string | null | undefined,
  options: { currentYear?: number; withYear?: boolean } = {},
): string | null {
  const parts = parseCivilDate(value);

  if (!parts) {
    return null;
  }

  const label = `${parts.day} ${MONTHS[parts.month - 1]}`;
  const showYear =
    options.withYear ||
    (options.currentYear !== undefined && options.currentYear !== parts.year);

  return showYear ? `${label} ${parts.year}` : label;
}

/** «15:00». Il server manda `HH:MM:SS`, il form `HH:MM`. */
export function formatTime(value: string | null | undefined): string | null {
  return value && /^\d{2}:\d{2}/.test(value) ? value.slice(0, 5) : null;
}

/** «30 settembre · 15:00», o solo il giorno se l'ora manca. */
export function formatWhen(
  row: Pick<SelectionEventRow, "startDate" | "startTime">,
  options: { currentYear?: number; withYear?: boolean } = {},
): string | null {
  const date = formatCivilDate(row.startDate, options);

  if (!date) {
    return null;
  }

  const time = formatTime(row.startTime);

  return time ? `${date} · ${time}` : date;
}

/** §11: «Se il titolo non è ancora stato inserito, mostra Evento senza titolo.» */
export function eventTitle(row: Pick<SelectionEventRow, "title">): string {
  return row.title?.trim() ? row.title : EVENTS_COPY.untitled;
}

/**
 * «Open day · Primavera». §11: «Se manca il tipo, ometti quel metadato
 * invece di indovinare.»
 */
export function eventContextLine(
  row: Pick<SelectionEventRow, "eventType" | "teamName">,
): string {
  return [row.eventType ? EVENT_TYPE_LABELS[row.eventType] : null, row.teamName || null]
    .filter(Boolean)
    .join(" · ");
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/**
 * Conteggio di un evento in programma (§11).
 *
 *   «32 / 50 confermati · 8 in attesa» oppure «32 confermati» senza limite.
 *   Mai «∞», mai «32/illimitati», mai «0 in attesa».
 *
 * `null` quando i conteggi non sono disponibili: §11 vieta di mascherare un
 * errore del servizio conteggi come «0 confermati».
 */
export function upcomingCountsLabel(
  row: Pick<
    SelectionEventRow,
    "confirmedCount" | "countsAvailable" | "maxParticipants" | "pendingRequestsCount"
  >,
): string | null {
  if (!row.countsAvailable || row.confirmedCount === null) {
    return null;
  }

  const confirmed =
    row.maxParticipants !== null
      ? `${row.confirmedCount} / ${row.maxParticipants} ${plural(row.maxParticipants, "confermato", "confermati")}`
      : `${row.confirmedCount} ${plural(row.confirmedCount, "confermato", "confermati")}`;

  const pending =
    row.pendingRequestsCount !== null && row.pendingRequestsCount > 0
      ? `${row.pendingRequestsCount} in attesa`
      : null;

  return pending ? `${confirmed} · ${pending}` : confirmed;
}

/**
 * Conteggio finale dello storico (§11). «N partecipanti» non certifica
 * presenza fisica; un Annullato lo omette.
 */
export function historyCountsLabel(
  row: Pick<SelectionEventRow, "confirmedCount" | "countsAvailable" | "status">,
): string | null {
  if (row.status !== "completed" || !row.countsAvailable || row.confirmedCount === null) {
    return null;
  }

  return `${row.confirmedCount} ${plural(row.confirmedCount, "partecipante", "partecipanti")}`;
}

export function historyStatusLabel(row: Pick<SelectionEventRow, "status">): string | null {
  return row.status === "completed"
    ? EVENTS_COPY.completed
    : row.status === "cancelled"
      ? EVENTS_COPY.cancelled
      : null;
}

/**
 * Le righe di testo di una riga del Centro, nell'ordine in cui compaiono.
 *
 * Una funzione sola per le tre sezioni: §11 descrive tre forme della stessa
 * riga, e tenerle insieme impedisce che un metadato compaia per errore dove
 * la regola lo esclude (QA-017: nessun conteggio sulle bozze).
 */
export type EventRowLines = {
  context: string;
  counts: string | null;
  full: boolean;
  status: string | null;
  title: string;
  when: string | null;
};

export function eventRowLines(
  row: SelectionEventRow,
  section: EventSection,
  options: { currentYear?: number } = {},
): EventRowLines {
  const title = eventTitle(row);
  const context = eventContextLine(row);

  if (section === "drafts") {
    return {
      context,
      counts: null,
      full: false,
      status: null,
      title,
      when: formatWhen(row, options) ?? EVENTS_COPY.dateMissing,
    };
  }

  if (section === "history") {
    return {
      context,
      counts: historyCountsLabel(row),
      full: false,
      status: historyStatusLabel(row),
      title,
      /* Lo storico porta sempre l'anno: §11 «data», e nel PNG «18 luglio
         2026». Senza data — record storici — la riga resta leggibile. */
      when: formatCivilDate(row.startDate, { withYear: true }),
    };
  }

  return {
    context,
    counts: upcomingCountsLabel(row),
    /* §11: «Posti esauriti è un'informazione testuale secondaria», non uno
       stato e non un allarme. */
    full: row.isFull,
    status: null,
    title,
    /* §12: un PUBLISHED legacy senza data non fa crash ed è segnalato. */
    when: formatWhen(row, options) ?? EVENTS_COPY.dateIncomplete,
  };
}

export function rowAccessibilityLabel(lines: EventRowLines): string {
  return [
    lines.title,
    lines.context,
    lines.when,
    lines.counts,
    lines.full ? EVENTS_COPY.full : null,
    lines.status,
  ]
    .filter(Boolean)
    .join(", ");
}

export const SECTION_TITLES: Record<EventSection, string> = {
  drafts: EVENTS_COPY.sectionDrafts,
  history: EVENTS_COPY.sectionHistory,
  upcoming: EVENTS_COPY.sectionUpcoming,
};

/**
 * Stato del Centro a partire dalle tre sezioni (§10, §24).
 *
 *   * `loading` finché una sezione non ha risposto la prima volta;
 *   * `error` se **tutte** le sezioni sono fallite senza dati: §24 vieta di
 *     mostrare «Nessun evento» o count 0 al posto di un errore;
 *   * `empty` solo se tutte hanno risposto e nessuna ha righe;
 *   * `ready` altrimenti, con le sole sezioni non vuote (§10: «Ometti le
 *     sezioni senza eventi accessibili»). Una sezione fallita mentre le
 *     altre rispondono resta visibile con il proprio errore locale.
 */
export type SectionState = {
  error: boolean;
  loaded: boolean;
  pages: SelectionEventsPage[] | null;
};

export type CenterBodyState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "empty" }
  | { kind: "ready"; sections: EventSection[] };

export function rowsOf(state: SectionState): SelectionEventRow[] {
  return (state.pages ?? []).flatMap((page) => page.rows);
}

export function centerBodyState(
  sections: Record<EventSection, SectionState>,
  order: readonly EventSection[],
): CenterBodyState {
  const states = order.map((section) => sections[section]);
  const anyRows = states.some((state) => rowsOf(state).length > 0);
  const pending = states.some((state) => !state.loaded && !state.error);

  /* Appena una sezione ha righe, il Centro si mostra senza attendere la più
     lenta; finché nessuna ne ha e qualcuna è in corso, skeleton. */
  if (!anyRows && pending) {
    return { kind: "loading" };
  }

  if (!anyRows && states.every((state) => state.error)) {
    return { kind: "error" };
  }

  const visible = order.filter((section) => {
    const state = sections[section];

    return rowsOf(state).length > 0 || state.error;
  });

  if (visible.length === 0) {
    return pending ? { kind: "loading" } : { kind: "empty" };
  }

  return { kind: "ready", sections: visible };
}

/**
 * Deduplica fra pagine (§12: «Nessun evento duplicato fra pagine o
 * sezioni»). Il keyset del server non ne produce; questa è una difesa contro
 * una pagina rimontata dopo un refresh concorrente.
 */
export function uniqueRows(rows: readonly SelectionEventRow[]): SelectionEventRow[] {
  const seen = new Set<string>();

  return rows.filter((row) => {
    if (seen.has(row.id)) {
      return false;
    }

    seen.add(row.id);

    return true;
  });
}
