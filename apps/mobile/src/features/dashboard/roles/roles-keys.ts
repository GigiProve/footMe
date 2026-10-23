/**
 * Query key di Ruoli e permessi (§28).
 *
 * «Riutilizza Foundation e DAS-REV-13: chiavi con account, Society, risorsa,
 * revisione di ruolo/catalogo/ownership e contesto capability/scope.»
 *
 * Il catalogo ha una chiave propria e non quella del centro: è la stessa
 * risposta per l'editor, per il livello granulare e per la vista di sola
 * lettura dei permessi di una persona, e tre copie darebbero tre revisioni
 * diverse nella stessa schermata.
 */
export const ROLES_QK = {
  catalog: (actorId: string, clubId: string) =>
    ["society-permission-catalog", actorId, clubId] as const,
  center: (actorId: string, clubId: string) =>
    ["society-roles-center", actorId, clubId] as const,
  detail: (actorId: string, clubId: string, roleId: string) =>
    ["society-role-detail", actorId, clubId, roleId] as const,
  list: (actorId: string, clubId: string) =>
    ["society-roles", actorId, clubId] as const,
} as const;

export const ROLES_QK_PREFIXES = [
  "society-roles-center",
  "society-roles",
  "society-role-detail",
  "society-permission-catalog",
] as const;
