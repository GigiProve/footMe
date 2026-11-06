/**
 * Query key del Centro Inviti e richieste (§36).
 *
 * «Chiavi cache scoped almeno a account/actor, Society oppure destinatario
 * personale, capability/scope rilevanti, tab, filtro, pagina/cursore.»
 *
 * Le due tab e le due sezioni hanno chiavi **distinte** perché §13 chiede
 * cursori e stati separati: «il caricamento dei Recenti non deve cancellare
 * gli In attesa». Una chiave sola ne farebbe una query e un errore solo.
 *
 * Il filtro entra nella chiave serializzato in forma canonica — `all`, o i
 * Team ordinati — così che la stessa selezione raggiunta in ordine diverso
 * non produca due cache.
 *
 * La ricezione non usa la chiave della Società: il destinatario legge il
 * proprio invito senza avere accesso al Centro (§8), quindi la sua cache è
 * indicizzata su actor e invito.
 */
import type { InvitesFilter, InvitesSection, InvitesTab } from "./invites-types";

export function filterKey(filter: InvitesFilter): string {
  return filter.kind === "all"
    ? "all"
    : `teams:${[...filter.teamIds].sort().join(",")}`;
}

export const INVITES_QK = {
  candidates: (actorId: string, clubId: string, query: string) =>
    ["society-invite-candidates", actorId, clubId, query] as const,
  center: (actorId: string, clubId: string) =>
    ["society-invites-center", actorId, clubId] as const,
  filterTeams: (actorId: string, clubId: string) =>
    ["society-invite-filter-teams", actorId, clubId] as const,
  list: (
    actorId: string,
    clubId: string,
    tab: InvitesTab,
    section: InvitesSection,
    filter: InvitesFilter,
  ) =>
    [
      "society-invites-list",
      actorId,
      clubId,
      tab,
      section,
      filterKey(filter),
    ] as const,
  myInvite: (actorId: string, inviteId: string) =>
    ["member-invite-mine", actorId, inviteId] as const,
  request: (actorId: string, requestId: string) =>
    ["society-member-request", actorId, requestId] as const,
  roles: (actorId: string) => ["club-assignment-roles", actorId] as const,
  sentInvite: (actorId: string, inviteId: string) =>
    ["society-member-invite", actorId, inviteId] as const,
  assignableTeams: (actorId: string, clubId: string) =>
    ["society-assignable-teams", actorId, clubId] as const,
} as const;

/**
 * Prefissi per l'invalidazione dopo una mutazione. Elencati, non dedotti da
 * una substring libera: §36 chiede isolamento, e un `startsWith("society-")`
 * invaliderebbe anche i centri di altri pack.
 */
export const INVITES_QK_PREFIXES = [
  "society-invites-center",
  "society-invites-list",
  "society-invite-filter-teams",
  "society-invite-candidates",
  "society-assignable-teams",
] as const;
