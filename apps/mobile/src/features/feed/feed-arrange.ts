/**
 * Composizione della lista del Feed — funzioni pure, nessun React.
 *
 * HOM-13 §83, §94, §220: l'ordine di Per te lo decide il server (ranking con
 * diversificazione dentro lo snapshot di sessione) e il client NON lo riordina mai:
 * né alternanza di moduli, né cap per autore, né riordino delle pagine già emesse.
 * Seguiti resta cronologico (§267). Le regole di alternanza di HOM-01 §8 che stavano
 * qui (`arrangeFeedItems`, `DEFAULT_ARRANGE_RULES`) sono state rimosse: tenerle
 * avrebbe sovrascritto lato client la diversificazione del server e, per Seguiti,
 * l'ordine cronologico.
 *
 * Resta una sola rete di sicurezza: l'appiattimento delle pagine con dedup per
 * `feed_unit_id` (§98–§99, §224). Il server deduplica già; qui un duplicato dovuto a
 * una sessione ripartita in modo trasparente (P0002 durante «carica altro») non
 * arriva mai a schermo. Vince la prima occorrenza, l'ordine ricevuto non cambia.
 */

import type { FeedItem, FeedPage } from "./feed-types";

/**
 * Appiattisce le pagine di useInfiniteQuery deduplicando per `id` (= `feed_unit_id`),
 * vince la prima occorrenza. È il SOLO punto di dedup del Feed: refresh,
 * paginazione e ripartenza di sessione passano tutti da qui.
 */
export function mergeFeedPages(pages: readonly FeedPage[]): FeedItem[] {
  const seen = new Set<string>();
  const merged: FeedItem[] = [];

  for (const page of pages) {
    for (const item of page.items) {
      if (seen.has(item.id)) {
        continue;
      }
      seen.add(item.id);
      merged.push(item);
    }
  }

  return merged;
}
