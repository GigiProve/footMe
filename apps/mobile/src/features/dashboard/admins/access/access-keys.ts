/**
 * Query key dell'accesso amministrativo (§28).
 *
 * Dettaglio, permessi effettivi, invito e candidati Owner hanno chiavi
 * distinte perché §29 chiede stati indipendenti: un errore nel picker delle
 * squadre non deve cancellare il dettaglio della persona.
 */
export const ACCESS_QK = {
  candidates: (actorId: string, clubId: string) =>
    ["society-owner-candidates", actorId, clubId] as const,
  detail: (actorId: string, clubId: string, profileId: string) =>
    ["society-admin-detail", actorId, clubId, profileId] as const,
  invite: (actorId: string, clubId: string, inviteId: string) =>
    ["society-admin-invite-detail", actorId, clubId, inviteId] as const,
  permissions: (actorId: string, clubId: string, profileId: string) =>
    ["society-admin-permissions", actorId, clubId, profileId] as const,
  scopeTeams: (actorId: string, clubId: string) =>
    ["society-admin-scope-teams", actorId, clubId] as const,
} as const;

export const ACCESS_QK_PREFIXES = [
  "society-admin-detail",
  "society-admin-permissions",
  "society-admin-invite-detail",
  "society-admin-scope-teams",
  "society-owner-candidates",
] as const;
