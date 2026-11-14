import { describe, expect, it } from "vitest";

import {
  applyTextChange,
  documentExcerpt,
  documentForWire,
  documentLimitIssue,
  documentPlainText,
  documentToLines,
  editLink,
  emptyTextLine,
  inlinesToLine,
  isTextLine,
  lineToInlines,
  linesToDocument,
  mergeWithPrevious,
  orderedIndex,
  plainTextToDocument,
  rangeHasMark,
  removeLine,
  safeLinkUrl,
  setLineKind,
  setLink,
  splitLine,
  standaloneUrl,
  toggleMark,
} from "./article-document";
import { DEFAULT_ARTICLE_LIMITS, type ArticleDocument, type EditorLine, type TextLine } from "./article-types";

function line(text: string, extra: Partial<TextLine> = {}): TextLine {
  return { id: extra.id ?? "l1", kind: extra.kind ?? "paragraph", links: extra.links ?? [], marks: extra.marks ?? [], text };
}

describe("safeLinkUrl (§67, §7G)", () => {
  it("accetta https, riscrive http e rifiuta gli schemi pericolosi", () => {
    expect(safeLinkUrl("https://accomo.it/news")).toBe("https://accomo.it/news");
    expect(safeLinkUrl("http://accomo.it")).toBe("https://accomo.it");
    expect(safeLinkUrl("javascript:alert(1)")).toBeNull();
    expect(safeLinkUrl("data:text/html,x")).toBeNull();
    expect(safeLinkUrl("file:///etc/passwd")).toBeNull();
    expect(safeLinkUrl("prolink://x")).toBeNull();
    expect(safeLinkUrl("https://user@host.it")).toBeNull();
    expect(safeLinkUrl("/relativo")).toBeNull();
  });

  it("riconosce una riga fatta solo di URL (§63)", () => {
    expect(standaloneUrl("  https://accomo.it/x  ")).toBe("https://accomo.it/x");
    expect(standaloneUrl("vedi https://accomo.it")).toBeNull();
  });
});

describe("applyTextChange", () => {
  it("il testo digitato alla fine di un grassetto resta grassetto", () => {
    const bold = line("Ciao", { marks: [{ end: 4, mark: "bold", start: 0 }] });
    const next = applyTextChange(bold, "Ciao!");
    expect(next.marks).toEqual([{ end: 5, mark: "bold", start: 0 }]);
  });

  it("il testo digitato all'inizio di un grassetto non lo eredita", () => {
    const bold = line("Ciao", { marks: [{ end: 4, mark: "bold", start: 0 }] });
    const next = applyTextChange(bold, "«Ciao");
    expect(next.marks).toEqual([{ end: 5, mark: "bold", start: 1 }]);
  });

  it("un link non si estende digitando dopo la sua fine e si sposta con il testo", () => {
    const linked = line("Leggi qui", { links: [{ end: 9, start: 6, url: "https://accomo.it" }] });
    expect(applyTextChange(linked, "Leggi qui.").links).toEqual([{ end: 9, start: 6, url: "https://accomo.it" }]);
    expect(applyTextChange(linked, "Ora leggi qui").links).toEqual([{ end: 13, start: 10, url: "https://accomo.it" }]);
  });

  it("cancellare tutto il testo di un intervallo lo elimina", () => {
    const bold = line("ab XY cd", { marks: [{ end: 5, mark: "bold", start: 3 }] });
    expect(applyTextChange(bold, "ab  cd").marks).toEqual([]);
  });

  it("i marks in attesa valgono per il testo inserito (B con cursore fermo)", () => {
    const plain = line("Ciao ");
    const next = applyTextChange(plain, "Ciao mondo", { bold: true });
    expect(next.marks).toEqual([{ end: 10, mark: "bold", start: 5 }]);
  });
});

describe("toggleMark e link", () => {
  it("applica e poi toglie il grassetto su una selezione", () => {
    const base = line("Prima squadra");
    const bold = toggleMark(base, 0, 5, "bold");
    expect(rangeHasMark(bold, 0, 5, "bold")).toBe(true);
    expect(toggleMark(bold, 0, 5, "bold").marks).toEqual([]);
  });

  it("aggiunge, modifica e rimuove un link inline mantenendo il testo (§59–§62)", () => {
    const base = line("Consulta il comunicato ufficiale");
    const linked = setLink(base, 12, 32, "accomo.it/x");
    expect(linked).toBeNull();
    const ok = setLink(base, 12, 32, "https://accomo.it/x")!;
    expect(ok.links).toEqual([{ end: 32, start: 12, url: "https://accomo.it/x" }]);

    const edited = editLink(ok, ok.links[0], "comunicato", "https://accomo.it/y")!;
    expect(edited.text).toBe("Consulta il comunicato");
    expect(edited.links).toEqual([{ end: 22, start: 12, url: "https://accomo.it/y" }]);
  });
});

describe("righe ⇄ documento (§49–§50)", () => {
  it("serializza marks, link e liste con id stabili e senza righe vuote", () => {
    const lines: EditorLine[] = [
      line("Titolo sezione", { id: "h", kind: "heading" }),
      line("Siamo felici della stagione 2026/2027.", {
        id: "p",
        links: [{ end: 37, start: 28, url: "https://accomo.it" }],
        marks: [{ end: 5, mark: "bold", start: 0 }],
      }),
      line("", { id: "vuota" }),
      line("uno", { id: "a", kind: "bullet" }),
      line("due", { id: "b", kind: "bullet" }),
      line("primo", { id: "c", kind: "numbered" }),
      { id: "r", kind: "rich_link", preview: null, snapshotId: "s1", status: "ready", url: "https://accomo.it/c" },
    ];
    const doc = linesToDocument(lines);
    expect(doc.blocks.map((block) => block.type)).toEqual(["heading", "paragraph", "unordered_list", "ordered_list", "rich_link"]);
    const paragraph = doc.blocks[1];
    expect(paragraph.type === "paragraph" && paragraph.content).toEqual([
      { marks: ["bold"], text: "Siamo", type: "text" },
      { text: " felici della stagione ", type: "text" },
      { content: [{ text: "2026/2027", type: "text" }], type: "inline_link", url: "https://accomo.it" },
      { text: ".", type: "text" },
    ]);

    const back = documentToLines(doc);
    expect(back.map((item) => item.id)).toEqual(["h", "p", "a", "b", "c", "r"]);
    expect(linesToDocument(back)).toEqual(doc);
  });

  it("un link che attraversa un grassetto resta un solo inline_link", () => {
    const value = line("abcdef", { links: [{ end: 6, start: 0, url: "https://x.it" }], marks: [{ end: 3, mark: "bold", start: 0 }] });
    const inlines = lineToInlines(value);
    expect(inlines).toHaveLength(1);
    expect(inlinesToLine(inlines, "z", "paragraph")).toEqual({ ...value, id: "z" });
  });

  it("scarta i link con URL non sicuri ma conserva il testo", () => {
    const parsed = inlinesToLine([{ content: [{ text: "clicca", type: "text" }], type: "inline_link", url: "javascript:x" }], "q", "paragraph");
    expect(parsed.text).toBe("clicca");
    expect(parsed.links).toEqual([]);
  });

  it("un documento vuoto apre una riga vuota e il testo legacy diventa paragrafi", () => {
    expect(documentToLines({ blocks: [], v: 1 })).toHaveLength(1);
    expect(plainTextToDocument("Uno\n\nDue\n").blocks).toHaveLength(2);
  });

  it("non invia le preview dei rich link (le ricostruisce il server, §68)", () => {
    const doc: ArticleDocument = {
      blocks: [{ id: "r", preview: { description: "x", domain: "a.it", favicon_url: null, final_url: null, image_url: null, site_name: null, title: "t" }, snapshot_id: "s", type: "rich_link", url: "https://a.it" }],
      v: 1,
    };
    expect(documentForWire(doc).blocks[0]).toEqual({ id: "r", snapshot_id: "s", type: "rich_link", url: "https://a.it" });
  });
});

describe("operazioni sulle righe", () => {
  it("Invio divide la riga; dopo una sezione si riparte da un paragrafo", () => {
    const lines: EditorLine[] = [line("Titolo e resto", { id: "h", kind: "heading" })];
    const split = splitLine(lines, "h", 6);
    expect(split.lines.map((item) => (isTextLine(item) ? [item.kind, item.text] : []))).toEqual([
      ["heading", "Titolo"],
      ["paragraph", " e resto"],
    ]);
    expect(split.focusId).toBe(split.lines[1].id);
  });

  it("Invio su una voce vuota esce dalla lista", () => {
    const split = splitLine([line("", { id: "x", kind: "bullet" })], "x", 0);
    expect((split.lines[0] as TextLine).kind).toBe("paragraph");
  });

  it("Invio su una riga con solo un URL crea un rich link (§63)", () => {
    const split = splitLine([line("https://accomo.it/c", { id: "u" })], "u", 19);
    expect(split.lines[0]).toMatchObject({ kind: "rich_link", status: "loading", url: "https://accomo.it/c" });
    expect(split.lines).toHaveLength(2);
  });

  it("Backspace fonde con la riga precedente spostando marks e link", () => {
    const lines: EditorLine[] = [line("Ab", { id: "1" }), line("cd", { id: "2", marks: [{ end: 2, mark: "italic", start: 0 }] })];
    const merged = mergeWithPrevious(lines, "2")!;
    expect(merged.lines).toEqual([line("Abcd", { id: "1", marks: [{ end: 4, mark: "italic", start: 2 }] })]);
    expect(merged.focusOffset).toBe(2);
  });

  it("Backspace non tocca un rich link precedente (§71)", () => {
    const lines: EditorLine[] = [
      { id: "r", kind: "rich_link", preview: null, snapshotId: null, status: "failed", url: "https://a.it" },
      line("testo", { id: "t" }),
    ];
    expect(mergeWithPrevious(lines, "t")).toBeNull();
    expect(removeLine(lines, "r")).toEqual([lines[1]]);
    expect(removeLine([lines[0]], "r")).toHaveLength(1);
  });

  it("Aa alterna paragrafo e sezione, i bottoni lista alternano la lista", () => {
    const lines: EditorLine[] = [line("x", { id: "1" })];
    const heading = setLineKind(lines, "1", "heading");
    expect((heading[0] as TextLine).kind).toBe("heading");
    expect((setLineKind(heading, "1", "heading")[0] as TextLine).kind).toBe("paragraph");
    expect((setLineKind(lines, "1", "numbered")[0] as TextLine).kind).toBe("numbered");
  });

  it("numera le voci nel loro gruppo", () => {
    const lines: EditorLine[] = [
      line("a", { id: "1", kind: "numbered" }),
      line("b", { id: "2", kind: "numbered" }),
      line("p", { id: "3" }),
      line("c", { id: "4", kind: "numbered" }),
    ];
    expect(orderedIndex(lines, "2")).toBe(2);
    expect(orderedIndex(lines, "4")).toBe(1);
  });
});

describe("testo, excerpt e limiti (§52–§54, §7R)", () => {
  const doc = linesToDocument([
    line("", { id: "0" }),
    line("Siamo felici di presentare il nuovo progetto https://accomo.it/lungo/url/che/non/serve tecnico.", { id: "1" }),
    line("uno", { id: "2", kind: "bullet" }),
    line("due", { id: "3", kind: "bullet" }),
  ]);

  it("testo piano con le voci di lista una per riga", () => {
    expect(documentPlainText(doc)).toBe(
      "Siamo felici di presentare il nuovo progetto https://accomo.it/lungo/url/che/non/serve tecnico.\n\nuno\ndue",
    );
  });

  it("excerpt senza URL lunghi e troncato a parola", () => {
    expect(documentExcerpt(doc)).toBe("Siamo felici di presentare il nuovo progetto tecnico.");
    expect(documentExcerpt(doc, 20)).toBe("Siamo felici di…");
    expect(documentExcerpt({ blocks: [], v: 1 })).toBeNull();
  });

  it("applica gli stessi limiti del server", () => {
    expect(documentLimitIssue(doc, DEFAULT_ARTICLE_LIMITS)).toBeNull();
    expect(documentLimitIssue(doc, { ...DEFAULT_ARTICLE_LIMITS, maxBlocks: 2 })).toBe("too_many_blocks");
    expect(documentLimitIssue(doc, { ...DEFAULT_ARTICLE_LIMITS, maxBlockText: 10 })).toBe("block_too_long");
    expect(documentLimitIssue(doc, { ...DEFAULT_ARTICLE_LIMITS, maxBodyLength: 20 })).toBe("body_too_long");
  });

  it("una riga vuota nuova ha id valido", () => {
    expect(emptyTextLine().id).toMatch(/^[A-Za-z0-9_-]{1,40}$/);
  });
});
