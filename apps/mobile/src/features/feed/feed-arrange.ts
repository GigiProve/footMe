/**
 * Regole di alternanza del Feed (§8) — funzioni pure, nessun React.
 *
 * Il §8 chiede che il Feed possa alternare dinamicamente i componenti evitando
 * che due moduli discovery compaiano consecutivamente, che troppe posizioni si
 * susseguano e che lo stesso autore domini la schermata. Il piano degli slot
 * lato server (`footme_feed_slot_plan`) impedisce già l'adiacenza dei moduli
 * per costruzione; questo modulo è la seconda linea di difesa e copre le
 * regole che dipendono dai dati effettivi della pagina (autori, sequenze).
 *
 * PERCHÉ UNA PASSATA GREEDY CON BUFFER E NON UN SORT
 *
 * Un sort avrebbe bisogno di una chiave totale, e queste regole non sono una
 * chiave: dipendono da ciò che è già stato piazzato. La passata greedy scorre
 * l'ordine del server e, quando l'elemento in testa violerebbe una regola, lo
 * parcheggia e prende il primo ammissibile successivo; i parcheggiati rientrano
 * appena diventano ammissibili. Se nulla è ammissibile si piazza comunque la
 * testa: NIENTE VIENE MAI SCARTATO, perché scartare interagirebbe male sia col
 * cursore di confine lato server sia con la dedup lato client.
 *
 * Proprietà garantite (e verificate in feed-arrange.test.ts):
 *   • l'output è una permutazione dell'input (stessi id, stessa lunghezza);
 *   • deterministico: nessun Math.random, nessuna dipendenza dall'orologio;
 *   • idempotente: arrange(arrange(x)) === arrange(x);
 *   • `frozenCount` preserva il prefisso già a schermo byte per byte.
 *
 * `frozenCount` è il punto chiave contro i salti di scroll: quando arriva la
 * pagina N+1 si passa la lunghezza di ciò che l'utente sta già guardando, il
 * prefisso viene copiato invariato e serve solo a inizializzare lo stato delle
 * regole. Riordinare il prefisso farebbe saltare la lista sotto il dito.
 */

import { authorKeyOf, isDiscoveryItem, type FeedItem, type FeedPage } from "./feed-types";

export type ArrangeRules = {
  /** Massimo di posizioni aperte consecutive. */
  maxConsecutivePositions: number;
  /** Quanti elementi non-discovery devono separare due moduli discovery. */
  minGapBetweenDiscoveryModules: number;
  /** Presenze massime dello stesso autore dentro `authorWindow`. */
  maxItemsPerAuthorInWindow: number;
  authorWindow: number;
};

export const DEFAULT_ARRANGE_RULES: ArrangeRules = {
  maxConsecutivePositions: 2,
  minGapBetweenDiscoveryModules: 3,
  maxItemsPerAuthorInWindow: 2,
  authorWindow: 5,
};

function trailingConsecutivePositions(placed: readonly FeedItem[]): number {
  let count = 0;
  for (let index = placed.length - 1; index >= 0; index -= 1) {
    if (placed[index].type !== "suggested_position") {
      break;
    }
    count += 1;
  }
  return count;
}

function hasRecentDiscovery(placed: readonly FeedItem[], gap: number): boolean {
  const from = Math.max(0, placed.length - gap);
  for (let index = from; index < placed.length; index += 1) {
    if (isDiscoveryItem(placed[index])) {
      return true;
    }
  }
  return false;
}

function authorCountInWindow(
  placed: readonly FeedItem[],
  authorKey: string,
  window: number,
): number {
  const from = Math.max(0, placed.length - window);
  let count = 0;
  for (let index = from; index < placed.length; index += 1) {
    if (authorKeyOf(placed[index]) === authorKey) {
      count += 1;
    }
  }
  return count;
}

function isAdmissible(
  placed: readonly FeedItem[],
  candidate: FeedItem,
  rules: ArrangeRules,
): boolean {
  if (isDiscoveryItem(candidate)) {
    return !hasRecentDiscovery(placed, rules.minGapBetweenDiscoveryModules);
  }

  if (
    candidate.type === "suggested_position" &&
    trailingConsecutivePositions(placed) >= rules.maxConsecutivePositions
  ) {
    return false;
  }

  const authorKey = authorKeyOf(candidate);
  if (authorKey === null) {
    return true;
  }

  // La finestra è `authorWindow - 1` perché piazzando il candidato la finestra
  // completa diventa esattamente `authorWindow`.
  const recent = authorCountInWindow(
    placed,
    authorKey,
    Math.max(0, rules.authorWindow - 1),
  );

  return recent < rules.maxItemsPerAuthorInWindow;
}

export function arrangeFeedItems(
  items: readonly FeedItem[],
  options?: { rules?: ArrangeRules; frozenCount?: number },
): FeedItem[] {
  const rules = options?.rules ?? DEFAULT_ARRANGE_RULES;
  const frozenCount = Math.max(0, Math.min(options?.frozenCount ?? 0, items.length));

  const placed: FeedItem[] = items.slice(0, frozenCount);
  const source = items.slice(frozenCount);

  /** Candidati in ordine server: parcheggiati e non ancora consumati. */
  const pool: FeedItem[] = [];
  let cursor = 0;

  while (pool.length > 0 || cursor < source.length) {
    if (pool.length === 0) {
      pool.push(source[cursor]);
      cursor += 1;
    }

    let pickIndex = pool.findIndex((candidate) =>
      isAdmissible(placed, candidate, rules),
    );

    // Nessuno dei candidati noti è ammissibile: si guarda più avanti nella
    // sorgente prima di rassegnarsi.
    while (pickIndex === -1 && cursor < source.length) {
      pool.push(source[cursor]);
      cursor += 1;
      pickIndex = pool.findIndex((candidate) =>
        isAdmissible(placed, candidate, rules),
      );
    }

    // Sorgente esaurita e nulla è ammissibile: si piazza la testa comunque.
    // Preferire una regola violata a un elemento perso.
    if (pickIndex === -1) {
      pickIndex = 0;
    }

    placed.push(pool[pickIndex]);
    pool.splice(pickIndex, 1);
  }

  return placed;
}

/**
 * Appiattisce le pagine di useInfiniteQuery deduplicando per `id`, vince la
 * prima occorrenza. È il SOLO punto di dedup del Feed: refresh, paginazione e
 * prepend passano tutti da qui, quindi i duplicati sono strutturalmente
 * impossibili (§15, §17).
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

/**
 * Inserisce in testa i contenuti nuovi (§19) senza duplicare quelli già
 * presenti: gli id vincono sempre sulla posizione.
 */
export function prependNewItems(
  current: readonly FeedItem[],
  incoming: readonly FeedItem[],
): FeedItem[] {
  const incomingIds = new Set<string>();
  const next: FeedItem[] = [];

  for (const item of incoming) {
    if (incomingIds.has(item.id)) {
      continue;
    }
    incomingIds.add(item.id);
    next.push(item);
  }

  for (const item of current) {
    if (!incomingIds.has(item.id)) {
      next.push(item);
    }
  }

  return next;
}
