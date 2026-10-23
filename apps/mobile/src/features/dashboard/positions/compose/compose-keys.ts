/**
 * Query key del composer (DAS-REV-16 §28, §32).
 *
 * «Scope richieste e cache almeno per account, Society, Position ID,
 * schema/resource version rilevante e contesto autorizzativo.» L'actor entra
 * in ogni chiave anche quando la risorsa è della Società: capability e
 * perimetro cambiano da amministratore ad amministratore, e due chiavi
 * condivise mostrerebbero a uno i dati autorizzati dell'altro.
 */
import type { PositionProfileType } from "./compose-types";

export const COMPOSE_QK = {
  catalogs: (profileType: PositionProfileType) =>
    ["position-compose-catalogs", profileType] as const,
  context: (actorId: string, clubId: string) =>
    ["position-compose-context", actorId, clubId] as const,
  /* Gli ID sono ordinati dal chiamante: una chiave che dipendesse
     dall'ordine di selezione rifarebbe la stessa lettura a ogni riordino. */
  drafts: (actorId: string, ids: readonly string[]) =>
    ["position-compose-drafts", actorId, [...ids].sort().join(",")] as const,
  teams: (actorId: string, clubId: string) =>
    ["position-compose-teams", actorId, clubId] as const,
} as const;

/**
 * §26: «Aggiorna o invalida query pertinenti: Centro Bozze/Attive, relativi
 * count, Dashboard Società e priorità operative, superfici Team, profilo
 * pubblico Society, posizioni pubbliche e ricerca.»
 *
 * Elencati e non dedotti da una sottostringa: un'invalidazione per prefisso
 * libero smette di funzionare al primo rename, in silenzio.
 */
export const COMPOSE_INVALIDATION_PREFIXES = [
  "society-positions-center",
  "society-positions-list",
  "society-position-filters",
  "society-position-detail",
  "dashboard-society",
  "dashboard-priority",
  "team-detail",
  "search-positions",
  "position-detail",
  "club-ads",
] as const;
