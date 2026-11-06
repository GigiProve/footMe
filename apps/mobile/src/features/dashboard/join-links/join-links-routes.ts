/**
 * Destinazioni canoniche dei Link di invito (§6).
 *
 * Un posto solo, perché gli ingressi non divergano. «Passa riferimenti
 * canonici di society_id, team_id quando pertinente, origin e stato di
 * ritorno. Non usare il nome visualizzato come chiave.»
 *
 * Il centro e i dettagli gestionali vivono nello Stack della tab Dashboard —
 * bottom navigation visibile, Dashboard selezionata (§6). Il composer, la
 * landing e il percorso del destinatario sono flussi focalizzati e stanno
 * fuori dalle tab: §6 vieta che aprire un invito renda disponibile la
 * Dashboard della Società invitante.
 *
 * Il token del destinatario vive nel **path**, non in un provider: §20 chiede
 * che il link sopravviva a login, registrazione, onboarding e avvio a freddo,
 * e uno stato in memoria non sopravvive a nessuno dei quattro.
 */
export type JoinLinksOrigin =
  | "dashboard"
  | "deactivation"
  | "invites"
  /** Ritorno dallo screen «Invito pronto» al dettaglio del link appena creato. */
  | "ready"
  | "structure"
  | "team";

const ORIGINS: readonly JoinLinksOrigin[] = [
  "dashboard",
  "deactivation",
  "invites",
  "ready",
  "structure",
  "team",
];

/**
 * Un parametro di rotta è testo arbitrario: va riconosciuto, non assunto.
 * Un valore sconosciuto non è un errore — §6 chiede solo che il back
 * ripristini un contesto coerente — quindi degrada al Centro.
 */
export function parseJoinLinksOrigin(value: unknown): JoinLinksOrigin | null {
  return typeof value === "string" &&
    (ORIGINS as readonly string[]).includes(value)
    ? (value as JoinLinksOrigin)
    : null;
}

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

export const JOIN_LINKS_HREFS = {
  /** Screen 01 — Centro Link di invito. */
  center: (input?: { from?: JoinLinksOrigin; teamId?: string }) =>
    `/(tabs)/dashboard/join-links${query({
      from: input?.from,
      teamId: input?.teamId,
    })}`,
  /** Screen 13 e 17 — dettaglio del link, disponibile o disattivato. */
  detail: (linkId: string, input?: { from?: JoinLinksOrigin }) =>
    `/(tabs)/dashboard/join-links/${encodeURIComponent(linkId)}${query({
      from: input?.from,
    })}`,
  /** Screen 18 — persone collegate tramite quel link. */
  people: (linkId: string) =>
    `/(tabs)/dashboard/join-links/${encodeURIComponent(linkId)}/people`,
  /** Screen 19 — dettaglio contestuale della persona. */
  person: (linkId: string, assignmentId: string) =>
    `/(tabs)/dashboard/join-links/${encodeURIComponent(
      linkId,
    )}/people/${encodeURIComponent(assignmentId)}`,

  /** Screen 02 — passo 1 del composer. */
  composeConfigure: (input?: { from?: JoinLinksOrigin; teamId?: string }) =>
    `/team-link/configure${query({
      from: input?.from,
      teamId: input?.teamId,
    })}`,
  /** Screen 03 — ruoli dirigenziali, solo quando Dirigenti è selezionato. */
  composeRoles: "/team-link/roles",
  /** Screen 04 — riepilogo prima della generazione. */
  composeReview: "/team-link/review",
  /** Screen 05 — invito pronto, dopo la creazione riuscita. */
  composeReady: (linkId: string) =>
    `/team-link/ready/${encodeURIComponent(linkId)}`,

  /** Screen 06 e 12 — landing pubblica del token. */
  landing: (token: string) => `/team-invite/${encodeURIComponent(token)}`,
  /** Screen 07-11 — percorso della PERSON autenticata sullo stesso token. */
  join: (token: string) => `/team-join/${encodeURIComponent(token)}`,
} as const;
