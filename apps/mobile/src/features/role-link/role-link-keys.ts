/**
 * Query key del collegamento Persona–Società (§44).
 *
 * «Scope minimo delle cache private: account, actor/identity, società,
 * risorsa/Team quando pertinente, versione dei permessi e schema. Le letture
 * personali e societarie non condividono indiscriminatamente una cache.»
 *
 * Per questo le chiavi personali partono da `my-` e portano l'actor, mentre
 * quelle societarie portano actor **e** club: lo stesso incarico letto come
 * persona e come amministratore è la stessa riga ma non lo stesso payload —
 * `canManage`, `canRestore` e il perimetro cambiano con chi guarda.
 */

export const ROLE_LINK_QK = {
  /** Blocco contestuale sul profilo Società (screen 01). */
  block: (actorId: string, clubId: string) =>
    ["role-link-block", actorId, clubId] as const,
  /** Richieste pendenti della persona verso una società (§11). */
  myClubRequests: (actorId: string, clubId: string) =>
    ["role-link-my-club-requests", actorId, clubId] as const,
  /** Materiali del form: identità reali e squadre assegnabili. */
  identities: (actorId: string) => ["role-link-identities", actorId] as const,
  teams: (actorId: string, clubId: string) =>
    ["role-link-teams", actorId, clubId] as const,
  catalog: (actorId: string) => ["club-assignment-roles", actorId] as const,
  /** La propria richiesta (screen 07). */
  myRequest: (actorId: string, requestId: string) =>
    ["role-link-my-request", actorId, requestId] as const,
  /** La richiesta vista dalla Società (screen 10). */
  societyRequest: (actorId: string, requestId: string) =>
    ["role-link-society-request", actorId, requestId] as const,
  /** Società e ruoli (screen 13). */
  mySocieties: (actorId: string) => ["role-link-my-societies", actorId] as const,
  /** Il rapporto con una società (screen 14 e 18). */
  mySocietyLink: (actorId: string, clubId: string) =>
    ["role-link-my-society", actorId, clubId] as const,
  /** Il singolo incarico, lato persona (screen 15). */
  myAssignment: (actorId: string, assignmentId: string) =>
    ["role-link-my-assignment", actorId, assignmentId] as const,
  /** Il rapporto con una persona, lato Società (screen 21). */
  societyPerson: (actorId: string, clubId: string, profileId: string) =>
    ["role-link-society-person", actorId, clubId, profileId] as const,
  /** Persone con un incarico societario (§32). */
  societyWide: (actorId: string, clubId: string) =>
    ["role-link-society-wide", actorId, clubId] as const,
  /** Il singolo incarico, lato Società (screen 22). */
  societyAssignment: (actorId: string, assignmentId: string) =>
    ["role-link-society-assignment", actorId, assignmentId] as const,
} as const;

/**
 * Prefissi da invalidare dopo una mutazione (§44).
 *
 * Elencati e non dedotti da una substring libera: un
 * `startsWith("role-")` colpirebbe anche chiavi di altri pack, e §44 chiede
 * isolamento, non un reset generale.
 *
 * Il Centro Inviti e il Centro Notifiche non sono qui ma vanno invalidati lo
 * stesso: le loro chiavi appartengono ai rispettivi moduli, che le
 * esportano. Vedi `invalidateRoleLinkQueries`.
 */
export const ROLE_LINK_QK_PREFIXES = [
  "role-link-block",
  "role-link-my-club-requests",
  "role-link-my-request",
  "role-link-society-request",
  "role-link-my-societies",
  "role-link-my-society",
  "role-link-my-assignment",
  "role-link-society-person",
  "role-link-society-assignment",
  "role-link-society-wide",
] as const;

/**
 * Chiavi di **altri** domini che una mutazione del rapporto sportivo rende
 * obsolete (§44: «Dopo ogni comando aggiorna/invalida le query correlate:
 * richiesta, Centro, blocco Società personale, relazione, incarico, organico
 * dei Team vecchio/nuovo, count, link interessati, profili e indici»).
 */
export const ROLE_LINK_RELATED_PREFIXES = [
  "society-invites-center",
  "society-invites-list",
  "society-member-request",
  "team-detail",
  "team-join-link",
  "team-join-link-people",
  "society-master-profile",
  "society-team-profile",
  "notifications",
] as const;
