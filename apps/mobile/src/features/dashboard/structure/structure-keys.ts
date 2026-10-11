/**
 * Query key dell'hub (§20).
 *
 * Actor e Società nella chiave: §22 chiede che «una risposta valida per la
 * versione precedente dei permessi non possa ripristinare un dominio appena
 * revocato», e la prima difesa è che la cache di un'altra identity non sia
 * nemmeno raggiungibile.
 *
 * Non c'è una chiave per i conteggi di squadre, rete e stagioni: l'hub
 * riusa `TEAMS_QK.center`, `NETWORK_QK.center` e `SEASONS_QK.center`, che
 * sono le stesse dei centri. È ciò che §24 chiede — «Se più componenti usano
 * lo stesso provider, deduplica per chiave e generazione» — e ciò che rende
 * coerente il numero fra hub e destinazione.
 */
export const STRUCTURE_QK = {
  hub: (actorId: string, clubId: string) =>
    ["society-structure", actorId, clubId] as const,
} as const;

export const STRUCTURE_QK_PREFIXES = ["society-structure"] as const;
