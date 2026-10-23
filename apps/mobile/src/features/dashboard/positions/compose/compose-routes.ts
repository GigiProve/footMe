/**
 * Destinazioni del composer (DAS-REV-16 §4).
 *
 * «Questo è un flusso focalizzato: nessuna bottom navigation, nessuna
 * seconda shell Dashboard, FAB, campanella o menu generale sopra i campi.»
 * Per questo le route vivono in `app/position-compose/` e non sotto
 * `app/(tabs)/dashboard/`, come già fanno `society-admin/` e `club-roles/`.
 *
 * Le tre fasi sono un significato, non un conteggio di route: §4 — «Il
 * numero di route interne non cambia il significato dei tre passaggi.»
 */

export type ComposeOrigin = "center" | "dashboard" | "team";

const ROOT = "/position-compose";

function query(params: Record<string, string | null | undefined>): string {
  const parts = Object.entries(params)
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`);

  return parts.length > 0 ? `?${parts.join("&")}` : "";
}

export const COMPOSE_HREFS = {
  /** Step 2, dettaglio di una Position. `from` distingue la CTA (§11). */
  details: (positionId: string, options?: { from?: "hub" | "single" }) =>
    `${ROOT}/details/${encodeURIComponent(positionId)}${query({
      from: options?.from,
    })}`,
  /** Step 2 multiplo: «Configura le posizioni». */
  hub: () => `${ROOT}/hub`,
  /** Step 3 con più Position: selezione di pubblicazione. */
  preview: () => `${ROOT}/preview`,
  /** Step 3 con una sola Position: anteprima singola. */
  previewSingle: (positionId: string) =>
    `${ROOT}/preview/${encodeURIComponent(positionId)}`,
  /**
   * Step 1. `teamId` assente significa «scegli nel flow», mai «Prima
   * squadra»: §5 — «Con più Team e nessuna scelta contestuale non assegnare
   * la Prima squadra arbitrariamente.»
   */
  start: (options?: {
    from?: ComposeOrigin;
    scope?: "society" | "team";
    teamId?: string | null;
  }) =>
    `${ROOT}${query({
      from: options?.from,
      scope: options?.scope,
      teamId: options?.teamId,
    })}`,
} as const;
