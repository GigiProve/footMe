/**
 * HOM-06.1 §77, §79 — fetch di una pagina con le protezioni SSRF. Nessun import
 * Deno: resolver DNS e fetch sono iniettati, così la logica (redirect manuali,
 * revalidazione a ogni hop, tetto di byte, tipo di contenuto, timeout) è
 * verificabile con vitest.
 *
 *   * redirect manuali, al massimo MAX_REDIRECTS; ogni hop (e quindi il target
 *     finale) passa di nuovo da parseHttpsUrl e dal controllo sugli IP risolti;
 *   * un hostname che non risolve, o che risolve ANCHE a un solo IP bloccato, è
 *     bloccato (un record misto è il caso tipico di DNS rebinding);
 *   * budget di tempo unico (5 s) condiviso fra tutti gli hop;
 *   * solo text/html (e xhtml), al massimo MAX_BYTES (512 KB) letti dallo stream.
 *
 * Limite dichiarato: fetch risolve di nuovo il nome per conto suo, quindi fra il
 * controllo e la connessione resta una finestra di DNS rebinding che il runtime
 * non permette di chiudere (nessun pinning dell'IP). La mitigazione è controllare
 * subito prima di ogni richiesta e rifiutare i record misti.
 */

import { isBlockedIp } from "./ip-guard.ts";
import { parseHttpsUrl } from "./url-normalize.ts";

export const MAX_REDIRECTS = 3;
export const MAX_BYTES = 512 * 1024;
export const TIMEOUT_MS = 5000;

export type GuardedFetchDeps = {
  /** Tutti gli indirizzi (A + AAAA) del nome; lancia o restituisce [] se non risolve. */
  resolve: (hostname: string) => Promise<string[]>;
  fetch: (url: string, init: { redirect: "manual"; signal: AbortSignal; headers: Record<string, string> }) => Promise<Response>;
  timeoutMs?: number;
  maxBytes?: number;
};

export type GuardedFetchResult =
  | { status: "ok"; finalUrl: string; html: string }
  | { status: "blocked" | "invalid" | "unavailable" };

const HTML_TYPE = /^(text\/html|application\/xhtml\+xml)\b/i;

async function hostIsPublic(hostname: string, deps: GuardedFetchDeps): Promise<boolean> {
  let addresses: string[];
  try {
    addresses = await deps.resolve(hostname);
  } catch {
    return false;
  }
  return addresses.length > 0 && addresses.every((ip) => !isBlockedIp(ip));
}

async function readCapped(response: Response, maxBytes: number): Promise<string | null> {
  if (!response.body) {
    return "";
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > maxBytes) {
      // Oltre il tetto: si tiene ciò che c'è (l'head sta all'inizio) e si chiude lo stream.
      chunks.push(value.subarray(0, value.byteLength - (total - maxBytes)));
      await reader.cancel().catch(() => undefined);
      break;
    }
    chunks.push(value);
  }
  const buffer = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
  let offset = 0;
  for (const c of chunks) {
    buffer.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(buffer);
}

export async function guardedFetchHtml(rawUrl: string, deps: GuardedFetchDeps): Promise<GuardedFetchResult> {
  const timeoutMs = deps.timeoutMs ?? TIMEOUT_MS;
  const maxBytes = deps.maxBytes ?? MAX_BYTES;

  const first = parseHttpsUrl(rawUrl);
  if (!first.ok) {
    return { status: first.reason === "invalid" ? "invalid" : "blocked" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let current = first.url;

    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      if (!(await hostIsPublic(current.hostname, deps))) {
        return { status: "blocked" };
      }

      let response: Response;
      try {
        response = await deps.fetch(current.toString(), {
          redirect: "manual",
          signal: controller.signal,
          headers: {
            accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
            "user-agent": "ProLinkBot/1.0 (link preview)",
            "accept-language": "it,en;q=0.8",
          },
        });
      } catch {
        return { status: "unavailable" };
      }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        await response.body?.cancel().catch(() => undefined);
        if (!location || hop === MAX_REDIRECTS) {
          return { status: "unavailable" };
        }
        let next: URL;
        try {
          next = new URL(location, current);
        } catch {
          return { status: "invalid" };
        }
        // Il target del redirect è un URL come un altro: stesse regole (§79).
        const parsed = parseHttpsUrl(next.toString());
        if (!parsed.ok) {
          return { status: "blocked" };
        }
        current = parsed.url;
        continue;
      }

      if (response.status < 200 || response.status >= 300) {
        await response.body?.cancel().catch(() => undefined);
        return { status: "unavailable" };
      }

      if (!HTML_TYPE.test(response.headers.get("content-type") ?? "")) {
        await response.body?.cancel().catch(() => undefined);
        return { status: "unavailable" };
      }

      const declared = Number(response.headers.get("content-length") ?? "");
      if (Number.isFinite(declared) && declared > maxBytes * 8) {
        // Dichiara più di 8x il tetto: non vale nemmeno la lettura parziale.
        await response.body?.cancel().catch(() => undefined);
        return { status: "unavailable" };
      }

      try {
        const html = await readCapped(response, maxBytes);
        return html === null ? { status: "unavailable" } : { status: "ok", finalUrl: current.toString(), html };
      } catch {
        return { status: "unavailable" };
      }
    }

    return { status: "unavailable" };
  } finally {
    clearTimeout(timer);
  }
}
