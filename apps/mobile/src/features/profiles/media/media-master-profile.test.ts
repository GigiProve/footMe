import { describe, expect, it } from "vitest";

import {
  MEDIA_PROFILE_INITIAL_TAB,
  MEDIA_PROFILE_NO_CAPABILITIES,
  MEDIA_PROFILE_TABS,
  buildMediaCoverageTopics,
  buildMediaEntityInitials,
  buildMediaInfoChips,
  dedupeMediaContentById,
  formatExternalDomain,
  formatMediaCoverageAreas,
  formatMediaEntityName,
  formatMediaEntityQualifier,
  formatMediaEntityType,
  normalizeExternalUrl,
  normalizeMediaCapabilities,
  parseMediaProfileTab,
} from "./media-master-profile";

describe("tab del Master Profile Media/Creator", () => {
  it("espone esattamente quattro tab, con Articoli per prima", () => {
    expect(MEDIA_PROFILE_TABS).toEqual([
      "articles",
      "tribuna",
      "media",
      "info",
    ]);
    expect(MEDIA_PROFILE_INITIAL_TAB).toBe("articles");
  });

  it("accetta dal deep link solo una tab esistente", () => {
    expect(parseMediaProfileTab("info")).toBe("info");
    expect(parseMediaProfileTab("bacheca")).toBeUndefined();
    expect(parseMediaProfileTab(undefined)).toBeUndefined();
  });
});

describe("capabilities", () => {
  it("non concede nulla quando il backend non ha risposto", () => {
    expect(normalizeMediaCapabilities(null)).toEqual(
      MEDIA_PROFILE_NO_CAPABILITIES,
    );
    expect(MEDIA_PROFILE_NO_CAPABILITIES.canEditProfile).toBe(false);
    expect(MEDIA_PROFILE_NO_CAPABILITIES.canPublishArticle).toBe(false);
    expect(MEDIA_PROFILE_NO_CAPABILITIES.canFollow).toBe(false);
  });

  it("legge il payload dell'Owner", () => {
    const capabilities = normalizeMediaCapabilities({
      can_add_media: true,
      can_create_tribuna_content: true,
      can_edit_profile: true,
      can_publish_article: true,
      can_share: true,
      can_view_website: true,
      mode: "owner",
    });

    expect(capabilities.canEditProfile).toBe(true);
    expect(capabilities.canPublishArticle).toBe(true);
    expect(capabilities.canAddMedia).toBe(true);
    // L'Owner non segue e non messaggia sé stesso.
    expect(capabilities.canFollow).toBe(false);
    expect(capabilities.canMessage).toBe(false);
    expect(capabilities.canReport).toBe(false);
    expect(capabilities.canBlock).toBe(false);
  });

  it("legge il payload del Visitor", () => {
    const capabilities = normalizeMediaCapabilities({
      can_block: true,
      can_follow: true,
      can_message: true,
      can_report: true,
      can_share: true,
      mode: "visitor",
    });

    expect(capabilities.canFollow).toBe(true);
    expect(capabilities.canMessage).toBe(true);
    // Il Visitor non modifica e non pubblica.
    expect(capabilities.canEditProfile).toBe(false);
    expect(capabilities.canPublishArticle).toBe(false);
    expect(capabilities.canCreateTribunaContent).toBe(false);
    expect(capabilities.canAddMedia).toBe(false);
  });

  it("tratta un permesso non booleano come assente", () => {
    const capabilities = normalizeMediaCapabilities({
      can_edit_profile: "true",
      can_publish_article: 1,
    });

    expect(capabilities.canEditProfile).toBe(false);
    expect(capabilities.canPublishArticle).toBe(false);
  });
});

describe("descrittore editoriale", () => {
  it("usa la tipologia strutturata di REV-ONB-09", () => {
    expect(formatMediaEntityType({ creatorType: "news_outlet" })).toBe(
      "Testata giornalistica",
    );
    expect(formatMediaEntityType({ creatorType: "social_page" })).toBe(
      "Pagina social",
    );
    expect(formatMediaEntityType({ creatorType: "editorial_project" })).toBe(
      "Progetto editoriale",
    );
  });

  it("per \"Altro\" mostra il testo scritto dall'utente", () => {
    expect(
      formatMediaEntityType({
        creatorType: "other",
        creatorTypeOther: "Collettivo di tifosi",
      }),
    ).toBe("Collettivo di tifosi");
  });

  it("ricade sul testo libero storico senza reinterpretarlo", () => {
    expect(
      formatMediaEntityType({
        creatorType: null,
        editorialType: "Testata o sito",
      }),
    ).toBe("Testata o sito");
  });

  it("non inventa una tipologia quando non ce n'è nessuna", () => {
    expect(
      formatMediaEntityType({
        affiliationType: "   ",
        creatorType: null,
        editorialType: null,
      }),
    ).toBeNull();
  });

  it("aggiunge la seconda metà solo se è un attributo distinto", () => {
    expect(
      formatMediaEntityQualifier(
        { focusAreas: ["Calcio dilettantistico"] },
        "Testata giornalistica",
      ),
    ).toBe("Calcio dilettantistico");
    // Ripetere il tipo come qualifica non aggiunge informazione.
    expect(
      formatMediaEntityQualifier(
        { focusAreas: ["Testata giornalistica"] },
        "Testata giornalistica",
      ),
    ).toBeNull();
    expect(formatMediaEntityQualifier({ focusAreas: [] }, "Pagina social")).toBeNull();
  });
});

describe("identità pubblica", () => {
  it("non sostituisce un nome editoriale assente", () => {
    expect(formatMediaEntityName("  TuttoDilettanti ")).toBe("TuttoDilettanti");
    expect(formatMediaEntityName("   ")).toBeNull();
    expect(formatMediaEntityName(null)).toBeNull();
  });

  it("costruisce il monogramma dalle prime due parole", () => {
    expect(buildMediaEntityInitials("Tutto Dilettanti")).toBe("TD");
    expect(buildMediaEntityInitials("Gazzetta")).toBe("G");
    expect(buildMediaEntityInitials(null)).toBe("·");
  });
});

describe("tassonomie della tab Info", () => {
  it("deduplica preservando l'ordine scelto dall'utente", () => {
    const chips = buildMediaInfoChips([
      "Notizie",
      "Interviste",
      "notizie",
      "  ",
      null as unknown as string,
    ]);

    expect(chips.map((chip) => chip.label)).toEqual(["Notizie", "Interviste"]);
  });

  it("tiene competizioni, squadre e temi nella copertura", () => {
    const chips = buildMediaCoverageTopics({
      coveredCompetitions: ["Serie D"],
      coveredTeams: ["ASD Predappio"],
      coveredTopics: ["Calciomercato"],
    });

    expect(chips.map((chip) => chip.label)).toEqual([
      "Serie D",
      "ASD Predappio",
      "Calciomercato",
    ]);
  });

  it("riassume le aree editoriali con il separatore del design system", () => {
    expect(
      formatMediaCoverageAreas(["Lombardia", "Piemonte", "Liguria"]),
    ).toBe("Lombardia · Piemonte · Liguria");
    expect(formatMediaCoverageAreas([])).toBeNull();
    expect(formatMediaCoverageAreas(null)).toBeNull();
  });
});

describe("URL esterni", () => {
  it("promuove un dominio senza protocollo a https", () => {
    expect(normalizeExternalUrl("tuttodilettanti.it")).toBe(
      "https://tuttodilettanti.it",
    );
    expect(normalizeExternalUrl("www.tuttodilettanti.it/news")).toBe(
      "https://www.tuttodilettanti.it/news",
    );
  });

  it("accetta http e https già espliciti", () => {
    expect(normalizeExternalUrl("https://example.it")).toBe("https://example.it");
    expect(normalizeExternalUrl("http://example.it")).toBe("http://example.it");
  });

  it("rifiuta gli schemi non sicuri senza provare a correggerli", () => {
    expect(normalizeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeExternalUrl("data:text/html,<script>")).toBeNull();
    expect(normalizeExternalUrl("file:///etc/passwd")).toBeNull();
    expect(normalizeExternalUrl("myapp://open")).toBeNull();
  });

  it("rifiuta un valore che non è un URL", () => {
    expect(normalizeExternalUrl("redazione")).toBeNull();
    expect(normalizeExternalUrl("")).toBeNull();
    expect(normalizeExternalUrl(null)).toBeNull();
  });

  it("estrae un dominio leggibile senza www", () => {
    expect(formatExternalDomain("https://www.Dominio.IT/articolo?x=1")).toBe(
      "dominio.it",
    );
    expect(formatExternalDomain("javascript:alert(1)")).toBeNull();
  });
});

describe("deduplicazione dei contenuti", () => {
  it("scarta un id già presente conservando il primo", () => {
    const items = dedupeMediaContentById([
      { id: "a", title: "primo" },
      { id: "b", title: "secondo" },
      { id: "a", title: "duplicato" },
    ]);

    expect(items).toEqual([
      { id: "a", title: "primo" },
      { id: "b", title: "secondo" },
    ]);
  });
});
