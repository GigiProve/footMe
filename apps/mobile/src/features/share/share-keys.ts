/**
 * Query key della Condivisione (HOM-09). Ogni dimensione che la cache deve
 * distinguere sta nella chiave: il profilo (un cambio utente non riusa la cache
 * di un altro) e la query di ricerca.
 *
 * I Recenti NON hanno una chiave propria: sono le conversazioni dell'Inbox e
 * ne condividono la cache (§220: «preferire cache Messaggi»), quindi aprire il
 * pannello dopo aver visto Messaggi non rifà alcuna richiesta.
 */

import { MESSAGING_QK } from "../messaging/messaging-keys";

export const SHARE_QK = {
  recents: MESSAGING_QK.inbox,
  recipients: (profileId: string, query: string) =>
    ["share-recipients", profileId, query] as const,
} as const;
