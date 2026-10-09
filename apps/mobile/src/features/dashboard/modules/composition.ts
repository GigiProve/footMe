/**
 * Composizione della Dashboard (§14).
 *
 * Funzione pura: data un'identità, le sue capability e la configurazione delle
 * feature, restituisce quali moduli esistono e in che ordine. Nessuna query,
 * nessun componente — così i casi di autorizzazione si verificano senza
 * montare nulla.
 *
 * Ordine di valutazione, non negoziabile:
 *
 *   1. accesso all'identità;
 *   2. compatibilità del dominio (il modulo ha senso per quel kind);
 *   3. capability e scope;
 *   4. feature e reale disponibilità della destinazione;
 *   5. stato dei dati e comportamento empty (fuori da qui: dipende dai dati);
 *   6. ordine base e rendering.
 *
 * Invertire 3 e 4 produrrebbe il bug che il Common Contract vieta: un feature
 * flag non conferisce autorizzazione.
 */

import {
  hasEveryCapability,
  hasSomeCapability,
  type DashboardIdentity,
} from "../dashboard-types";
import { isFeatureAvailable } from "./dashboard-features";
import {
  MODULE_REGISTRY,
  type DashboardModuleId,
  type ModuleDefinition,
} from "./module-registry";

export type QuickActionId =
  | "personal_search_positions"
  | "society_new_position"
  | "society_invite_person"
  | "society_new_post"
  | "society_new_article";

export type DashboardComposition = {
  modules: ModuleDefinition[];
  quickActions: QuickActionId[];
};

/**
 * Un modulo è eleggibile quando **tutte** le condizioni reggono. Un `false`
 * qualsiasi lo rende assente — non disabilitato, non in errore: assente.
 */
export function isModuleEligible(
  definition: ModuleDefinition,
  identity: DashboardIdentity | null,
): boolean {
  if (!identity) {
    return false;
  }

  // 2. compatibilità del dominio
  if (!definition.kinds.includes(identity.kind)) {
    return false;
  }

  // 3. capability — ALL e ANY sono espliciti, non una catena di condizioni
  if (!hasEveryCapability(identity, definition.capabilitiesAll)) {
    return false;
  }

  if (
    definition.capabilitiesAny.length > 0 &&
    !hasSomeCapability(identity, definition.capabilitiesAny)
  ) {
    return false;
  }

  // 3-bis. la destinazione è ancora gated sul ruolo e non sulle capability
  if (definition.requiresOwner && !identity.isOwner) {
    return false;
  }

  // 4. disponibilità reale della destinazione
  return isFeatureAvailable(definition.feature);
}

/**
 * Azioni rapide: autorizzate **separatamente** dalla lettura.
 *
 * §14: chi può vedere le Posizioni ma non crearle non vede "Nuova posizione",
 * anche quando il modulo Posizioni è presente.
 */
export function composeQuickActions(
  identity: DashboardIdentity | null,
): QuickActionId[] {
  if (!identity) {
    return [];
  }

  if (identity.kind !== "society") {
    return isFeatureAvailable("personal_saved_positions")
      ? ["personal_search_positions"]
      : [];
  }

  const actions: QuickActionId[] = [];

  if (
    identity.capabilities.includes("positions_create") &&
    isFeatureAvailable("society_positions")
  ) {
    actions.push("society_new_position");
  }

  if (
    identity.capabilities.includes("invites_create") &&
    identity.isOwner &&
    isFeatureAvailable("society_invites")
  ) {
    // `isOwner`: il flusso Inviti canonico vive in /club-admin/invites, che
    // redirige chi non ha `profile.role === 'club_admin'`. §11 vuole che
    // l'azione apra il flusso reale, non che rimbalzi un membro autorizzato.
    actions.push("society_invite_person");
  }

  if (
    identity.capabilities.includes("content_create") &&
    isFeatureAvailable("society_content_create")
  ) {
    // Il composer Società è uno solo: non si inventa una distinzione
    // POST/ARTICLE che il dominio non ha. §17 mostra due pulsanti perché
    // presuppone HOM-06.1 e HOM-06.2; qui ne esiste uno, e mostrarne due
    // porterebbe alla stessa destinazione due volte.
    actions.push("society_new_post");

    if (isFeatureAvailable("society_article_composer")) {
      actions.push("society_new_article");
    }
  }

  // §11: «Per questa panoramica mantenere al massimo due azioni principali
  // anche con responsabilità miste, selezionate con una regola stabile.»
  // La regola è l'ordine di costruzione qui sopra — sportive prima di
  // editoriali — non il caso o la quantità di dati di ciascun dominio.
  return actions.slice(0, 2);
}

export function composeDashboard(
  identity: DashboardIdentity | null,
): DashboardComposition {
  const modules = (
    Object.values(MODULE_REGISTRY) as ModuleDefinition[]
  )
    .filter((definition) => isModuleEligible(definition, identity))
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

  return {
    modules,
    quickActions: composeQuickActions(identity),
  };
}

/**
 * Un modulo autorizzato ma senza dati compare o sparisce secondo la propria
 * policy. Separata dalla composizione perché dipende dai dati, che arrivano
 * dopo: la composizione non deve attendere il dominio più lento per decidere
 * che cosa esiste.
 */
export function shouldRenderWhenEmpty(moduleId: DashboardModuleId): boolean {
  return MODULE_REGISTRY[moduleId].emptyPolicy === "show_empty";
}
