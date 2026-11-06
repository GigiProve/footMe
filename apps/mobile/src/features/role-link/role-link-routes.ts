/**
 * Destinazioni canoniche del collegamento Persona–Società (§6).
 *
 * Un posto solo, perché i cinque ingressi di §6 non possano divergere.
 * «Preserva origine, Society, Team di ingresso, filtri, scroll e selezione
 * della tab quando pertinenti»: qui passano riferimenti canonici — club_id,
 * request_id, assignment_id, profile_id e `from` — mai il nome
 * visualizzato.
 *
 * Due famiglie, come le vuole il PNG:
 *
 *   · figlie di una tab, bottom navigation visibile — screen 13, 14, 18
 *     nella tab Profilo, screen 09 e 21 nella Dashboard;
 *   · flussi focalizzati in `app/role-link/`, con back e safe area e senza
 *     bottom navigation — form, riepiloghi, dettagli, esiti e conferme.
 *
 * `/role-link/` è un namespace nuovo: `/society-link/` appartiene alla rete
 * **fra società** di DAS-REV-11 e condividerlo confonderebbe due domini che
 * §3 tiene distinti.
 */
export type RoleLinkOrigin =
  | "club"
  | "dashboard"
  | "notification"
  | "profile"
  | "roster"
  | "structure"
  | "team";

function query(parts: Record<string, string | null | undefined>): string {
  const entries = Object.entries(parts).filter(
    (entry): entry is [string, string] =>
      typeof entry[1] === "string" && entry[1].length > 0,
  );

  return entries.length === 0
    ? ""
    : `?${entries
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join("&")}`;
}

export const ROLE_LINK_HREFS = {
  /** Form della richiesta (screen 02, 04, 05) — flusso focalizzato. */
  requestForm: (clubId: string, input?: { from?: RoleLinkOrigin }) =>
    `/role-link/request${query({ clubId, from: input?.from })}`,
  /** Riepilogo prima dell'invio (screen 06). */
  requestReview: (clubId: string) => `/role-link/review${query({ clubId })}`,
  /** La propria richiesta in attesa o terminale (screen 07, 08). */
  myRequest: (requestId: string, input?: { from?: RoleLinkOrigin }) =>
    `/role-link/my-request/${encodeURIComponent(requestId)}${query({
      from: input?.from,
    })}`,
  /** Elenco delle proprie richieste verso una società (§11). */
  myClubRequests: (clubId: string) =>
    `/role-link/requests${query({ clubId })}`,

  /** Società e ruoli (screen 13) — tab Profilo. */
  societies: "/profile/societies",
  /** Il rapporto con una società (screen 14, 18, 20) — tab Profilo. */
  society: (clubId: string, input?: { from?: RoleLinkOrigin }) =>
    `/profile/societies/${encodeURIComponent(clubId)}${query({
      from: input?.from,
    })}`,
  /** Il singolo incarico personale (screen 15, 19) — focalizzato. */
  assignment: (assignmentId: string) =>
    `/role-link/assignment/${encodeURIComponent(assignmentId)}`,
  /** Form condiviso di modifica e aggiunta (screen 16, 17) — focalizzato. */
  assignmentEdit: (assignmentId: string) =>
    `/role-link/assignment-form${query({ mode: "edit", assignmentId })}`,
  assignmentAdd: (clubId: string, input?: { profileId?: string }) =>
    `/role-link/assignment-form${query({
      mode: "add",
      clubId,
      profileId: input?.profileId,
    })}`,

  /** Il rapporto con una persona, lato Società (screen 21, 23, 24). */
  societyPerson: (
    clubId: string,
    profileId: string,
    input?: { from?: RoleLinkOrigin; teamId?: string },
  ) =>
    `/(tabs)/dashboard/people/${encodeURIComponent(profileId)}${query({
      clubId,
      from: input?.from,
      teamId: input?.teamId,
    })}`,
  /** Il singolo incarico, lato Società (screen 22) — focalizzato. */
  societyAssignment: (assignmentId: string) =>
    `/role-link/society-assignment/${encodeURIComponent(assignmentId)}`,
  /** Persone con un incarico societario (§32). */
  societyWideMembers: (clubId: string) =>
    `/(tabs)/dashboard/people${query({ clubId })}`,

  /** Dettaglio gestionale della richiesta, nel Centro esistente (§20). */
  societyRequest: (requestId: string) =>
    `/(tabs)/dashboard/invites/request/${encodeURIComponent(requestId)}${query({
      kind: "role",
    })}`,
} as const;
