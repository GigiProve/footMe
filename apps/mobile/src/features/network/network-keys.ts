/**
 * Query key della Rete societaria (§27).
 *
 * «Le chiavi includono account, Society corrente, scope/capability e
 * parametri di lista; i dettagli includono relationship/invite ID e versione
 * pertinente.»
 *
 * Actor e Società stanno nella chiave: cambiare identità non deve poter
 * ripopolare la pagina con la response precedente. La versione arriva invece
 * dentro il payload e invalida per confronto — moltiplicare le chiavi per
 * versione lascerebbe in cache la riga vecchia, pronta a ricomparire.
 */
export const NETWORK_QK = {
  center: (actorId: string, clubId: string) =>
    ["society-network", actorId, clubId] as const,
  detail: (actorId: string, clubId: string, relationshipId: string) =>
    ["society-network-detail", actorId, clubId, relationshipId] as const,
  eligibility: (actorId: string, clubId: string, targetIds: readonly string[]) =>
    ["society-network-eligibility", actorId, clubId, [...targetIds].sort().join(",")] as const,
  history: (actorId: string, clubId: string) =>
    ["society-network-history", actorId, clubId] as const,
  inviteContext: (actorId: string, token: string) =>
    ["society-invite-context", actorId, token] as const,
  invitePublic: (token: string) => ["society-invite-public", token] as const,
  links: (actorId: string, clubId: string) =>
    ["society-network-links", actorId, clubId] as const,
  requests: (actorId: string, clubId: string) =>
    ["society-network-requests", actorId, clubId] as const,
  types: () => ["society-relationship-types"] as const,
} as const;

export const NETWORK_QK_PREFIXES = [
  "society-network",
  "society-network-detail",
  "society-network-eligibility",
  "society-network-history",
  "society-network-links",
  "society-network-requests",
] as const;
