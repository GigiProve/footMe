/**
 * Le regole di §11, §12 e §30 che una schermata non deve poter sbagliare.
 *
 * Non verificano l'implementazione: verificano gli scenari che la task
 * elenca come criteri — QA015, QA016, QA011, QA028, QA057.
 */
import { describe, expect, it } from "vitest";

import {
  SHORTLIST_COPY,
  addErrorCopy,
  addedByLine,
  centerPresentation,
  filtersAreActive,
  filtersKey,
  normalizeFilters,
  originAuditLabel,
  poolCountLabel,
  poolPresentation,
  poolRowLines,
  priorityLabel,
  profilesLabel,
  removeConfirmBody,
  rowSubtitle,
} from "./shortlist-presentation";

const READY = "ready" as const;
const ERROR = "error" as const;
const LOADING = "loading" as const;

const BOTH = { canAddProfiles: true, canCreateLists: true };

describe("profilesLabel", () => {
  it("usa il singolare per una sola membership (QA005)", () => {
    expect(profilesLabel(1)).toBe("1 profilo");
  });

  it("usa il plurale per zero e per quantità maggiori (§30)", () => {
    expect(profilesLabel(0)).toBe("0 profili");
    expect(profilesLabel(3)).toBe("3 profili");
    expect(profilesLabel(60)).toBe("60 profili");
  });
});

describe("rowSubtitle", () => {
  it("compone «ambito · N profili» come nel master 02", () => {
    expect(rowSubtitle("Prima squadra", 3)).toBe("Prima squadra · 3 profili");
  });

  it("omette il separatore quando la Position non ha un ambito leggibile", () => {
    expect(rowSubtitle(null, 2)).toBe("2 profili");
  });

  it("aggiunge Posizione chiusa come metadato neutro (QA008)", () => {
    expect(rowSubtitle("Prima squadra", 3, true)).toContain(
      SHORTLIST_COPY.positionClosed,
    );
  });
});

describe("centerPresentation", () => {
  it("mostra il vuoto globale solo con entrambi i gruppi risolti e vuoti (QA015)", () => {
    const result = centerPresentation({
      capabilities: BOTH,
      customCount: 0,
      customState: READY,
      positionCount: 0,
      positionState: READY,
    });

    expect(result).toEqual({
      body: SHORTLIST_COPY.globalEmptyBoth,
      kind: "globalEmpty",
      showCreate: true,
    });
  });

  it("non produce il vuoto globale se un gruppo è in errore e l'altro vuoto (QA016)", () => {
    expect(
      centerPresentation({
        capabilities: BOTH,
        customCount: 0,
        customState: READY,
        positionCount: 0,
        positionState: ERROR,
      }).kind,
    ).toBe("content");
  });

  it("non produce il vuoto globale mentre un gruppo sta ancora caricando", () => {
    expect(
      centerPresentation({
        capabilities: BOTH,
        customCount: 0,
        customState: LOADING,
        positionCount: 0,
        positionState: READY,
      }).kind,
    ).toBe("content");
  });

  it("l'errore globale richiede che falliscano entrambi i gruppi (QA103)", () => {
    expect(
      centerPresentation({
        capabilities: BOTH,
        customCount: 0,
        customState: ERROR,
        positionCount: 0,
        positionState: ERROR,
      }).kind,
    ).toBe("globalError");

    expect(
      centerPresentation({
        capabilities: BOTH,
        customCount: 2,
        customState: READY,
        positionCount: 0,
        positionState: ERROR,
      }).kind,
    ).toBe("content");
  });

  it("una CUSTOM accessibile a zero impedisce il falso empty globale (QA007)", () => {
    expect(
      centerPresentation({
        capabilities: BOTH,
        customCount: 1,
        customState: READY,
        positionCount: 0,
        positionState: READY,
      }).kind,
    ).toBe("content");
  });

  it("adatta copy e CTA alle capacità reali (QA015)", () => {
    const createOnly = centerPresentation({
      capabilities: { canAddProfiles: false, canCreateLists: true },
      customCount: 0,
      customState: READY,
      positionCount: 0,
      positionState: READY,
    });

    expect(createOnly).toEqual({
      body: SHORTLIST_COPY.globalEmptyCreateOnly,
      kind: "globalEmpty",
      showCreate: true,
    });

    const addOnly = centerPresentation({
      capabilities: { canAddProfiles: true, canCreateLists: false },
      customCount: 0,
      customState: READY,
      positionCount: 0,
      positionState: READY,
    });

    expect(addOnly).toEqual({
      body: SHORTLIST_COPY.globalEmptyAddOnly,
      kind: "globalEmpty",
      showCreate: false,
    });

    const readOnly = centerPresentation({
      capabilities: { canAddProfiles: false, canCreateLists: false },
      customCount: 0,
      customState: READY,
      positionCount: 0,
      positionState: READY,
    });

    expect(readOnly).toEqual({
      body: SHORTLIST_COPY.globalEmptyReadOnly,
      kind: "globalEmpty",
      showCreate: false,
    });
  });
});

describe("poolRowLines — §12, §16", () => {
  const base = {
    applicationState: "active" as const,
    createdSource: "application" as const,
    evaluationStatus: "da_valutare" as const,
    notePreview: null,
    priority: null,
  };

  it("omette la priorità quando non è impostata (§12, QA031)", () => {
    expect(poolRowLines(base).evaluation).toBe("Da valutare");
  });

  it("mostra priorità e stato insieme quando la priorità c'è (§12)", () => {
    expect(
      poolRowLines({ ...base, evaluationStatus: "interessante", priority: "alta" })
        .evaluation,
    ).toBe("Alta · Interessante");
  });

  it("dice Da candidatura quando la membership è nata da lì (§16)", () => {
    expect(poolRowLines(base).origin).toBe(SHORTLIST_COPY.fromApplication);
  });

  it("non nega una candidatura solo perché l'origine è PROFILE (§16, QA064)", () => {
    expect(
      poolRowLines({ ...base, createdSource: "profile" }).origin,
    ).toBe(SHORTLIST_COPY.entryApplicationReceived);
  });

  it("usa la label neutra per una candidatura ritirata (§16, QA061)", () => {
    expect(
      poolRowLines({
        ...base,
        applicationState: "withdrawn",
        createdSource: "profile",
      }).origin,
    ).toBe(SHORTLIST_COPY.entryApplicationWithdrawn);
  });

  it("dice Aggiunto dal profilo quando non esiste candidatura (§16)", () => {
    expect(
      poolRowLines({
        ...base,
        applicationState: "none",
        createdSource: "profile",
      }).origin,
    ).toBe(SHORTLIST_COPY.fromProfile);
  });

  it("non afferma niente sulla candidatura senza autorizzazione (§16, QA062)", () => {
    /* Il server manda già `unknown` al posto di `application`: insieme a
       `applicationState: null` non resta nessuna dicitura. */
    expect(
      poolRowLines({
        ...base,
        applicationState: null,
        createdSource: "unknown",
      }).origin,
    ).toBeNull();
  });

  it("non inventa una nota quando non c'è (§12, QA032)", () => {
    expect(poolRowLines(base).note).toBeNull();
    expect(poolRowLines({ ...base, notePreview: "Buona visione." }).note).toBe(
      "Buona visione.",
    );
  });
});

describe("poolCountLabel — §14", () => {
  it("mostra il solo totale senza restrizioni (QA050)", () => {
    expect(
      poolCountLabel({ filtered: 3, filtersApplied: false, total: 3 }),
    ).toBe("3 profili");
  });

  it("mostra «1 di 3 profili» con filtri attivi (screen 04)", () => {
    expect(
      poolCountLabel({ filtered: 1, filtersApplied: true, total: 3 }),
    ).toBe("1 di 3 profili");
  });

  it("mostra «0 di 3 profili» senza corrispondenze (screen 16, QA047)", () => {
    expect(
      poolCountLabel({ filtered: 0, filtersApplied: true, total: 3 }),
    ).toBe("0 di 3 profili");
  });
});

describe("normalizeFilters — §13", () => {
  it("deduplica e riordina stabilmente (QA054)", () => {
    expect(
      normalizeFilters({
        priorities: ["media", "alta", "alta"],
        statuses: [],
      }).priorities,
    ).toEqual(["alta", "media"]);
  });

  it("tratta tutti i valori di una dimensione come nessuna restrizione (QA042)", () => {
    expect(
      normalizeFilters({
        priorities: ["alta", "media", "bassa", "none"],
        statuses: [],
      }),
    ).toEqual({ priorities: [], statuses: [] });
  });

  it("produce la stessa chiave per selezioni equivalenti (§27)", () => {
    expect(filtersKey({ priorities: ["media", "alta"], statuses: [] })).toBe(
      filtersKey({ priorities: ["alta", "media"], statuses: [] }),
    );
  });

  it("distingue «Senza priorità» da «Bassa» (§13, QA040)", () => {
    expect(filtersKey({ priorities: ["none"], statuses: [] })).not.toBe(
      filtersKey({ priorities: ["bassa"], statuses: [] }),
    );
  });

  it("non considera attivo un filtro che non restringe nulla (QA041)", () => {
    expect(filtersAreActive({ priorities: [], statuses: [] })).toBe(false);
    expect(
      filtersAreActive({
        priorities: ["alta", "media", "bassa", "none"],
        statuses: [],
      }),
    ).toBe(false);
    expect(filtersAreActive({ priorities: ["alta"], statuses: [] })).toBe(true);
  });
});

describe("poolPresentation — §28", () => {
  it("distingue il vuoto reale dal vuoto filtrato (QA047)", () => {
    expect(
      poolPresentation({ filtersApplied: false, rowCount: 0, total: 0 }),
    ).toBe("empty");

    expect(
      poolPresentation({ filtersApplied: true, rowCount: 0, total: 3 }),
    ).toBe("filteredEmpty");
  });

  it("una lista senza membership non diventa un vuoto filtrato", () => {
    /* §28: «Non confonderlo con una lista senza membership.» Anche con i
       filtri attivi, totale 0 è il vuoto reale. */
    expect(
      poolPresentation({ filtersApplied: true, rowCount: 0, total: 0 }),
    ).toBe("empty");
  });

  it("mostra le righe quando ce ne sono", () => {
    expect(
      poolPresentation({ filtersApplied: true, rowCount: 1, total: 3 }),
    ).toBe("rows");
  });
});

describe("originAuditLabel e addedByLine — §15, §16, §30", () => {
  it("conserva l'origine storica anche con una candidatura collegata (QA060)", () => {
    expect(originAuditLabel("profile")).toBe(SHORTLIST_COPY.fromProfile);
    expect(originAuditLabel("application")).toBe(SHORTLIST_COPY.fromApplication);
  });

  it("non inventa un'origine sconosciuta (§30)", () => {
    expect(originAuditLabel("unknown")).toBeNull();
  });

  it("omette l'autore mancante invece di sostituirlo (QA065)", () => {
    expect(
      addedByLine({ addedByName: null, createdAtLabel: "12 set 2026" }),
    ).toBe("12 set 2026");

    expect(
      addedByLine({ addedByName: "Marco Bianchi", createdAtLabel: "13 set 2026" }),
    ).toBe("Aggiunto da Marco Bianchi · 13 set 2026");

    expect(
      addedByLine({ addedByName: null, createdAtLabel: null }),
    ).toBeNull();
  });
});

describe("removeConfirmBody — §21", () => {
  it("nomina persona e destinazione reali (QA093)", () => {
    expect(
      removeConfirmBody({
        name: "Mario Rossi",
        positionTitle: "Centrocampista",
        scopeLabel: "Prima squadra",
      }),
    ).toBe("Mario Rossi verrà rimosso da Centrocampista · Prima squadra.");
  });

  it("non lascia un separatore penzolante senza scope", () => {
    expect(
      removeConfirmBody({
        name: "Mario Rossi",
        positionTitle: "Centrocampista",
        scopeLabel: null,
      }),
    ).toBe("Mario Rossi verrà rimosso da Centrocampista.");
  });
});

describe("priorityLabel — §12, §15, §17", () => {
  it("non produce testo per una priorità assente (QA031)", () => {
    /* Lo stesso null è «omesso» nella lista, «—» nel dettaglio, «Senza
       priorità» nel filtro e «Nessuna» nell'editor: la funzione non ne
       sceglie nessuno al posto del chiamante. */
    expect(priorityLabel(null)).toBeNull();
    expect(priorityLabel("alta")).toBe("Alta");
  });
});

describe("addErrorCopy", () => {
  it("usa il motivo autorizzato quando è noto (§30)", () => {
    expect(addErrorCopy("withdrawn")).toBe(SHORTLIST_COPY.withdrawn);
    expect(addErrorCopy("conflict")).toBe(SHORTLIST_COPY.conflict);
    expect(addErrorCopy("notAuthorized")).toBe(SHORTLIST_COPY.revoked);
  });

  it("non rivela dettagli per gli altri casi", () => {
    expect(addErrorCopy("network")).toBe(SHORTLIST_COPY.addError);
    expect(addErrorCopy("notFound")).toBe(SHORTLIST_COPY.addError);
  });
});
