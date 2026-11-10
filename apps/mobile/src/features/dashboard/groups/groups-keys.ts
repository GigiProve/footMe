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
} as const;

/** Prefissi da invalidare dopo una create confermata (§27). Elencati, non dedotti. */
export const GROUPS_QK_PREFIXES = ["society-groups-center", "society-group-detail"] as const;
