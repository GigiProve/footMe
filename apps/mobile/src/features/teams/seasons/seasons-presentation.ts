/**
 * Copy e derivazioni di Stagioni e storico (§4, §7, §10, §11, §20, §33).
 *
 * Funzioni pure: nessuna query, nessun componente. Le regole che decidono
 * cosa si legge — plurale dei conteggi, stato neutro del lifecycle, testo
 * degli impedimenti, messaggi d'errore — si verificano senza montare nulla,
 * ed è qui che vivono invece che sparse nei nove schermi.
 *
 * Il lifecycle **non** è persistito (§7: «Da preparare è una proiezione
 * dell'assenza del record»): `seasonLifecycleLabel` lo deriva dalla fase del
 * catalogo e dalla presenza della configurazione, che è l'unica forma
 * compatibile con un riferimento centrale che avanza da solo.
 */
import type {
  DeactivationBlocker,
  HistoryPeriodErrorCode,
  HistoryPeriodPreview,
  SeasonErrorCode,
} from "./seasons-service";

/** Stati testuali neutri di §4: nessuna pill verde, blu o gialla. */
export type SeasonLifecycle =
  | "concluded"
  | "inProgress"
  | "prepared"
  | "teamInactive"
  | "toPrepare";

export const SEASON_LIFECYCLE_LABEL: Record<SeasonLifecycle, string> = {
  concluded: "Conclusa",
  inProgress: "In corso",
  prepared: "Preparata",
  teamInactive: "Squadra non attiva",
  toPrepare: "Da preparare",
};

/**
 * Stato della stagione corrente di una squadra.
 *
 * §28: «La stagione corrente eventualmente presente resta un riferimento
 * temporale, non una prova che la squadra sia attiva.» La squadra non attiva
 * mostra quindi il proprio stato al posto di "In corso" — e non trasforma
 * tutte le configurazioni in Conclusa, che §28 vieta espressamente.
 */
export function currentSeasonLifecycle(input: {
  hasConfig: boolean;
  isArchived: boolean;
}): SeasonLifecycle | null {
  if (input.isArchived) {
    return "teamInactive";
  }

  return input.hasConfig ? "inProgress" : null;
}

export function nextSeasonLifecycle(hasConfig: boolean): SeasonLifecycle {
  return hasConfig ? "prepared" : "toPrepare";
}

/**
 * "Under 18 · Élite", oppure il solo Tipo.
 *
 * §10: «Se il Livello manca, mostrare il Tipo senza N/A.» Nessun valore
 * sentinella, nessun separatore orfano.
 */
export function classificationLine(
  typeLabel: string | null,
  levelLabel: string | null,
): string | null {
  const parts = [typeLabel, levelLabel].filter(
    (part): part is string => typeof part === "string" && part.length > 0,
  );

  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Riga di una squadra nel Centro: classificazione corrente o invito a configurare. */
export function centerRowMeta(row: {
  hasSeasonConfig: boolean;
  levelLabel: string | null;
  typeLabel: string | null;
}): string {
  if (!row.hasSeasonConfig) {
    // §10: «Se manca la configurazione corrente, mostrare "Stagione da
    // configurare" senza usare dati storici come correnti.»
    return "Stagione da configurare";
  }

  return classificationLine(row.typeLabel, row.levelLabel) ?? "Stagione da configurare";
}

/**
 * "3 da preparare · 1 preparata" (§10).
 *
 * `null` quando nessuno dei due conteggi è consultabile: §10 vuole quantità
 * reali, e un riepilogo a zero su dati non autorizzati sarebbe un numero
 * inventato. Uno zero vero resta scritto — "0 da preparare" non si omette,
 * perché è l'informazione che tutto è pronto.
 */
export function nextSeasonSummary(input: {
  preparedCount: number | null;
  toPrepareCount: number | null;
}): string | null {
  const parts: string[] = [];

  if (input.toPrepareCount !== null) {
    parts.push(`${input.toPrepareCount} da preparare`);
  }

  if (input.preparedCount !== null) {
    parts.push(
      input.preparedCount === 1 ? "1 preparata" : `${input.preparedCount} preparate`,
    );
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

/** "Aggiungi 4 stagioni" / "Aggiungi 1 stagione" (§18). */
export function addSeasonsCta(count: number): string {
  return count === 1 ? "Aggiungi 1 stagione" : `Aggiungi ${count} stagioni`;
}

/** "Aggiungi 6 stagioni allo storico" / singolare (§22). */
export function commitHistoryCta(count: number): string {
  return count === 1
    ? "Aggiungi 1 stagione allo storico"
    : `Aggiungi ${count} stagioni allo storico`;
}

/** "6 stagioni da aggiungere" (§22). */
export function historyTotalLabel(count: number): string {
  return count === 1 ? "1 stagione da aggiungere" : `${count} stagioni da aggiungere`;
}

/** "4 stagioni" / "2 nuove · 2 già presenti" (§22). */
export function periodCountLine(period: {
  draftCoveredCount: number;
  existingCount: number;
  newCount: number;
}): string {
  const existing = period.existingCount + period.draftCoveredCount;

  if (existing === 0) {
    return period.newCount === 1 ? "1 stagione" : `${period.newCount} stagioni`;
  }

  const newPart = period.newCount === 1 ? "1 nuova" : `${period.newCount} nuove`;
  const existingPart =
    existing === 1 ? "1 già presente" : `${existing} già presenti`;

  return `${newPart} · ${existingPart}`;
}

/** "Le 2 stagioni già presenti resteranno invariate." (§22). */
export function existingSeasonsNotice(count: number): string | null {
  if (count <= 0) {
    return null;
  }

  return count === 1
    ? "La stagione già presente resterà invariata."
    : `Le ${count} stagioni già presenti resteranno invariate.`;
}

/**
 * Spiegazione di un periodo che non aggiunge nulla (§20).
 *
 * Due casi distinti, come la task chiede: tutto già **nel database** e tutto
 * già **nella bozza** non sono la stessa frase, perché non si correggono
 * allo stesso modo.
 */
export function emptyPeriodReason(period: {
  draftCoveredCount: number;
  existingCount: number;
  newCount: number;
}): string | null {
  if (period.newCount > 0) {
    return null;
  }

  if (period.draftCoveredCount > 0 && period.existingCount === 0) {
    return "Le stagioni selezionate sono già nel riepilogo.";
  }

  if (period.existingCount > 0 || period.draftCoveredCount > 0) {
    return "Le stagioni selezionate sono già presenti nello storico.";
  }

  return null;
}

const PERIOD_ERROR_COPY: Record<HistoryPeriodErrorCode, string> = {
  PERIOD_LEVEL_INCOMPATIBLE:
    "Il livello non è compatibile con il tipo squadra selezionato.",
  PERIOD_NOT_HISTORICAL:
    "Seleziona stagioni precedenti a quella corrente.",
  PERIOD_RANGE_INVERTED: "La stagione iniziale deve precedere quella finale.",
  PERIOD_SEASON_UNKNOWN: "Una delle stagioni selezionate non è disponibile.",
  PERIOD_TYPE_REQUIRED: "Seleziona il tipo squadra.",
  PERIOD_TYPE_UNKNOWN: "Il tipo squadra selezionato non è disponibile.",
};

export function periodErrorMessage(
  code: HistoryPeriodErrorCode | null,
): string | null {
  return code ? PERIOD_ERROR_COPY[code] ?? null : null;
}

/** Conflitto di classificazione su stagioni nuove (§20). */
export function conflictMessage(seasonIds: string[]): string | null {
  if (seasonIds.length === 0) {
    return null;
  }

  const list = seasonIds.join(", ");

  return seasonIds.length === 1
    ? `La stagione ${list} compare in due periodi con classificazioni diverse. Correggi uno dei due per continuare.`
    : `Le stagioni ${list} compaiono in più periodi con classificazioni diverse. Correggi i periodi per continuare.`;
}

/** Copy degli impedimenti dello screen 07 (§26). */
export function blockerCopy(blocker: DeactivationBlocker): {
  actionLabel: string | null;
  body: string;
  title: string;
} {
  if (blocker.kind === "positions") {
    return {
      actionLabel: blocker.canOpen ? "Vedi posizioni" : null,
      body:
        blocker.count === null
          ? "Gestite da un amministratore autorizzato."
          : blocker.count === 1
            ? "1 posizione attiva"
            : `${blocker.count} posizioni attive`,
      title: "Posizioni aperte",
    };
  }

  if (blocker.kind === "invites") {
    return {
      actionLabel: blocker.canOpen ? "Gestisci inviti" : null,
      body:
        blocker.count === null
          ? "Gestiti da un amministratore autorizzato."
          : blocker.count === 1
            ? "1 invito ancora accettabile"
            : `${blocker.count} inviti ancora accettabili`,
      title: "Inviti in attesa",
    };
  }

  // §25: una condizione non riconosciuta dal client resta un impedimento.
  return {
    actionLabel: null,
    body: "Alcune attività devono essere gestite da un amministratore autorizzato.",
    title: "Attività da gestire",
  };
}

/**
 * Serve una spiegazione neutra al posto dei dettagli? (§26)
 *
 * «Se l'actor può disattivare ma non consultare o gestire un dominio
 * bloccante, non esporre dettagli riservati o CTA non autorizzate.»
 */
export function hasUnreadableBlocker(blockers: DeactivationBlocker[]): boolean {
  return blockers.some((blocker) => blocker.count === null || !blocker.canOpen);
}

const ERROR_COPY: Partial<Record<SeasonErrorCode, string>> = {
  HISTORY_BATCH_TOO_LARGE:
    "Il periodo contiene troppe stagioni. Dividilo in più periodi e riprova.",
  HISTORY_CONTEXT_CHANGED:
    "Lo storico è stato aggiornato. Controlla il riepilogo prima di confermare.",
  HISTORY_NOTHING_TO_ADD: "Le stagioni selezionate sono già presenti nello storico.",
  HISTORY_PERIOD_CONFLICT:
    "Due periodi assegnano classificazioni diverse alla stessa stagione. Correggili per continuare.",
  HISTORY_PERIOD_INVALID: "Controlla i periodi inseriti prima di confermare.",
  OPERATION_CONTENT_CHANGED:
    "I dati sono cambiati dopo l'ultimo tentativo. Controllali e conferma di nuovo.",
  SEASON_ALREADY_EXISTS:
    "La stagione è già stata configurata. Ricarica per vedere i dati aggiornati.",
  SEASON_CATALOG_UNAVAILABLE:
    "Non è stato possibile caricare le stagioni. Riprova.",
  SEASON_CONFIG_NOT_AUTHORIZED:
    "Per riattivare la squadra serve anche il permesso di configurare la stagione.",
  SEASON_CONTEXT_CHANGED:
    "La stagione corrente è cambiata. Controlla i dati prima di salvare.",
  SEASON_NOT_HISTORICAL: "Questa stagione non è conclusa e non si corregge da qui.",
  SEASON_VERSION_CONFLICT:
    "I dati sono stati modificati da un altro amministratore. Ricarica e controlla prima di salvare.",
  TEAM_HAS_OPEN_ACTIVITY:
    "La squadra ha ancora attività aperte. Gestiscile prima di disattivarla.",
  TEAM_LEVEL_INCOMPATIBLE:
    "Il livello non è compatibile con il tipo squadra selezionato.",
  TEAM_NOT_ACTIVE: "La squadra non è attiva. Riattivala per continuare.",
  TEAM_NOT_AUTHORIZED: "Non hai i permessi per questa operazione.",
  TEAM_NOT_FOUND: "La squadra non è più disponibile.",
  TEAM_SEASON_NOT_FOUND: "La stagione non è più disponibile.",
  TEAM_TYPE_REQUIRED: "Seleziona il tipo squadra.",
  TEAM_VERSION_CONFLICT:
    "La squadra è stata modificata da un altro amministratore. Ricarica e riprova.",
};

/**
 * Messaggio utente di un errore (§33).
 *
 * «Messaggi di validazione vicino al relativo campo; niente codici HTTP,
 * stack trace o dettagli interni.» Un codice sconosciuto ricade sul testo
 * generico passato dal chiamante, che è specifico dell'operazione.
 */
export function seasonErrorMessage(
  code: SeasonErrorCode,
  fallback: string,
): string {
  return ERROR_COPY[code] ?? fallback;
}

/** Il periodo può entrare nella bozza? (§18, §20) */
export function canAddPeriod(preview: HistoryPeriodPreview | null): boolean {
  return !!preview && preview.errorCode === null && preview.newCount > 0;
}
