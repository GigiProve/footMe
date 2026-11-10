/**
 * Eventi dei Gruppi operativi (DAS-REV-32 §29).
 *
 * Naming `dashboard_groups_*` come gli altri moduli Dashboard. Parametri
 * solo aggregati e tecnici: origine, step, presenza di squadra/immagine,
 * fascia di persone, categoria d'errore. **Mai** nomi di gruppi o persone,
 * query, ID dei membri, body o URL firmati (§29). Un retry dello stesso
 * intento non è un secondo successo: chi chiama passa `replayed`.
 *
 * Stato reale: `setAnalyticsSink` non è mai chiamato nel progetto, quindi
 * `trackEvent` è un no-op (vedi dashboard-analytics.ts).
 */
import { trackEvent } from "../../../lib/analytics";
import type { GroupComposeOrigin } from "./groups-types";

/** Fascia invece del numero esatto di persone. */
export function peopleBand(count: number): string {
  if (count <= 2) return "2";
  if (count <= 5) return "3-5";
  if (count <= 15) return "6-15";
  if (count <= 40) return "16-40";
  return "41+";
}

export function trackGroupsCenterOpened(): void {
  trackEvent("dashboard_groups_center_opened", {});
}

export function trackGroupsSearchCompleted(resultCount: number): void {
  trackEvent("dashboard_groups_search_completed", { has_results: resultCount > 0 });
}

export function trackGroupDetailOpened(canOpenConversation: boolean): void {
  trackEvent("dashboard_group_detail_opened", { can_open_conversation: canOpenConversation });
}

export function trackGroupOpenConversation(): void {
  trackEvent("dashboard_group_open_conversation", {});
}

export function trackGroupCreateOpened(origin: GroupComposeOrigin): void {
  trackEvent("dashboard_group_create_opened", { origin });
}

export function trackGroupCreateStep(step: 1 | 2 | 3): void {
  trackEvent("dashboard_group_create_step", { step });
}

export function trackGroupCreateResult(input: {
  errorCategory?: string;
  hasAvatar: boolean;
  hasTeam: boolean;
  origin: GroupComposeOrigin;
  outcome: "started" | "succeeded" | "failed" | "recovered";
  people: number;
}): void {
  trackEvent("dashboard_group_create_result", {
    error_category: input.errorCategory ?? null,
    has_avatar: input.hasAvatar,
    has_team: input.hasTeam,
    origin: input.origin,
    outcome: input.outcome,
    people_band: peopleBand(input.people),
  });
}

export function trackGroupCreateAbandoned(step: 1 | 2 | 3): void {
  trackEvent("dashboard_group_create_abandoned", { step });
}
