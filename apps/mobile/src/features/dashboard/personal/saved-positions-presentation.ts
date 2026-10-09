/**
 * Presentazione del widget "Posizioni salvate" (DAS-REV-05).
 *
 * Funzioni pure, nello stesso stile di `personal-presentation.ts`: le regole
 * che la task scrive in prosa — selezione delle preview, etichette dello
 * storico, aggregazione degli aggiornamenti — verificabili senza montare
 * nulla, e con l'istante sempre passato come parametro.
 *
 * Quattro concetti restano separati (§6) e nessuna funzione qui li mescola:
 * esistenza del bookmark, disponibilità della posizione, candidatura e
 * processo di selezione.
 */

import type {
  PersonalSavedPosition,
  PersonalSavedUpdate,
} from "../adapters/personal-adapter";
import { dedupePreview, type PreviewOutcome } from "./personal-presentation";

/** §9: «Mostrare normalmente due preview, massimo tre». */
export const MAX_SAVED_PREVIEWS = 2;

/** §15: default della lista CER e destinazione di "Vedi tutte". */
export const SAVED_AVAILABLE_HREF =
  "/search/positions?tab=salvate&group=available";

/** §20, §23: accesso contestuale allo storico. */
export const SAVED_UNAVAILABLE_HREF =
  "/search/positions?tab=salvate&group=unavailable";

/** Stato esposto nelle row storiche (§16). Mai la motivazione interna. */
export const UNAVAILABLE_LABEL = "Non più disponibile";

/** §16: row senza destinazione, bookmark ancora utilizzabile. */
export const NO_DETAIL_LABEL = "Dettaglio non disponibile";

const ITALIAN_MONTHS_SHORT = [
  "gen",
  "feb",
  "mar",
  "apr",
  "mag",
  "giu",
  "lug",
  "ago",
  "set",
  "ott",
  "nov",
  "dic",
] as const;

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

/**
 * Preview del widget (§9, §11, §12).
 *
 * Due passaggi, nell'ordine: si tolgono le posizioni già mostrate come
 * scadenza promossa in "Da gestire" — DAS-REV-03 §12 vieta di ripetere la
 * stessa risorsa due volte nella stessa pagina — e poi si taglia a due. La
 * fonte ne manda tre proprio perché la terza possa prendere il posto di
 * quella tolta.
 *
 * `collapsed` resta la condizione di §12 (**tutte** erano già mostrate in
 * alto) e non diventa vera per effetto del taglio: in quel caso il modulo si
 * riduce all'accesso alla lista, e §11 vieta di trasformarlo in un falso
 * empty o in un decremento del conteggio.
 */
export function selectSavedPreviews(
  items: PersonalSavedPosition[],
  alreadyShown: ReadonlySet<string>,
): PreviewOutcome<PersonalSavedPosition> {
  const deduped = dedupePreview(items, (item) => item.adId, alreadyShown);

  return {
    collapsed: deduped.collapsed,
    items: deduped.items.slice(0, MAX_SAVED_PREVIEWS),
  };
}

/**
 * Etichetta di una row storica (§16, §17).
 *
 * «Preferire la data affidabile in cui la posizione è diventata
 * indisponibile.» Se quella data non esiste non viene inventata e non viene
 * sostituita dalla data di salvataggio travestita: o si omette, o si mostra
 * la data reale con la propria label esplicita.
 *
 * La motivazione canonica non entra nel testo: §7 chiede ragioni autorizzate,
 * e "Chiusa" o "Ritirata" direbbero all'utente qualcosa che il dominio non ha
 * autorizzato a rivelare.
 */
export function formatUnavailableLabel(unavailableAt: string | null): string {
  const closed = formatShortDate(unavailableAt);

  return closed ? `${UNAVAILABLE_LABEL} · ${closed}` : UNAVAILABLE_LABEL;
}

/**
 * Data reale alternativa, con label esplicita (§17).
 *
 * «Ometterla oppure mostrare una data reale con label esplicita, ad esempio
 * Salvata il 5 settembre.» Si usa **solo** quando la data di chiusura manca:
 * presentare il salvataggio come chiusura è esattamente ciò che §17 vieta.
 */
export function formatSavedAtLabel(savedAt: string | null): string | null {
  const date = toDate(savedAt);

  if (!date) {
    return null;
  }

  const month = ITALIAN_MONTHS[date.getMonth()];

  return month ? `Salvata il ${date.getDate()} ${month}` : null;
}

/** "11 set 2026" — formato delle row storiche del master. */
export function formatShortDate(value: string | null): string | null {
  const date = toDate(value);

  if (!date) {
    return null;
  }

  const month = ITALIAN_MONTHS_SHORT[date.getMonth()];

  return month ? `${date.getDate()} ${month} ${date.getFullYear()}` : null;
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Riga informativa di "Aggiornamenti recenti" per i Salvati (§13).
 *
 * Due forme, mai entrambe: la singola nomina la posizione, l'aggregata conta
 * le transizioni pertinenti del gruppo. §13 vieta di elencare molti club o di
 * moltiplicare gli alert.
 */
export type SavedUpdateRow =
  | {
      count: number;
      kind: "aggregated";
      /** Chiave stabile dell'insieme di eventi aggregati (§14). */
      key: string;
    }
  | {
      kind: "single";
      key: string;
      update: PersonalSavedUpdate;
    };

/**
 * Aggregazione degli aggiornamenti di indisponibilità (§13, §14).
 *
 * Con un solo evento vale la row compatta della posizione; con più di uno
 * vale una sola row che li conta — «3 posizioni salvate non sono più
 * disponibili» — e apre lo stesso filtro canonico.
 *
 * La deduplicazione è per **evento**: lo stesso evento consegnato due volte
 * resta un aggiornamento solo. Il numero rappresenta le transizioni pertinenti
 * del gruppo, non tutto lo storico, perché la fonte filtra già recency,
 * bookmark esistente e riconciliazione delle riaperture.
 *
 * `budget` è il numero di posti residui, non un secondo contatore: arriva da
 * `recentUpdatesBudget` e vale zero quando le azioni reali hanno già occupato
 * il budget della Foundation.
 */
export function buildSavedUpdateRows(
  updates: PersonalSavedUpdate[],
  budget: number,
): SavedUpdateRow[] {
  if (budget <= 0) {
    return [];
  }

  const seen = new Set<string>();
  const unique = updates.filter((update) => {
    if (seen.has(update.eventId)) {
      return false;
    }

    seen.add(update.eventId);

    return true;
  });

  if (unique.length === 0) {
    return [];
  }

  if (unique.length === 1) {
    return [{ key: unique[0].eventId, kind: "single", update: unique[0] }];
  }

  return [
    {
      count: unique.length,
      key: unique
        .map((update) => update.eventId)
        .sort()
        .join("|"),
      kind: "aggregated",
    },
  ];
}

/** Copy dell'aggregazione (§13). Nessun elenco di club. */
export function aggregatedUpdateLabel(count: number): string {
  return count === 1
    ? "1 posizione salvata non è più disponibile"
    : `${count} posizioni salvate non sono più disponibili`;
}

/**
 * Nota della row singola di aggiornamento (§13).
 *
 * Una frase informativa, non uno stato nella colonna destra e non un'azione.
 * La reason canonica resta fuori dal testo (§7).
 */
export const SINGLE_UPDATE_NOTE = "Posizione non più disponibile";
