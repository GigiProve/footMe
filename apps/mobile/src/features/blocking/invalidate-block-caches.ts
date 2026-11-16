/**
 * Invalidazione delle cache dopo Block e Unblock (HOM-12 §195–§197, §214–§216, §327).
 *
 * «Nessun ghost state»: dopo un Block non devono restare identità suggerite, trovate,
 * selezionabili come destinatario o menzione, né una chat apparentemente scrivibile.
 * Dopo uno Sblocca le stesse superfici tornano eleggibili (§196, §162) — non
 * necessariamente subito nel ranking (§163–§164).
 *
 * Una sola funzione per entrambe le direzioni: invalidare per radice è più sicuro che
 * ragionare su ogni chiave, e il costo sono refetch delle sole query attive. La copia
 * del Feed su disco (`feed-cache`) la riscrive il prossimo caricamento: il server filtra
 * già in eligibility (§65).
 */

import type { QueryClient } from "@tanstack/react-query";

import { COMMENTS_QK } from "../comments/comment-keys";
import { LIKES_ROOT_KEY } from "../likes/likes-keys";
import { MESSAGING_QK } from "../messaging/messaging-keys";
import { composerKeys } from "../post-composer/composer-keys";
import { SAVED_QK } from "../saved/saved-keys";
import { BLOCK_QK } from "./blocking-keys";

/** Radici di query che dipendono dall'eleggibilità tra identità. */
const ROOT_KEYS: readonly string[] = [
  // Follow (§195): conteggi, liste e flag
  "following-count",
  "followed",
  "followed-club-flags",
  "feed-following-state",
  // Feed e suggerimenti (§195)
  "feed",
  "feed-updates",
  "feed-suggested-clubs",
  "feed-suggested-profiles",
  "feed-post-detail",
  "feed-interaction",
  // Share e mention (§195, §215–§216)
  "share-recipients",
  // Mention (§216): ricerca tag dei composer Post/Articolo/Commenti/Repost
  // (`composerKeys.all`) e contenuti taggati che risolvono l'identità.
  composerKeys.all[0],
  "tagged-content",
  "tagged-content-target",
  // Messaggi: meta e inbox sono sotto
  "conversation-meta",
  // Notifiche (§195)
  "notifications",
  "notifications-unread",
  // Likes e Salvati (liste filtrate per il viewer coinvolto, D10)
  LIKES_ROOT_KEY,
];

export function invalidateBlockCaches(queryClient: QueryClient, viewerId: string): void {
  for (const root of ROOT_KEYS) {
    void queryClient.invalidateQueries({ queryKey: [root] });
  }

  // Cerca (§214): tutte le query `search-*`, conteggi dei filtri inclusi.
  void queryClient.invalidateQueries({
    predicate: (query) => {
      const head = query.queryKey[0];
      return typeof head === "string" && head.startsWith("search-");
    },
  });

  void queryClient.invalidateQueries({ queryKey: COMMENTS_QK.all });
  void queryClient.invalidateQueries({ queryKey: SAVED_QK.lists });
  void queryClient.invalidateQueries({ queryKey: SAVED_QK.counts });
  void queryClient.invalidateQueries({ queryKey: MESSAGING_QK.inbox(viewerId) });
  void queryClient.invalidateQueries({ queryKey: BLOCK_QK.all });
}
