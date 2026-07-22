import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchLinkPreview, normalizeLinkUrl } from "./link-preview";

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetchHtml(html: string, ok = true) {
  return vi.fn(async () => ({
    ok,
    text: async () => html,
  })) as unknown as typeof fetch;
}

describe("normalizeLinkUrl", () => {
  it("keeps absolute http(s) urls", () => {
    expect(normalizeLinkUrl("https://gazzetta.it/articolo")).toBe(
      "https://gazzetta.it/articolo",
    );
  });

  it("prefixes bare domains with https", () => {
    expect(normalizeLinkUrl("www.gazzetta.it/x")).toBe("https://www.gazzetta.it/x");
    expect(normalizeLinkUrl("gazzetta.it/x")).toBe("https://gazzetta.it/x");
  });

  it("returns null for non-urls and empty input", () => {
    expect(normalizeLinkUrl("   ")).toBeNull();
    expect(normalizeLinkUrl("just words")).toBeNull();
  });
});

describe("fetchLinkPreview", () => {
  it("extracts Open Graph metadata from the page", async () => {
    const html = `
      <html><head>
        <meta property="og:title" content="Marco Rossi, il talento Under 19" />
        <meta property="og:description" content="Piace ai club lombardi." />
        <meta property="og:image" content="https://cdn.gazzetta.it/cover.jpg" />
        <meta property="og:site_name" content="Gazzetta dello Sport" />
        <meta property="article:author" content="Luca Verdi" />
        <title>Fallback</title>
      </head></html>`;
    vi.stubGlobal("fetch", mockFetchHtml(html));

    const preview = await fetchLinkPreview("gazzetta.it/articolo");

    expect(preview).toMatchObject({
      author: "Luca Verdi",
      description: "Piace ai club lombardi.",
      imageUrl: "https://cdn.gazzetta.it/cover.jpg",
      siteName: "Gazzetta dello Sport",
      title: "Marco Rossi, il talento Under 19",
      url: "https://gazzetta.it/articolo",
    });
  });

  it("falls back to the <title> and resolves relative og:image", async () => {
    const html = `
      <head>
        <meta name="twitter:image" content="/img/cover.png" />
        <title>Solo titolo &amp; co</title>
      </head>`;
    vi.stubGlobal("fetch", mockFetchHtml(html));

    const preview = await fetchLinkPreview("https://example.com/news");

    expect(preview.title).toBe("Solo titolo & co");
    expect(preview.imageUrl).toBe("https://example.com/img/cover.png");
    expect(preview.siteName).toBe("example.com");
  });

  it("degrades gracefully when the request is not ok", async () => {
    vi.stubGlobal("fetch", mockFetchHtml("", false));

    const preview = await fetchLinkPreview("https://blocked.example/x");

    expect(preview.title).toBeNull();
    expect(preview.siteName).toBe("blocked.example");
    expect(preview.url).toBe("https://blocked.example/x");
  });

  it("returns a safe fallback for invalid urls", async () => {
    const preview = await fetchLinkPreview("not a url");
    expect(preview.title).toBeNull();
    expect(preview.url).toBe("not a url");
  });
});
