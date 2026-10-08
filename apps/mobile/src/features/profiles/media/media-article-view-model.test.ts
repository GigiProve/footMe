import { describe, expect, it } from "vitest";

import type { MediaProfilePost } from "../media-profile-post-service";
import {
  buildMediaArticleAccessibilityLabel,
  buildMediaArticleViewModel,
  formatArticleDate,
  resolveMediaArticleOrigin,
} from "./media-article-view-model";

function buildPost(overrides: Partial<MediaProfilePost> = {}): MediaProfilePost {
  return {
    author_id: "author-1",
    author_name: "Marco Rossi",
    body: "Il mercato entra nella fase decisiva.",
    category: "Mercato",
    comment_count: 12,
    comments: [],
    cover_type: "image",
    cover_url: "https://example.com/cover.jpg",
    created_at: "2026-06-19T08:00:00Z",
    created_by_profile_id: "media-1",
    display_mode: "full",
    excerpt: "Le trattative si infiammano.",
    external_url: null,
    id: "article-1",
    is_saved: false,
    kind: "article",
    media_profile_id: "media-1",
    published_at: "2026-06-19T08:00:00Z",
    publisher_name: "TuttoDilettanti",
    reading_time_minutes: 3,
    source_name: null,
    source_type: "platform",
    status: "published",
    subtitle: null,
    tagged_targets: [],
    title: "Promozione, il mercato entra nella fase decisiva",
    updated_at: "2026-06-19T08:00:00Z",
    ...overrides,
  };
}

describe("origine canonica dell'articolo", () => {
  it("riconosce le tre modalità di HOM-06.2", () => {
    expect(
      resolveMediaArticleOrigin({ external_url: null, source_type: "platform" }),
    ).toBe("NATIVE");
    expect(
      resolveMediaArticleOrigin({
        external_url: "https://dominio.it/x",
        source_type: "link",
      }),
    ).toBe("EXTERNAL_LINK");
    expect(
      resolveMediaArticleOrigin({ external_url: null, source_type: "pasted" }),
    ).toBe("IMPORTED_TEXT");
  });

  it("per i contenuti senza origine dichiarata deduce dal link", () => {
    expect(
      resolveMediaArticleOrigin({
        external_url: "https://dominio.it/x",
        source_type: null as unknown as MediaProfilePost["source_type"],
      }),
    ).toBe("EXTERNAL_LINK");
    expect(
      resolveMediaArticleOrigin({
        external_url: null,
        source_type: null as unknown as MediaProfilePost["source_type"],
      }),
    ).toBe("NATIVE");
  });
});

describe("view model unificato", () => {
  it("un articolo nativo porta l'autore pubblico dell'articolo", () => {
    const article = buildMediaArticleViewModel(buildPost(), "TuttoDilettanti");

    expect(article.origin).toBe("NATIVE");
    expect(article.primaryAttribution).toBe("di Marco Rossi");
    expect(article.sourceAttribution).toBeNull();
    expect(article.isExternal).toBe(false);
    expect(article.tagline).toBe("3 min");
    expect(article.category).toBe("Mercato");
  });

  it("un link non viene attribuito a PROLINK come se l'avesse scritto", () => {
    const article = buildMediaArticleViewModel(
      buildPost({
        display_mode: "preview",
        external_url: "https://www.dominio.it/articolo",
        source_name: null,
        source_type: "link",
      }),
      "TuttoDilettanti",
    );

    expect(article.origin).toBe("EXTERNAL_LINK");
    expect(article.primaryAttribution).toBe("Condiviso da TuttoDilettanti");
    expect(article.sourceAttribution).toBe("Fonte originale · dominio.it");
    expect(article.isExternal).toBe(true);
    expect(article.externalUrl).toBe("https://www.dominio.it/articolo");
    // Un contenuto solo-anteprima non ha un corpo da leggere su PROLINK.
    expect(article.tagline).toBeNull();
  });

  it("un testo incollato mostra il publisher e l'autore originale", () => {
    const article = buildMediaArticleViewModel(
      buildPost({ source_type: "pasted" }),
      "TuttoDilettanti",
    );

    expect(article.origin).toBe("IMPORTED_TEXT");
    expect(article.primaryAttribution).toBe("di Marco Rossi");
  });

  it("senza autore ricade sulla realtà editoriale, non sul proprietario", () => {
    const article = buildMediaArticleViewModel(
      buildPost({ author_name: "   " }),
      "TuttoDilettanti",
    );

    expect(article.primaryAttribution).toBe("TuttoDilettanti");
  });

  it("preferisce il nome della fonte al dominio quando esiste", () => {
    const article = buildMediaArticleViewModel(
      buildPost({
        external_url: "https://www.dominio.it/articolo",
        source_name: "Il Corriere Locale",
        source_type: "link",
      }),
      "TuttoDilettanti",
    );

    expect(article.sourceAttribution).toBe(
      "Fonte originale · Il Corriere Locale",
    );
  });

  it("non mostra l'estratto se è assente invece di ritagliarlo dal corpo", () => {
    const article = buildMediaArticleViewModel(
      buildPost({ excerpt: null }),
      "TuttoDilettanti",
    );

    expect(article.excerpt).toBeNull();
  });

  it("omette il tempo di lettura invece di mostrare 0 min", () => {
    expect(
      buildMediaArticleViewModel(
        buildPost({ reading_time_minutes: 0 }),
        "TuttoDilettanti",
      ).tagline,
    ).toBeNull();
    // Una news non si misura in minuti di lettura.
    expect(
      buildMediaArticleViewModel(
        buildPost({ kind: "news" }),
        "TuttoDilettanti",
      ).tagline,
    ).toBeNull();
  });

  it("non apre un URL esterno non validato dalla card", () => {
    const article = buildMediaArticleViewModel(
      buildPost({
        external_url: "javascript:alert(1)",
        source_type: "link",
      }),
      "TuttoDilettanti",
    );

    expect(article.externalUrl).toBeNull();
    expect(article.domainLabel).toBeNull();
  });

  it("non lascia una copertina vuota come stringa", () => {
    expect(
      buildMediaArticleViewModel(buildPost({ cover_url: "  " }), "X").coverUrl,
    ).toBeNull();
  });
});

describe("data di pubblicazione", () => {
  it("è localizzata e breve", () => {
    expect(formatArticleDate("2026-06-19T08:00:00Z")).toBe(
      new Date("2026-06-19T08:00:00Z").toLocaleDateString("it-IT", {
        day: "numeric",
        month: "short",
      }),
    );
  });

  it("non mostra niente per una data non utilizzabile", () => {
    expect(formatArticleDate(null)).toBeNull();
    expect(formatArticleDate("non-una-data")).toBeNull();
  });
});

describe("nome accessibile della card", () => {
  it("compone una frase leggibile e non una sequenza di frammenti", () => {
    const article = buildMediaArticleViewModel(buildPost(), "TuttoDilettanti");
    const label = buildMediaArticleAccessibilityLabel(article);

    expect(label).toContain(
      "Articolo: Promozione, il mercato entra nella fase decisiva",
    );
    expect(label).toContain("categoria Mercato");
    expect(label).toContain("pubblicato da Marco Rossi");
    expect(label).toContain("3 min di lettura");
    expect(label.endsWith(".")).toBe(true);
  });

  it("non annuncia i metadati assenti", () => {
    const article = buildMediaArticleViewModel(
      buildPost({
        author_name: "  ",
        created_at: "non-una-data",
        kind: "news",
        published_at: null,
        publisher_name: "  ",
      }),
      null,
    );
    const label = buildMediaArticleAccessibilityLabel(article);

    expect(label).not.toContain("pubblicato da");
    expect(label).not.toContain("di lettura");
  });

  it("dichiara un link esterno", () => {
    const article = buildMediaArticleViewModel(
      buildPost({
        external_url: "https://dominio.it/x",
        source_type: "link",
      }),
      "TuttoDilettanti",
    );

    expect(buildMediaArticleAccessibilityLabel(article)).toContain(
      "link esterno",
    );
  });
});
