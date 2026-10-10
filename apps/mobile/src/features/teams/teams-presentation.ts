/**
 * Presentazione del Centro Squadre (DAS-REV-08 §9, §10, §24).
 *
 * Funzioni pure: le regole che la task verifica — la riga che non ripete se
 * stessa, i conteggi che distinguono assenza da zero, la copy d'errore
 * contestuale — si controllano senza montare una schermata.
 */
import type { TeamErrorCode, TeamsCenterRow } from "./teams-service";

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("it-IT");
}

/** "8 squadre" · "1 squadra". `null` resta `null`: non è zero (§25). */
export function teamsTotalLabel(total: number | null): string | null {
  if (total === null) {
    return null;
  }

  return `${total} ${plural(total, "squadra", "squadre")}`;
}

/** "Stagione corrente · 2026/27" (§13). Informazione, non campo. */
export function currentSeasonLabel(seasonLabel: string | null): string | null {
  return seasonLabel ? `Stagione corrente · ${seasonLabel}` : null;
}

/**
 * Classificazione della riga (§9).
 *
 * Tre casi distinti, e §9 vieta di confonderli: «Distinguere Livello non
 * specificato, stagione non configurata ed errore temporaneo: non inventare
 * un valore per riempire la riga.»
 *
 * Quando il nome esprime già esattamente il Tipo — "Prima squadra" di tipo
 * Prima squadra — sotto resta il solo campionato. È una semplificazione
 * visuale: i campi salvati non cambiano.
 */
export function teamClassificationLine(row: {
  hasSeasonConfig: boolean;
  levelLabel: string | null;
  name: string;
  typeLabel: string | null;
}): string | null {
  if (!row.hasSeasonConfig) {
    return "Stagione da configurare";
  }

  if (!row.typeLabel) {
    return row.levelLabel;
  }

  if (normalize(row.typeLabel) === normalize(row.name)) {
    return row.levelLabel;
  }

  return [row.typeLabel, row.levelLabel].filter(Boolean).join(" · ");
}

/**
 * "24 calciatori · 6 staff" (§10).
 *
 * Un conteggio non consultabile viene **omesso**, non reso come zero. Se
 * nessuno dei due è disponibile la riga non ha una seconda metadata, e nome,
 * stemma e classificazione restano utilizzabili.
 */
export function teamCountsLine(row: {
  countsAvailable: boolean;
  playersCount: number | null;
  staffCount: number | null;
}): string | null {
  if (!row.countsAvailable) {
    return null;
  }

  const parts: string[] = [];

  if (row.playersCount !== null) {
    parts.push(
      `${row.playersCount} ${plural(row.playersCount, "calciatore", "calciatori")}`,
    );
  }

  if (row.staffCount !== null) {
    parts.push(`${row.staffCount} staff`);
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Riga completa del Centro, pronta per `DashboardEntityRow`. */
export function teamRowLines(row: TeamsCenterRow): {
  counts: string | null;
  meta: string | null;
} {
  return {
    counts: teamCountsLine(row),
    meta: teamClassificationLine(row),
  };
}

/**
 * Copy d'errore di §24, contestuale e in italiano.
 *
 * Il database conosce i codici, non le frasi: una `raise exception` con il
 * testo dentro avrebbe reso la copy non traducibile e non rivedibile senza
 * una migrazione.
 */
export const TEAM_ERROR_COPY: Record<TeamErrorCode, string> = {
  RATE_LIMIT:
    "Hai inviato troppe segnalazioni. Riprova più tardi.",
  TEAM_ASSET_INVALID: "Non è stato possibile caricare lo stemma. Riprova.",
  TEAM_CITY_INVALID: "Seleziona una località valida.",
  TEAM_CITY_MODE_INVALID: "Seleziona una località valida.",
  TEAM_CONFIRMATION_REQUIRED:
    "Non è stato possibile verificare le squadre esistenti. Riprova.",
  TEAM_CONFIRMATION_STALE:
    "I dati sono cambiati dopo il controllo. Controlla e riprova.",
  TEAM_CREST_MODE_INVALID:
    "Non è stato possibile caricare lo stemma. Riprova.",
  TEAM_DUPLICATE_CONFLICT:
    "Esiste già una squadra che occupa questo posto nella società.",
  TEAM_LEVEL_INCOMPATIBLE:
    "Seleziona un livello compatibile con il tipo di squadra.",
  TEAM_LEVEL_REPORT_INVALID: "Inserisci il nome del campionato.",
  TEAM_NAME_INVALID: "Inserisci il nome della squadra.",
  TEAM_NOT_AUTHORIZED: "Non hai i permessi per questa operazione.",
  TEAM_NOT_FOUND: "Questa squadra non è più disponibile.",
  TEAM_NO_SEASON_CONFIG:
    "La stagione corrente non è ancora configurata per questa squadra.",
  TEAM_SEASON_CHANGED:
    "La stagione corrente è cambiata. Controlla i dati prima di salvare.",
  TEAM_SEASON_UNAVAILABLE:
    "Non è stato possibile caricare la stagione corrente. Riprova.",
  TEAM_TYPE_INVALID: "Seleziona il tipo di squadra.",
  TEAM_VERSION_CONFLICT:
    "Questa squadra è stata aggiornata da un altro amministratore. " +
    "Controlla le modifiche prima di salvare.",
  UNKNOWN: "Non è stato possibile completare l'operazione. Riprova.",
};

export function teamErrorMessage(
  code: TeamErrorCode,
  fallback: string,
): string {
  return code === "UNKNOWN" ? fallback : TEAM_ERROR_COPY[code];
}

/**
 * Empty state del Centro (§11).
 *
 * Tre formulazioni per tre situazioni diverse, e l'ultima è quella che §11
 * tiene a distinguere: «Un elenco autorizzato vuoto non prova che l'intera
 * Società non possieda squadre». Senza permesso di creazione la frase è
 * neutra e non porta una CTA impossibile.
 */
export function teamsEmptyState(input: {
  canCreate: boolean;
  hasScopeRestriction: boolean;
}): { action: string | null; body: string | null; title: string } {
  if (input.hasScopeRestriction || !input.canCreate) {
    return {
      action: null,
      body: null,
      title: "Nessuna squadra disponibile nel tuo ambito",
    };
  }

  return {
    action: "Crea la prima squadra",
    body: "Aggiungi la prima squadra per organizzare organico e attività del club.",
    title: "Nessuna squadra configurata",
  };
}
