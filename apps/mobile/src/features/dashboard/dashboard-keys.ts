/**
 * Query key della Dashboard in un posto solo, sul modello di
 * `features/feed/feed-keys.ts`.
 *
 * Ogni chiave che tocca dati di un'identità include **actor + identità**.
 * È il requisito §22 ("cache e stato devono distinguere almeno actor/sessione,
 * Dashboard Identity, contesto di accesso/scope e modulo") e la ragione per
 * cui le chiavi attuali della Dashboard non bastavano: `["home-dashboard",
 * userId]` non sa dire di quale Società sono i dati che contiene.
 *
 * `identities` dipende dal solo actor: l'elenco delle Dashboard disponibili
 * non cambia a seconda di quale si sta guardando.
 */

export const DASHBOARD_QK = {
  /** Elenco delle identità eleggibili per l'actor. */
  identities: (actorId: string) => ["dashboard-identities", actorId] as const,

  /** Riepilogo, priorità e conteggi di una Società. */
  societyOverview: (actorId: string, identityId: string) =>
    ["dashboard-society-overview", actorId, identityId] as const,

  /** Dati di un modulo, per actor e identità. */
  module: (actorId: string, identityId: string, moduleId: string) =>
    ["dashboard-module", actorId, identityId, moduleId] as const,
} as const;

/**
 * Prefisso comune: serve a invalidare in blocco tutto ciò che appartiene a un
 * actor al logout o al cambio account, senza enumerare i moduli.
 */
export const DASHBOARD_QK_PREFIXES = [
  "dashboard-identities",
  "dashboard-society-overview",
  "dashboard-module",
] as const;
