/**
 * Presentazione della Dashboard personale (DAS-REV-03).
 *
 * Funzioni pure, separate dal componente: sono le regole che la task scrive
 * in prosa — budget dei segnali, deduplicazione della preview, formattazione
 * delle scadenze e degli aggiornamenti, aggregazione dei requisiti — e sono
 * verificabili senza montare nulla.
 *
 * Nessuna di queste funzioni legge `Date.now()`: l'istante è sempre un
 * parametro. §28 chiede un clock controllato per i casi limite del cutoff, e
 * un orologio letto dentro la funzione lo renderebbe impossibile.
 */

import { MAX_APPLICATION_PREVIEWS } from "../../applications/application-presentation";
import { MAX_VISIBLE_PRIORITIES } from "../priority/priority-ranking";
import type { PersonalRequirement } from "../adapters/personal-adapter";

/** §6: Aggiornamenti recenti, massimo due row. */
export const MAX_RECENT_UPDATES = 2;

/** §15: massimo due scadenze promosse. */
export const MAX_PROMOTED_DEADLINES = 2;

/**
 * Posti residui per gli aggiornamenti informativi (§6).
 *
 * «Azioni temporali e informazioni obbligatorie occupano per prime il budget;
 * gli aggiornamenti informativi utilizzano gli eventuali posti residui, entro
 * il proprio limite di due.»
 *
 * Il budget è quello della Foundation (tre segnali prioritari in evidenza),
 * non un secondo contatore: parte da `MAX_VISIBLE_PRIORITIES` e sottrae le
 * priorità già visibili.
 */
export function recentUpdatesBudget(visiblePriorityCount: number): number {
  const remaining = MAX_VISIBLE_PRIORITIES - visiblePriorityCount;

  return Math.max(0, Math.min(MAX_RECENT_UPDATES, remaining));
}

const ITALIAN_MONTHS = [
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

export type DeadlineActionType = "apply" | "register";

/**
 * Parti della data nel fuso dichiarato dall'opportunità.
 *
 * Il fuso conta: un cutoff espresso a Roma letto nel fuso del telefono può
 * cadere in un altro giorno. Quando `Intl` non supporta il `timeZone` sul
 * motore corrente si ricade sul fuso del dispositivo — un degrado visibile
 * solo sull'ora, mai una scadenza inventata, perché l'autorizzazione resta
 * server-side (§15).
 */
function partsInZone(
  date: Date,
  timeZone: string | null,
): { day: number; hour: number; minute: number; month: number; year: number } {
  if (timeZone) {
    try {
      const formatted = new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        hour: "2-digit",
        hour12: false,
        minute: "2-digit",
        month: "2-digit",
        timeZone,
        year: "numeric",
      }).formatToParts(date);

      const read = (type: string) =>
        Number(formatted.find((part) => part.type === type)?.value ?? NaN);

      const parts = {
        day: read("day"),
        hour: read("hour"),
        minute: read("minute"),
        month: read("month"),
        year: read("year"),
      };

      if (!Object.values(parts).some(Number.isNaN)) {
        return parts;
      }
    } catch {
      // Motore senza dati di fuso: si usa quello del dispositivo.
    }
  }

  return {
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    month: date.getMonth() + 1,
    year: date.getFullYear(),
  };
}

/**
 * Etichetta della scadenza nella row di "Da gestire" (§14).
 *
 * «Utilizzare formattazione localizzata: Iscrizioni entro il 15 settembre.»
 * Il verbo dipende dall'action type reale, non dal mockup: §17 vieta di
 * scegliere il testo arbitrariamente, e una posizione a cui ci si candida non
 * ha iscrizioni. `register` resta nel vocabolario per il giorno in cui il
 * dominio Eventi esisterà.
 *
 * Nessun countdown, nessun "2 giorni rimasti", nessuna urgenza commerciale
 * (§14).
 */
export function formatDeadlineRowLabel(
  deadlineAt: string,
  options: { actionType?: DeadlineActionType; timeZone?: string | null } = {},
): string | null {
  const date = new Date(deadlineAt);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const { day, month } = partsInZone(date, options.timeZone ?? null);
  const monthLabel = ITALIAN_MONTHS[month - 1];

  if (!monthLabel) {
    return null;
  }

  const prefix =
    options.actionType === "register"
      ? "Iscrizioni entro il"
      : "Candidature entro il";

  return `${prefix} ${day} ${monthLabel}`;
}

/**
 * Etichetta della scadenza nel dettaglio dell'opportunità (§14, §17).
 *
 * «Nel dettaglio aggiungere anno e, quando rilevante per comprendere il
 * cutoff, ora e fuso.» L'ora è rilevante quando non è mezzanotte: un cutoff a
 * fine giornata non dice nulla di più se stampato come "00:00", mentre un
 * cutoff alle 18:00 cambia la decisione di chi legge.
 */
export function formatDeadlineDetailLabel(
  deadlineAt: string,
  options: { actionType?: DeadlineActionType; timeZone?: string | null } = {},
): string | null {
  const date = new Date(deadlineAt);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const timeZone = options.timeZone ?? null;
  const { day, hour, minute, month, year } = partsInZone(date, timeZone);
  const monthLabel = ITALIAN_MONTHS[month - 1];

  if (!monthLabel) {
    return null;
  }

  const prefix =
    options.actionType === "register"
      ? "Iscrizioni entro il"
      : "Candidature entro il";

  const base = `${prefix} ${day} ${monthLabel} ${year}`;

  if (hour === 0 && minute === 0) {
    return base;
  }

  const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  return timeZone
    ? `${base}, ore ${time} (${timeZone})`
    : `${base}, ore ${time}`;
}

/**
 * Data di un aggiornamento professionale (§11).
 *
 * È la **data dell'evento**, tenuta separata dallo stato corrente. "oggi" e
 * "ieri" si calcolano sui giorni di calendario locali, non su differenze di
 * 24 ore: un evento delle 23:50 di ieri non è "oggi" perché sono passate
 * meno di 24 ore.
 */
export function formatUpdateLabel(
  occurredAt: string,
  now: number,
): string | null {
  const date = new Date(occurredAt);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const reference = new Date(now);
  const startOfDay = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();

  const days = Math.round(
    (startOfDay(reference) - startOfDay(date)) / 86_400_000,
  );

  if (days <= 0) {
    return "Aggiornata oggi";
  }

  if (days === 1) {
    return "Aggiornata ieri";
  }

  const monthLabel = ITALIAN_MONTHS[date.getMonth()];

  return monthLabel ? `Aggiornata il ${date.getDate()} ${monthLabel}` : null;
}

/**
 * Un aggiornamento è "significativo" per la row di una candidatura quando
 * l'evento esiste ed è successivo all'invio (§9).
 *
 * Senza questo controllo la candidatura appena inviata mostrerebbe
 * "Aggiornata oggi" per il solo fatto di essere stata creata oggi — e §9
 * vieta esplicitamente di trattare "Aggiornata" come uno stato.
 */
export function hasSignificantUpdate(application: {
  createdAt: string;
  lastEventAt: string | null;
}): boolean {
  if (!application.lastEventAt) {
    return false;
  }

  const event = Date.parse(application.lastEventAt);
  const created = Date.parse(application.createdAt);

  if (Number.isNaN(event) || Number.isNaN(created)) {
    return false;
  }

  return event > created;
}

/**
 * Deduplicazione della presentazione (§12).
 *
 * «Utilizzare riferimenti canonici, non confronto di titoli o nomi.» Da qui
 * la firma: si passano gli id, non gli oggetti.
 *
 * La deduplicazione riguarda la preview e non il dato: non modifica
 * conteggi, non elimina bookmark, non elimina candidature e non tocca le
 * liste complete.
 */
export function dedupeById<T>(
  items: T[],
  idOf: (item: T) => string,
  alreadyShown: ReadonlySet<string>,
): T[] {
  return items.filter((item) => !alreadyShown.has(idOf(item)));
}

/**
 * Esito della deduplicazione di un modulo di preview (§12).
 *
 * `collapsed` significa: tutti gli elementi della preview erano già mostrati
 * in alto. §12 vieta sia il falso "Nessuna candidatura" sia la sparizione del
 * modulo — la risorsa deve restare facilmente raggiungibile — quindi il
 * modulo si riduce a un accesso compatto alla lista completa.
 */
export type PreviewOutcome<T> = {
  collapsed: boolean;
  items: T[];
};

export function dedupePreview<T>(
  items: T[],
  idOf: (item: T) => string,
  alreadyShown: ReadonlySet<string>,
): PreviewOutcome<T> {
  const remaining = dedupeById(items, idOf, alreadyShown);

  return {
    collapsed: items.length > 0 && remaining.length === 0,
    items: remaining,
  };
}

/**
 * Aggregazione dei requisiti obbligatori (§13).
 *
 * «Più informazioni obbligatorie confluiscono in un solo elemento con una
 * destinazione coerente.» Con un solo requisito vale la sua copy specifica
 * ("Indica il tuo ruolo principale."); con più di uno vale una copy che li
 * conta, perché elencarli trasformerebbe il blocco in una checklist, che §13
 * vieta.
 *
 * Oggi il modello ne produce al massimo uno per ruolo; il ramo plurale esiste
 * perché il requisito della task è l'aggregazione, non il numero attuale.
 */
export function aggregateRequirements(
  requirements: PersonalRequirement[],
  hubHref: string | null = null,
): { description: string; href: string } | null {
  if (requirements.length === 0) {
    return null;
  }

  if (requirements.length === 1) {
    return {
      description: requirements[0].description,
      href: requirements[0].href,
    };
  }

  return {
    description: `Completa ${requirements.length} informazioni obbligatorie del profilo.`,
    // Stessa regola del registry: con più requisiti la destinazione è l'hub
    // del ruolo, che li contiene tutti. Due regole diverse divergerebbero.
    href: hubHref ?? requirements[0].href,
  };
}

/**
 * Preview del modulo Candidature (DAS-REV-04 §8, §10).
 *
 * Due passaggi, in quest'ordine:
 *
 *   1. si tolgono le candidature già presentate in "Aggiornamenti recenti" —
 *      §10 vieta di ripetere la stessa situazione due volte nello stesso
 *      widget;
 *   2. si taglia a due. La fonte ne manda tre proprio perché la terza possa
 *      prendere il posto di quella tolta: §10 chiede di «mostrare altre
 *      candidature eleggibili entro il limite».
 *
 * `collapsed` resta la condizione di §10 — **tutte** erano già mostrate in
 * alto — e non diventa vera per effetto del taglio: in quel caso il modulo si
 * riduce all'accesso alla lista, e un falso "Nessuna candidatura" sarebbe
 * un'altra cosa.
 *
 * Non tocca il conteggio: §8 lo vuole indipendente dalle righe scaricate.
 */
export function selectApplicationPreviews<T>(
  items: T[],
  idOf: (item: T) => string,
  alreadyShown: ReadonlySet<string>,
): PreviewOutcome<T> {
  const deduped = dedupePreview(items, idOf, alreadyShown);

  return {
    collapsed: deduped.collapsed,
    items: deduped.items.slice(0, MAX_APPLICATION_PREVIEWS),
  };
}

/**
 * Copy dei suggerimenti facoltativi, per chiave stabile (DAS-REV-06 §8, §22).
 *
 * Il backend emette classificazione, chiave e destinazione; il testo vive qui.
 * È la stessa divisione delle priorità — `priority-registry.ts` tiene la copy
 * dei tipi e il dominio ne decide la pertinenza — e tiene le frasi di prodotto
 * fuori da una migrazione SQL, dove cambiarle costerebbe un rilascio di
 * database.
 *
 * Una chiave sconosciuta non viene inventata né mostrata vuota: il modulo non
 * si compone. §23 vieta di «inventare un requisito per riempire lo spazio».
 */
export type SuggestionCopy = {
  actionLabel: string;
  /** Il beneficio: perché conviene, non cosa manca. */
  body: string;
  /** L'indicazione: cosa fare. */
  description: string;
  icon: "location-outline";
};

export const SUGGESTION_COPY: Record<string, SuggestionCopy> = {
  availability_areas: {
    actionLabel: "Imposta aree",
    body: "Aiuta le società a trovarti nelle zone che hai scelto.",
    description: "Indica le aree in cui sei disponibile.",
    icon: "location-outline",
  },
};
