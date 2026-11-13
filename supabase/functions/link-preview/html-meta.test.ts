import { describe, expect, it } from "vitest";

import { cleanText, decodeEntities, parseAttributes, parseLinkMeta, resolveHttpsUrl } from "./html-meta.ts";

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
    expect(parseLinkMeta("", BASE)).toEqual({ title: null, description: null, imageUrl: null, faviconUrl: "https://www.example.com/favicon.ico", siteName: null });
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
