import { describe, expect, it } from "vitest";

import {
  activeFormats,
  applyChangeText,
  applyLinkEdit,
  lineSegments,
  linkTarget,
  removeLinkFrom,
  toggleInlineMark,
  toggleKind,
  withScheme,
} from "./article-editing";
import type { EditorLine, TextLine } from "./article-types";

function line(id: string, text: string, extra: Partial<TextLine> = {}): TextLine {
  return { id, kind: "paragraph", links: [], marks: [], text, ...extra };
}

function texts(lines: EditorLine[]): string[] {
  return lines.map((item) => (item.kind === "rich_link" ? `[${item.url}]` : item.text));
}

describe("applyChangeText", () => {
  it("aggiorna il testo senza spezzare", () => {
    const result = applyChangeText([line("a", "Ciao")], "a", "Ciao!");
    expect(texts(result.lines)).toEqual(["Ciao!"]);
    expect(result.focus).toBeNull();
  });

  it("Invio a metà riga la spezza e porta il cursore all'inizio della seconda", () => {
    const result = applyChangeText([line("a", "abcdef")], "a", "abc\ndef");
    expect(texts(result.lines)).toEqual(["abc", "def"]);
    expect(result.focus?.offset).toBe(0);
    expect(result.focus?.id).toBe(result.lines[1].id);
  });

  it("testo incollato su più righe crea più righe", () => {
    const result = applyChangeText([line("a", "")], "a", "uno\ndue\ntre");
    expect(texts(result.lines)).toEqual(["uno", "due", "tre"]);
    expect(result.focus?.id).toBe(result.lines[2].id);
  });

  it("Invio dopo un URL isolato lo trasforma in rich link (§63)", () => {
    const result = applyChangeText([line("a", "https://accomo.it/x")], "a", "https://accomo.it/x\n");
    expect(result.lines[0]).toMatchObject({ kind: "rich_link", url: "https://accomo.it/x" });
    expect(result.lines[1]).toMatchObject({ kind: "paragraph", text: "" });
  });

  it("i marks in attesa valgono per il testo digitato e poi si consumano", () => {
    const result = applyChangeText([line("a", "")], "a", "x", { bold: true });
    const first = result.lines[0] as TextLine;
    expect(first.marks).toEqual([{ end: 1, mark: "bold", start: 0 }]);
    expect(result.pending).toEqual({});
  });

  it("una riga che non esiste (o un rich link) non cambia nulla", () => {
    const lines: EditorLine[] = [{ id: "r", kind: "rich_link", preview: null, snapshotId: null, status: "ready", url: "https://a.it" }];
    expect(applyChangeText(lines, "r", "x").lines).toBe(lines);
    expect(applyChangeText(lines, "zzz", "x").lines).toBe(lines);
  });
});

describe("toggleInlineMark", () => {
  it("con una selezione applica e poi toglie il grassetto", () => {
    const on = toggleInlineMark([line("a", "Ciao mondo")], "a", { end: 4, start: 0 }, "bold");
    expect((on.lines[0] as TextLine).marks).toEqual([{ end: 4, mark: "bold", start: 0 }]);
    const off = toggleInlineMark(on.lines, "a", { end: 4, start: 0 }, "bold");
    expect((off.lines[0] as TextLine).marks).toEqual([]);
  });

  it("a cursore fermo arma il mark per il testo successivo, senza toccare le righe", () => {
    const lines = [line("a", "Ciao")];
    const result = toggleInlineMark(lines, "a", { end: 4, start: 4 }, "italic");
    expect(result.lines).toBe(lines);
    expect(result.pending).toEqual({ italic: true });
    expect(toggleInlineMark(lines, "a", { end: 4, start: 4 }, "italic", result.pending).pending).toEqual({ italic: false });
  });
});

describe("toggleKind e activeFormats", () => {
  it("Aa porta a sezione e un secondo tap torna a paragrafo", () => {
    const once = toggleKind([line("a", "Titolo")], "a", "heading");
    expect(once[0].kind).toBe("heading");
    expect(toggleKind(once, "a", "heading")[0].kind).toBe("paragraph");
  });

  it("riporta i comandi attivi alla posizione del cursore", () => {
    const formats = activeFormats(line("a", "Ciao", { kind: "bullet", marks: [{ end: 4, mark: "bold", start: 0 }] }), { end: 2, start: 2 });
    expect(formats).toMatchObject({ bold: true, bullet: true, heading: false, italic: false, link: false });
  });

  it("senza riga di testo nessun comando è attivo", () => {
    expect(activeFormats(null, { end: 0, start: 0 }).bold).toBe(false);
  });
});

describe("link inline", () => {
  it("collega il testo selezionato", () => {
    const lines = [line("a", "Consulta il comunicato")];
    const target = linkTarget(lines[0], { end: 22, start: 12 });
    expect(target).toEqual({ end: 22, kind: "new", selectedText: "comunicato", start: 12 });
    const next = applyLinkEdit(lines, "a", target!, "comunicato", "https://club.it/c");
    expect((next![0] as TextLine).links).toEqual([{ end: 22, start: 12, url: "https://club.it/c" }]);
  });

  it("senza selezione inserisce testo e link al cursore", () => {
    const lines = [line("a", "Vai ")];
    const target = linkTarget(lines[0], { end: 4, start: 4 });
    const next = applyLinkEdit(lines, "a", target!, "qui", "https://club.it");
    const updated = next![0] as TextLine;
    expect(updated.text).toBe("Vai qui");
    expect(updated.links).toEqual([{ end: 7, start: 4, url: "https://club.it" }]);
  });

  it("rifiuta un URL non sicuro e un testo vuoto", () => {
    const lines = [line("a", "Testo")];
    const target = linkTarget(lines[0], { end: 5, start: 0 })!;
    expect(applyLinkEdit(lines, "a", target, "Testo", "javascript:alert(1)")).toBeNull();
    expect(applyLinkEdit(lines, "a", { end: 0, kind: "new", selectedText: "", start: 0 }, "  ", "https://a.it")).toBeNull();
  });

  it("modifica un link esistente e lo rimuove tenendo il testo (§62)", () => {
    const base = line("a", "Leggi qui ora", { links: [{ end: 9, start: 6, url: "https://a.it" }] });
    const target = linkTarget(base, { end: 7, start: 7 });
    expect(target).toMatchObject({ kind: "edit", text: "qui" });
    const edited = applyLinkEdit([base], "a", target!, "questo", "https://b.it");
    expect((edited![0] as TextLine).text).toBe("Leggi questo ora");
    expect((edited![0] as TextLine).links[0].url).toBe("https://b.it");

    const removed = removeLinkFrom([base], "a", base.links[0]);
    expect((removed[0] as TextLine).links).toEqual([]);
    expect((removed[0] as TextLine).text).toBe("Leggi qui ora");
  });
});

describe("lineSegments", () => {
  it("spezza il testo nei tratti formattati e li ricompone esattamente", () => {
    const base = line("a", "Ciao grande mondo", {
      links: [{ end: 17, start: 12, url: "https://a.it" }],
      marks: [{ end: 11, mark: "bold", start: 5 }],
    });
    const segments = lineSegments(base);
    expect(segments.map((segment) => segment.text).join("")).toBe("Ciao grande mondo");
    expect(segments).toEqual([
      { bold: false, italic: false, link: false, text: "Ciao " },
      { bold: true, italic: false, link: false, text: "grande" },
      { bold: false, italic: false, link: false, text: " " },
      { bold: false, italic: false, link: true, text: "mondo" },
    ]);
  });

  it("una riga vuota non ha tratti", () => {
    expect(lineSegments(line("a", ""))).toEqual([]);
  });
});

describe("withScheme", () => {
  it("aggiunge https a un dominio scritto a mano e lascia stare gli altri schemi", () => {
    expect(withScheme("accomo.it/x")).toBe("https://accomo.it/x");
    expect(withScheme(" https://a.it ")).toBe("https://a.it");
    expect(withScheme("javascript:alert(1)")).toBe("javascript:alert(1)");
    expect(withScheme("")).toBe("");
  });
});
