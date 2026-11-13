/**
 * HOM-06.1 §75 — metadata della rich preview da un documento HTML: Open Graph,
 * Twitter card, <title>, favicon. Modulo puro (nessun import Deno). Non è un
 * parser HTML completo: legge solo i tag <meta>, <link> e <title> dell'head, che
 * è tutto ciò che serve, e non esegue né interpreta nulla.
 *
 * Il testo è dato, mai markup: le entità si decodificano, i tag residui si
 * tolgono, gli spazi si comprimono e le lunghezze si troncano (§208). Gli URL
 * di immagine e favicon si risolvono rispetto al final_url e restano solo se
 * https (il client e il CHECK del database accettano solo https).
 */

export type LinkMeta = {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  faviconUrl: string | null;
  siteName: string | null;
};

export const MAX_TITLE = 300;
export const MAX_DESCRIPTION = 500;
export const MAX_SITE_NAME = 100;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  laquo: "«",
  raquo: "»",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  egrave: "è",
  eacute: "é",
  agrave: "à",
  ograve: "ò",
  ugrave: "ù",
  igrave: "ì",
  euro: "€",
};

export function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] === "#") {
      const code = body[1].toLowerCase() === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) {
        return "";
      }
      return String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

/** Testo da un valore di attributo o dal contenuto di <title>: entità decodificate, niente markup, spazi compressi. */
export function cleanText(input: string | null | undefined, max: number): string | null {
  if (!input) {
    return null;
  }
  const text = decodeEntities(input)
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text === "") {
    return null;
  }
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** Attributi di un tag: valori tra apici singoli, doppi o senza apici. Nomi in minuscolo. */
export function parseAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  // salta il nome del tag
  const body = tag.replace(/^<\s*[a-z0-9]+/i, "").replace(/\/?>$/, "");
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const name = m[1].toLowerCase();
    if (!(name in attrs)) {
      attrs[name] = m[2] ?? m[3] ?? m[4] ?? "";
    }
  }
  return attrs;
}

export function resolveHttpsUrl(value: string | null | undefined, baseUrl: string): string | null {
  const v = (value ?? "").trim();
  if (v === "" || v.length > 2048 || /[\u0000-\u001f\u007f\s]/.test(v)) {
    return null;
  }
  try {
    const url = new URL(decodeEntities(v), baseUrl);
    return url.protocol === "https:" && url.username === "" && url.password === "" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Solo l'head: evita di scandire un body da 512 KB per tre tag. */
function headOf(html: string): string {
  const end = html.search(/<\/head\s*>/i);
  const head = end >= 0 ? html.slice(0, end) : html.slice(0, 200_000);
  return head.replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style|noscript)\b[\s\S]*?<\/\1\s*>/gi, "");
}

export function parseLinkMeta(html: string, baseUrl: string): LinkMeta {
  const head = headOf(html);
  const metas: Record<string, string> = {};
  const icons: Array<{ rel: string; href: string; sizes: string }> = [];

  for (const tag of head.match(/<(?:meta|link)\b[^>]*>/gi) ?? []) {
    const attrs = parseAttributes(tag);
    if (/^<\s*meta/i.test(tag)) {
      const key = (attrs["property"] ?? attrs["name"] ?? "").toLowerCase();
      const content = attrs["content"];
      if (key !== "" && content !== undefined && !(key in metas)) {
        metas[key] = content;
      }
    } else if (attrs["href"] !== undefined && attrs["rel"] !== undefined) {
      icons.push({ rel: attrs["rel"].toLowerCase(), href: attrs["href"], sizes: attrs["sizes"] ?? "" });
    }
  }

  const titleTag = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(head);

  const title = cleanText(metas["og:title"] ?? metas["twitter:title"] ?? titleTag?.[1], MAX_TITLE);
  const description = cleanText(
    metas["og:description"] ?? metas["twitter:description"] ?? metas["description"],
    MAX_DESCRIPTION,
  );
  const siteName = cleanText(metas["og:site_name"] ?? metas["application-name"], MAX_SITE_NAME);

  const imageUrl = resolveHttpsUrl(
    metas["og:image:secure_url"] ?? metas["og:image"] ?? metas["og:image:url"] ?? metas["twitter:image"] ?? metas["twitter:image:src"],
    baseUrl,
  );

  // Favicon: preferisce apple-touch-icon / icon con sizes, poi shortcut icon; ripiego /favicon.ico.
  const rank = (i: { rel: string }) => (i.rel.includes("apple-touch-icon") ? 0 : i.rel.split(/\s+/).includes("icon") ? 1 : 2);
  const candidates = icons.filter((i) => /(^|\s)(icon|shortcut|apple-touch-icon)(\s|$)/.test(i.rel)).sort((a, b) => rank(a) - rank(b));
  let faviconUrl: string | null = null;
  for (const c of candidates) {
    faviconUrl = resolveHttpsUrl(c.href, baseUrl);
    if (faviconUrl) {
      break;
    }
  }
  if (!faviconUrl) {
    faviconUrl = resolveHttpsUrl("/favicon.ico", baseUrl);
  }

  return { title, description, imageUrl, faviconUrl, siteName };
}
