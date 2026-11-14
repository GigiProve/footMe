/**
 * Stato di editing del corpo dell'Articolo (HOM-06.2 §41–§45, §59–§63, §71, §252).
 *
 * Il corpo è una TextInput per riga (vedi `RichLineInput`): la riga con il focus,
 * la selezione al suo interno, i marks in attesa (B / I premuti a cursore fermo) e
 * le richieste di spostare il cursore (dopo Invio o una fusione) vivono qui, fuori
 * dal ScrollView, perché la toolbar sta sopra la tastiera e agisce sulla stessa
 * riga. La logica vera è in `article-editing.ts` (pura, testata): qui si
 * collegano gli eventi allo store.
 *
 * La riga «attiva» resta l'ultima toccata anche dopo il blur: la toolbar in linea
 * (mockup 2–3) funziona a tastiera chiusa, i comandi sono solo dati.
 */

import { useRef, useState } from "react";

import { isTextLine, mergeWithPrevious, orderedIndex } from "./article-document";
import {
  activeFormats,
  applyChangeText,
  applyLinkEdit,
  linkTarget,
  removeLinkFrom,
  toggleInlineMark,
  toggleKind,
  type ActiveFormats,
  type FocusTarget,
  type LinkTarget,
  type TextSelection,
} from "./article-editing";
import { trackArticle } from "./article-analytics";
import { articleStore } from "./article-store";
import type { EditorLine, PendingMarks, TextLineKind } from "./article-types";
import { useArticleStoreState } from "./use-article-store";

export type FocusRequest = FocusTarget & { nonce: number };

export type LinkSheetState = { lineId: string; target: LinkTarget };

type FormatName = "heading" | "bold" | "italic" | "unordered_list" | "ordered_list";

function firstTextId(lines: readonly EditorLine[]): string | null {
  return lines.find(isTextLine)?.id ?? null;
}

function lastTextId(lines: readonly EditorLine[]): string | null {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (isTextLine(lines[index])) return lines[index].id;
  }
  return null;
}

export function useBlockEditing() {
  const { lines } = useArticleStoreState();
  const [active, setActive] = useState<{ id: string | null; selection: TextSelection }>({
    id: null,
    selection: { end: 0, start: 0 },
  });
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingMarks>({});
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [linkSheet, setLinkSheet] = useState<LinkSheetState | null>(null);
  // Dopo un cambio di testo arriva subito un cambio di selezione (il cursore avanza): non deve azzerare i pending.
  const justTyped = useRef(false);
  const nonce = useRef(0);

  const activeId = active.id && lines.some((line) => line.id === active.id) ? active.id : firstTextId(lines);
  const activeLine = lines.find((line) => line.id === activeId) ?? null;

  function requestFocus(target: FocusTarget) {
    nonce.current += 1;
    setFocusRequest({ ...target, nonce: nonce.current });
  }

  function commit(next: EditorLine[]) {
    articleStore.dispatch({ lines: next, type: "linesChanged" });
  }

  function track(format: FormatName) {
    trackArticle({ format, name: "formatting_used" });
  }

  const handlers = {
    onBackspaceAtStart: (id: string) => {
      const result = mergeWithPrevious(articleStore.getState().lines, id);
      if (!result) return;
      commit(result.lines);
      requestFocus({ id: result.focusId, offset: result.focusOffset });
    },
    onBlur: (id: string) => setFocusedId((current) => (current === id ? null : current)),
    onChangeText: (id: string, text: string) => {
      const result = applyChangeText(articleStore.getState().lines, id, text, pending);
      justTyped.current = true;
      commit(result.lines);
      setPending(result.pending);
      if (result.focus) requestFocus(result.focus);
    },
    onFocus: (id: string) => {
      setFocusedId(id);
      setActive((current) => (current.id === id ? current : { id, selection: { end: 0, start: 0 } }));
    },
    onSelection: (id: string, selection: TextSelection) => {
      setActive({ id, selection });
      if (justTyped.current) {
        justTyped.current = false;
      } else if (pending.bold !== undefined || pending.italic !== undefined) {
        setPending({});
      }
    },
  };

  function toggleMark(mark: "bold" | "italic") {
    if (!activeId) return;
    const result = toggleInlineMark(articleStore.getState().lines, activeId, active.selection, mark, pending);
    commit(result.lines);
    setPending(result.pending);
    track(mark);
  }

  function toggleLineKind(kind: TextLineKind, format: FormatName) {
    if (!activeId) return;
    commit(toggleKind(articleStore.getState().lines, activeId, kind));
    track(format);
  }

  const commands = {
    openLink: () => {
      if (!activeId) return;
      const target = linkTarget(articleStore.getState().lines.find((line) => line.id === activeId), active.selection);
      if (target) setLinkSheet({ lineId: activeId, target });
    },
    toggleBold: () => toggleMark("bold"),
    toggleBullet: () => toggleLineKind("bullet", "unordered_list"),
    toggleHeading: () => toggleLineKind("heading", "heading"),
    toggleItalic: () => toggleMark("italic"),
    toggleNumbered: () => toggleLineKind("numbered", "ordered_list"),
  };

  const link = {
    apply: (text: string, url: string): boolean => {
      if (!linkSheet) return false;
      const next = applyLinkEdit(articleStore.getState().lines, linkSheet.lineId, linkSheet.target, text, url);
      if (!next) return false;
      commit(next);
      trackArticle({ name: "inline_link_added" });
      setLinkSheet(null);
      return true;
    },
    close: () => setLinkSheet(null),
    remove: () => {
      if (!linkSheet || linkSheet.target.kind !== "edit") return;
      commit(removeLinkFrom(articleStore.getState().lines, linkSheet.lineId, linkSheet.target.link));
      setLinkSheet(null);
    },
    sheet: linkSheet,
  };

  /** Dal titolo (Invio) al corpo, e il tocco sotto l'ultima riga: il cursore dove si scrive. */
  function focusFirst() {
    const id = firstTextId(articleStore.getState().lines);
    if (id) requestFocus({ id, offset: 0 });
  }

  function focusLast() {
    const state = articleStore.getState();
    const id = lastTextId(state.lines);
    const last = state.lines.find((line) => line.id === id);
    if (id && last && isTextLine(last)) requestFocus({ id, offset: last.text.length });
  }

  const formats: ActiveFormats = activeFormats(activeLine, active.selection, pending);

  return {
    activeId,
    bodyFocused: focusedId !== null,
    clearFocusRequest: () => setFocusRequest(null),
    commands,
    focusFirst,
    focusLast,
    focusRequest,
    formats,
    handlers,
    link,
    orderedIndexOf: (id: string) => orderedIndex(lines, id),
    toolbarEnabled: activeLine !== null && isTextLine(activeLine),
  };
}

export type BlockEditing = ReturnType<typeof useBlockEditing>;
