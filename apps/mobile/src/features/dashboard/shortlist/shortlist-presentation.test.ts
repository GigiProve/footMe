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
  centerPresentation,
  poolRowMeta,
  profilesLabel,
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

describe("poolRowMeta", () => {
  const base = {
    canSeeEvaluation: true,
    createdSource: "application" as const,
    evaluationStatus: "da_valutare" as const,
    hasApplication: true,
    priority: null,
  };

  it("omette la priorità quando non è impostata (§17, QA028)", () => {
    expect(poolRowMeta(base)).toEqual([
      "Da valutare",
      SHORTLIST_COPY.fromApplication,
    ]);
  });

  it("mostra la priorità solo se presente (§14)", () => {
    expect(poolRowMeta({ ...base, priority: "alta" })).toEqual([
      "Da valutare",
      "Priorità alta",
      SHORTLIST_COPY.fromApplication,
    ]);
  });

  it("segue la relazione corrente, non l'origine storica (§14, QA053)", () => {
    expect(
      poolRowMeta({
        ...base,
        createdSource: "profile",
        evaluationStatus: "interessante",
        hasApplication: true,
      }),
    ).toContain(SHORTLIST_COPY.fromApplication);

    expect(
      poolRowMeta({
        ...base,
        createdSource: "profile",
        hasApplication: false,
      }),
    ).toContain(SHORTLIST_COPY.fromProfile);
  });

  it("non afferma «non si è candidato» quando il metadata non è autorizzato (QA057)", () => {
    const meta = poolRowMeta({ ...base, hasApplication: null });

    expect(meta).not.toContain(SHORTLIST_COPY.fromProfile);
    expect(meta).not.toContain(SHORTLIST_COPY.fromApplication);
  });

  it("nasconde lo stato di valutazione a chi non è autorizzato (§14, §22)", () => {
    expect(
      poolRowMeta({ ...base, canSeeEvaluation: false, hasApplication: null }),
    ).toEqual([]);
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
