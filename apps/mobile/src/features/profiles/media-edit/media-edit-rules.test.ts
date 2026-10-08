/**
 * Regole della Modifica profilo Media/Creator (REV-PROF-22).
 *
 * Coprono i confini che la task dichiara non negoziabili: un canale senza
 * valore non può essere pubblico, Copertura e Tipi di contenuto restano due
 * domini distinti, la residenza non diventa una copertura, e un valore
 * legacy non si perde solo perché la tassonomia non lo riconosce più.
 */
import { describe, expect, it } from "vitest";

import {
  MEDIA_CONTENT_TYPE_OPTIONS,
  MEDIA_SCOPE_OPTIONS,
} from "../../onboarding/community/media-taxonomy";
import {
  MEDIA_CHANNELS,
  MEDIA_DESCRIPTION_MAX_LENGTH,
  buildMediaChannelPatch,
  countVisibleMediaChannels,
  findUnpublishableMediaChannel,
  normalizeMediaChannelValue,
  normalizeMediaContentTypeSelection,
  normalizeMediaEntityName,
  normalizeMediaScopeSelection,
  resolveMediaAreasDraft,
  sameMediaSelection,
  sanitizeMediaDescription,
  validateMediaAreas,
  validateMediaCreatorType,
  validateMediaDescription,
  validateMediaEntityName,
  type MediaChannelForm,
} from "./media-edit-rules";

function channelForm(
  overrides: Partial<MediaChannelForm> = {},
): MediaChannelForm {
  return {
    facebook: "",
    instagram: "",
    tiktok: "",
    visibility: {
      facebook: false,
      instagram: false,
      tiktok: false,
      website: false,
      youtube: false,
    },
    website: "",
    youtube: "",
    ...overrides,
  };
}

describe("nome della realtà", () => {
  it("riduce gli spazi senza toccare accenti, apostrofi e maiuscole", () => {
    expect(normalizeMediaEntityName("  Tutto   Dilett'anti  ")).toBe(
      "Tutto Dilett'anti",
    );
    expect(normalizeMediaEntityName("Città Calcio")).toBe("Città Calcio");
  });

  it("rifiuta un nome vuoto e un nome con markup", () => {
    expect(validateMediaEntityName("   ")).toBe(
      "Inserisci il nome della realtà.",
    );
    expect(validateMediaEntityName("<b>Testata</b>")).toBe(
      "Il nome non può contenere markup.",
    );
    expect(validateMediaEntityName("Redazione Nord")).toBeNull();
  });
});

describe("tipo di realtà", () => {
  it("richiede una categoria canonica, non una stringa qualsiasi", () => {
    expect(validateMediaCreatorType("", "")).toBe(
      "Seleziona il tipo di realtà.",
    );
    expect(validateMediaCreatorType("news_outlet", "")).toBeNull();
  });

  it('chiede il testo libero solo per "Altro"', () => {
    expect(validateMediaCreatorType("other", "   ")).toBe(
      "Indica il tipo di realtà.",
    );
    expect(validateMediaCreatorType("other", "Collettivo")).toBeNull();
  });
});

describe("descrizione pubblica", () => {
  it("usa il limite canonico dell'onboarding, non quello del mockup", () => {
    expect(MEDIA_DESCRIPTION_MAX_LENGTH).toBe(400);
  });

  it("toglie il markup e preserva i paragrafi", () => {
    expect(
      sanitizeMediaDescription("<script>x()</script>Notizie\n\n\n\ne analisi "),
    ).toBe("x()Notizie\n\ne analisi");
  });

  it("segnala solo il superamento del limite canonico", () => {
    expect(validateMediaDescription("a".repeat(400))).toBeNull();
    expect(validateMediaDescription("a".repeat(401))).toBe(
      "La descrizione non può superare 400 caratteri.",
    );
  });
});

describe("selezioni multiple", () => {
  it("deduplica e ordina come la tassonomia, non come i tocchi", () => {
    const selection = normalizeMediaScopeSelection([
      "Calciomercato",
      "Calcio giovanile",
      "Calciomercato",
    ]);

    expect(selection.known).toEqual(["Calcio giovanile", "Calciomercato"]);
    expect(selection.deprecated).toEqual([]);
  });

  it("conserva i valori che la tassonomia non riconosce più", () => {
    const selection = normalizeMediaContentTypeSelection([
      "Notizie",
      "Rassegna stampa",
    ]);

    expect(selection.known).toEqual(["Notizie"]);
    expect(selection.deprecated).toEqual(["Rassegna stampa"]);
  });

  it("tiene Copertura e Tipi di contenuto su due vocabolari distinti", () => {
    // "Notizie" è un formato, non un ambito: non deve attraversare il confine.
    expect(normalizeMediaScopeSelection(["Notizie"]).known).toEqual([]);
    expect(
      normalizeMediaContentTypeSelection(["Calcio giovanile"]).known,
    ).toEqual([]);
    expect(MEDIA_SCOPE_OPTIONS).toContain("Calcio femminile");
    expect(MEDIA_CONTENT_TYPE_OPTIONS).toContain("Podcast");
  });

  it("non considera modificata una selezione riordinata", () => {
    expect(sameMediaSelection(["a", "b"], ["b", "a"])).toBe(true);
    expect(sameMediaSelection(["a"], ["a", "b"])).toBe(false);
  });
});

describe("canali ufficiali", () => {
  it("copre i cinque canali previsti e nessun altro", () => {
    expect(MEDIA_CHANNELS.map((channel) => channel.key)).toEqual([
      "website",
      "instagram",
      "youtube",
      "tiktok",
      "facebook",
    ]);
  });

  it("normalizza handle e domini nella forma canonica", () => {
    expect(normalizeMediaChannelValue("website", "tuttodilettanti.it")).toBe(
      "https://tuttodilettanti.it",
    );
    expect(normalizeMediaChannelValue("tiktok", "@redazione")).toBe(
      "https://tiktok.com/@redazione",
    );
  });

  it("rifiuta uno schema non sicuro invece di correggerlo", () => {
    expect(
      normalizeMediaChannelValue("website", "javascript:alert(1)"),
    ).toBe("");
  });

  it("non lascia pubblicare un canale senza un valore valido", () => {
    const invalid = findUnpublishableMediaChannel(
      channelForm({
        visibility: {
          facebook: false,
          instagram: false,
          tiktok: false,
          website: true,
          youtube: false,
        },
      }),
    );

    expect(invalid?.key).toBe("website");
  });

  it("spegne la visibilità di un canale rimasto senza valore", () => {
    const { values, visibility } = buildMediaChannelPatch(
      channelForm({
        instagram: "@redazione",
        visibility: {
          facebook: false,
          instagram: true,
          tiktok: false,
          // Acceso su un campo vuoto: non può sopravvivere al salvataggio.
          website: true,
          youtube: false,
        },
      }),
    );

    expect(values.instagram).toBe("https://instagram.com/redazione");
    expect(visibility.instagram).toBe(true);
    expect(visibility.website).toBe(false);
    expect(values.website).toBe("");
  });

  it("conta solo i canali presenti, validi e accesi", () => {
    expect(
      countVisibleMediaChannels(
        channelForm({
          instagram: "@redazione",
          visibility: {
            facebook: false,
            instagram: true,
            tiktok: false,
            website: true,
            youtube: false,
          },
          youtube: "@canale",
        }),
      ),
    ).toBe(1);
  });

  it("non cancella un valore scritto ma non interpretabile", () => {
    const { values } = buildMediaChannelPatch(
      channelForm({ youtube: "non un canale" }),
    );

    expect(values.youtube).toBe("non un canale");
  });
});

describe("aree coperte", () => {
  it("tiene attiva una sola lista per modalità", () => {
    expect(
      resolveMediaAreasDraft({
        provinces: ["Bergamo"],
        regions: ["Lombardia"],
        scope: "REGIONS",
      }),
    ).toEqual({ provinces: [], regions: ["Lombardia"] });

    expect(
      resolveMediaAreasDraft({
        provinces: ["Bergamo"],
        regions: ["Lombardia"],
        scope: "ITALY",
      }),
    ).toEqual({ provinces: [], regions: [] });
  });

  it("deduplica le aree senza perdere l'ordine scelto", () => {
    expect(
      resolveMediaAreasDraft({
        provinces: [],
        regions: ["Piemonte", "Lombardia", "Piemonte"],
        scope: "REGIONS",
      }).regions,
    ).toEqual(["Piemonte", "Lombardia"]);
  });

  it("richiede almeno un'area nelle modalità che la prevedono", () => {
    expect(
      validateMediaAreas({ provinces: [], regions: [], scope: "REGIONS" }),
    ).toBe("Seleziona almeno un'area di copertura.");
    expect(
      validateMediaAreas({ provinces: [], regions: [], scope: "ITALY" }),
    ).toBeNull();
  });
});
