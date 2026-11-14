/**
 * Documento strutturato dell'Articolo e operazioni di editing (HOM-06.2
 * §41–§54, §59–§71, §7R, §7S). Modulo puro: niente React, niente rete.
 *
 * Due rappresentazioni dello stesso contenuto:
 *  • `ArticleDocument` (§49, contratto §A4): blocchi con id stabile (§50) —
 *    paragraph, heading, unordered_list, ordered_list, rich_link — e inline
 *    text con marks bold/italic e inline_link. È ciò che si salva e si rende.
 *  • `EditorLine[]`: righe piatte che l'editor mobile sa modificare (una
 *    TextInput per riga), con marks e link come intervalli sul testo. Righe
 *    consecutive `bullet`/`numbered` diventano una lista.
 *
 * Nessun HTML in nessun punto (§48, §51): il testo è testo, i link sono dati.
 * Gli URL accettati sono solo https (http è riscritto in https, gli altri
 * schemi sono scartati); il server rivalida tutto (§12, §258).
 */

import type {
  ArticleBlock,
  ArticleDocument,
  ArticleInline,
  ArticleLimits,
  ArticleListItem,
  ArticleMark,
  ArticleTextInline,
  EditorLine,
  LinkSpan,
  MarkSpan,
  PendingMarks,
  RichLinkLine,
  TextLine,
  TextLineKind,
} from "./article-types";

const MARK_ORDER: ArticleMark[] = ["bold", "italic"];

/* ------------------------------------------------------------------ */
/* Id e URL                                                            */
/* ------------------------------------------------------------------ */

let idCounter = 0;

/** §50: id stabile di blocco/riga, `[A-Za-z0-9_-]`, ≤ 40 caratteri. */
export function newBlockId(): string {
  idCounter = (idCounter + 1) % 1_679_616;
  const random = Math.random().toString(36).slice(2, 10).padEnd(8, "0");
  return `b${Date.now().toString(36)}${idCounter.toString(36)}${random}`.slice(0, 40);
}

const BLOCK_ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;

/**
 * §67, §7G: solo http(s) con host; `http` diventa `https`. Tutto il resto
 * (javascript:, data:, file:, schemi custom, URL relativi) → null.
 */
export function safeLinkUrl(raw: string): string | null {
  const value = raw.trim();
  const match = /^(https?):\/\/([^/?#\s]+)([^\s]*)$/i.exec(value);
  if (!match) {
    return null;
  }
  const host = match[2];
  if (host.includes("@") || !/[a-z0-9]/i.test(host)) {
    return null;
  }
  return `https://${host}${match[3]}`;
}

/** §63: una riga che contiene SOLO un URL può diventare un rich link. */
export function standaloneUrl(text: string): string | null {
  const value = text.trim();
  if (value.length === 0 || /\s/.test(value)) {
    return null;
  }
  return safeLinkUrl(value);
}

/** «accomo.it» da un URL (§69 fallback, §7L). */
export function urlDomain(url: string): string | null {
  const match = /^https?:\/\/([^/?#\s:]+)/i.exec(url.trim());
  const host = match?.[1]?.toLowerCase().replace(/^www\./, "");
  return host && host.length > 0 ? host : null;
}

/* ------------------------------------------------------------------ */
/* Righe                                                               */
/* ------------------------------------------------------------------ */

export function emptyTextLine(kind: TextLineKind = "paragraph", id: string = newBlockId()): TextLine {
  return { id, kind, links: [], marks: [], text: "" };
}

export function isTextLine(line: EditorLine): line is TextLine {
  return line.kind !== "rich_link";
}

/** Ordina, scarta vuoti e fonde intervalli contigui/sovrapposti dello stesso mark. */
export function normalizeMarks(marks: MarkSpan[], textLength: number): MarkSpan[] {
  const result: MarkSpan[] = [];
  for (const mark of MARK_ORDER) {
    const spans = marks
      .filter((span) => span.mark === mark)
      .map((span) => ({
        end: Math.min(Math.max(span.end, 0), textLength),
        mark,
        start: Math.min(Math.max(span.start, 0), textLength),
      }))
      .filter((span) => span.end > span.start)
      .sort((a, b) => a.start - b.start);
    for (const span of spans) {
      const last = result[result.length - 1];
      if (last && last.mark === mark && span.start <= last.end) {
        last.end = Math.max(last.end, span.end);
      } else {
        result.push({ ...span });
      }
    }
  }
  return result;
}

/** Link non sovrapposti, non vuoti, entro il testo; in caso di sovrapposizione vince il primo. */
export function normalizeLinks(links: LinkSpan[], textLength: number): LinkSpan[] {
  const sorted = links
    .map((link) => ({
      end: Math.min(Math.max(link.end, 0), textLength),
      start: Math.min(Math.max(link.start, 0), textLength),
      url: link.url,
    }))
    .filter((link) => link.end > link.start)
    .sort((a, b) => a.start - b.start);
  const result: LinkSpan[] = [];
  for (const link of sorted) {
    const last = result[result.length - 1];
    if (!last || link.start >= last.end) {
      result.push(link);
    }
  }
  return result;
}

/**
 * Applica un cambio di testo di una TextInput a marks e link, ricavando
 * l'intervallo modificato come differenza fra vecchio e nuovo testo (prefisso
 * e suffisso comuni). Il testo digitato alla fine di un tratto in grassetto
 * resta in grassetto (come ogni editor); un link non si estende mai da solo.
 * I `pendingMarks` (B / I premuti con il cursore fermo) valgono per il testo
 * appena inserito.
 */
export function applyTextChange(line: TextLine, nextText: string, pendingMarks: PendingMarks = {}): TextLine {
  const prev = line.text;
  if (prev === nextText) {
    return line;
  }

  const maxPrefix = Math.min(prev.length, nextText.length);
  let prefix = 0;
  while (prefix < maxPrefix && prev.charCodeAt(prefix) === nextText.charCodeAt(prefix)) {
    prefix += 1;
  }
  let suffix = 0;
  while (
    suffix < maxPrefix - prefix &&
    prev.charCodeAt(prev.length - 1 - suffix) === nextText.charCodeAt(nextText.length - 1 - suffix)
  ) {
    suffix += 1;
  }

  const removedEnd = prev.length - suffix;
  const inserted = nextText.length - suffix - prefix;
  const delta = nextText.length - prev.length;

  const mapStart = (pos: number): number => {
    if (pos < prefix) return pos;
    if (pos >= removedEnd) return pos + delta;
    return prefix + inserted;
  };
  const mapEnd = (pos: number, extend: boolean): number => {
    if (pos < prefix) return pos;
    if (pos === prefix && removedEnd === prefix) return extend ? pos + inserted : pos;
    if (pos > removedEnd || (pos === removedEnd && pos > prefix)) return pos + delta;
    return extend ? prefix + inserted : prefix;
  };

  let marks = line.marks.map((span) => ({
    end: mapEnd(span.end, span.start < prefix || (span.start === prefix && removedEnd > prefix)),
    mark: span.mark,
    start: mapStart(span.start),
  }));
  const links = line.links.map((link) => ({ end: mapEnd(link.end, false), start: mapStart(link.start), url: link.url }));

  if (inserted > 0) {
    for (const mark of MARK_ORDER) {
      const wanted = pendingMarks[mark];
      if (wanted === true) {
        marks.push({ end: prefix + inserted, mark, start: prefix });
      } else if (wanted === false) {
        marks = removeMarkRange(marks, prefix, prefix + inserted, mark);
      }
    }
  }

  return {
    ...line,
    links: normalizeLinks(links, nextText.length),
    marks: normalizeMarks(marks, nextText.length),
    text: nextText,
  };
}

function removeMarkRange(marks: MarkSpan[], start: number, end: number, mark: ArticleMark): MarkSpan[] {
  const result: MarkSpan[] = [];
  for (const span of marks) {
    if (span.mark !== mark || span.end <= start || span.start >= end) {
      result.push(span);
      continue;
    }
    if (span.start < start) result.push({ end: start, mark, start: span.start });
    if (span.end > end) result.push({ end: span.end, mark, start: end });
  }
  return result;
}

/** Il mark copre tutto l'intervallo (non vuoto)? */
export function rangeHasMark(line: TextLine, start: number, end: number, mark: ArticleMark): boolean {
  if (end <= start) {
    return false;
  }
  let cursor = start;
  for (const span of normalizeMarks(line.marks, line.text.length).filter((s) => s.mark === mark)) {
    if (span.start > cursor) break;
    if (span.end > cursor) cursor = span.end;
    if (cursor >= end) return true;
  }
  return cursor >= end;
}

/** Il mark è attivo alla posizione del cursore (carattere prima del cursore)? */
export function markActiveAt(line: TextLine, position: number, mark: ArticleMark): boolean {
  return line.marks.some((span) => span.mark === mark && span.start < position && position <= span.end);
}

/** §43 B / I su una selezione: se il mark copre già tutto si toglie, altrimenti si applica. */
export function toggleMark(line: TextLine, start: number, end: number, mark: ArticleMark): TextLine {
  if (end <= start) {
    return line;
  }
  const marks = rangeHasMark(line, start, end, mark)
    ? removeMarkRange(line.marks, start, end, mark)
    : [...line.marks, { end, mark, start }];
  return { ...line, marks: normalizeMarks(marks, line.text.length) };
}

/** §59: Aggiungi link su una selezione; un link già presente nell'intervallo viene sostituito. */
export function setLink(line: TextLine, start: number, end: number, rawUrl: string): TextLine | null {
  const url = safeLinkUrl(rawUrl);
  if (!url || end <= start) {
    return null;
  }
  const links = line.links.filter((link) => link.end <= start || link.start >= end);
  return { ...line, links: normalizeLinks([...links, { end, start, url }], line.text.length) };
}

/** Il link che contiene la posizione (o la selezione), se c'è. */
export function linkAt(line: TextLine, start: number, end: number = start): LinkSpan | null {
  return (
    line.links.find((link) =>
      end > start ? link.start <= start && end <= link.end : link.start <= start && start <= link.end,
    ) ?? null
  );
}

/** §62: rimozione del link mantenendo il testo. */
export function removeLink(line: TextLine, link: LinkSpan): TextLine {
  return { ...line, links: line.links.filter((item) => item.start !== link.start || item.end !== link.end) };
}

/** §62: modifica di testo e URL di un link esistente; il resto della riga si sposta di conseguenza. */
export function editLink(line: TextLine, link: LinkSpan, nextText: string, rawUrl: string): TextLine | null {
  const url = safeLinkUrl(rawUrl);
  const text = nextText.length > 0 ? nextText : line.text.slice(link.start, link.end);
  if (!url || text.trim().length === 0) {
    return null;
  }
  const replaced = `${line.text.slice(0, link.start)}${text}${line.text.slice(link.end)}`;
  const shifted = applyTextChange(removeLink(line, link), replaced);
  return setLink(shifted, link.start, link.start + text.length, url);
}

/* ------------------------------------------------------------------ */
/* Operazioni sulle righe                                              */
/* ------------------------------------------------------------------ */

function sliceLine(line: TextLine, start: number, end: number, id: string): TextLine {
  const clip = <T extends { start: number; end: number }>(spans: T[]): T[] =>
    spans
      .filter((span) => span.end > start && span.start < end)
      .map((span) => ({ ...span, end: Math.min(span.end, end) - start, start: Math.max(span.start, start) - start }));
  return {
    id,
    kind: line.kind,
    links: clip(line.links),
    marks: clip(line.marks),
    text: line.text.slice(start, end),
  };
}

function replaceLine(lines: EditorLine[], index: number, ...next: EditorLine[]): EditorLine[] {
  return [...lines.slice(0, index), ...next, ...lines.slice(index + 1)];
}

/** §43–§44: Aa (paragrafo ⇄ sezione) e i due bottoni lista (attiva ⇄ disattiva). */
export function setLineKind(lines: EditorLine[], lineId: string, kind: TextLineKind): EditorLine[] {
  const index = lines.findIndex((line) => line.id === lineId);
  const line = lines[index];
  if (!line || !isTextLine(line)) {
    return lines;
  }
  const next: TextLineKind = line.kind === kind ? "paragraph" : kind;
  return replaceLine(lines, index, { ...line, kind: next });
}

export type SplitResult = { lines: EditorLine[]; focusId: string; focusOffset: number };

/**
 * Invio dentro una riga: il testo dopo il cursore va in una riga nuova.
 *  • dopo una sezione si riparte da un paragrafo;
 *  • Invio su una voce di lista vuota esce dalla lista (diventa paragrafo);
 *  • §63: Invio su una riga che contiene solo un URL la trasforma in rich link.
 */
export function splitLine(lines: EditorLine[], lineId: string, at: number): SplitResult {
  const index = lines.findIndex((line) => line.id === lineId);
  const line = lines[index];
  if (!line || !isTextLine(line)) {
    return { focusId: lineId, focusOffset: 0, lines };
  }

  const isList = line.kind === "bullet" || line.kind === "numbered";
  if (isList && line.text.length === 0) {
    return { focusId: line.id, focusOffset: 0, lines: replaceLine(lines, index, { ...line, kind: "paragraph" }) };
  }

  const url = at === line.text.length && line.kind === "paragraph" ? standaloneUrl(line.text) : null;
  if (url) {
    const rich: RichLinkLine = { id: line.id, kind: "rich_link", preview: null, snapshotId: null, status: "loading", url };
    const after = emptyTextLine("paragraph");
    return { focusId: after.id, focusOffset: 0, lines: replaceLine(lines, index, rich, after) };
  }

  const before = sliceLine(line, 0, at, line.id);
  const after = sliceLine(line, at, line.text.length, newBlockId());
  after.kind = line.kind === "heading" ? "paragraph" : line.kind;
  return { focusId: after.id, focusOffset: 0, lines: replaceLine(lines, index, before, after) };
}

export type MergeResult = { lines: EditorLine[]; focusId: string; focusOffset: number } | null;

/**
 * Backspace all'inizio di una riga: una voce di lista torna paragrafo; un
 * paragrafo si fonde con la riga di testo precedente. Un rich link precedente
 * NON viene toccato (§71: rimuoverlo è un'azione esplicita).
 */
export function mergeWithPrevious(lines: EditorLine[], lineId: string): MergeResult {
  const index = lines.findIndex((line) => line.id === lineId);
  const line = lines[index];
  if (!line || !isTextLine(line)) {
    return null;
  }
  if (line.kind === "bullet" || line.kind === "numbered") {
    return { focusId: line.id, focusOffset: 0, lines: replaceLine(lines, index, { ...line, kind: "paragraph" }) };
  }
  const previous = lines[index - 1];
  if (!previous || !isTextLine(previous)) {
    if (line.kind === "heading") {
      return { focusId: line.id, focusOffset: 0, lines: replaceLine(lines, index, { ...line, kind: "paragraph" }) };
    }
    return null;
  }

  const offset = previous.text.length;
  const shift = <T extends { start: number; end: number }>(spans: T[]): T[] =>
    spans.map((span) => ({ ...span, end: span.end + offset, start: span.start + offset }));
  const text = previous.text + line.text;
  const merged: TextLine = {
    ...previous,
    links: normalizeLinks([...previous.links, ...shift(line.links)], text.length),
    marks: normalizeMarks([...previous.marks, ...shift(line.marks)], text.length),
    text,
  };
  const next = [...lines.slice(0, index - 1), merged, ...lines.slice(index + 1)];
  return { focusId: previous.id, focusOffset: offset, lines: next };
}

/** §71: togliere un rich link non elimina altri blocchi; restano almeno una riga di testo. */
export function removeLine(lines: EditorLine[], lineId: string): EditorLine[] {
  const next = lines.filter((line) => line.id !== lineId);
  return next.some(isTextLine) ? next : [...next, emptyTextLine()];
}

export function updateLine(lines: EditorLine[], line: EditorLine): EditorLine[] {
  const index = lines.findIndex((item) => item.id === line.id);
  return index < 0 ? lines : replaceLine(lines, index, line);
}

/** Numero d'ordine di una voce numerata nel suo gruppo contiguo (1-based). */
export function orderedIndex(lines: EditorLine[], lineId: string): number {
  const index = lines.findIndex((line) => line.id === lineId);
  let count = 0;
  for (let cursor = index; cursor >= 0; cursor -= 1) {
    const line = lines[cursor];
    if (line.kind !== "numbered") break;
    count += 1;
  }
  return count;
}

/* ------------------------------------------------------------------ */
/* Righe ⇄ documento                                                   */
/* ------------------------------------------------------------------ */

function marksAt(marks: MarkSpan[], start: number, end: number): ArticleMark[] {
  return MARK_ORDER.filter((mark) => marks.some((span) => span.mark === mark && span.start <= start && end <= span.end));
}

/** Testo + intervalli → inline del documento (§49). */
export function lineToInlines(line: TextLine): ArticleInline[] {
  const text = line.text;
  if (text.length === 0) {
    return [];
  }
  const marks = normalizeMarks(line.marks, text.length);
  const links = normalizeLinks(line.links, text.length);
  const cuts = new Set<number>([0, text.length]);
  for (const span of [...marks, ...links]) {
    cuts.add(span.start);
    cuts.add(span.end);
  }
  const points = [...cuts].sort((a, b) => a - b);

  const inlines: ArticleInline[] = [];
  // Il nodo inline_link aperto e il LinkSpan da cui nasce: segmenti dello stesso span vi confluiscono.
  let open: { node: Extract<ArticleInline, { type: "inline_link" }>; span: LinkSpan } | null = null;
  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i];
    const end = points[i + 1];
    const piece: ArticleTextInline = { text: text.slice(start, end), type: "text" };
    const active = marksAt(marks, start, end);
    if (active.length > 0) {
      piece.marks = active;
    }
    const link = links.find((item) => item.start <= start && end <= item.end) ?? null;
    if (!link) {
      open = null;
      inlines.push(piece);
    } else if (open && open.span === link) {
      open.node.content.push(piece);
    } else {
      const node: Extract<ArticleInline, { type: "inline_link" }> = { content: [piece], type: "inline_link", url: link.url };
      open = { node, span: link };
      inlines.push(node);
    }
  }
  return inlines;
}

/** Inline del documento → testo + intervalli. URL non sicuri: il link cade, il testo resta. */
export function inlinesToLine(inlines: ArticleInline[], id: string, kind: TextLineKind): TextLine {
  let text = "";
  const marks: MarkSpan[] = [];
  const links: LinkSpan[] = [];

  const pushText = (inline: ArticleTextInline) => {
    const start = text.length;
    text += inline.text ?? "";
    for (const mark of inline.marks ?? []) {
      if (mark === "bold" || mark === "italic") {
        marks.push({ end: text.length, mark, start });
      }
    }
  };

  for (const inline of inlines ?? []) {
    if (inline.type === "text") {
      pushText(inline);
    } else if (inline.type === "inline_link") {
      const start = text.length;
      for (const child of inline.content ?? []) {
        if (child.type === "text") pushText(child);
      }
      const url = safeLinkUrl(inline.url ?? "");
      if (url && text.length > start) {
        links.push({ end: text.length, start, url });
      }
    }
  }

  return {
    id,
    kind,
    links: normalizeLinks(links, text.length),
    marks: normalizeMarks(marks, text.length),
    text,
  };
}

function listBlockId(firstItemId: string): string {
  return `l${firstItemId}`.slice(0, 40);
}

/**
 * Righe → documento. Le righe vuote non diventano blocchi (nessun paragrafo
 * vuoto salvato); voci consecutive dello stesso tipo formano una lista.
 */
export function linesToDocument(lines: EditorLine[]): ArticleDocument {
  const blocks: ArticleBlock[] = [];
  let currentList: { kind: "bullet" | "numbered"; items: ArticleListItem[]; firstId: string } | null = null;

  const flush = () => {
    if (currentList && currentList.items.length > 0) {
      blocks.push({
        id: listBlockId(currentList.firstId),
        items: currentList.items,
        type: currentList.kind === "bullet" ? "unordered_list" : "ordered_list",
      });
    }
    currentList = null;
  };

  for (const line of lines) {
    if (line.kind === "rich_link") {
      flush();
      blocks.push({ id: line.id, preview: line.preview, snapshot_id: line.snapshotId, type: "rich_link", url: line.url });
      continue;
    }
    if (line.text.trim().length === 0) {
      continue;
    }
    if (line.kind === "bullet" || line.kind === "numbered") {
      const list = currentList as { kind: "bullet" | "numbered"; items: ArticleListItem[]; firstId: string } | null;
      if (!list || list.kind !== line.kind) {
        flush();
        currentList = { firstId: line.id, items: [], kind: line.kind };
      }
      currentList!.items.push({ content: lineToInlines(line), id: line.id });
      continue;
    }
    flush();
    blocks.push({ content: lineToInlines(line), id: line.id, type: line.kind });
  }
  flush();

  return { blocks, v: 1 };
}

/** Documento → righe dell'editor; un documento vuoto apre una riga vuota. */
export function documentToLines(document: ArticleDocument | null | undefined): EditorLine[] {
  const lines: EditorLine[] = [];
  const seen = new Set<string>();
  const safeId = (id: string | undefined) => {
    const value = id && BLOCK_ID_PATTERN.test(id) && !seen.has(id) ? id : newBlockId();
    seen.add(value);
    return value;
  };

  for (const block of document?.blocks ?? []) {
    switch (block.type) {
      case "paragraph":
      case "heading":
        lines.push(inlinesToLine(block.content, safeId(block.id), block.type));
        break;
      case "unordered_list":
      case "ordered_list":
        for (const item of block.items ?? []) {
          lines.push(inlinesToLine(item.content, safeId(item.id), block.type === "unordered_list" ? "bullet" : "numbered"));
        }
        break;
      case "rich_link": {
        const url = safeLinkUrl(block.url ?? "");
        if (url) {
          lines.push({
            id: safeId(block.id),
            kind: "rich_link",
            preview: block.preview ?? null,
            snapshotId: block.snapshot_id ?? null,
            status: block.preview ? "ready" : block.snapshot_id ? "ready" : "failed",
            url,
          });
        }
        break;
      }
      default:
        break;
    }
  }

  return lines.length > 0 ? lines : [emptyTextLine()];
}

/** Il body di un vecchio articolo (testo piano) → documento a paragrafi. */
export function plainTextToDocument(text: string): ArticleDocument {
  const blocks: ArticleBlock[] = text
    .replace(/\r\n?/g, "\n")
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
    .map((paragraph) => ({ content: [{ text: paragraph, type: "text" as const }], id: newBlockId(), type: "paragraph" as const }));
  return { blocks, v: 1 };
}

/* ------------------------------------------------------------------ */
/* Testo, excerpt, validazione                                         */
/* ------------------------------------------------------------------ */

function inlineText(inlines: ArticleInline[]): string {
  return inlines
    .map((inline) =>
      inline.type === "text" ? inline.text : inline.content.map((child) => child.text).join(""),
    )
    .join("");
}

/** Testo piano del documento (§35, §52–§54): blocchi separati da riga vuota, una voce di lista per riga. */
export function documentPlainText(document: ArticleDocument): string {
  const parts: string[] = [];
  for (const block of document.blocks) {
    if (block.type === "paragraph" || block.type === "heading") {
      parts.push(inlineText(block.content));
    } else if (block.type === "unordered_list" || block.type === "ordered_list") {
      parts.push(block.items.map((item) => inlineText(item.content)).join("\n"));
    }
  }
  return parts.filter((part) => part.trim().length > 0).join("\n\n");
}

/** Lunghezza del testo piano: è il limite `max_body_length` (§7R). */
export function documentTextLength(document: ArticleDocument): number {
  return documentPlainText(document).length;
}

const LONG_URL = /\bhttps?:\/\/\S+/gi;

/**
 * §53–§54: excerpt dal primo contenuto significativo, testo piano, senza
 * markup né URL lunghi, troncato a parola. La regola server è la stessa
 * (`footme_article_excerpt`): questa serve all'anteprima.
 */
export function documentExcerpt(document: ArticleDocument, maxLength = 240): string | null {
  for (const block of document.blocks) {
    let text = "";
    if (block.type === "paragraph" || block.type === "heading") {
      text = inlineText(block.content);
    } else if (block.type === "unordered_list" || block.type === "ordered_list") {
      text = block.items.map((item) => inlineText(item.content)).join(" · ");
    }
    const clean = text.replace(LONG_URL, "").replace(/\s+/g, " ").trim();
    if (clean.length >= 2) {
      if (clean.length <= maxLength) {
        return clean;
      }
      const cut = clean.slice(0, maxLength - 1);
      const lastSpace = cut.lastIndexOf(" ");
      return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
    }
  }
  return null;
}

/** §118: un corpo con testo reale (non solo spazi o un rich link). */
export function documentHasText(document: ArticleDocument): boolean {
  return documentPlainText(document).trim().length > 0;
}

export type DocumentLimitIssue = "too_many_blocks" | "block_too_long" | "body_too_long";

/** §7R: gli stessi limiti del server, prima dell'invio. */
export function documentLimitIssue(document: ArticleDocument, limits: ArticleLimits): DocumentLimitIssue | null {
  const blockCount = document.blocks.reduce(
    (total, block) => total + (block.type === "unordered_list" || block.type === "ordered_list" ? block.items.length : 1),
    0,
  );
  if (blockCount > limits.maxBlocks) {
    return "too_many_blocks";
  }
  for (const block of document.blocks) {
    const texts =
      block.type === "paragraph" || block.type === "heading"
        ? [inlineText(block.content)]
        : block.type === "unordered_list" || block.type === "ordered_list"
          ? block.items.map((item) => inlineText(item.content))
          : [];
    if (texts.some((text) => text.length > limits.maxBlockText)) {
      return "block_too_long";
    }
  }
  return documentTextLength(document) > limits.maxBodyLength ? "body_too_long" : null;
}

/** Il documento per l'invio: le preview dei rich link non partono dal client (§68, server ricostruisce). */
export function documentForWire(document: ArticleDocument): ArticleDocument {
  return {
    blocks: document.blocks.map((block) =>
      block.type === "rich_link" ? { id: block.id, snapshot_id: block.snapshot_id, type: "rich_link", url: block.url } : block,
    ),
    v: 1,
  };
}
