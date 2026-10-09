/**
 * Eventi della Dashboard (§24).
 *
 * Naming `dashboard_*` sul modello di `features/feed/feed-analytics.ts`.
 * Proprietà minimizzate: tipo di identità, id del tipo di modulo, tipo di
 * destinazione, categoria di esito. **Mai** nomi, titoli, recapiti, id di
 * persone o di Società — un correlation ID tecnico non deve incorporare dati
 * personali.
 *
 * NOTA sullo stato reale: `setAnalyticsSink` non è mai chiamato nel progetto,
 * quindi `trackEvent` è oggi un no-op. Gli eventi sono definiti perché il
 * contratto lo richiede; nessuno di essi è stato verificato su un sink reale.
 */

import { trackEvent } from "../../lib/analytics";
import type { DashboardIdentityKind } from "./dashboard-types";

/** Da dove è arrivato il contesto corrente. */
export type DashboardSource =
  | "bottom_nav"
  | "restore"
  | "default"
  | "selector"
  | "deep_link"
  | "authorization_fallback";

export function trackDashboardOpened(input: {
  identityKind: DashboardIdentityKind | null;
  moduleCount: number;
  source: DashboardSource;
}): void {
  trackEvent("dashboard_opened", {
    identity_kind: input.identityKind,
    module_count: input.moduleCount,
    source: input.source,
  });
}

export function trackSelectorOpened(identityCount: number): void {
  trackEvent("dashboard_selector_opened", { identity_count: identityCount });
}

export function trackIdentitySwitchRequested(
  targetKind: DashboardIdentityKind,
): void {
  trackEvent("dashboard_identity_switch_requested", {
    target_kind: targetKind,
  });
}

export function trackIdentitySwitchCompleted(
  targetKind: DashboardIdentityKind,
): void {
  trackEvent("dashboard_identity_switch_completed", {
    target_kind: targetKind,
  });
}

export function trackAuthorizationFallback(
  fallbackKind: DashboardIdentityKind | null,
): void {
  trackEvent("dashboard_authorization_fallback", {
    fallback_kind: fallbackKind,
  });
}

export function trackModuleAction(input: {
  action: "row" | "cta";
  identityKind: DashboardIdentityKind;
  moduleId: string;
}): void {
  trackEvent("dashboard_module_action", {
    action: input.action,
    identity_kind: input.identityKind,
    module_id: input.moduleId,
  });
}

export function trackDashboardError(input: {
  /** Categoria tecnica, mai il messaggio: può contenere payload. */
  category: "composition" | "module";
  moduleId: string | null;
}): void {
  trackEvent("dashboard_error", {
    category: input.category,
    module_id: input.moduleId,
  });
}
