/**
 * Query key di Stagioni e storico (§32).
 *
 * Stesso modello di `teams-keys.ts`: actor e identità nella chiave, stagione
 * e revisione di scope nel payload. §32 chiede che le chiavi includano
 * «account, identity Società, Team quando pertinente, scope/capability,
 * catalogo/configurazione rilevante e parametri di elenco», e il motivo è
 * uno solo — «La cache di un'altra identity non può comparire sotto il nuovo
 * header, neppure temporaneamente».
 *
 * La preview del batch è intenzionalmente **fuori** da questa mappa: dipende
 * dalla bozza locale, ha un contesto che scade e §20 vuole che un conteggio
 * non ancora disponibile resti tale invece di tornare zero da una cache.
 */
export const SEASONS_QK = {
  center: (actorId: string, clubId: string) =>
    ["seasons-center", actorId, clubId] as const,
  centerPage: (actorId: string, clubId: string) =>
    ["seasons-center-page", actorId, clubId] as const,
  historyOptions: (actorId: string, teamId: string) =>
    ["seasons-history-options", actorId, teamId] as const,
  historyPage: (actorId: string, teamId: string) =>
    ["seasons-history-page", actorId, teamId] as const,
  inactive: (actorId: string, clubId: string) =>
    ["seasons-inactive", actorId, clubId] as const,
  seasonDetail: (actorId: string, teamSeasonId: string) =>
    ["seasons-detail", actorId, teamSeasonId] as const,
  /** Esito del controllo impedimenti: provider separato, può fallire da solo. */
  teamDeactivation: (actorId: string, teamId: string) =>
    ["seasons-deactivation", actorId, teamId] as const,
  teamContext: (actorId: string, teamId: string) =>
    ["seasons-team-context", actorId, teamId] as const,
} as const;

export const SEASONS_QK_PREFIXES = [
  "seasons-center",
  "seasons-center-page",
  "seasons-history-options",
  "seasons-history-page",
  "seasons-inactive",
  "seasons-detail",
  "seasons-deactivation",
  "seasons-team-context",
] as const;
