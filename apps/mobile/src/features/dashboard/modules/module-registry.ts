/**
 * Registro dei moduli Dashboard (§14).
 *
 * Statico e tipizzato: il backend decide **se** un modulo è eleggibile, il
 * client decide **come** si disegna. Non è un page builder — nessun payload
 * può introdurre un renderer che questa build non contiene già.
 *
 * `id` è l'identificativo tecnico stabile; `title` è la label localizzata.
 * Sono campi diversi apposta: rinominare la sezione non deve invalidare
 * cache, analytics o test.
 */

import type {
  DashboardCapability,
  DashboardIdentityKind,
} from "../dashboard-types";
import type { DashboardFeatureKey } from "./dashboard-features";

export const DASHBOARD_MODULE_IDS = [
  "personal_applications",
  "personal_saved_positions",
  "society_applications",
  "society_areas",
  "society_drafts",
  "society_recent_content",
] as const;

export type DashboardModuleId = (typeof DASHBOARD_MODULE_IDS)[number];

/**
 * Comportamento quando il modulo è autorizzato ma non ha dati.
 *
 * §14: «Un modulo autorizzato ma vuoto segue la propria policy: mostrare
 * empty oppure nascondere. Zero non significa universalmente "nascondi".»
 */
export type EmptyPolicy = "show_empty" | "hide";

export type ModuleDefinition = {
  /** Tutte queste capability sono necessarie. */
  capabilitiesAll: readonly DashboardCapability[];
  /** Almeno una di queste, se l'elenco non è vuoto. */
  capabilitiesAny: readonly DashboardCapability[];
  emptyPolicy: EmptyPolicy;
  feature: DashboardFeatureKey;
  id: DashboardModuleId;
  /** Tipi di identità su cui il modulo ha senso. */
  kinds: readonly DashboardIdentityKind[];
  /** Ordine base. Il riordino dinamico è di DAS-REV-02. */
  order: number;
  /** Versione dello schema dati del modulo, per cache e rollout. */
  schemaVersion: number;
  title: string;
};

export const MODULE_REGISTRY: Record<DashboardModuleId, ModuleDefinition> = {
  personal_applications: {
    capabilitiesAll: [],
    capabilitiesAny: [],
    emptyPolicy: "hide",
    feature: "personal_applications",
    id: "personal_applications",
    kinds: ["person", "media"],
    order: 10,
    schemaVersion: 1,
    title: "Le tue candidature",
  },
  personal_saved_positions: {
    capabilitiesAll: [],
    capabilitiesAny: [],
    emptyPolicy: "hide",
    feature: "personal_saved_positions",
    id: "personal_saved_positions",
    kinds: ["person", "media"],
    order: 20,
    schemaVersion: 1,
    title: "Posizioni salvate",
  },
  society_applications: {
    capabilitiesAll: ["applications_view"],
    capabilitiesAny: [],
    emptyPolicy: "show_empty",
    feature: "society_applications",
    id: "society_applications",
    kinds: ["society"],
    order: 10,
    schemaVersion: 1,
    title: "Candidature ricevute",
  },
  society_drafts: {
    capabilitiesAll: ["content_view"],
    capabilitiesAny: [],
    emptyPolicy: "hide",
    feature: "society_drafts",
    id: "society_drafts",
    kinds: ["society"],
    order: 20,
    schemaVersion: 1,
    title: "Bozze e programmati",
  },
  society_recent_content: {
    capabilitiesAll: ["content_view"],
    capabilitiesAny: [],
    emptyPolicy: "hide",
    feature: "society_recent_content",
    id: "society_recent_content",
    kinds: ["society"],
    order: 30,
    schemaVersion: 1,
    title: "Contenuti recenti",
  },
  society_areas: {
    capabilitiesAll: [],
    // Il modulo "Aree di gestione" esiste se almeno una delle due righe è
    // autorizzata: ciascuna riga viene poi filtrata separatamente.
    capabilitiesAny: ["positions_view", "teams_view"],
    emptyPolicy: "hide",
    feature: "society_positions",
    id: "society_areas",
    kinds: ["society"],
    order: 40,
    schemaVersion: 1,
    title: "Aree di gestione",
  },
};

export function isKnownModuleId(value: string): value is DashboardModuleId {
  return (DASHBOARD_MODULE_IDS as readonly string[]).includes(value);
}
