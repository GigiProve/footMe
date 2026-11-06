/**
 * Query key dei Link di invito (§40).
 *
 * «Cache amministrativa scoped almeno a utente, Society, scope/capability,
 * link o Team e versione rilevante. Cache della persona scoped all'account e
 * al contesto di ripresa.»
 *
 * Le due tab hanno chiavi distinte: §10 chiede che il cambio tab non
 * rigeneri i link e non ne alteri lo stato, e una chiave sola ne farebbe una
 * query e un errore soli.
 *
 * Le chiavi del destinatario non portano la Società: §8 ricorda che la
 * persona che apre un link non ha accesso al centro, quindi la sua cache è
 * indicizzata su account e token.
 */
import type { JoinLinksTab } from "./join-links-types";

export const JOIN_LINKS_QK = {
  /** Composizione del centro (screen 01). */
  center: (actorId: string, clubId: string) =>
    ["team-join-links-center", actorId, clubId] as const,
  /**
   * Una tab del centro, nel contesto squadra corrente.
   *
   * Il teamId entra nella chiave perché la stessa tab filtrata su una
   * squadra e non filtrata sono due insiemi diversi (§37).
   */
  list: (
    actorId: string,
    clubId: string,
    tab: JoinLinksTab,
    teamId: string | null,
  ) =>
    ["team-join-links-list", actorId, clubId, tab, teamId ?? "all"] as const,
  /** Squadre su cui l'actor può emettere un link (screen 02). */
  teams: (actorId: string, clubId: string) =>
    ["team-join-link-teams", actorId, clubId] as const,
  /** Dettaglio del link (screen 13, 17). */
  detail: (actorId: string, linkId: string) =>
    ["team-join-link", actorId, linkId] as const,
  /** Persone collegate (screen 18). */
  people: (actorId: string, linkId: string) =>
    ["team-join-link-people", actorId, linkId] as const,
  /** Dettaglio della persona (screen 19). */
  person: (actorId: string, linkId: string, assignmentId: string) =>
    ["team-join-link-person", actorId, linkId, assignmentId] as const,
  /** Catalogo dei ruoli, condiviso e indipendente dalla Società. */
  roles: (actorId: string) => ["club-assignment-roles", actorId] as const,

  /**
   * Landing pubblica (screen 06). La chiave non porta l'actor: §40 vuole che
   * «la pagina pubblica non condivida cache di autorizzazioni o dati
   * privati», e lo stesso token letto prima e dopo il login non deve
   * riutilizzare la risposta anonima.
   */
  publicContext: (token: string) =>
    ["team-join-link-public", token] as const,
  /** Contesto della PERSON autenticata (screen 07-11). */
  joinContext: (actorId: string, token: string) =>
    ["team-join-context", actorId, token] as const,
} as const;

/**
 * Prefissi per l'invalidazione dopo una mutazione (§38).
 *
 * Elencati, non dedotti da una substring: un `startsWith("team-")`
 * invaliderebbe anche il Centro Squadre, che non cambia perché un link è
 * stato creato.
 */
export const JOIN_LINKS_QK_PREFIXES = [
  "team-join-links-center",
  "team-join-links-list",
  "team-join-link-teams",
  "team-join-link",
  "team-join-link-people",
  "team-join-link-person",
] as const;
