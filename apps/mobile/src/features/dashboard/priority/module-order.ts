/**
 * Ordine base, promozione e momenti sicuri (§11, §12).
 *
 * Il riordino è l'unica cosa che la Dashboard fa **sotto il dito** dell'utente
 * se non viene disciplinata: una risposta asincrona, un tick dell'orologio o
 * un evento realtime non sono di per sé una ragione per spostare i moduli.
 *
 * Qui dentro non c'è stato: ci sono due funzioni pure e un tipo. Lo stato
 * (ordine applicato + ordine in attesa) vive in `use-dashboard-order`.
 */

import type { DashboardModuleId, ModuleDefinition } from "../modules/module-registry";

/**
 * Perché una nuova composizione può essere applicata (§12).
 *
 * `security_removal` è l'eccezione dichiarata: le rimozioni per revoca sono
 * immediate e non attendono un momento sicuro.
 */
export type OrderApplyTrigger =
  | "first_load"
  | "identity_change"
  | "refresh_completed"
  | "action_confirmed"
  | "security_removal";

const SAFE_TRIGGERS: readonly OrderApplyTrigger[] = [
  "first_load",
  "identity_change",
  "refresh_completed",
  "action_confirmed",
];

/**
 * Un momento è sicuro quando il trigger lo prevede **e** l'utente non sta
 * interagendo. L'unica eccezione è la rimozione per sicurezza, che ignora
 * entrambe le condizioni.
 */
export function isSafePoint(input: {
  isInteracting: boolean;
  trigger: OrderApplyTrigger;
}): boolean {
  if (input.trigger === "security_removal") {
    return true;
  }

  return SAFE_TRIGGERS.includes(input.trigger) && !input.isInteracting;
}

/**
 * Applica la promozione all'ordine base.
 *
 * Il modulo promosso sale in cima; **tutti gli altri conservano l'ordine
 * relativo** (§11). Non è un sort con chiave artificiale: un sort
 * riordinerebbe anche i moduli non coinvolti a ogni cambio di priorità.
 */
export function applyPromotion(
  modules: readonly ModuleDefinition[],
  promotedModuleId: DashboardModuleId | null,
): ModuleDefinition[] {
  if (!promotedModuleId) {
    return [...modules];
  }

  const promoted = modules.find((module) => module.id === promotedModuleId);

  if (!promoted) {
    return [...modules];
  }

  return [promoted, ...modules.filter((module) => module.id !== promotedModuleId)];
}

/**
 * Firma dell'ordine, per sapere se una nuova composizione è davvero diversa
 * da quella applicata. Confrontare le firme evita di segnare come "in
 * attesa" un ordine identico a quello già a schermo.
 */
export function orderFingerprint(modules: readonly { id: string }[]): string {
  return modules.map((module) => module.id).join("|");
}
