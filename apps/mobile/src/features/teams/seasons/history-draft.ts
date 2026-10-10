/**
 * Bozza dell'inserimento storico (§21).
 *
 * «Il draft può essere locale o appoggiarsi all'infrastruttura di bozze già
 * disponibile, ma **non deve creare record stagionali prima della
 * conferma**.» Questo file è la forma locale: un array di periodi e tre
 * operazioni pure su di esso. Nessuna scrittura, nessun autosave, nessun
 * nuovo sistema generale di Bozze — che §21 vieta esplicitamente.
 *
 * I conteggi non vivono qui: §20 li affida al server
 * (`preview_team_season_history`), perché dipendono dalle stagioni già
 * persistite e dal catalogo, non dal contenuto del draft.
 */
import type { HistoryPeriodInput, HistorySeasonOption } from "./seasons-service";

export type HistoryDraftPeriod = HistoryPeriodInput & {
  /** Identità locale del periodo: la posizione nell'array non è stabile. */
  id: string;
  /**
   * Label di stagioni e classificazione, conservate accanto agli ID.
   *
   * Gli ID restano l'unica cosa che viaggia verso il server
   * (`toPeriodInputs`): §31 vieta di «salvare come unica fonte label
   * visualizzate». Qui servono solo a disegnare il riepilogo senza una
   * seconda lettura della tassonomia per ogni riga.
   */
  fromLabel: string;
  levelLabel: string | null;
  toLabel: string;
  typeLabel: string | null;
};

/**
 * Ambito della bozza (§21).
 *
 * «Scope del draft: account, identità Società, Team e contesto di
 * validazione. Non trasferirlo a un'altra identità o Team cambiando account
 * o tornando da un selector.» La chiave è il modo in cui lo si fa rispettare
 * senza ricordarselo a ogni schermata.
 */
export function draftScopeKey(
  actorId: string,
  clubId: string,
  teamId: string,
): string {
  return [actorId, clubId, teamId].join("|");
}

export function addPeriod(
  periods: HistoryDraftPeriod[],
  period: HistoryDraftPeriod,
): HistoryDraftPeriod[] {
  return [...periods, period];
}

/**
 * Modifica sostituisce l'elemento, non ne aggiunge una copia (§21).
 *
 * «Modifica riapre lo stesso form con i dati del periodo. Usare una CTA
 * coerente, per esempio Aggiorna periodo, e **sostituire** l'elemento del
 * draft.» La posizione resta la stessa, e con essa l'ordine stabile su cui
 * §20 fonda l'assegnazione delle stagioni nuove.
 */
export function updatePeriod(
  periods: HistoryDraftPeriod[],
  period: HistoryDraftPeriod,
): HistoryDraftPeriod[] {
  return periods.map((item) => (item.id === period.id ? period : item));
}

export function removePeriod(
  periods: HistoryDraftPeriod[],
  id: string,
): HistoryDraftPeriod[] {
  return periods.filter((item) => item.id !== id);
}

export function toPeriodInputs(
  periods: HistoryDraftPeriod[],
): HistoryPeriodInput[] {
  return periods.map(({ fromSeason, levelId, toSeason, typeId }) => ({
    fromSeason,
    levelId,
    toSeason,
    typeId,
  }));
}

type ClassificationSource = {
  levelId: string | null;
  levelLabel: string | null;
  typeId: string | null;
  typeLabel: string | null;
};

type SuggestionInput = {
  /** Configurazione della stagione corrente, se presente. */
  currentConfig: ClassificationSource | null;
  /**
   * Stagioni storiche già persistite, dalla più recente alla più vecchia —
   * lo stesso ordine in cui l'elenco le mostra.
   */
  history: (ClassificationSource & { seasonId: string })[];
  periods: HistoryDraftPeriod[];
  seasons: HistorySeasonOption[];
};

/**
 * Valori proposti per un nuovo periodo (§19).
 *
 * L'ordine è quello della task, e non un'euristica:
 *
 *   1. periodo draft aggiunto immediatamente prima;
 *   2. configurazione storica del Team temporalmente più vicina;
 *   3. configurazione corrente;
 *   4. nessun valore quando non determinabile.
 *
 * «Il suggerimento è modificabile e non dimostra che quella classificazione
 * fosse corretta per tutto l'intervallo»: resta un prefill, e il campo non
 * viene bloccato.
 *
 * `fromSeason` segue la stessa logica di §19 — «la prima stagione storica
 * successiva pertinente e ancora mancante» — e **A non viene scelto**: la
 * durata del periodo è una decisione dell'utente.
 */
export function suggestPeriodDefaults(
  input: SuggestionInput,
): ClassificationSource & { fromSeason: string | null } {
  const last = input.periods[input.periods.length - 1] ?? null;
  const closestHistory = input.history[0] ?? null;

  const empty: ClassificationSource = {
    levelId: null,
    levelLabel: null,
    typeId: null,
    typeLabel: null,
  };

  const classification: ClassificationSource =
    last && last.typeId
      ? {
          levelId: last.levelId,
          levelLabel: last.levelLabel,
          typeId: last.typeId,
          typeLabel: last.typeLabel,
        }
      : closestHistory && closestHistory.typeId
        ? closestHistory
        : input.currentConfig && input.currentConfig.typeId
          ? input.currentConfig
          : empty;

  return { ...classification, fromSeason: suggestFromSeason(input) };
}

function suggestFromSeason(input: SuggestionInput): string | null {
  const order = new Map(input.seasons.map((s) => [s.seasonId, s.sortOrder]));

  const covered = new Set<string>();

  for (const period of input.periods) {
    const from = order.get(period.fromSeason);
    const to = order.get(period.toSeason);

    if (from === undefined || to === undefined) {
      continue;
    }

    for (const season of input.seasons) {
      if (season.sortOrder >= from && season.sortOrder <= to) {
        covered.add(season.seasonId);
      }
    }
  }

  const lastCovered = input.periods.reduce<number | null>((max, period) => {
    const to = order.get(period.toSeason);

    return to === undefined ? max : max === null || to > max ? to : max;
  }, null);

  if (lastCovered === null) {
    return null;
  }

  // Ascendente: la prima stagione **successiva** al draft che manca ancora.
  const ascending = [...input.seasons].sort((a, b) => a.sortOrder - b.sortOrder);

  const candidate = ascending.find(
    (season) =>
      season.sortOrder > lastCovered &&
      !season.alreadyPresent &&
      !covered.has(season.seasonId),
  );

  return candidate?.seasonId ?? null;
}

/**
 * Cambiare "Da" non lascia valido un "A" precedente (§19).
 *
 * «Cambiare Da non deve lasciare un estremo A precedente considerato valido:
 * segnalare l'incompatibilità e chiedere di correggerlo, preservando gli
 * altri dati.» Il form non azzera A da solo: chiede di correggerlo.
 */
export function isRangeValid(
  fromSeason: string | null,
  toSeason: string | null,
  seasons: HistorySeasonOption[],
): boolean {
  if (!fromSeason || !toSeason) {
    return false;
  }

  const order = new Map(seasons.map((s) => [s.seasonId, s.sortOrder]));
  const from = order.get(fromSeason);
  const to = order.get(toSeason);

  if (from === undefined || to === undefined) {
    return false;
  }

  return from <= to;
}
