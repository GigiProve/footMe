import { describe, expect, it } from "vitest";

import { htmlToPlainText, parsePastedArticle, plainTextBlocks } from "./article-paste";
import { DEFAULT_ARTICLE_LIMITS, type ArticleBlock } from "./article-types";

const LIMITS = DEFAULT_ARTICLE_LIMITS;

function shape(blocks: ArticleBlock[]): unknown[] {
  return blocks.map((block) => {
    if (block.type === "paragraph" || block.type === "heading") {
      return [block.type, block.content.map((inline) => (inline.type === "text" ? [inline.text, inline.marks ?? []] : ["link", inline.url, inline.content.map((c) => c.text).join("")]))];
    }
    if (block.type === "unordered_list" || block.type === "ordered_list") {
      return [block.type, block.items.map((item) => item.content.map((inline) => (inline.type === "text" ? inline.text : "")).join(""))];
    }
    return [block.type];
  });
}

describe("testo piano (§7R, 280I)", () => {
  it("ogni riga è un paragrafo, le righe a elenco diventano liste", () => {
    expect(shape(plainTextBlocks("Primo paragrafo\nSecondo\n\n- uno\n- due\n1. a\n2) b\nFine"))).toEqual([
      ["paragraph", [["Primo paragrafo", []]]],
      ["paragraph", [["Secondo", []]]],
      ["unordered_list", ["uno", "due"]],
      ["ordered_list", ["a", "b"]],
      ["paragraph", [["Fine", []]]],
    ]);
  });

  it("senza HTML usa il testo piano", () => {
    const result = parsePastedArticle({ plain: "Riga" }, LIMITS);
    expect(result.ok && shape(result.document.blocks)).toEqual([["paragraph", [["Riga", []]]]]);
  });
});

describe("rich text (280J)", () => {
  it("conserva paragrafi, heading, grassetto, corsivo, liste e link sicuri", () => {
    const html = `
      <h2>Il progetto</h2>
      <p>Siamo <b>felici</b> di <em>presentare</em> il <a href="https://accomo.it/s">piano</a>.</p>
      <ul><li>Uno</li><li>Due <strong>forte</strong></li></ul>
      <ol><li>Primo</li></ol>
      <h3>Seconda sezione</h3>
      <p>Fine</p>`;
    const result = parsePastedArticle({ html, plain: "x" }, LIMITS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.proposedTitle).toBeNull(); // due heading → nessun titolo proposto (§7S)
    expect(shape(result.document.blocks)).toEqual([
      ["heading", [["Il progetto", []]]],
      [
        "paragraph",
        [
          ["Siamo ", []],
          ["felici", ["bold"]],
          [" di ", []],
          ["presentare", ["italic"]],
          [" il ", []],
          ["link", "https://accomo.it/s", "piano"],
          [".", []],
        ],
      ],
      ["unordered_list", ["Uno", "Due forte"]],
      ["ordered_list", ["Primo"]],
      ["heading", [["Seconda sezione", []]]],
      ["paragraph", [["Fine", []]]],
    ]);
    expect(result.removedUnsupported).toBe(false);
  });

  it("legge grassetto e corsivo dallo stile di Google Docs, ignora font e colori", () => {
    const html = `<b style="font-weight:normal" id="docs-internal-guid-1"><p><span style="font-size:11pt;color:#000;font-weight:700">Forte</span><span style="font-style:italic;font-family:Arial"> corsivo</span></p></b>`;
    const result = parsePastedArticle({ html, plain: "" }, LIMITS);
    expect(result.ok && shape(result.document.blocks)).toEqual([["paragraph", [["Forte", ["bold"]], [" corsivo", ["italic"]]]]]);
  });

  it("propone come titolo l'unico heading iniziale e lo toglie dal corpo (§7S)", () => {
    const result = parsePastedArticle({ html: "<h1>Giovani talenti</h1><p>Testo</p>", plain: "" }, LIMITS);
    expect(result.ok && result.proposedTitle).toBe("Giovani talenti");
    expect(result.ok && shape(result.document.blocks)).toEqual([["paragraph", [["Testo", []]]]]);
  });
});

describe("contenuto malevolo e non supportato (280K–280L)", () => {
  it("toglie script, iframe, stili, event handler, pixel e immagini, conserva il testo", () => {
    const html = `<style>p{color:red}</style><script>alert(1)</script>
      <p onclick="steal()">Testo <img src="https://t.it/pixel.gif" width="1"> sicuro</p>
      <iframe src="https://evil.it"></iframe><form><input value="x"></form>
      <p><a href="javascript:alert(1)">cliccami</a> e <a href="data:text/html,x">dati</a></p><!-- commento -->`;
    const result = parsePastedArticle({ html, plain: "" }, LIMITS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.removedUnsupported).toBe(true);
    const json = JSON.stringify(result.document);
    expect(json).not.toMatch(/script|alert|iframe|onclick|pixel|javascript|data:|commento|color/);
    expect(shape(result.document.blocks)).toEqual([
      ["paragraph", [["Testo sicuro", []]]],
      ["paragraph", [["cliccami e dati", []]]],
    ]);
  });

  it("niente HTML nel documento: le entità diventano testo", () => {
    const result = parsePastedArticle({ html: "<p>&lt;b&gt;non grassetto&lt;/b&gt; &amp; c&#39;è</p>", plain: "" }, LIMITS);
    expect(result.ok && shape(result.document.blocks)).toEqual([["paragraph", [["<b>non grassetto</b> & c'è", []]]]]);
  });
});

describe("limiti e ripieghi (280M, §7R)", () => {
  it("rifiuta oltre la dimensione massima degli appunti", () => {
    expect(parsePastedArticle({ plain: "x".repeat(11) }, { ...LIMITS, maxClipboardChars: 10 })).toEqual({ issue: "too_large", ok: false });
  });

  it("rifiuta oltre il numero massimo di blocchi", () => {
    expect(parsePastedArticle({ plain: "a\nb\nc" }, { ...LIMITS, maxBlocks: 2 })).toEqual({ issue: "too_many_blocks", ok: false });
  });

  it("testo vuoto", () => {
    expect(parsePastedArticle({ plain: "  \n " }, LIMITS)).toEqual({ issue: "empty", ok: false });
  });

  it("oltre il tempo concesso ripiega sul testo piano senza perdere contenuto", () => {
    let clock = 0;
    const html = `${"<span>x</span>".repeat(500)}<p>fine</p>`;
    const result = parsePastedArticle({ html, plain: "Testo piano di riserva" }, { ...LIMITS, parseTimeoutMs: 5 }, () => (clock += 10));
    expect(result.ok && result.usedPlainFallback).toBe(true);
    expect(result.ok && shape(result.document.blocks)).toEqual([["paragraph", [["Testo piano di riserva", []]]]]);
  });

  it("htmlToPlainText conserva il testo dei blocchi", () => {
    expect(htmlToPlainText("<p>Uno</p><p>Due<br>Tre</p><script>x</script>")).toBe("Uno\nDue\nTre\n");
  });
});
