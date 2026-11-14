import { describe, expect, it } from "vitest";

import { linesToDocument } from "./article-document";
import {
  articleBlocker,
  availableModes,
  defaultIdentityId,
  defaultMode,
  effectiveTitle,
  EMPTY_PROVENANCE,
  isSignificantArticle,
  modeChangeLosses,
  modeEntry,
  needsManualTitle,
  publisherLine,
  rightsNeedReconfirm,
  sourceLine,
  type ArticleDraftState,
} from "./article-presentation";
import { DEFAULT_ARTICLE_LIMITS } from "./article-types";

const body = linesToDocument([{ id: "p", kind: "paragraph", links: [], marks: [], text: "Testo dell'articolo" }]);

function state(extra: Partial<ArticleDraftState> = {}): ArticleDraftState {
  return {
    cover: null,
    document: { blocks: [], v: 1 },
    manualTitle: "",
    mode: "native",
    provenance: EMPTY_PROVENANCE,
    rightsConfirmed: false,
    source: { status: "empty" },
    tagCount: 0,
    title: "",
    ...extra,
  };
}

const READY = {
  canonicalUrl: null,
  domain: "accomo.it",
  finalUrl: "https://accomo.it/a",
  normalizedUrl: "https://accomo.it/a",
  siteName: "AC Como",
  snapshot: { author: null, description: null, favicon_url: null, image_url: null, published_time: null, site_name: "AC Como", title: null },
  snapshotId: "s1",
  status: "ready" as const,
  url: "https://accomo.it/a",
};

describe("modalità (§7A–§7B, 280A–280B)", () => {
  it("solo le modalità autorizzate, nell'ordine del selector", () => {
    expect(availableModes([{ modes: ["imported_text"] }, { modes: ["native", "imported_text"] }])).toEqual([
      "native",
      "imported_text",
    ]);
  });

  it("selector solo con due o più modalità, altrimenti fast path", () => {
    expect(modeEntry(["native", "external_link"])).toEqual({ kind: "selector" });
    expect(modeEntry(["external_link"])).toEqual({ kind: "direct", mode: "external_link" });
    expect(modeEntry([])).toEqual({ kind: "none" });
  });

  it("default Scrivi su PROLINK salvo ripristino", () => {
    expect(defaultMode(["native", "external_link"])).toBe("native");
    expect(defaultMode(["native", "external_link"], "external_link")).toBe("external_link");
    expect(defaultMode(["imported_text"])).toBe("imported_text");
  });
});

describe("identity di default (§21–§23)", () => {
  const ids = [{ id: "como" }, { id: "news" }];
  it("contestuale → ultima → prima; mai una non autorizzata", () => {
    expect(defaultIdentityId(ids, { contextual: "news", last: "como" })).toBe("news");
    expect(defaultIdentityId(ids, { contextual: "altro", last: "como" })).toBe("como");
    expect(defaultIdentityId(ids, { contextual: "altro" })).toBe("como");
    expect(defaultIdentityId([], {})).toBeNull();
  });
});

describe("bloccanti di Pubblica/Programma", () => {
  it("NATIVE: titolo obbligatorio (§32, 275), cover facoltativa (§37, 276)", () => {
    expect(articleBlocker(state({ document: body }), DEFAULT_ARTICLE_LIMITS)).toBe("missing_title");
    expect(articleBlocker(state({ document: body, title: "Il nuovo progetto" }), DEFAULT_ARTICLE_LIMITS)).toBeNull();
    expect(articleBlocker(state({ title: "Solo titolo" }), DEFAULT_ARTICLE_LIMITS)).toBe("empty_body");
    expect(articleBlocker(state({ document: body, title: "x".repeat(161) }), DEFAULT_ARTICLE_LIMITS)).toBe("title_too_long");
  });

  it("EXTERNAL_LINK: URL validato e titolo da metadata o manuale (§7J, §7L, 280E)", () => {
    expect(articleBlocker(state({ mode: "external_link" }), DEFAULT_ARTICLE_LIMITS)).toBe("source_missing");
    expect(
      articleBlocker(state({ mode: "external_link", source: { domain: "a.it", reason: "unavailable", status: "failed", url: "https://a.it" } }), DEFAULT_ARTICLE_LIMITS),
    ).toBe("source_invalid");
    const noTitle = state({ mode: "external_link", source: READY });
    expect(needsManualTitle(noTitle)).toBe(true);
    expect(articleBlocker(noTitle, DEFAULT_ARTICLE_LIMITS)).toBe("missing_title");
    expect(articleBlocker({ ...noTitle, manualTitle: "Comunicato" }, DEFAULT_ARTICLE_LIMITS)).toBeNull();
    const withMeta = state({ mode: "external_link", source: { ...READY, snapshot: { ...READY.snapshot, title: "Dai metadata" } } });
    expect(effectiveTitle(withMeta)).toBe("Dai metadata");
    expect(articleBlocker(withMeta, DEFAULT_ARTICLE_LIMITS)).toBeNull();
  });

  it("IMPORTED_TEXT: origine, fonte, link e diritti (§7P–§7Q, 280N)", () => {
    const base = state({ document: body, mode: "imported_text", title: "Intervista" });
    expect(articleBlocker(base, DEFAULT_ARTICLE_LIMITS)).toBe("provenance_choice");
    const notPublished = { ...base, provenance: { ...EMPTY_PROVENANCE, publishedElsewhere: false } };
    expect(articleBlocker(notPublished, DEFAULT_ARTICLE_LIMITS)).toBe("rights");
    expect(articleBlocker({ ...notPublished, rightsConfirmed: true }, DEFAULT_ARTICLE_LIMITS)).toBeNull();

    const published = { ...base, provenance: { ...EMPTY_PROVENANCE, publishedElsewhere: true }, rightsConfirmed: true };
    expect(articleBlocker(published, DEFAULT_ARTICLE_LIMITS)).toBe("provenance_source");
    const withSource = { ...published, provenance: { ...published.provenance, sourceName: "Corriere" } };
    expect(articleBlocker(withSource, DEFAULT_ARTICLE_LIMITS)).toBe("provenance_link");
    expect(articleBlocker({ ...withSource, provenance: { ...withSource.provenance, noOriginalLink: true } }, DEFAULT_ARTICLE_LIMITS)).toBeNull();
  });
});

describe("bozza significativa (§118)", () => {
  it("il selector aperto o l'editor vuoto non sono una bozza", () => {
    expect(isSignificantArticle(state())).toBe(false);
    expect(isSignificantArticle(state({ mode: "external_link" }))).toBe(false);
  });

  it("titolo, corpo, cover, tag o URL validato lo sono", () => {
    expect(isSignificantArticle(state({ title: "T" }))).toBe(true);
    expect(isSignificantArticle(state({ document: body }))).toBe(true);
    expect(isSignificantArticle(state({ tagCount: 1 }))).toBe(true);
    expect(isSignificantArticle(state({ mode: "external_link", source: READY }))).toBe(true);
  });
});

describe("diritti, cambio modalità, attribuzione", () => {
  it("riconferma quando cambiano identity o fonte (§7Q, 280O)", () => {
    const before = { identityId: "como", provenance: { ...EMPTY_PROVENANCE, publishedElsewhere: true, sourceName: "A" } };
    expect(rightsNeedReconfirm(before, before)).toBe(false);
    expect(rightsNeedReconfirm(before, { ...before, identityId: "news" })).toBe(true);
    expect(rightsNeedReconfirm(before, { ...before, provenance: { ...before.provenance, sourceName: "B" } })).toBe(true);
  });

  it("spiega i dati non conservati dal cambio modalità (§7X)", () => {
    expect(modeChangeLosses(state({ document: body }), "external_link")).toEqual(["il testo dell'articolo"]);
    expect(modeChangeLosses(state({ mode: "external_link", source: READY }), "native")).toEqual([
      "il link della fonte e la sua anteprima",
    ]);
    expect(modeChangeLosses(state(), "native")).toEqual([]);
  });

  it("publisher e fonte restano distinti (§7D, §7U)", () => {
    expect(publisherLine("external_link", "AC Como", false)).toBe("Condiviso da AC Como");
    expect(publisherLine("imported_text", "AC Como", true)).toBe("Pubblicato da AC Como");
    expect(publisherLine("imported_text", "AC Como", false)).toBeNull();
    expect(publisherLine("native", "AC Como", false)).toBeNull();
    expect(sourceLine("accomo.it")).toBe("Fonte originale · accomo.it");
  });
});
