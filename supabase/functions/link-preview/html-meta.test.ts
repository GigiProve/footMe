import { describe, expect, it } from "vitest";

import {
  cleanAuthor,
  cleanPublishedTime,
  cleanText,
  decodeEntities,
  parseAttributes,
  parseLinkMeta,
  resolveCanonicalUrl,
  resolveHttpsUrl,
  siteKey,
} from "./html-meta.ts";

const BASE = "https://www.example.com/news/articolo-1";

describe("parseLinkMeta (§75)", () => {
  it("legge Open Graph completo e risolve gli URL relativi", () => {
    const html = `<!doctype html><html><head>
      <title>Titolo pagina</title>
      <meta property="og:title" content="Titolo OG &amp; co">
      <meta property="og:description" content="Descrizione &quot;lunga&quot;">
      <meta property="og:image" content="/img/cover.jpg">
      <meta property="og:site_name" content="Esempio News">
      <link rel="icon" href="/fav.png">
    </head><body>ignorato</body></html>`;
    expect(parseLinkMeta(html, BASE)).toEqual({
      title: "Titolo OG & co",
      description: 'Descrizione "lunga"',
      imageUrl: "https://www.example.com/img/cover.jpg",
      faviconUrl: "https://www.example.com/fav.png",
      siteName: "Esempio News",
      canonicalUrl: null,
      author: null,
      publishedTime: null,
    });
  });

  it("ripiega su twitter:*, <title> e meta description", () => {
    const html = `<head><title> Solo  titolo
      tag </title><meta name="description" content="desc normale"><meta name="twitter:image" content="https://cdn.example.com/t.png"></head>`;
    const m = parseLinkMeta(html, BASE);
    expect(m.title).toBe("Solo titolo tag");
    expect(m.description).toBe("desc normale");
    expect(m.imageUrl).toBe("https://cdn.example.com/t.png");
    // nessun <link rel=icon>: ripiego /favicon.ico
    expect(m.faviconUrl).toBe("https://www.example.com/favicon.ico");
  });

  it("scarta immagini e favicon non https (nessun contenuto misto, §78)", () => {
    const html = `<head><meta property="og:image" content="http://insecure.example.com/a.jpg"><link rel="icon" href="http://insecure.example.com/f.ico"><meta property="og:title" content="T"></head>`;
    const m = parseLinkMeta(html, BASE);
    expect(m.imageUrl).toBeNull();
    expect(m.faviconUrl).toBe("https://www.example.com/favicon.ico");
  });

  it("scarta javascript:, data: e URL con spazi", () => {
    const html = `<head><meta property="og:image" content="javascript:alert(1)"><meta property="twitter:image" content="data:image/png;base64,AAAA"></head>`;
    expect(parseLinkMeta(html, BASE).imageUrl).toBeNull();
    expect(resolveHttpsUrl("https://a.example.com/x y", BASE)).toBeNull();
  });

  it("preferisce apple-touch-icon e accetta attributi senza apici o con apici singoli", () => {
    const html = `<head><link rel=icon href=/small.png><link rel='apple-touch-icon' href='/touch.png' sizes='180x180'></head>`;
    expect(parseLinkMeta(html, BASE).faviconUrl).toBe("https://www.example.com/touch.png");
  });

  it("ignora meta dentro commenti, script e style; legge solo l'head", () => {
    const html = `<head><!-- <meta property="og:title" content="commento"> -->
      <script>var x = '<meta property="og:title" content="script">';</script>
      <meta property="og:title" content="Vero"></head>
      <body><meta property="og:description" content="nel body"></body>`;
    const m = parseLinkMeta(html, BASE);
    expect(m.title).toBe("Vero");
    expect(m.description).toBeNull();
  });

  it("il primo og:title vince sui duplicati", () => {
    const html = `<head><meta property="og:title" content="Primo"><meta property="og:title" content="Secondo"></head>`;
    expect(parseLinkMeta(html, BASE).title).toBe("Primo");
  });

  it("non esegue né conserva markup nei testi (§208) e tronca le lunghezze", () => {
    const html = `<head><meta property="og:title" content="&lt;script&gt;alert(1)&lt;/script&gt;Ciao"><meta property="og:description" content="${"x".repeat(900)}"></head>`;
    const m = parseLinkMeta(html, BASE);
    expect(m.title).toBe("alert(1) Ciao");
    expect(m.description!.length).toBeLessThanOrEqual(500);
    expect(m.description!.endsWith("…")).toBe(true);
  });

  it("documento vuoto o senza head → tutto null tranne il ripiego favicon", () => {
    expect(parseLinkMeta("", BASE)).toEqual({
      title: null,
      description: null,
      imageUrl: null,
      faviconUrl: "https://www.example.com/favicon.ico",
      siteName: null,
      canonicalUrl: null,
      author: null,
      publishedTime: null,
    });
    expect(parseLinkMeta("testo senza tag", BASE).title).toBeNull();
  });
});

describe("helper di testo", () => {
  it("decodeEntities: numeriche, esadecimali, nominate, surrogate e fuori range scartate", () => {
    expect(decodeEntities("&#8217;&#x20AC;&amp;&egrave;")).toBe("’€&è");
    expect(decodeEntities("&#xD800;&#0;&#1114112;&sconosciuta;")).toBe("&sconosciuta;");
  });

  it("cleanText: null su vuoto e spazi compressi", () => {
    expect(cleanText("   ", 10)).toBeNull();
    expect(cleanText(null, 10)).toBeNull();
    expect(cleanText(" a \n\t b ", 10)).toBe("a b");
  });

  it("parseAttributes", () => {
    expect(parseAttributes(`<meta property="og:title" content='a "b"' data-x=1 hidden>`)).toEqual({
      property: "og:title",
      content: 'a "b"',
      "data-x": "1",
      hidden: "",
    });
  });
});

describe("canonico, autore e data (HOM-06.2 §7H–§7I)", () => {
  it("legge <link rel=canonical> (anche relativo) e lo preferisce a og:url", () => {
    const html = `<head><link rel="canonical" href="/news/articolo-1?id=3#top"><meta property="og:url" content="https://www.example.com/altro"></head>`;
    expect(parseLinkMeta(html, BASE).canonicalUrl).toBe("https://www.example.com/news/articolo-1?id=3");
    expect(parseLinkMeta(`<head><meta property="og:url" content="https://www.example.com/solo-og"></head>`, BASE).canonicalUrl).toBe(
      "https://www.example.com/solo-og",
    );
  });

  it("canonico: rel con più valori, e il favicon non lo scambia per un'icona", () => {
    const html = `<head><link rel="canonical amphtml" href="https://www.example.com/c"><link rel="icon" href="/i.png"></head>`;
    const m = parseLinkMeta(html, BASE);
    expect(m.canonicalUrl).toBe("https://www.example.com/c");
    expect(m.faviconUrl).toBe("https://www.example.com/i.png");
  });

  it("canonico: scartato se http, di un altro sito, con porta o IP; si prova og:url", () => {
    for (const bad of ["http://www.example.com/a", "https://altro.org/a", "https://www.example.com:8443/a", "https://10.0.0.1/a", "javascript:alert(1)", "data:text/html,x"]) {
      expect(parseLinkMeta(`<head><link rel="canonical" href="${bad}"></head>`, BASE).canonicalUrl, bad).toBeNull();
    }
    const html = `<head><link rel="canonical" href="https://altro.org/a"><meta property="og:url" content="https://www.example.com/buono"></head>`;
    expect(parseLinkMeta(html, BASE).canonicalUrl).toBe("https://www.example.com/buono");
  });

  it("canonico: sottodomini dello stesso sito ammessi (amp.example.com, example.co.uk)", () => {
    expect(resolveCanonicalUrl("https://example.com/a", "https://amp.example.com/a")).toBe("https://example.com/a");
    expect(resolveCanonicalUrl("https://news.bbc.co.uk/a", "https://www.bbc.co.uk/x")).toBe("https://news.bbc.co.uk/a");
    expect(resolveCanonicalUrl("https://evil.co.uk/a", "https://www.bbc.co.uk/x")).toBeNull();
    expect(siteKey("a.b.example.com")).toBe("example.com");
    expect(siteKey("www.bbc.co.uk")).toBe("bbc.co.uk");
  });

  it("autore: meta author o article:author testuali, mai un URL; passa al candidato successivo", () => {
    expect(parseLinkMeta(`<head><meta name="author" content="Mario  Rossi"></head>`, BASE).author).toBe("Mario Rossi");
    expect(parseLinkMeta(`<head><meta property="article:author" content="https://facebook.com/mario"></head>`, BASE).author).toBeNull();
    const html = `<head><meta name="author" content="https://example.com/profilo"><meta property="article:author" content="Anna Verdi"></head>`;
    expect(parseLinkMeta(html, BASE).author).toBe("Anna Verdi");
    expect(cleanAuthor("www.example.com/a")).toBeNull();
    expect(cleanAuthor("<b>Luca</b> Bianchi")).toBe("Luca Bianchi");
    expect(cleanAuthor("x".repeat(500))!.length).toBeLessThanOrEqual(200);
  });

  it("data: article:published_time ISO riscritto in UTC; valori non validi → null", () => {
    expect(parseLinkMeta(`<head><meta property="article:published_time" content="2026-11-13T10:30:00+01:00"></head>`, BASE).publishedTime).toBe(
      "2026-11-13T09:30:00.000Z",
    );
    for (const bad of ["ieri", "", "2026-13-45", "1850-01-01", "9999-01-01T00:00:00Z", "2026-11-13T25:00:00"]) {
      expect(cleanPublishedTime(bad), bad).toBeNull();
    }
    expect(cleanPublishedTime("2026-11-13")).toBe("2026-11-13T00:00:00.000Z");
  });
});

describe("canonico banale (HOM-06.2 §7M)", () => {
  it("la home come canonico di una pagina con percorso non si usa; si prova og:url o resta null", () => {
    expect(resolveCanonicalUrl("https://www.example.com/", BASE)).toBeNull();
    expect(resolveCanonicalUrl("https://www.example.com", BASE)).toBeNull();
    expect(parseLinkMeta(`<head><link rel="canonical" href="https://www.example.com/"></head>`, BASE).canonicalUrl).toBeNull();
    const html = `<head><link rel="canonical" href="https://www.example.com/"><meta property="og:url" content="https://www.example.com/news/articolo-1"></head>`;
    expect(parseLinkMeta(html, BASE).canonicalUrl).toBe("https://www.example.com/news/articolo-1");
  });

  it("canonico banale ammesso quando la pagina stessa è la home; con query non è banale", () => {
    expect(resolveCanonicalUrl("https://www.example.com/", "https://www.example.com/")).toBe("https://www.example.com/");
    expect(resolveCanonicalUrl("https://www.example.com/?id=3", BASE)).toBe("https://www.example.com/?id=3");
    expect(resolveCanonicalUrl("https://www.example.com/news/x", BASE)).toBe("https://www.example.com/news/x");
  });
});
