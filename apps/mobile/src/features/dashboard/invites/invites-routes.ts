/**
 * Destinazioni canoniche del pack Inviti (§6).
 *
 * Un posto solo, perché i cinque ingressi di §6 non possano divergere.
 * «Passa riferimenti canonici di society_id, team_id quando pertinente,
 * invitation_id, origin e stato di ritorno. Non usare il nome visualizzato
 * come chiave.»
 *
 * Il Centro e i dettagli gestionali vivono nello Stack della tab Dashboard —
 * bottom navigation visibile, Dashboard selezionata. Il composer e le
 * superfici del destinatario sono flussi focalizzati e stanno fuori dalle
 * tab: §6 vieta che aprirli renda disponibile la Dashboard della Società
 * invitante.
 */
export type InvitesOrigin =
  | "dashboard"
  | "deactivation"
  | "notification"
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

export const INVITES_HREFS = {
  /** Il Centro (screen 01, 02). */
  center: (input?: {
    from?: InvitesOrigin;
    tab?: "sent" | "received";
    teamId?: string;
  }) =>
    `/(tabs)/dashboard/invites${query({
      from: input?.from,
      tab: input?.tab,
      teamId: input?.teamId,
    })}`,
  /** Dettaglio dell'invito inviato (screen 15). */
  sentDetail: (inviteId: string, input?: { from?: InvitesOrigin }) =>
    `/(tabs)/dashboard/invites/${encodeURIComponent(inviteId)}${query({
      from: input?.from,
    })}`,
  /** Dettaglio consultabile della richiesta ricevuta (§15). */
  requestDetail: (requestId: string) =>
    `/(tabs)/dashboard/invites/request/${encodeURIComponent(requestId)}`,
  /** Passo 1 del composer (screen 04). */
  composeSearch: (input?: { from?: InvitesOrigin; teamId?: string }) =>
    `/member-invite/search${query({
      from: input?.from,
      teamId: input?.teamId,
    })}`,
  /** Passo 2 (screen 05, 06, 07). */
  composeConfigure: "/member-invite/configure",
  /** Passo 3 (screen 08). */
  composeReview: "/member-invite/review",
  /** La proposta come la vede il destinatario (screen 10-14, 16). */
  received: (inviteId: string) =>
    `/invitation/${encodeURIComponent(inviteId)}`,
} as const;
