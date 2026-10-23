/**
 * Destinazioni del Centro Posizioni aperte (§18, §19).
 *
 * Un posto solo: la Dashboard Società, il dettaglio operativo Squadra e il
 * flusso di disattivazione devono aprire **la stessa** destinazione con lo
 * stesso contesto, e §20 chiede esplicitamente di aggiornare gli ingressi di
 * DAS-REV-07 e DAS-REV-09 perché «Gestisci/Vedi posizioni aprano questo
 * Centro condiviso».
 *
 * `from` conserva l'origine per il back di §21; `teamId` preimposta il
 * filtro. Nessuno dei due è un permesso: il server rivalida il perimetro a
 * ogni pagina e rifiuta un Team fuori scope (§15).
 */

export type PositionsOrigin =
  | "dashboard"
  | "deactivation"
  | "structure"
  | "team";

const CENTER = "/(tabs)/dashboard/positions";

function query(params: Record<string, string | null | undefined>): string {
  const parts = Object.entries(params)
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`);

  return parts.length > 0 ? `?${parts.join("&")}` : "";
}

export const POSITIONS_HREFS = {
  /** Centro, eventualmente con tab e Team preimpostati. */
  center: (options?: {
    from?: PositionsOrigin;
    group?: "active" | "drafts" | "closed";
    teamId?: string | null;
  }) =>
    `${CENTER}${query({
      from: options?.from,
      tab: options?.group,
      teamId: options?.teamId,
    })}`,
  /**
   * Composer condiviso delle Posizioni (DAS-REV-16).
   *
   * §19: «Passa Society ID e origine. Con Team specifico valido
   * preselezionato, passa quel Team; … Con più Team e filtro Tutte le
   * posizioni non scegliere arbitrariamente il primo.» Da qui il `teamId`
   * opzionale: assente significa "scegli nel flow", non "Prima squadra".
   */
  compose: (options?: { scope?: "society" | "team"; teamId?: string | null }) =>
    `/(tabs)/announcements${query({
      compose: "1",
      focus: "positions",
      scope: options?.scope,
      teamId: options?.teamId,
    })}`,
  /** Dettaglio gestionale della stessa Position, mai la scheda visitor. */
  detail: (positionId: string, options?: { from?: PositionsOrigin }) =>
    `/society-position/${encodeURIComponent(positionId)}${query({
      from: options?.from,
    })}`,
  /** Candidature della Position, nel loro dominio (§20). */
  positionApplications: (positionId: string) =>
    `/(tabs)/announcements${query({
      adId: positionId,
      focus: "applications",
    })}`,
} as const;
