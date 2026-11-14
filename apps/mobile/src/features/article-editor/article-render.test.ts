import { describe, expect, it } from "vitest";

import {
  articleBodyKind,
  attributionModel,
  dedupeTitle,
  httpsAssetUrl,
  listMarker,
  markFlags,
  richLinkModel,
  showsAttribution,
  sourceCardModel,
  type RichLinkBlock,
} from "./article-render";

const richLink = (over: Partial<RichLinkBlock> = {}): RichLinkBlock => ({
  id: "b1",
  preview: null,
  snapshot_id: null,
  type: "rich_link",
  url: "https://www.accomo.it/comunicato",
  ...over,
});

describe("liste e marks (§43–§44)", () => {
  it("ogni lista numerata riparte da 1, il punto elenco è fisso", () => {
    expect(listMarker("ordered_list", 0)).toBe("1.");
    expect(listMarker("ordered_list", 11)).toBe("12.");
    expect(listMarker("unordered_list", 3)).toBe("•");
  });

  it("markFlags legge bold e italic e ignora l'assenza", () => {
    expect(markFlags(["bold", "italic"])).toEqual({ bold: true, italic: true });
    expect(markFlags(["italic"])).toEqual({ bold: false, italic: true });
    expect(markFlags(undefined)).toEqual({ bold: false, italic: false });
  });
});

describe("httpsAssetUrl", () => {
  it("accetta solo https e scarta il resto", () => {
    expect(httpsAssetUrl("https://cdn.it/a.jpg")).toBe("https://cdn.it/a.jpg");
    expect(httpsAssetUrl("http://cdn.it/a.jpg")).toBeNull();
    expect(httpsAssetUrl("javascript:alert(1)")).toBeNull();
    expect(httpsAssetUrl("  ")).toBeNull();
    expect(httpsAssetUrl(null)).toBeNull();
  });
});

describe("richLinkModel (§65, §67, §69)", () => {
  it("URL non sicuro → nessuna card", () => {
    expect(richLinkModel(richLink({ url: "javascript:alert(1)" }))).toBeNull();
    expect(richLinkModel(richLink({ url: "data:text/html,x" }))).toBeNull();
    expect(richLinkModel(richLink({ url: "/relativo" }))).toBeNull();
  });

  it("senza preview → fallback con dominio e apertura https", () => {
    const model = richLinkModel(richLink({ url: "http://www.accomo.it/x" }));
    expect(model).toMatchObject({ domain: "accomo.it", href: "https://www.accomo.it/x", variant: "fallback" });
  });

  it("preview vuota (nessun titolo, descrizione, immagine) è come non averla", () => {
    const model = richLinkModel(
      richLink({
        preview: {
          description: "  ",
          domain: "accomo.it",
          favicon_url: "https://accomo.it/f.ico",
          final_url: null,
          image_url: null,
          site_name: "Como",
          title: null,
        },
      }),
    );
    expect(model?.variant).toBe("fallback");
  });

  it("preview con metadata → card con titolo, descrizione, immagine https e dominio", () => {
    const model = richLinkModel(
      richLink({
        preview: {
          description: "Scopri tutti i dettagli",
          domain: "www.accomo.it",
          favicon_url: "http://accomo.it/f.ico",
          final_url: "https://www.accomo.it/comunicato",
          image_url: "https://accomo.it/og.jpg",
          site_name: null,
          title: "Comunicato ufficiale",
        },
      }),
    );
    expect(model).toEqual({
      accessibilityLabel: "Comunicato ufficiale, accomo.it",
      description: "Scopri tutti i dettagli",
      domain: "accomo.it",
      faviconUrl: null,
      href: "https://www.accomo.it/comunicato",
      imageUrl: "https://accomo.it/og.jpg",
      title: "Comunicato ufficiale",
      variant: "card",
    });
  });

  it("solo immagine: card senza titolo, l'etichetta usa il dominio", () => {
    const model = richLinkModel(
      richLink({
        preview: {
          description: null,
          domain: null,
          favicon_url: null,
          final_url: null,
          image_url: "https://accomo.it/og.jpg",
          site_name: null,
          title: null,
        },
      }),
    );
    expect(model).toMatchObject({ accessibilityLabel: "accomo.it", title: null, variant: "card" });
  });
});

describe("sourceCardModel (§7D, §7J, §7K, §54)", () => {
  const source = {
    description: "Scopri il piano tecnico",
    domain: "accomo.it",
    faviconUrl: null,
    imageUrl: "https://accomo.it/og.jpg",
    openUrl: "https://accomo.it/comunicato",
    siteName: "AC Como",
    title: "Comunicato ufficiale",
  };

  it("«Condiviso da», fonte originale e CTA dedicata", () => {
    const model = sourceCardModel(source, "AC Como");
    expect(model.eyebrow).toBe("Condiviso da AC Como");
    expect(model.sourceLine).toBe("Fonte originale · accomo.it");
    expect(model.ctaLabel).toBe("Leggi sul sito originale");
    expect(model.href).toBe("https://accomo.it/comunicato");
  });

  it("niente immagine né descrizione inventate", () => {
    const model = sourceCardModel({ ...source, description: "   ", imageUrl: null, title: null }, "AC Como");
    expect(model.imageUrl).toBeNull();
    expect(model.description).toBeNull();
    expect(model.title).toBeNull();
  });

  it("senza URL (anteprima di una bozza) o con URL non sicuro la CTA non ha destinazione", () => {
    expect(sourceCardModel({ ...source, openUrl: null }, "AC Como").href).toBeNull();
    expect(sourceCardModel({ ...source, openUrl: "javascript:x" }, "AC Como").href).toBeNull();
  });

  it("senza nome del publisher non inventa un'identità", () => {
    expect(sourceCardModel(source, "  ").eyebrow).toBe("Condiviso");
  });
});

describe("articleBodyKind / showsAttribution (§7K, §7U)", () => {
  const document = { blocks: [{ content: [{ text: "Ciao", type: "text" as const }], id: "b1", type: "paragraph" as const }], v: 1 as const };
  const source = {
    description: null,
    domain: "accomo.it",
    faviconUrl: null,
    imageUrl: null,
    openUrl: "https://accomo.it/x",
    siteName: null,
    title: null,
  };

  it("external_link con fonte → card; senza fonte → ripiego storico", () => {
    expect(articleBodyKind({ creationMode: "external_link", document: null, source })).toBe("external");
    expect(articleBodyKind({ creationMode: "external_link", document, source: null })).toBe("none");
  });

  it("native / imported_text con blocchi → documento; documento vuoto o assente → ripiego", () => {
    expect(articleBodyKind({ creationMode: "native", document, source: null })).toBe("document");
    expect(articleBodyKind({ creationMode: "imported_text", document, source: null })).toBe("document");
    expect(articleBodyKind({ creationMode: "native", document: { blocks: [], v: 1 }, source: null })).toBe("none");
    expect(articleBodyKind({ creationMode: "native", document: null, source: null })).toBe("none");
    expect(articleBodyKind(null)).toBe("none");
  });

  it("l'attribuzione compare solo per un testo importato già pubblicato altrove", () => {
    const attribution = { originalAuthor: null, originalUrl: null, publishedElsewhere: true, sourceName: "La Gazzetta" };
    expect(showsAttribution({ attribution, creationMode: "imported_text" })).toBe(true);
    expect(showsAttribution({ attribution: { ...attribution, publishedElsewhere: false }, creationMode: "imported_text" })).toBe(false);
    expect(showsAttribution({ attribution: null, creationMode: "imported_text" })).toBe(false);
    expect(showsAttribution({ attribution, creationMode: "native" })).toBe(false);
  });
});

describe("dedupeTitle", () => {
  it("non ripete il titolo della testata", () => {
    expect(dedupeTitle("Il nuovo progetto", "il nuovo progetto ")).toBeNull();
    expect(dedupeTitle("Comunicato", "Il nuovo progetto")).toBe("Comunicato");
    expect(dedupeTitle(null, "x")).toBeNull();
  });
});

describe("attributionModel (§7U)", () => {
  it("publisher, fonte, autore e link originale sicuro", () => {
    const model = attributionModel({
      originalAuthor: "Luca Verdi",
      originalUrl: "https://www.gazzetta.it/articolo",
      publisherName: "AC Como",
      sourceName: "La Gazzetta",
    });
    expect(model.publishedBy).toBe("Pubblicato da AC Como");
    expect(model.source).toBe("Fonte originale · La Gazzetta");
    expect(model.author).toBe("Autore originale · Luca Verdi");
    expect(model.link).toMatchObject({ href: "https://www.gazzetta.it/articolo" });
  });

  it("autore e link assenti non compaiono; un link non sicuro viene scartato", () => {
    const model = attributionModel({
      originalAuthor: " ",
      originalUrl: "javascript:alert(1)",
      publisherName: "AC Como",
      sourceName: "La Gazzetta",
    });
    expect(model.author).toBeNull();
    expect(model.link).toBeNull();
  });

  it("senza nome fonte non mostra una finta fonte (§7P)", () => {
    expect(attributionModel({ originalAuthor: null, originalUrl: null, publisherName: "AC Como", sourceName: null }).source).toBeNull();
  });
});
