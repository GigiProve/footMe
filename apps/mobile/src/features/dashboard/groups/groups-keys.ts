/**
 * Query key dei Gruppi operativi (DAS-REV-32 §27).
 *
 * «Scopa la cache almeno per user, acting Society, permission/scope version,
 * tipo di proiezione, query/cursore.» L'actor e la Società entrano in ogni
 * chiave amministrativa; la proiezione (center/detail/people) è il primo
 * segmento, così una lettura amministrativa e una conversazionale non
 * condividono mai la stessa entry. Il cursore non è nella chiave: le pagine
 * stanno nella stessa infinite query.
 *
 * La versione di scope non è esposta dal server: al cambio di permessi il
 * server risponde con un rifiuto e la chiave della Società viene rimossa.
 */
export const GROUPS_QK = {
  center: (actorId: string, clubId: string, query: string) =>
    ["society-groups-center", actorId, clubId, query] as const,
  detail: (actorId: string, clubId: string, conversationId: string) =>
    ["society-group-detail", actorId, clubId, conversationId] as const,
  contexts: (actorId: string) => ["society-group-contexts", actorId] as const,
  teams: (actorId: string, clubId: string) => ["society-group-teams", actorId, clubId] as const,
  people: (actorId: string, clubId: string, teamId: string | null, query: string) =>
    ["society-group-people", actorId, clubId, teamId ?? "", query] as const,
  avatarUrl: (actorId: string, path: string) => ["society-group-avatar-url", actorId, path] as const,

  /*
   * DAS-REV-33 §26: «Scopa le cache per user/actor, Society/scope, Conversation,
   * proiezione e periodo». La proiezione è il primo segmento: la gestione
   * amministrativa non condivide mai una entry con la chat. `conversationId`
   * distingue i gruppi; un nuovo periodo parte da cache vuota perché alla fine
   * del periodo le query vengono rimosse (`purgeGroupQueries`).
   */
  management: (actorId: string, conversationId: string) =>
    ["society-group-management", actorId, conversationId] as const,
  members: (actorId: string, conversationId: string, query: string) =>
    ["society-group-members", actorId, conversationId, query] as const,
  eligible: (actorId: string, conversationId: string, query: string) =>
    ["society-group-eligible", actorId, conversationId, query] as const,
  teamOptions: (actorId: string, conversationId: string) =>
    ["society-group-team-options", actorId, conversationId] as const,
  handover: (actorId: string, conversationId: string, query: string) =>
    ["society-group-handover", actorId, conversationId, query] as const,
  archived: (actorId: string, clubId: string, query: string) =>
    ["society-groups-archived", actorId, clubId, query] as const,
} as const;

/** Prefissi da invalidare dopo una create confermata (§27). Elencati, non dedotti. */
export const GROUPS_QK_PREFIXES = ["society-groups-center", "society-group-detail"] as const;

/**
 * Prefissi per conversazione con la forma `[prefisso, actor, conversationId, …]`
 * (DAS-REV-33 §26). Il dettaglio 32 ha anche la Società e si filtra a parte.
 */
export const GROUPS_QK_CONVERSATION_PREFIXES = [
  "society-group-management",
  "society-group-members",
  "society-group-eligible",
  "society-group-team-options",
  "society-group-handover",
] as const;

/** Liste per Società: Centro attivi e Archiviati (§21, §26). */
export const GROUPS_QK_LIST_PREFIXES = ["society-groups-center", "society-groups-archived"] as const;
