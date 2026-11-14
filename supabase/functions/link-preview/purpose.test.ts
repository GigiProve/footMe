import { describe, expect, it } from "vitest";

import type { LinkMeta } from "./html-meta.ts";
import { hasUsableMetadata, parsePurpose, remembersNoMetadata, shouldPersistSnapshot } from "./purpose.ts";

const EMPTY: LinkMeta = {
  title: null,
  description: null,
  imageUrl: null,
  faviconUrl: "https://example.com/favicon.ico",
  siteName: null,
  canonicalUrl: null,
  author: null,
  publishedTime: null,
};

describe("parsePurpose (HOM-06.2)", () => {
  it("default 'post': assente, sconosciuto o di tipo sbagliato (il client di HOM-06.1 non manda purpose)", () => {
    for (const v of [undefined, null, "", "POST", "article", 3, {}, ["article_source"]]) {
      expect(parsePurpose(v), String(v)).toBe("post");
    }
  });

  it("riconosce article_source e rich_link", () => {
    expect(parsePurpose("article_source")).toBe("article_source");
    expect(parsePurpose("rich_link")).toBe("rich_link");
    expect(parsePurpose("post")).toBe("post");
  });
});

describe("snapshot per scopo", () => {
  it("una pagina senza metadata: nessuno snapshot per Post e rich link, snapshot per la fonte di un Articolo (§7L)", () => {
    expect(hasUsableMetadata(EMPTY)).toBe(false);
    expect(shouldPersistSnapshot("post", EMPTY)).toBe(false);
    expect(shouldPersistSnapshot("rich_link", EMPTY)).toBe(false);
    expect(shouldPersistSnapshot("article_source", EMPTY)).toBe(true);
  });

  it("con anche un solo metadata utile si salva per ogni scopo", () => {
    for (const meta of [{ ...EMPTY, title: "T" }, { ...EMPTY, description: "D" }, { ...EMPTY, imageUrl: "https://example.com/i.jpg" }]) {
      expect(hasUsableMetadata(meta)).toBe(true);
      for (const p of ["post", "rich_link", "article_source"] as const) {
        expect(shouldPersistSnapshot(p, meta), p).toBe(true);
      }
    }
  });

  it("il solo favicon, il canonico o l'autore non sono metadata da mostrare", () => {
    expect(hasUsableMetadata({ ...EMPTY, canonicalUrl: "https://example.com/a", author: "A" })).toBe(false);
  });

  it("«senza metadata» si ricorda come fallimento solo se lo scopo non lo accetta", () => {
    expect(remembersNoMetadata("post")).toBe(true);
    expect(remembersNoMetadata("rich_link")).toBe(true);
    expect(remembersNoMetadata("article_source")).toBe(false);
  });
});
