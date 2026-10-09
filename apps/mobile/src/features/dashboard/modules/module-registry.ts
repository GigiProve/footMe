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
  "personal_recent_updates",
  "personal_applications",
  "personal_saved_positions",
  "personal_profile_suggestion",
  "society_applications",
  "society_areas",
  "society_positions",
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
  /**
   * Il modulo porta **contenuto operativo** oppure è una scorciatoia di
   * navigazione? (§13)
   *
   * Solo il primo tipo dimostra che la Dashboard ha caricato qualcosa di
   * utile. Un elenco di aree con un conteggio a zero è ancora una pagina
   * vuota: contarlo come contenuto renderebbe il Global Empty del master 08
   * irraggiungibile per qualunque Società autorizzata.
   */
  countsAsContent: boolean;
  emptyPolicy: EmptyPolicy;
  feature: DashboardFeatureKey;
  id: DashboardModuleId;
  /** Tipi di identità su cui il modulo ha senso. */
  kinds: readonly DashboardIdentityKind[];
  /**
   * Ordine base (§11). È l'ordine senza priorità: per lo scenario sportivo
   * Posizioni aperte precede Candidature ricevute. La promozione di
   * DAS-REV-02 non lo riscrive, lo sovrascrive temporaneamente.
   */
  order: number;
  /** Versione dello schema dati del modulo, per cache e rollout. */
  schemaVersion: number;
  title: string;
};

export const MODULE_REGISTRY: Record<DashboardModuleId, ModuleDefinition> = {
  /**
   * DAS-REV-03 §11: presentazione **informativa** di eventi professionali
   * già avvenuti, distinta dalle azioni obbligatorie di "Da gestire".
   *
   * `countsAsContent: false`: un aggiornamento esiste solo se esiste la
   * candidatura che lo ha generato, quindi contarlo come contenuto non
   * aggiungerebbe nulla al calcolo del Global Empty e renderebbe quest'ultimo
   * dipendente da una sezione informativa.
   *
   * `order: 5`: §6 lo colloca dopo Azioni rapide e prima di "Le tue
   * candidature".
   */
  personal_recent_updates: {
    capabilitiesAll: [],
    capabilitiesAny: [],
    countsAsContent: false,
    emptyPolicy: "hide",
    feature: "personal_recent_updates",
    id: "personal_recent_updates",
    kinds: ["person", "media"],
    order: 5,
    schemaVersion: 1,
    title: "Aggiornamenti recenti",
  },
  personal_applications: {
    capabilitiesAll: [],
    capabilitiesAny: [],
    countsAsContent: true,
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
    countsAsContent: true,
    emptyPolicy: "hide",
    feature: "personal_saved_positions",
    id: "personal_saved_positions",
    kinds: ["person", "media"],
    order: 20,
    schemaVersion: 1,
    title: "Posizioni salvate",
  },
  /**
   * DAS-REV-03 §19: suggerimento **facoltativo** sulle aree geografiche.
   *
   * È un modulo e non una priorità perché §19 lo vuole «sotto i moduli
   * operativi» e vieta di chiamarlo Informazioni richieste o Da gestire: la
   * gerarchia, il testo e la posizione devono comunicarne il carattere
   * facoltativo. `countsAsContent: false` per la stessa ragione — un
   * suggerimento non dimostra che la Dashboard ha attività utili, e §23
   * vieta che trasformi il primo accesso in un onboarding obbligatorio.
   */
  personal_profile_suggestion: {
    capabilitiesAll: [],
    capabilitiesAny: [],
    countsAsContent: false,
    emptyPolicy: "hide",
    feature: "personal_availability",
    id: "personal_profile_suggestion",
    kinds: ["person", "media"],
    order: 30,
    schemaVersion: 1,
    title: "Migliora la tua visibilità",
  },
  /**
   * DAS-REV-02 §24: il master ordinario mostra "Posizioni aperte" come
   * modulo con azione **Gestisci** e due preview, non come sola riga di
   * "Aree di gestione". Senza questo modulo non esisterebbe l'ordine base
   * che la promozione deve poter ripristinare (§11).
   */
  society_positions: {
    capabilitiesAll: ["positions_view"],
    capabilitiesAny: [],
    countsAsContent: true,
    emptyPolicy: "show_empty",
    feature: "society_positions",
    id: "society_positions",
    kinds: ["society"],
    order: 10,
    schemaVersion: 1,
    title: "Posizioni aperte",
  },
  society_applications: {
    capabilitiesAll: ["applications_view"],
    capabilitiesAny: [],
    countsAsContent: true,
    emptyPolicy: "show_empty",
    feature: "society_applications",
    id: "society_applications",
    kinds: ["society"],
    order: 20,
    schemaVersion: 1,
    title: "Candidature ricevute",
  },
  society_drafts: {
    capabilitiesAll: ["content_view"],
    capabilitiesAny: [],
    countsAsContent: true,
    emptyPolicy: "hide",
    feature: "society_drafts",
    id: "society_drafts",
    kinds: ["society"],
    order: 30,
    schemaVersion: 1,
    title: "Bozze e programmati",
  },
  society_recent_content: {
    capabilitiesAll: ["content_view"],
    capabilitiesAny: [],
    countsAsContent: true,
    emptyPolicy: "hide",
    feature: "society_recent_content",
    id: "society_recent_content",
    kinds: ["society"],
    order: 40,
    schemaVersion: 1,
    title: "Contenuti recenti",
  },
  society_areas: {
    capabilitiesAll: [],
    // Il modulo "Aree di gestione" esiste se almeno una delle due righe è
    // autorizzata: ciascuna riga viene poi filtrata separatamente.
    capabilitiesAny: ["positions_view", "teams_view"],
    countsAsContent: false,
    emptyPolicy: "hide",
    feature: "society_positions",
    id: "society_areas",
    kinds: ["society"],
    order: 50,
    schemaVersion: 1,
    title: "Aree di gestione",
  },
};

export function isKnownModuleId(value: string): value is DashboardModuleId {
  return (DASHBOARD_MODULE_IDS as readonly string[]).includes(value);
}
