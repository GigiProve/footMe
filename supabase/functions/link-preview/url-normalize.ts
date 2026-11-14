/**
 * HOM-06.1 §77–§79, §88 — validazione e normalizzazione degli URL della
 * rich preview. Modulo puro (nessun import Deno): lo usa la Edge Function e lo
 * provano i test vitest.
 *
 * Specchio SQL: `public.footme_normalize_url` (migrazione
 * 20261121090000_home_editorial_drafts_scheduling.sql, già in 20261120090000 con
 * i soli utm_*). Le due funzioni devono dare lo stesso risultato per gli URL
 * ASCII; l'IDN passa da `URL` (punycode) solo qui, e per
 * questo `publish_post` accetta uno snapshot anche quando coincide
 * `original_url` o `final_url` invece del solo `normalized_url`.
 */

export const MAX_URL_LENGTH = 2048;

export type ParsedUrl =
  | { ok: true; url: URL }
  | { ok: false; reason: "invalid" | "scheme" | "credentials" | "port" | "host" };

/** Hostname che è un IP letterale (v4 decimale, v6 tra parentesi). */
export function isIpLiteralHost(hostname: string): boolean {
  if (hostname.startsWith("[") || hostname.includes(":")) {
    return true;
  }
  // `new URL` normalizza anche 0x7f.1 e 2130706433 in a.b.c.d: basta il caso decimale puntato.
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
}

/**
 * Solo https, porta 443 (o assente), niente userinfo, host con almeno un punto
 * e non un IP letterale, niente caratteri di controllo (§78).
 */
export function parseHttpsUrl(raw: string): ParsedUrl {
  const text = raw.trim();
  if (text.length === 0 || text.length > MAX_URL_LENGTH || /[\u0000-\u001f\u007f\s]/.test(text)) {
    return { ok: false, reason: "invalid" };
  }

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { ok: false, reason: "invalid" };
  }

  if (url.protocol !== "https:") {
    return { ok: false, reason: "scheme" };
  }
  if (url.username !== "" || url.password !== "") {
    return { ok: false, reason: "credentials" };
  }
  if (url.port !== "" && url.port !== "443") {
    return { ok: false, reason: "port" };
  }

  const host = url.hostname.toLowerCase();
  if (!host.includes(".") || isIpLiteralHost(host) || host.endsWith(".") || host.endsWith(".local") || host.endsWith(".internal")) {
    return { ok: false, reason: "host" };
  }

  return { ok: true, url };
}

/**
 * HOM-06.2 §7H — parametri di TRACCIAMENTO noti, tolti dall'URL normalizzato.
 * Solo quelli che non identificano la risorsa: `utm_*` e gli identificativi di
 * click/campagna delle piattaforme. MAI i parametri funzionali (id, v, page, q,
 * ref, ...): cambiano la pagina. Lo stesso elenco vive in SQL
 * (footme_normalize_url).
 */
export const TRACKING_PARAM = /^(utm_[^=]*|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid|_hsenc|_hsmi|ref_src)(=|$)/i;

/**
 * Chiave di deduplica (§88, §7H): schema e host minuscoli, niente fragment,
 * niente parametri di tracciamento (`utm_*`, fbclid, gclid, ...), niente porta
 * di default, path '/' se vuoto. L'ordine degli altri parametri non cambia.
 */
export function normalizeUrl(raw: string): string | null {
  const parsed = parseHttpsUrl(raw);
  if (!parsed.ok) {
    return null;
  }

  const url = parsed.url;
  const kept: string[] = [];
  const search = url.search.startsWith("?") ? url.search.slice(1) : url.search;
  for (const part of search.split("&")) {
    if (part !== "" && !TRACKING_PARAM.test(part)) {
      kept.push(part);
    }
  }

  const path = url.pathname === "" ? "/" : url.pathname;
  return `https://${url.hostname.toLowerCase()}${path}${kept.length > 0 ? `?${kept.join("&")}` : ""}`;
}

/** Dominio mostrato (§81): host senza `www.`. */
export function displayDomain(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}
