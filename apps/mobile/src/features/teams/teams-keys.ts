/**
 * Query key del Centro Squadre, sul modello di `dashboard-keys.ts`.
 *
 * §26 chiede chiavi che includano «account, Società, scope/capability
 * revision, stagione e versione dello schema pertinente». Actor e Società
 * sono nella chiave; la stagione e la revisione di scope arrivano dal payload
 * e invalidano per confronto, non moltiplicando le chiavi — il contrario
 * lascerebbe in cache la pagina della stagione precedente, pronta a
 * ricomparire al rientro.
 */
export const TEAMS_QK = {
  center: (actorId: string, clubId: string) =>
    ["teams-center", actorId, clubId] as const,
  editor: (actorId: string, teamId: string) =>
    ["teams-editor", actorId, teamId] as const,
  levels: (typeId: string, seasonId: string | null, query: string) =>
    ["teams-levels", typeId, seasonId ?? "", query] as const,
  page: (actorId: string, clubId: string) =>
    ["teams-center-page", actorId, clubId] as const,
  types: () => ["teams-types"] as const,
} as const;

export const TEAMS_QK_PREFIXES = [
  "teams-center",
  "teams-center-page",
  "teams-editor",
] as const;
