/**
 * Query key del Centro Amministratori (§26).
 *
 * «Riutilizza la cache Foundation, separando account/actor, Society e scope
 * gestionale, destinatario autorizzato per la ricezione, tipo di lista/query,
 * cursore … I nomi AC Como o Luca non sono chiavi.»
 *
 * Attivi e inviti hanno chiavi **distinte** perché §25 chiede stati
 * indipendenti: «Se falliscono solo i pending, gli attivi restano
 * utilizzabili.» Una chiave sola li renderebbe un'unica query e un unico
 * errore.
 *
 * La ricezione non usa la chiave della Società: il destinatario legge il
 * proprio invito senza avere accesso al centro (§6), quindi la sua cache è
 * indicizzata su actor e invito.
 */
export const ADMINS_QK = {
  admins: (actorId: string, clubId: string) =>
    ["society-admins", actorId, clubId] as const,
  center: (actorId: string, clubId: string) =>
    ["society-admin-center", actorId, clubId] as const,
  candidates: (actorId: string, clubId: string, query: string) =>
    ["society-admin-candidates", actorId, clubId, query] as const,
  invites: (actorId: string, clubId: string) =>
    ["society-admin-invites", actorId, clubId] as const,
  myInvite: (actorId: string, inviteId: string) =>
    ["admin-invite-mine", actorId, inviteId] as const,
  invitePublic: (token: string) => ["admin-invite-public", token] as const,
  roles: (actorId: string, clubId: string) =>
    ["society-admin-roles", actorId, clubId] as const,
  teams: (actorId: string, clubId: string) =>
    ["society-admin-teams", actorId, clubId] as const,
} as const;

export const ADMINS_QK_PREFIXES = [
  "society-admin-center",
  "society-admins",
  "society-admin-invites",
  "society-admin-candidates",
  "society-admin-roles",
  "society-admin-teams",
] as const;
