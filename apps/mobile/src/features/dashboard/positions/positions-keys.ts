/**
 * Query key del Centro Posizioni aperte (§24).
 *
 * «La cache distingue almeno account, Society Identity, actor/contesto
 * permission, revisione scope, tab, tipo filtro ALL/SOCIETY/TEAM e relativo
 * ID, cursor/snapshot, versione schema e locale.»
 *
 * Il tipo di filtro e il Team ID sono **due dimensioni separate**: §22 vieta
 * di usare «un Team ID null ambiguo per significare sia Tutte sia Intera
 * società», e due chiavi che collassassero sullo stesso array avrebbero
 * esattamente quel difetto.
 *
 * L'actor entra in ogni chiave anche quando la risorsa è della Società: i
 * conteggi autorizzati dipendono dalle sue capability, e §24 vieta di
 * «condividere il read state fra amministratori per errore».
 */
import type { PositionFilter, PositionGroup } from "./positions-types";

function filterKey(filter: PositionFilter): readonly [string, string] {
  return [filter.kind, filter.kind === "team" ? filter.teamId : "-"] as const;
}

export const POSITIONS_QK = {
  center: (actorId: string, clubId: string) =>
    ["society-positions-center", actorId, clubId] as const,
  detail: (actorId: string, positionId: string) =>
    ["society-position-detail", actorId, positionId] as const,
  filters: (actorId: string, clubId: string, group: PositionGroup) =>
    ["society-position-filters", actorId, clubId, group] as const,
  list: (
    actorId: string,
    clubId: string,
    group: PositionGroup,
    filter: PositionFilter,
  ) =>
    [
      "society-positions-list",
      actorId,
      clubId,
      group,
      ...filterKey(filter),
    ] as const,
} as const;

/**
 * Prefissi da invalidare quando cambia qualcosa che il Centro proietta (§28).
 *
 * Elencati e non dedotti: un'invalidazione per stringa libera smette di
 * funzionare al primo rename di una chiave, in silenzio.
 */
export const POSITIONS_QK_PREFIXES = [
  "society-positions-center",
  "society-positions-list",
  "society-position-filters",
  "society-position-detail",
] as const;
