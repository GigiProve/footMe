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
import type { DashboardPriorityTypeId } from "./priority/priority-types";
import type { DashboardErrorCategory } from "./state/error-classification";

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

// ── DAS-REV-02 — caricamento, stati, cache, priorità ──────────────────────
//
// Parametri limitati a enum e durate (§33): tipo identità, tipo modulo, tipo
// priorità, posizione, motivo, categoria di errore, origine del dato,
// versioni. **Mai** nomi, recapiti, titoli, testi di candidature, contenuti
// editoriali o id di persone e risorse.
//
// La chiave di una priorità incorpora l'id della risorsa (`new_applications:
// <club>:<ad>`): per questo gli eventi qui sotto ricevono `typeId`, non la
// chiave. §33 lo vieta esplicitamente.

/** Da dove è arrivato il primo rendering utile. */
export type DashboardDataOrigin = "network" | "cache";

export function trackDashboardLoadStarted(input: {
  identityKind: DashboardIdentityKind;
  /** true se esisteva una cache utilizzabile da cui partire. */
  hasUsableCache: boolean;
}): void {
  trackEvent("dashboard_load_started", {
    has_usable_cache: input.hasUsableCache,
    identity_kind: input.identityKind,
  });
}

/**
 * Primo rendering **utile**: un caricamento che ha mostrato soltanto lo
 * skeleton non è un successo (§33).
 */
export function trackDashboardFirstUsefulRender(input: {
  durationMs: number;
  identityKind: DashboardIdentityKind;
  moduleCount: number;
  origin: DashboardDataOrigin;
}): void {
  trackEvent("dashboard_first_useful_render", {
    duration_ms: input.durationMs,
    identity_kind: input.identityKind,
    module_count: input.moduleCount,
    origin: input.origin,
  });
}

export function trackDashboardLoadFailed(input: {
  category: DashboardErrorCategory;
  identityKind: DashboardIdentityKind;
  /** true quando resta comunque contenuto utilizzabile a schermo. */
  hasUsableContent: boolean;
}): void {
  trackEvent("dashboard_load_failed", {
    category: input.category,
    has_usable_content: input.hasUsableContent,
    identity_kind: input.identityKind,
  });
}

export function trackDashboardRefresh(input: {
  category?: DashboardErrorCategory;
  identityKind: DashboardIdentityKind;
  outcome: "started" | "succeeded" | "failed";
}): void {
  trackEvent("dashboard_refresh", {
    category: input.category ?? null,
    identity_kind: input.identityKind,
    outcome: input.outcome,
  });
}

export function trackDashboardModuleError(input: {
  category: DashboardErrorCategory;
  moduleId: string;
}): void {
  trackEvent("dashboard_module_error", {
    category: input.category,
    module_id: input.moduleId,
  });
}

export function trackDashboardModuleRetry(input: {
  moduleId: string;
  outcome: "started" | "succeeded" | "failed";
}): void {
  trackEvent("dashboard_module_retry", {
    module_id: input.moduleId,
    outcome: input.outcome,
  });
}

export function trackDashboardOffline(input: {
  hasUsableData: boolean;
  identityKind: DashboardIdentityKind;
}): void {
  trackEvent("dashboard_offline", {
    has_usable_data: input.hasUsableData,
    identity_kind: input.identityKind,
  });
}

/** Scadenza della possibilità di usare la cache, con il motivo distinto. */
export function trackDashboardCacheUnusable(input: {
  identityKind: DashboardIdentityKind;
  reason: "expired" | "access_window_expired" | "incompatible";
}): void {
  trackEvent("dashboard_cache_unusable", {
    identity_kind: input.identityKind,
    reason: input.reason,
  });
}

export function trackDashboardEmpty(input: {
  hasAction: boolean;
  identityKind: DashboardIdentityKind;
  interaction: "shown" | "cta";
}): void {
  trackEvent("dashboard_empty", {
    has_action: input.hasAction,
    identity_kind: input.identityKind,
    interaction: input.interaction,
  });
}

/**
 * Impression di una priorità. Richiede visibilità effettiva e **non** si
 * duplica a ogni re-render, aggiornamento del conteggio o lettura dalla
 * cache: il chiamante tiene un set delle chiavi già annunciate per contesto.
 */
export function trackPriorityImpression(input: {
  identityKind: DashboardIdentityKind;
  position: number;
  typeId: DashboardPriorityTypeId;
}): void {
  trackEvent("dashboard_priority_impression", {
    identity_kind: input.identityKind,
    position: input.position,
    type_id: input.typeId,
  });
}

export function trackPriorityTap(input: {
  identityKind: DashboardIdentityKind;
  position: number;
  typeId: DashboardPriorityTypeId;
}): void {
  trackEvent("dashboard_priority_tap", {
    identity_kind: input.identityKind,
    position: input.position,
    type_id: input.typeId,
  });
}

/**
 * Sparizione di una priorità, con il motivo **distinto** (§33).
 *
 * `hidden_by_limit`, `permission_revoked` e `deduplicated` non sono
 * risoluzioni: interpretarli come tali gonfierebbe la metrica di attività
 * gestite con attività che nessuno ha gestito.
 */
export type PriorityRemovalReason =
  | "resolved"
  | "expired"
  | "no_longer_eligible"
  | "permission_revoked"
  | "hidden_by_limit";

export function trackPriorityRemoved(input: {
  reason: PriorityRemovalReason;
  typeId: DashboardPriorityTypeId;
}): void {
  trackEvent("dashboard_priority_removed", {
    reason: input.reason,
    type_id: input.typeId,
  });
}

export function trackModulePromotion(input: {
  moduleId: string;
  typeId: DashboardPriorityTypeId;
}): void {
  trackEvent("dashboard_module_promoted", {
    module_id: input.moduleId,
    type_id: input.typeId,
  });
}

export function trackOrderApplied(input: {
  moduleCount: number;
  trigger: string;
}): void {
  trackEvent("dashboard_order_applied", {
    module_count: input.moduleCount,
    trigger: input.trigger,
  });
}
