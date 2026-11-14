/**
 * Comandi di editing dell'Articolo sul modello a righe (HOM-06.2 §41–§45,
 * §59–§63, §71, §252). Modulo puro: collega gli eventi di una TextInput per riga
 * (testo cambiato, Invio, selezione, toolbar) alle operazioni di
 * `article-document.ts`, così la logica si prova senza renderizzare nulla.
 *
 *  • testo cambiato: se contiene a-capo (Invio digitato o testo incollato su più
 *    righe) la riga si spezza; il resto è `applyTextChange` con i marks in
 *    attesa (B / I premuti a cursore fermo, §43);
 *  • toolbar: Aa (sezione), B, I, liste, Link — tutti su una riga di testo, mai
 *    su un rich link (§63, §71);
 *  • link inline (§59–§62): selezionare del testo e dare un URL; oppure, senza
 *    selezione, scrivere testo e URL che vengono inseriti al cursore.
 */

import {
  applyTextChange,
  editLink,
  isTextLine,
  linkAt,
  markActiveAt,
  rangeHasMark,
  removeLink,
  setLineKind,
  setLink,
  splitLine,
  toggleMark,
  updateLine,
} from "./article-document";
import type { ArticleMark, EditorLine, LinkSpan, PendingMarks, TextLine, TextLineKind } from "./article-types";

export type TextSelection = { start: number; end: number };

/** Dove mettere il cursore dopo un'operazione che crea o fonde righe. */
export type FocusTarget = { id: string; offset: number };

export type EditResult = { lines: EditorLine[]; focus: FocusTarget | null; pending: PendingMarks };

function textLineById(lines: readonly EditorLine[], lineId: string): TextLine | null {
  const line = lines.find((item) => item.id === lineId);
  return line && isTextLine(line) ? line : null;
}

/**
 * Il testo di una riga è cambiato. Un a-capo non resta mai nel testo di una
 * riga: spezza (§63: Invio dopo un URL isolato lo trasforma in rich link).
 */
export function applyChangeText(
  lines: EditorLine[],
  lineId: string,
  text: string,
  pending: PendingMarks = {},
): EditResult {
  const line = textLineById(lines, lineId);
  if (!line) {
    return { focus: null, lines, pending };
  }

  const parts = text.replace(/\r\n?/g, "\n").split("\n");
  const joined = parts.join("");
  let next = updateLine(lines, applyTextChange(line, joined, pending));

  if (parts.length === 1) {
    return { focus: null, lines: next, pending: joined === line.text ? pending : {} };
  }

  let target = lineId;
  let focus: FocusTarget = { id: lineId, offset: 0 };
  for (let index = 0; index < parts.length - 1; index += 1) {
    const result = splitLine(next, target, parts[index].length);
    next = result.lines;
    target = result.focusId;
    focus = { id: result.focusId, offset: result.focusOffset };
  }
  return { focus, lines: next, pending: {} };
}

/**
 * §43 B / I. Con una selezione il mark si applica o si toglie; a cursore fermo
 * si arma per il testo che verrà digitato.
 */
export function toggleInlineMark(
  lines: EditorLine[],
  lineId: string,
  selection: TextSelection,
  mark: ArticleMark,
  pending: PendingMarks = {},
): { lines: EditorLine[]; pending: PendingMarks } {
  const line = textLineById(lines, lineId);
  if (!line) {
    return { lines, pending };
  }
  if (selection.end > selection.start) {
    return { lines: updateLine(lines, toggleMark(line, selection.start, selection.end, mark)), pending };
  }
  const current = pending[mark] ?? markActiveAt(line, selection.start, mark);
  return { lines, pending: { ...pending, [mark]: !current } };
}

/** §43–§44: Aa e i due bottoni lista; un secondo tap torna a paragrafo. */
export function toggleKind(lines: EditorLine[], lineId: string, kind: TextLineKind): EditorLine[] {
  return setLineKind(lines, lineId, kind);
}

export type ActiveFormats = {
  heading: boolean;
  bold: boolean;
  italic: boolean;
  bullet: boolean;
  numbered: boolean;
  link: boolean;
};

const NO_FORMATS: ActiveFormats = { bold: false, bullet: false, heading: false, italic: false, link: false, numbered: false };

/** Stato dei comandi della toolbar (selezionato ≠ solo colore: `accessibilityState.selected`). */
export function activeFormats(line: EditorLine | null | undefined, selection: TextSelection, pending: PendingMarks = {}): ActiveFormats {
  if (!line || !isTextLine(line)) {
    return NO_FORMATS;
  }
  const marked = (mark: ArticleMark): boolean =>
    selection.end > selection.start
      ? rangeHasMark(line, selection.start, selection.end, mark)
      : (pending[mark] ?? markActiveAt(line, selection.start, mark));
  return {
    bold: marked("bold"),
    bullet: line.kind === "bullet",
    heading: line.kind === "heading",
    italic: marked("italic"),
    link: linkAt(line, selection.start, selection.end) !== null,
    numbered: line.kind === "numbered",
  };
}

/* ------------------------------------------------------------------ */
/* Resa nell'editor                                                    */
/* ------------------------------------------------------------------ */

export type LineSegment = { text: string; bold: boolean; italic: boolean; link: boolean };

/**
 * Il testo di una riga spezzato nei tratti con la stessa formattazione (§43, §60):
 * ciò che la TextInput mostra come figli stilizzati. Il testo è quello della riga,
 * mai modificato: i tratti concatenati lo ricompongono esattamente.
 */
export function lineSegments(line: TextLine): LineSegment[] {
  const length = line.text.length;
  if (length === 0) {
    return [];
  }
  const cuts = new Set<number>([0, length]);
  for (const span of [...line.marks, ...line.links]) {
    cuts.add(Math.min(Math.max(span.start, 0), length));
    cuts.add(Math.min(Math.max(span.end, 0), length));
  }
  const points = [...cuts].sort((a, b) => a - b);

  const segments: LineSegment[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const covers = (span: { start: number; end: number }) => span.start <= start && end <= span.end;
    segments.push({
      bold: line.marks.some((span) => span.mark === "bold" && covers(span)),
      italic: line.marks.some((span) => span.mark === "italic" && covers(span)),
      link: line.links.some(covers),
      text: line.text.slice(start, end),
    });
  }
  return segments;
}

/* ------------------------------------------------------------------ */
/* Link inline                                                         */
/* ------------------------------------------------------------------ */

export type LinkTarget =
  | { kind: "edit"; link: LinkSpan; text: string }
  | { kind: "new"; start: number; end: number; selectedText: string };

/** Cosa apre il bottone Link: un link esistente da modificare, o una selezione (anche vuota) da collegare. */
export function linkTarget(line: EditorLine | null | undefined, selection: TextSelection): LinkTarget | null {
  if (!line || !isTextLine(line)) {
    return null;
  }
  const existing = linkAt(line, selection.start, selection.end);
  if (existing) {
    return { kind: "edit", link: existing, text: line.text.slice(existing.start, existing.end) };
  }
  const start = Math.min(selection.start, selection.end);
  const end = Math.max(selection.start, selection.end);
  return { end, kind: "new", selectedText: line.text.slice(start, end), start };
}

/** `null` se il testo è vuoto o l'URL non è sicuro (§67): il chiamante mostra l'errore nel foglio. */
export function applyLinkEdit(lines: EditorLine[], lineId: string, target: LinkTarget, text: string, rawUrl: string): EditorLine[] | null {
  const line = textLineById(lines, lineId);
  if (!line) {
    return null;
  }

  if (target.kind === "edit") {
    const edited = editLink(line, target.link, text, rawUrl);
    return edited ? updateLine(lines, edited) : null;
  }

  if (text.trim().length === 0) {
    return null;
  }
  const same = text === line.text.slice(target.start, target.end);
  const base = same ? line : applyTextChange(line, `${line.text.slice(0, target.start)}${text}${line.text.slice(target.end)}`);
  const linked = setLink(base, target.start, target.start + text.length, rawUrl);
  return linked ? updateLine(lines, linked) : null;
}

/** §62: toglie il link, il testo resta. */
export function removeLinkFrom(lines: EditorLine[], lineId: string, link: LinkSpan): EditorLine[] {
  const line = textLineById(lines, lineId);
  return line ? updateLine(lines, removeLink(line, link)) : lines;
}

/** Il testo di un'URL scritta a mano: https se manca lo schema, come fa l'utente medio («accomo.it»). */
export function withScheme(input: string): string {
  const value = input.trim();
  if (value.length === 0 || /^[a-z][a-z0-9+.-]*:/i.test(value)) {
    return value;
  }
  return `https://${value}`;
}
