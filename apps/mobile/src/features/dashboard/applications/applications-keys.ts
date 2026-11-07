/**
 * Query key del Centro Candidature (§28).
 *
 * «Chiavi almeno per account/actor, Society, access scope e sua revisione,
 * tab, filtri normalizzati, Position contestuale, cursore/versione dataset.
 * Il dettaglio include Application e versione submission/profilo pertinente.»
 *
 * L'actor è il primo segmento di ogni chiave, non un dettaglio: la lettura è
 * registrata **per actor** (§8), quindi due amministratori della stessa
 * Società vedono due dataset diversi. Una cache condivisa mostrerebbe
 * all'uno le letture dell'altro — che è esattamente la policy Society-shared
 * che §8 vieta di assumere senza approvazione esplicita.
 */
import type { ApplicationsFilter, ApplicationsTab } from "./applications-types";

/**
 * Forma canonica del filtro. Gli id sono ordinati, così la stessa selezione
 * raggiunta in ordine diverso non produce due cache e due paginazioni.
 */
export function filterKey(filter: ApplicationsFilter): string {
  const teams = [...filter.teamIds].sort().join(",");
  const ads = [...filter.adIds].sort().join(",");

  return `t:${teams}|p:${ads}`;
}

export const APPLICATIONS_QK = {
  center: (actorId: string, clubId: string) =>
    ["society-applications-center", actorId, clubId] as const,
  detail: (actorId: string, applicationId: string) =>
    ["society-application-detail", actorId, applicationId] as const,
  filters: (actorId: string, clubId: string) =>
    ["society-application-filters", actorId, clubId] as const,
  list: (
    actorId: string,
    clubId: string,
    tab: ApplicationsTab,
    filter: ApplicationsFilter,
  ) =>
    [
      "society-applications-list",
      actorId,
      clubId,
      tab,
      filterKey(filter),
    ] as const,
  /** §23: l'elenco contestuale ha cursore e stato propri. */
  positionList: (
    actorId: string,
    clubId: string,
    adId: string,
    tab: ApplicationsTab,
  ) =>
    ["society-position-applications", actorId, clubId, adId, tab] as const,
  /** Profilo canonico del candidato, letto separatamente (§16, §27). */
  candidateProfile: (actorId: string, personId: string) =>
    ["society-application-candidate", actorId, personId] as const,
} as const;

/**
 * Prefissi da invalidare dopo una lettura o un'aggiunta alla shortlist (§28).
 * Elencati e non dedotti da una substring: un `startsWith("society-")`
 * invaliderebbe anche i centri degli altri pack.
 */
export const APPLICATIONS_QK_PREFIXES = [
  "society-applications-center",
  "society-applications-list",
  "society-position-applications",
  "society-application-filters",
] as const;

/**
 * §28: «Dopo una lettura aggiorna coerentemente … widget/count Dashboard,
 * count/lista/dettaglio Position.» Quelle proiezioni appartengono ad altri
 * pack e hanno le loro chiavi; elencarle qui è il modo di non dimenticarle.
 */
export const APPLICATIONS_CROSS_PREFIXES = [
  "dashboard-society-overview",
  "society-positions-center",
  "society-positions-list",
  "society-position-detail",
] as const;
