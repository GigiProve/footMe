/**
 * HOM-06.2 §7F, §7I, §7L — scopo di una richiesta di preview. Modulo puro
 * (nessun import Deno): lo usa la Edge Function e lo prova vitest.
 *
 *   post           (default) la preview di un Post: senza metadata non c'è niente
 *                  da mostrare, la risposta è 'unavailable' e non si salva nulla
 *                  (comportamento di HOM-06.1, invariato).
 *   rich_link      un blocco rich link dentro un Articolo: stessa regola del Post.
 *   article_source la fonte di un Articolo «Collega da un link»: la destinazione
 *                  validata basta. Anche una pagina senza metadata produce uno
 *                  snapshot (titolo null) con status 'ok': il client chiede il
 *                  titolo a mano (§7J, §7L). Blocked/invalid restano errori;
 *                  'unavailable' = destinazione non raggiungibile, e il client
 *                  blocca Pubblica/Programma offrendo Riprova.
 */

import type { LinkMeta } from "./html-meta.ts";

export type LinkPurpose = "post" | "article_source" | "rich_link";

/** Un valore sconosciuto o assente vale 'post': il client di HOM-06.1 non manda `purpose`. */
export function parsePurpose(value: unknown): LinkPurpose {
  return value === "article_source" || value === "rich_link" ? value : "post";
}

export function hasUsableMetadata(meta: LinkMeta): boolean {
  return meta.title !== null || meta.description !== null || meta.imageUrl !== null;
}

/** Si salva uno snapshot se c'è qualcosa da mostrare, o se la destinazione validata basta (fonte di un Articolo). */
export function shouldPersistSnapshot(purpose: LinkPurpose, meta: LinkMeta): boolean {
  return purpose === "article_source" || hasUsableMetadata(meta);
}

/**
 * «Pagina senza metadata» si ricorda come fallimento solo per gli scopi che
 * non sanno cosa farne: per la fonte di un Articolo non è un fallimento, e una
 * richiesta `post` appena fatta non deve nascondere la pagina a un'`article_source`.
 */
export function remembersNoMetadata(purpose: LinkPurpose): boolean {
  return purpose !== "article_source";
}
