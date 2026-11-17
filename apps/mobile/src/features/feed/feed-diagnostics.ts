/**
 * Log tecnico del Feed (HOM-15 §356–§357): unità malformate e renderer mancanti.
 *
 * Solo identificativi tecnici — id della unit e tipo dichiarato —, MAI payload, testo,
 * nomi o URL (§357: niente dati privati non necessari). Nessun vendor: in sviluppo un
 * `console.warn`, sempre un evento al sink di `lib/analytics` (no-op finché nessuno lo
 * registra, §358 lo predispone). Una sola volta per unit e motivo: il default del
 * renderer gira a ogni render e non deve inondare il log.
 */

import { trackEvent } from "../../lib/analytics";

export type FeedAnomalyReason = "malformed_unit" | "missing_renderer";

const LOGGED_CAP = 200;
const logged = new Set<string>();

export function logFeedAnomaly(
  reason: FeedAnomalyReason,
  unit: { id: unknown; type: unknown },
): void {
  const id = typeof unit.id === "string" ? unit.id : null;
  const type = typeof unit.type === "string" ? unit.type : null;
  const key = `${reason}:${id ?? "-"}:${type ?? "-"}`;
  if (logged.has(key)) {
    return;
  }
  if (logged.size >= LOGGED_CAP) {
    logged.clear();
  }
  logged.add(key);

  if (__DEV__) {
    console.warn(`[feed] ${reason}`, { id, type });
  }
  trackEvent("feed_technical_issue", { itemId: id, itemType: type, reason });
}

/** Solo per i test. */
export function resetFeedAnomalyLog(): void {
  logged.clear();
}
