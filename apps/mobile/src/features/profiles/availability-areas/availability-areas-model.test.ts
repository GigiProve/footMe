/**
 * Modello canonico della disponibilità geografica (DAS-REV-06 §13–§17).
 *
 * I casi della tabella QA di §28 che sono deterministici e puri vivono qui.
 */
import { describe, expect, it } from "vitest";

import {
  AVAILABILITY_AREAS_MODES,
  areAvailabilityAreasEqual,
  dedupeAreas,
  listAreaOptions,
  normalizeAvailabilityAreasMode,
  orderAreasByTaxonomy,
  resolveActiveAreas,
  searchAreaOptions,
  toggleArea,
  validateAvailabilityAreas,
  type AvailabilityAreasDraft,
} from "./availability-areas-model";

function draft(
  partial: Partial<AvailabilityAreasDraft> = {},
): AvailabilityAreasDraft {
  return { mode: null, provinces: [], regions: [], ...partial };
}

describe("modalità", () => {
  it("espone le tre modalità del master nell'ordine del master", () => {
    expect(AVAILABILITY_AREAS_MODES.map((entry) => entry.mode)).toEqual([
      "PROVINCES",
      "REGIONS",
      "ITALY",
    ]);
    expect(AVAILABILITY_AREAS_MODES.map((entry) => entry.title)).toEqual([
      "Province specifiche",
      "Una o più regioni",
      "Tutta Italia",
    ]);
  });

  it("riconosce il valore legacy ALL_ITALY come ITALY", () => {
    expect(normalizeAvailabilityAreasMode("ALL_ITALY")).toBe("ITALY");
  });

  it("non inventa una modalità quando il dato è assente o irriconoscibile", () => {
    // §16: «Dato realmente assente: nessuna modalità selezionata
    // automaticamente». Il default non può essere ITALY.
    expect(normalizeAvailabilityAreasMode(null)).toBeNull();
    expect(normalizeAvailabilityAreasMode(undefined)).toBeNull();
    expect(normalizeAvailabilityAreasMode("")).toBeNull();
    expect(normalizeAvailabilityAreasMode("NORD")).toBeNull();
  });
});

describe("selezioni attive", () => {
  it("persiste solo le selezioni della modalità corrente", () => {
    const base = draft({
      mode: "PROVINCES",
      provinces: ["Milano", "Como"],
      regions: ["Lombardia"],
    });

    expect(resolveActiveAreas(base)).toEqual({
      provinces: ["Milano", "Como"],
      regions: [],
    });

    expect(resolveActiveAreas({ ...base, mode: "REGIONS" })).toEqual({
      provinces: [],
      regions: ["Lombardia"],
    });
  });

  it("Tutta Italia non porta liste specifiche", () => {
    // §15: «Non espandere lo scope nazionale in centinaia di selezioni».
    expect(
      resolveActiveAreas(
        draft({ mode: "ITALY", provinces: ["Milano"], regions: ["Lombardia"] }),
      ),
    ).toEqual({ provinces: [], regions: [] });
  });

  it("una selezione ripetuta resta una sola area", () => {
    expect(dedupeAreas(["Milano", "Como", "Milano"])).toEqual([
      "Milano",
      "Como",
    ]);
  });

  it("chip e checkbox aggiornano lo stesso insieme", () => {
    // §13: «Rimuovere un chip aggiorna lo stesso draft del checkbox.»
    const afterCheckbox = toggleArea(["Milano"], "Como");

    expect(afterCheckbox).toEqual(["Milano", "Como"]);
    expect(toggleArea(afterCheckbox, "Como")).toEqual(["Milano"]);
  });
});

describe("validazione", () => {
  it("chiede una modalità quando non ne è stata scelta nessuna", () => {
    expect(validateAvailabilityAreas(draft())).toEqual({
      field: "mode",
      message: "Seleziona una modalità di disponibilità.",
    });
  });

  it("chiede almeno una provincia nello scope Province", () => {
    expect(validateAvailabilityAreas(draft({ mode: "PROVINCES" }))).toEqual({
      field: "provinces",
      message: "Seleziona almeno una provincia.",
    });
  });

  it("chiede almeno una regione nello scope Regioni", () => {
    expect(validateAvailabilityAreas(draft({ mode: "REGIONS" }))).toEqual({
      field: "regions",
      message: "Seleziona almeno una regione.",
    });
  });

  it("accetta una sola provincia e una sola regione", () => {
    // §13 e §14: «Una sola provincia è valida», «Una sola regione è valida».
    expect(
      validateAvailabilityAreas(
        draft({ mode: "PROVINCES", provinces: ["Como"] }),
      ),
    ).toBeNull();
    expect(
      validateAvailabilityAreas(
        draft({ mode: "REGIONS", regions: ["Piemonte"] }),
      ),
    ).toBeNull();
  });

  it("non impone un massimo di tre selezioni", () => {
    expect(
      validateAvailabilityAreas(
        draft({
          mode: "PROVINCES",
          provinces: ["Milano", "Como", "Bergamo", "Varese", "Lecco"],
        }),
      ),
    ).toBeNull();
  });

  it("Tutta Italia è valida senza nessun'altra selezione", () => {
    expect(validateAvailabilityAreas(draft({ mode: "ITALY" }))).toBeNull();
  });

  it("segnala le aree fuori tassonomia invece di scartarle in silenzio", () => {
    expect(
      validateAvailabilityAreas(
        draft({ mode: "PROVINCES", provinces: ["Milano", "Atlantide"] }),
      ),
    ).toEqual({
      field: "provinces",
      message: "Alcune aree non sono più disponibili. Controlla la selezione.",
    });
  });

  it("rifiuta una regione passata come provincia", () => {
    // §17: «identificativi validi e del tipo geografico corretto».
    expect(
      validateAvailabilityAreas(
        draft({ mode: "PROVINCES", provinces: ["Lombardia"] }),
      ),
    ).toMatchObject({ field: "provinces" });
  });
});

describe("confronto di due configurazioni", () => {
  it("ignora l'ordine delle selezioni", () => {
    expect(
      areAvailabilityAreasEqual(
        draft({ mode: "PROVINCES", provinces: ["Milano", "Como"] }),
        draft({ mode: "PROVINCES", provinces: ["Como", "Milano"] }),
      ),
    ).toBe(true);
  });

  it("ignora le selezioni della modalità non attiva", () => {
    // §16 consente di conservarle nella bozza; non sono una modifica.
    expect(
      areAvailabilityAreasEqual(
        draft({ mode: "ITALY", provinces: ["Milano"] }),
        draft({ mode: "ITALY" }),
      ),
    ).toBe(true);
  });

  it("riconosce il cambio di modalità come una modifica", () => {
    expect(
      areAvailabilityAreasEqual(
        draft({ mode: "ITALY" }),
        draft({ mode: "PROVINCES", provinces: ["Milano"] }),
      ),
    ).toBe(false);
  });

  it("distingue «nessuna modalità» da Tutta Italia", () => {
    expect(areAvailabilityAreasEqual(draft(), draft({ mode: "ITALY" }))).toBe(
      false,
    );
  });
});

describe("tassonomia e ricerca", () => {
  it("espone tutte le province e tutte le regioni italiane", () => {
    expect(listAreaOptions("PROVINCES")).toHaveLength(107);
    expect(listAreaOptions("REGIONS")).toHaveLength(20);
    expect(listAreaOptions("ITALY")).toEqual([]);
  });

  it("porta la regione come metadato della provincia", () => {
    const bergamo = listAreaOptions("PROVINCES").find(
      (option) => option.value === "Bergamo",
    );

    expect(bergamo?.metadata).toBe("Lombardia");
  });

  it("non mette metadati sulle regioni, che non vanno disambiguate", () => {
    expect(listAreaOptions("REGIONS")[0]?.metadata).toBeUndefined();
  });

  it("include la provincia di Aosta, che mancava dalla lista piatta", () => {
    expect(
      listAreaOptions("PROVINCES").some((option) => option.value === "Aosta"),
    ).toBe(true);
  });

  it("cerca senza distinguere maiuscole, accenti e punteggiatura", () => {
    expect(
      searchAreaOptions("PROVINCES", "forli").map((option) => option.value),
    ).toContain("Forlì-Cesena");
    expect(
      searchAreaOptions("REGIONS", "EMILIA ROMAGNA").map(
        (option) => option.value,
      ),
    ).toEqual(["Emilia-Romagna"]);
  });

  it("con query vuota restituisce la tassonomia intera, non un estratto", () => {
    // §17: «le due row del PNG sono esempi, non la lista completa».
    expect(searchAreaOptions("PROVINCES", "   ")).toHaveLength(107);
  });

  it("non filtra le selezioni già effettuate fuori dai risultati", () => {
    // §13: una provincia selezionata che compare nei risultati resta nella
    // lista — è il checkbox a dire che è scelta, non la sua assenza.
    expect(
      searchAreaOptions("PROVINCES", "milano").map((option) => option.value),
    ).toEqual(["Milano"]);
  });

  it("ordina i chip come la tassonomia e tiene in coda i valori legacy", () => {
    expect(
      orderAreasByTaxonomy("PROVINCES", ["Varese", "Atlantide", "Como"]),
    ).toEqual(["Como", "Varese", "Atlantide"]);
  });
});
