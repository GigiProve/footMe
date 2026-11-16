/**
 * Query key di Blocking (HOM-12 §195–§196, §208–§210).
 *
 * Ogni dimensione che la cache deve distinguere sta nella chiave: il viewer (un
 * cambio account non legge lo stato dell'altro) e il target. La lista «Profili
 * bloccati» non porta il blocker: tutte le identità dell'utente stanno nella stessa
 * lista (D7), raggruppate in presentazione.
 */

import type { BlockIdentityRef } from "./blocking-types";

export const BLOCK_QK = {
  all: ["blocking"] as const,
  availability: (viewerId: string, target: BlockIdentityRef) =>
    ["blocking", "availability", viewerId, target.type, target.id] as const,
  list: (viewerId: string) => ["blocking", "list", viewerId] as const,
};
