/**
 * «Incolla un articolo» → documento strutturato (HOM-06.2 §7O, §7R, §7S).
 *
 * Il testo incollato non è mai source of truth come HTML (§7O): si converte nel
 * documento §49 conservando solo ciò che il formato supporta — paragrafi,
 * heading, grassetto, corsivo, liste puntate e numerate, link sicuri, a-capo
 * significativi (§7R) — e scartando font, dimensioni, colori, stili inline,
 * classi, script, iframe, form, pixel di tracking, commenti, embed e ogni
 * elemento non supportato. Le immagini nel corpo non si importano in V1.
 *
 * Non è un parser HTML completo e non costruisce un DOM: è un tokenizer di tag
 * che non esegue nulla. Se qualcosa va storto (o supera il tempo concesso) si
 * ripiega sul testo piano: il contenuto non si perde mai (§7R «parsing
 * fallito»). Limiti di dimensione, blocchi e tempo arrivano dal server
 * (§7R «definire centralmente», stessi limiti client e backend).
 */

import { newBlockId, safeLinkUrl } from "./article-document";
import type {
  ArticleBlock,
  ArticleDocument,
  ArticleInline,
  ArticleLimits,
  ArticleListItem,
  ArticleMark,
  ArticleTextInline,
} from "./article-types";

export type PasteIssue = "empty" | "too_large" | "too_many_blocks";

export type PasteResult =
  | {
      ok: true;
      document: ArticleDocument;
      /** §7S: un unico heading iniziale chiaramente identificabile, mai pubblicato senza revisione. */
      proposedTitle: string | null;
      /** §7R: elementi non supportati rimossi → avviso non bloccante. */
      removedUnsupported: boolean;
      /** Il parsing rich text è fallito ed è stato usato il testo piano. */
      usedPlainFallback: boolean;
    }
  | { ok: false; issue: PasteIssue };

/* ------------------------------------------------------------------ */
/* Testo piano                                                         */
/* ------------------------------------------------------------------ */

const BULLET = /^\s*(?:[-*•‣◦▪]|–)\s+(.*)$/;
const NUMBERED = /^\s*\d{1,3}[.)]\s+(.*)$/;

function textInline(text: string): ArticleTextInline[] {
  return text.length > 0 ? [{ text, type: "text" }] : [];
}

/**
 * Testo piano: ogni riga non vuota è un paragrafo (gli a-capo dell'autore sono
 * significativi), le righe «- x» / «1. x» consecutive diventano liste.
 */
export function plainTextBlocks(input: string): ArticleBlock[] {
  const blocks: ArticleBlock[] = [];
  let list: { type: "unordered_list" | "ordered_list"; items: ArticleListItem[] } | null = null;

  const flush = () => {
    if (list && list.items.length > 0) {
      blocks.push({ id: newBlockId(), items: list.items, type: list.type });
    }
    list = null;
  };

  for (const raw of input.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.replace(/[\t  ]+/g, " ").trim();
    if (line.length === 0) {
      flush();
      continue;
    }
    const bullet = BULLET.exec(line);
    const numbered = bullet ? null : NUMBERED.exec(line);
    const type = bullet ? "unordered_list" : numbered ? "ordered_list" : null;
    if (type) {
      const current = list as { type: "unordered_list" | "ordered_list"; items: ArticleListItem[] } | null;
      if (!current || current.type !== type) {
        flush();
        list = { items: [], type };
      }
      const content = (bullet?.[1] ?? numbered?.[1] ?? "").trim();
      if (content.length > 0) {
        list!.items.push({ content: textInline(content), id: newBlockId() });
      }
      continue;
    }
    flush();
    blocks.push({ content: textInline(line), id: newBlockId(), type: "paragraph" });
  }
  flush();
  return blocks;
}

/* ------------------------------------------------------------------ */
/* HTML                                                                */
/* ------------------------------------------------------------------ */

/** Contenuto scartato per intero, tag e testo (§7R). */
const DROP_WITH_CONTENT = new Set([
  "script",
  "style",
  "iframe",
  "frame",
  "frameset",
  "object",
  "embed",
  "form",
  "noscript",
  "template",
  "svg",
  "math",
  "canvas",
  "video",
  "audio",
  "select",
  "textarea",
  "button",
  "head",
  "title",
  "meta",
  "link",
]);

/** Elementi senza contenuto che si tolgono con un avviso (immagini, pixel §7R). */
const DROP_VOID = new Set(["img", "picture", "source", "input", "hr", "wbr", "area", "track", "param"]);

const BLOCK_TAGS = new Set([
  "p",
  "div",
  "section",
  "article",
  "header",
  "footer",
  "main",
  "aside",
  "blockquote",
  "pre",
  "figure",
  "figcaption",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "td",
  "th",
  "caption",
  "dl",
  "dt",
  "dd",
  "address",
  "center",
  "body",
  "html",
]);

const HEADINGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

/** Tag tollerati che si «srotolano» senza avviso (formattazione comune degli editor). */
const UNWRAP_SILENT = new Set(["span", "font", "u", "s", "strike", "sub", "sup", "small", "big", "mark", "abbr", "cite", "q", "code", "kbd", "samp", "var", "time", "label", "o:p"]);

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  hellip: "…",
  laquo: "«",
  ldquo: "“",
  lsquo: "‘",
  lt: "<",
  mdash: "—",
  nbsp: " ",
  ndash: "–",
  quot: '"',
  raquo: "»",
  rdquo: "”",
  rsquo: "’",
  agrave: "à",
  egrave: "è",
  eacute: "é",
  igrave: "ì",
  ograve: "ò",
  ugrave: "ù",
  Agrave: "À",
  Egrave: "È",
  Eacute: "É",
  euro: "€",
  copy: "©",
  reg: "®",
  deg: "°",
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
    return NAMED_ENTITIES[body] ?? NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

function attribute(attrs: string, name: string): string | null {
  const pattern = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const match = pattern.exec(attrs);
  return match ? decodeEntities(match[1] ?? match[2] ?? match[3] ?? "") : null;
}

/** Grassetto/corsivo espressi dallo stile (Google Docs, Word) — l'unica cosa che si legge dello stile. */
function styleMarks(attrs: string): { bold?: boolean; italic?: boolean } {
  const style = (attribute(attrs, "style") ?? "").toLowerCase();
  const result: { bold?: boolean; italic?: boolean } = {};
  const weight = /font-weight\s*:\s*([a-z0-9]+)/.exec(style)?.[1];
  if (weight) {
    result.bold = weight === "bold" || weight === "bolder" || Number(weight) >= 600;
  }
  const fontStyle = /font-style\s*:\s*([a-z]+)/.exec(style)?.[1];
  if (fontStyle) {
    result.italic = fontStyle === "italic" || fontStyle === "oblique";
  }
  return result;
}

type Frame = {
  tag: string;
  bold?: boolean;
  italic?: boolean;
  link?: string | null;
};

type Builder = {
  blocks: ArticleBlock[];
  current: { kind: "paragraph" | "heading" | "item"; inlines: ArticleInline[] } | null;
  listStack: { type: "unordered_list" | "ordered_list"; items: ArticleListItem[] }[];
  removed: boolean;
};

class PasteTimeout extends Error {}

function activeMarks(stack: Frame[]): ArticleMark[] {
  let bold = false;
  let italic = false;
  for (const frame of stack) {
    if (frame.bold !== undefined) bold = frame.bold;
    if (frame.italic !== undefined) italic = frame.italic;
  }
  const marks: ArticleMark[] = [];
  if (bold) marks.push("bold");
  if (italic) marks.push("italic");
  return marks;
}

function activeLink(stack: Frame[]): string | null {
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    if (stack[index].link !== undefined) return stack[index].link ?? null;
  }
  return null;
}

function sameMarks(a: ArticleMark[] | undefined, b: ArticleMark[] | undefined): boolean {
  return (a ?? []).join() === (b ?? []).join();
}

function appendText(builder: Builder, text: string, marks: ArticleMark[], link: string | null) {
  if (!builder.current) {
    if (text.trim().length === 0) return;
    builder.current = { inlines: [], kind: builder.listStack.length > 0 ? "item" : "paragraph" };
  }
  const inlines = builder.current.inlines;
  const piece: ArticleTextInline = { text, type: "text" };
  if (marks.length > 0) piece.marks = marks;

  const last = inlines[inlines.length - 1];
  if (link) {
    if (last && last.type === "inline_link" && last.url === link) {
      const tail = last.content[last.content.length - 1];
      if (tail && sameMarks(tail.marks, piece.marks)) tail.text += text;
      else last.content.push(piece);
    } else {
      inlines.push({ content: [piece], type: "inline_link", url: link });
    }
    return;
  }
  if (last && last.type === "text" && sameMarks(last.marks, piece.marks)) {
    last.text += text;
  } else {
    inlines.push(piece);
  }
}

/** Spazi HTML: sequenze → uno spazio, niente spazi ai bordi del blocco. */
function trimInlines(inlines: ArticleInline[]): ArticleInline[] {
  const flat: ArticleInline[] = inlines
    .map((inline) =>
      inline.type === "text"
        ? { ...inline, text: inline.text.replace(/\s+/g, " ") }
        : { ...inline, content: inline.content.map((child) => ({ ...child, text: child.text.replace(/\s+/g, " ") })) },
    );
  const textOf = (inline: ArticleInline) => (inline.type === "text" ? inline.text : inline.content.map((c) => c.text).join(""));

  // Spazio doppio fra due inline adiacenti.
  for (let index = 1; index < flat.length; index += 1) {
    const prev = textOf(flat[index - 1]);
    const current = flat[index];
    if (prev.endsWith(" ")) {
      if (current.type === "text") current.text = current.text.replace(/^ /, "");
      else if (current.content[0]) current.content[0].text = current.content[0].text.replace(/^ /, "");
    }
  }
  const first = flat[0];
  if (first) {
    if (first.type === "text") first.text = first.text.replace(/^ /, "");
    else if (first.content[0]) first.content[0].text = first.content[0].text.replace(/^ /, "");
  }
  const last = flat[flat.length - 1];
  if (last) {
    if (last.type === "text") last.text = last.text.replace(/ $/, "");
    else {
      const tail = last.content[last.content.length - 1];
      if (tail) tail.text = tail.text.replace(/ $/, "");
    }
  }
  return flat
    .map((inline) => (inline.type === "inline_link" ? { ...inline, content: inline.content.filter((c) => c.text.length > 0) } : inline))
    .filter((inline) => (inline.type === "text" ? inline.text.length > 0 : inline.content.length > 0));
}

function closeCurrent(builder: Builder) {
  const current = builder.current;
  builder.current = null;
  if (!current) return;
  const content = trimInlines(current.inlines);
  if (content.length === 0) return;
  if (current.kind === "item" && builder.listStack.length > 0) {
    builder.listStack[builder.listStack.length - 1].items.push({ content, id: newBlockId() });
    return;
  }
  builder.blocks.push({ content, id: newBlockId(), type: current.kind === "heading" ? "heading" : "paragraph" });
}

function closeList(builder: Builder) {
  closeCurrent(builder);
  const list = builder.listStack.pop();
  if (!list || list.items.length === 0) return;
  // Le liste annidate non esistono nel formato (§43): si appiattiscono nella lista esterna.
  const parent = builder.listStack[builder.listStack.length - 1];
  if (parent) {
    parent.items.push(...list.items);
    return;
  }
  builder.blocks.push({ id: newBlockId(), items: list.items, type: list.type });
}

/**
 * HTML degli appunti → blocchi. Lancia `PasteTimeout` oltre `timeoutMs`.
 * Restituisce anche se qualcosa di non supportato è stato rimosso.
 */
export function htmlBlocks(html: string, timeoutMs: number, now: () => number = Date.now): { blocks: ArticleBlock[]; removed: boolean } {
  const startedAt = now();
  const source = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "");
  // I commenti (anche i condizionali di Word) si tolgono in silenzio: non sono contenuto dell'autore.
  const builder: Builder = { blocks: [], current: null, listStack: [], removed: false };
  const stack: Frame[] = [];
  let dropDepth = 0;
  let dropTag: string | null = null;

  const tokens = /<\/?([a-zA-Z][a-zA-Z0-9:-]*)([^>]*)>|([^<]+)|(<)/g;
  let match: RegExpExecArray | null;
  let steps = 0;

  while ((match = tokens.exec(source)) !== null) {
    steps += 1;
    if (steps % 200 === 0 && now() - startedAt > timeoutMs) {
      throw new PasteTimeout();
    }

    const [whole, rawTag, attrs = "", text, stray] = match;
    if (text !== undefined || stray !== undefined) {
      if (dropDepth > 0) continue;
      const value = decodeEntities(text ?? stray ?? "");
      appendText(builder, value, activeMarks(stack), activeLink(stack));
      continue;
    }

    const tag = rawTag.toLowerCase();
    const closing = whole.startsWith("</");
    const selfClosing = /\/\s*>$/.test(whole);

    if (dropDepth > 0) {
      if (tag === dropTag) dropDepth += closing ? -1 : selfClosing ? 0 : 1;
      if (dropDepth === 0) dropTag = null;
      continue;
    }

    if (DROP_WITH_CONTENT.has(tag)) {
      builder.removed = true;
      if (!closing && !selfClosing) {
        dropDepth = 1;
        dropTag = tag;
      }
      continue;
    }
    if (DROP_VOID.has(tag)) {
      if (tag !== "hr" && tag !== "wbr") builder.removed = true;
      if (tag === "hr") closeCurrent(builder);
      continue;
    }

    if (tag === "br") {
      // Un a-capo dentro un blocco è significativo (§7R): chiude il paragrafo.
      if (builder.current?.kind === "item") appendText(builder, " ", activeMarks(stack), activeLink(stack));
      else closeCurrent(builder);
      continue;
    }

    if (tag === "ul" || tag === "ol") {
      if (closing) {
        closeList(builder);
      } else {
        closeCurrent(builder);
        builder.listStack.push({ items: [], type: tag === "ul" ? "unordered_list" : "ordered_list" });
      }
      continue;
    }

    if (tag === "li") {
      closeCurrent(builder);
      if (!closing) {
        if (builder.listStack.length === 0) builder.listStack.push({ items: [], type: "unordered_list" });
        builder.current = { inlines: [], kind: "item" };
      }
      continue;
    }

    if (HEADINGS.has(tag)) {
      closeCurrent(builder);
      if (!closing) builder.current = { inlines: [], kind: "heading" };
      continue;
    }

    if (BLOCK_TAGS.has(tag)) {
      if (builder.current?.kind !== "item") closeCurrent(builder);
      if (tag === "table" && !closing) builder.removed = true;
      continue;
    }

    if (closing) {
      for (let index = stack.length - 1; index >= 0; index -= 1) {
        if (stack[index].tag === tag) {
          stack.splice(index, 1);
          break;
        }
      }
      continue;
    }
    if (selfClosing) continue;

    const frame: Frame = { tag };
    const fromStyle = styleMarks(attrs);
    if (tag === "b" || tag === "strong") frame.bold = fromStyle.bold ?? true;
    else if (tag === "i" || tag === "em") frame.italic = fromStyle.italic ?? true;
    else {
      if (fromStyle.bold !== undefined) frame.bold = fromStyle.bold;
      if (fromStyle.italic !== undefined) frame.italic = fromStyle.italic;
    }
    if (tag === "a") {
      const href = attribute(attrs, "href");
      const url = href ? safeLinkUrl(href) : null;
      if (href && !url) builder.removed = true;
      frame.link = url;
    } else if (!UNWRAP_SILENT.has(tag) && tag !== "b" && tag !== "strong" && tag !== "i" && tag !== "em") {
      builder.removed = true;
    }
    stack.push(frame);
  }

  while (builder.listStack.length > 0) closeList(builder);
  closeCurrent(builder);
  return { blocks: builder.blocks, removed: builder.removed };
}

/** Il testo piano di un HTML: ripiego quando il parsing rich text fallisce (§7R). */
export function htmlToPlainText(html: string): string {
  return decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<(script|style|iframe|object|embed|noscript|template|svg|head)\b[\s\S]*?<\/\1\s*>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h[1-6]|li|tr|blockquote|section|article)\s*>/gi, "\n")
      .replace(/<[^>]*>/g, ""),
  );
}

/* ------------------------------------------------------------------ */
/* Ingresso unico                                                      */
/* ------------------------------------------------------------------ */

function blockCount(blocks: ArticleBlock[]): number {
  return blocks.reduce(
    (total, block) => total + (block.type === "unordered_list" || block.type === "ordered_list" ? block.items.length : 1),
    0,
  );
}

function headingText(block: ArticleBlock | undefined): string | null {
  if (!block || block.type !== "heading") return null;
  const text = block.content
    .map((inline) => (inline.type === "text" ? inline.text : inline.content.map((c) => c.text).join("")))
    .join("")
    .trim();
  return text.length > 0 ? text : null;
}

/**
 * §7R–§7S. `html` è il formato ricco degli appunti quando c'è, `plain` il
 * testo piano (sempre). Il titolo proposto è l'heading iniziale SOLO se è
 * l'unico heading del documento ed è seguito da altro contenuto; si toglie dal
 * corpo perché non compaia due volte, e l'utente lo rivede prima di pubblicare.
 */
export function parsePastedArticle(
  input: { plain: string; html?: string | null },
  limits: Pick<ArticleLimits, "maxClipboardChars" | "maxBlocks" | "maxTitleLength" | "parseTimeoutMs">,
  now: () => number = Date.now,
): PasteResult {
  const plain = input.plain ?? "";
  const html = input.html ?? null;
  const size = Math.max(plain.length, html?.length ?? 0);
  if (size > limits.maxClipboardChars) {
    return { issue: "too_large", ok: false };
  }

  let blocks: ArticleBlock[] = [];
  let removed = false;
  let usedPlainFallback = false;

  if (html && html.trim().length > 0) {
    try {
      const parsed = htmlBlocks(html, limits.parseTimeoutMs, now);
      blocks = parsed.blocks;
      removed = parsed.removed;
    } catch {
      usedPlainFallback = true;
      blocks = plainTextBlocks(plain.trim().length > 0 ? plain : htmlToPlainText(html));
    }
    if (!usedPlainFallback && blocks.length === 0 && plain.trim().length > 0) {
      usedPlainFallback = true;
      blocks = plainTextBlocks(plain);
    }
  } else {
    blocks = plainTextBlocks(plain);
  }

  if (blocks.length === 0) {
    return { issue: "empty", ok: false };
  }
  if (blockCount(blocks) > limits.maxBlocks) {
    return { issue: "too_many_blocks", ok: false };
  }

  let proposedTitle: string | null = null;
  const headings = blocks.filter((block) => block.type === "heading");
  const first = headingText(blocks[0]);
  if (first && headings.length === 1 && blocks.length > 1 && first.length <= limits.maxTitleLength) {
    proposedTitle = first;
    blocks = blocks.slice(1);
  }

  return {
    document: { blocks, v: 1 },
    ok: true,
    proposedTitle,
    removedUnsupported: removed,
    usedPlainFallback,
  };
}
