/**
 * Test della presentazione del Centro Candidature (DAS-REV-22 §36).
 *
 * Verificano i rischi, non l'implementazione: le date relative al confine del
 * giorno, la precedenza degli stati di riga, i plurali dei riepiloghi, la
 * riconciliazione dei filtri pending e la scelta dell'empty — cioè i punti in
 * cui §13, §14 e §27 chiedono comportamenti che una lettura distratta del
 * mockup non produrrebbe.
 */
import { describe, expect, it } from "vitest";

import {
  APPLICATIONS_COPY,
  adoptEffectiveFilter,
  countsLine,
  emptyCopy,
  filterSummary,
  formatSubmittedAgo,
  personLine,
  positionLine,
  reconcilePendingFilter,
  rowStatusLabel,
  sameFilter,
  withdrawnLine,
} from "./applications-presentation";
import type { ApplicationFilterOption } from "./applications-types";

/** Clock della fixture di §33: 13 settembre 2026, 14:00 Europe/Rome. */
const NOW = new Date(2026, 8, 13, 14, 0, 0);

describe("formatSubmittedAgo", () => {
  it("rende le ore dello stesso giorno come nel mockup", () => {
    // A1: 13 settembre 12:00 -> "2h"
    expect(formatSubmittedAgo(new Date(2026, 8, 13, 12, 0).toISOString(), NOW)).toBe(
      "2h",
    );
    // A2: 13 settembre 09:00 -> "5h"
    expect(formatSubmittedAgo(new Date(2026, 8, 13, 9, 0).toISOString(), NOW)).toBe(
      "5h",
    );
  });

  it("conta i giorni di calendario, non i multipli di 24 ore", () => {
    /* §10: «Ieri» è una parola del lettore, non una differenza aritmetica.
       Le 23:00 di ieri sono «Ieri» anche se sono passate 15 ore, e le 01:00
       di ieri lo sono anche se ne sono passate 37. */
    expect(formatSubmittedAgo(new Date(2026, 8, 12, 23, 0).toISOString(), NOW)).toBe(
      "Ieri",
    );
    expect(formatSubmittedAgo(new Date(2026, 8, 12, 1, 0).toISOString(), NOW)).toBe(
      "Ieri",
    );
  });

  it("rende i giorni come nel mockup", () => {
    // A5: 11 settembre -> "2g"; A6: 10 settembre -> "3g"; A7: 9 settembre -> "4g"
    expect(formatSubmittedAgo(new Date(2026, 8, 11, 10, 0).toISOString(), NOW)).toBe(
      "2g",
    );
    expect(formatSubmittedAgo(new Date(2026, 8, 10, 9, 0).toISOString(), NOW)).toBe(
      "3g",
    );
    expect(formatSubmittedAgo(new Date(2026, 8, 9, 8, 0).toISOString(), NOW)).toBe(
      "4g",
    );
  });

  it("non inventa una data quando non c'è", () => {
    /* §32: «I record con data sconosciuta … non ricevono la data di oggi.» */
    expect(formatSubmittedAgo(null, NOW)).toBeNull();
    expect(formatSubmittedAgo("non-una-data", NOW)).toBeNull();
  });
});

describe("rowStatusLabel", () => {
  it("privilegia Ritirata sul contesto della posizione", () => {
    /* §13: «Se coesistono ritiro e chiusura … Nella riga privilegia
       Ritirata», e §24 esclude comunque una ritirata da Nuove. */
    expect(
      rowStatusLabel({ adStatus: "closed", isNew: false, state: "withdrawn" }),
    ).toBe(APPLICATIONS_COPY.withdrawn);
  });

  it("mostra il contesto neutro di una posizione chiusa", () => {
    expect(
      rowStatusLabel({ adStatus: "closed", isNew: false, state: "active" }),
    ).toBe(APPLICATIONS_COPY.positionClosed);
  });

  it("non etichetta una candidatura attiva già consultata", () => {
    /* §13: «Letta e attiva: niente badge Nuova.» */
    expect(
      rowStatusLabel({ adStatus: "published", isNew: false, state: "active" }),
    ).toBeNull();
  });

  it("etichetta Nuova solo su una submission non letta di una posizione aperta", () => {
    expect(
      rowStatusLabel({ adStatus: "published", isNew: true, state: "active" }),
    ).toBe(APPLICATIONS_COPY.newBadge);
  });
});

describe("righe di contesto", () => {
  it("tiene separati il dato corrente della persona e il contesto della candidatura", () => {
    /* §13: «Le qualifiche o il ruolo attuale possono differire dal ruolo
       richiesto dalla Position … senza riscrivere l'uno con l'altro.» */
    expect(
      personLine({ personRole: "player", personSituation: "Svincolato" }),
    ).toBe("Calciatore · Svincolato");
    expect(
      positionLine({ roleLabel: "Centrocampista", teamLabel: "Prima squadra" }),
    ).toBe("Centrocampista · Prima squadra");
  });

  it("omette la situazione quando il profilo non la determina", () => {
    /* §16: null non è «Svincolato». */
    expect(personLine({ personRole: "coach", personSituation: null })).toBe(
      "Allenatore",
    );
  });

  it("mostra l'ambito societario senza una squadra finta", () => {
    expect(
      positionLine({ roleLabel: "Direttore sportivo", teamLabel: "Intera società" }),
    ).toBe("Direttore sportivo · Intera società");
  });
});

describe("withdrawnLine", () => {
  it("resta leggibile anche senza una data affidabile", () => {
    /* §19: «conserva l'assenza … evita date inventate». */
    expect(withdrawnLine(null)).toBe(APPLICATIONS_COPY.withdrawn);
    expect(withdrawnLine(new Date(2026, 8, 11, 10, 0).toISOString())).toBe(
      "Ritirata il 11 settembre 2026",
    );
  });
});

const OPTIONS: ApplicationFilterOption[] = [
  { kind: "team", label: "Prima squadra", teamId: "t1" },
  { kind: "team", label: "Primavera", teamId: "t2" },
  { kind: "team", label: "Under 17", teamId: "t3" },
  {
    adId: "p1",
    group: "active",
    kind: "position",
    label: "Centrocampista",
    sublabel: "Prima squadra",
    teamId: "t1",
  },
  {
    adId: "p2",
    group: "active",
    kind: "position",
    label: "Allenatore",
    sublabel: "Primavera",
    teamId: "t2",
  },
  {
    adId: "p4",
    group: "active",
    kind: "position",
    label: "Direttore sportivo",
    sublabel: "Intera società",
    teamId: null,
  },
  {
    adId: "p6",
    group: "closed",
    kind: "position",
    label: "Portiere",
    sublabel: "Under 17",
    teamId: "t3",
  },
];

describe("reconcilePendingFilter", () => {
  it("non tocca niente a zero squadre selezionate", () => {
    /* §14: «Con zero Squadre selezionate possono essere comprese anche le
       Position SOCIETY autorizzate.» */
    const filter = { adIds: ["p4"], teamIds: [] };

    expect(reconcilePendingFilter(filter, OPTIONS)).toEqual({
      dropped: 0,
      filter,
    });
  });

  it("toglie la Position SOCIETY quando si seleziona una squadra reale", () => {
    /* §14, QA060. */
    const result = reconcilePendingFilter(
      { adIds: ["p1", "p4"], teamIds: ["t1"] },
      OPTIONS,
    );

    expect(result.filter.adIds).toEqual(["p1"]);
    expect(result.dropped).toBe(1);
  });

  it("toglie le Position di squadre principali diverse", () => {
    const result = reconcilePendingFilter(
      { adIds: ["p1", "p2"], teamIds: ["t2"] },
      OPTIONS,
    );

    expect(result.filter.adIds).toEqual(["p2"]);
    expect(result.dropped).toBe(1);
  });

  it("non scarta una selezione le cui opzioni non sono ancora arrivate", () => {
    /* §27: un elenco di opzioni in caricamento non è la prova che una
       selezione sia decaduta. */
    const result = reconcilePendingFilter(
      { adIds: ["sconosciuta"], teamIds: ["t1"] },
      OPTIONS,
    );

    expect(result.filter.adIds).toEqual(["sconosciuta"]);
    expect(result.dropped).toBe(0);
  });
});

describe("filterSummary", () => {
  it("dice Tutte le candidature a filtri vuoti", () => {
    expect(filterSummary({ adIds: [], teamIds: [] }, OPTIONS)).toBe(
      APPLICATIONS_COPY.allApplications,
    );
  });

  it("nomina la squadra quando è una sola", () => {
    expect(filterSummary({ adIds: [], teamIds: ["t1"] }, OPTIONS)).toBe(
      "Prima squadra",
    );
  });

  it("nomina ruolo e ambito quando la Position è una sola", () => {
    expect(filterSummary({ adIds: ["p1"], teamIds: [] }, OPTIONS)).toBe(
      "Centrocampista · Prima squadra",
    );
  });

  it("riproduce il riepilogo dello screen 04", () => {
    /* §14: «entrambe → "2 squadre · 3 posizioni"». */
    expect(
      filterSummary({ adIds: ["p1", "p2", "p4"], teamIds: ["t1", "t2"] }, OPTIONS),
    ).toBe("2 squadre · 3 posizioni");
  });
});

describe("countsLine", () => {
  it("riproduce «2 candidature · 1 nuova» dello screen 11", () => {
    expect(countsLine({ newCount: 1, total: 2 })).toBe("2 candidature · 1 nuova");
  });

  it("omette la metà nuove quando sono zero", () => {
    expect(countsLine({ newCount: 0, total: 2 })).toBe("2 candidature");
  });

  it("non inventa uno zero quando il conteggio non è disponibile", () => {
    /* §9: «Non inventare un count zero in presenza di errore, dato assente o
       capability mancante.» */
    expect(countsLine({ newCount: null, total: null })).toBeNull();
  });
});

describe("emptyCopy", () => {
  it("distingue il filtro senza risultati dall'assenza di candidature", () => {
    expect(
      emptyCopy({
        filtered: true,
        hasHistory: true,
        historyIsInactiveOnly: false,
        tab: "new",
      }).title,
    ).toBe("Nessuna candidatura trovata");

    expect(
      emptyCopy({
        filtered: false,
        hasHistory: false,
        historyIsInactiveOnly: false,
        tab: "new",
      }).title,
    ).toBe("Nessuna candidatura ricevuta");
  });

  it("riproduce lo screen 14 quando le nuove sono state consultate", () => {
    const copy = emptyCopy({
      filtered: false,
      hasHistory: true,
      historyIsInactiveOnly: false,
      tab: "new",
    });

    expect(copy.title).toBe("Nessuna nuova candidatura");
    expect(copy.body).toBe("Le candidature già consultate sono in Tutte.");
    expect(copy.actionLabel).toBe("Vedi tutte");
  });

  it("non afferma che siano state consultate se lo storico è solo ritirate o chiuse", () => {
    /* §27: «usa una copy vera, per esempio "Puoi consultare lo storico in
       Tutte." Non affermare che siano state tutte lette.» */
    expect(
      emptyCopy({
        filtered: false,
        hasHistory: true,
        historyIsInactiveOnly: true,
        tab: "new",
      }).body,
    ).toBe("Puoi consultare lo storico in Tutte.");
  });
});

describe("adoptEffectiveFilter", () => {
  it("conserva l'oggetto applicato quando il server non normalizza niente", () => {
    const applied = { adIds: ["p1"], teamIds: ["t1"] };

    expect(adoptEffectiveFilter(applied, { adIds: ["p1"], teamIds: ["t1"] })).toBe(
      applied,
    );
  });

  it("adotta i filtri effettivi quando lo scope è cambiato", () => {
    /* §26: «il client non deve continuare a mostrare un riepilogo diverso dal
       dataset restituito». */
    const effective = { adIds: [], teamIds: ["t1"] };

    expect(
      adoptEffectiveFilter({ adIds: ["p2"], teamIds: ["t1", "t2"] }, effective),
    ).toBe(effective);
  });
});

describe("sameFilter", () => {
  it("ignora l'ordine di selezione", () => {
    expect(
      sameFilter(
        { adIds: ["p2", "p1"], teamIds: ["t2", "t1"] },
        { adIds: ["p1", "p2"], teamIds: ["t1", "t2"] },
      ),
    ).toBe(true);
  });
});
