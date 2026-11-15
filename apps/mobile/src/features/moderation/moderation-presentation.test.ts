/**
 * Segnala: la macchina di stato del flow, le categorie a uno o due livelli, la pulizia dei
 * dettagli, la chiave di idempotenza, il copy per tipo di target (HOM-11 §80–§101, §127,
 * §156–§160, §184, §256–§262).
 */
import { describe, expect, it } from "vitest";

import {
  COMMENT_REPORTED_LABEL,
  EMPTY_REPORT_DRAFT,
  REPORTED_ACTION_A11Y_LABEL,
  REPORTED_ACTION_LABEL,
  REPORT_ACTION_LABEL,
  REPORT_COPY,
  REPORT_DETAILS_MAX,
  REPORT_DONE,
  REPORT_HEADER_TITLE,
  REPORT_PRIVACY_NOTICE,
  REPORT_SUBMIT,
  REPORT_SUBMIT_ERROR,
  REPORT_SUCCESS_BODY,
  REPORT_SUCCESS_TITLE,
  allowsDetails,
  buildSubmission,
  chooseCategory,
  chooseSubcategory,
  clearCategory,
  detailsCounter,
  isSubmitEnabled,
  isTerminalPhase,
  needsSubcategory,
  nextOperationKey,
  phaseAnnouncement,
  phaseForCreateStatus,
  phaseForReportState,
  reportStep,
  reportTargetKey,
  rootCategories,
  sanitizeDetails,
  setDetails,
  submissionFingerprint,
  submitBlockReason,
  subcategoriesOf,
  terminalTitle,
} from "./moderation-presentation";
import type { ReportCategory, ReportDraft } from "./moderation-types";

function category(overrides: Partial<ReportCategory> & { categoryId: string }): ReportCategory {
  return {
    allowsFreeText: true,
    description: null,
    label: overrides.categoryId,
    parentId: null,
    requiresSubcategory: false,
    sortOrder: 0,
    ...overrides,
  };
}

/** Una categoria con secondo livello (§89) e una semplice (§90). */
const CATEGORIES: ReportCategory[] = [
  category({ categoryId: "other", label: "Altro", sortOrder: 8 }),
  category({ categoryId: "spam", label: "Spam o contenuto ingannevole", requiresSubcategory: true, sortOrder: 1 }),
  category({ categoryId: "spam.scam", label: "Truffa o tentativo di frode", parentId: "spam", sortOrder: 2 }),
  category({ categoryId: "spam.fake", label: "Contenuto falso o ingannevole", parentId: "spam", sortOrder: 1 }),
  category({ allowsFreeText: false, categoryId: "privacy", label: "Violazione della privacy", sortOrder: 6 }),
];

describe("copy — §80–§81, §94, §115, §120–§122, §127, §156, §159–§160", () => {
  it("le stringhe della spec, una per una", () => {
    expect(REPORT_HEADER_TITLE).toBe("Segnala contenuto");
    expect(REPORT_COPY.CONTENT.title).toBe("Perché vuoi segnalare questo contenuto?");
    expect(REPORT_PRIVACY_NOTICE).toBe(
      "La tua segnalazione è riservata e ci aiuta a mantenere PROLINK un ambiente sicuro.",
    );
    expect(REPORT_SUBMIT).toBe("Invia segnalazione");
    expect(REPORT_SUCCESS_TITLE).toBe("Segnalazione inviata");
    expect(REPORT_SUCCESS_BODY).toBe("Valuteremo il contenuto secondo le regole di PROLINK.");
    expect(REPORT_DONE).toBe("Fine");
    expect(REPORT_SUBMIT_ERROR).toBe("Non è stato possibile inviare la segnalazione. Riprova.");
    expect(REPORT_ACTION_LABEL).toBe("Segnala");
    expect(REPORTED_ACTION_LABEL).toBe("Segnalazione inviata ✓");
    expect(COMMENT_REPORTED_LABEL).toBe("Commento segnalato");
  });

  it("§201: lo screen reader legge «Segnalazione inviata», non il segno di spunta", () => {
    expect(REPORTED_ACTION_A11Y_LABEL).toBe("Segnalazione inviata");
  });

  it("COMMENT: stesso engine, copy per commento (§81, §160)", () => {
    expect(REPORT_COPY.COMMENT.title).toBe("Perché vuoi segnalare questo commento?");
    expect(REPORT_COPY.COMMENT.duplicate).toBe("Hai già segnalato questo commento");
    expect(REPORT_COPY.COMMENT.unavailable).toBe("Il commento non è più disponibile");
    expect(REPORT_COPY.CONTENT.duplicate).toBe("Hai già segnalato questo contenuto");
    expect(REPORT_COPY.CONTENT.unavailable).toBe("Il contenuto non è più disponibile");
  });

  it("§120–§121: il successo non promette rimozioni, sospensioni o violazioni confermate", () => {
    const copy = `${REPORT_SUCCESS_TITLE} ${REPORT_SUCCESS_BODY}`.toLowerCase();

    for (const promise of ["elimin", "sospes", "confermat", "rimoss", "bloccat"]) {
      expect(copy).not.toContain(promise);
    }
  });

  it("§122: nessun Annulla fra gli stati terminali", () => {
    for (const phase of ["success", "duplicate", "unavailable", "not_allowed"] as const) {
      expect(terminalTitle(phase, "CONTENT")).not.toMatch(/annulla/i);
    }
  });
});

describe("categorie — §83–§90", () => {
  it("il primo livello nell'ordine del server, senza le sottocategorie", () => {
    expect(rootCategories(CATEGORIES).map((entry) => entry.categoryId)).toEqual(["spam", "privacy", "other"]);
  });

  it("le sottocategorie di una categoria, nell'ordine del server (§89)", () => {
    expect(subcategoriesOf(CATEGORIES, "spam").map((entry) => entry.categoryId)).toEqual([
      "spam.fake",
      "spam.scam",
    ]);
    expect(subcategoriesOf(CATEGORIES, "other")).toEqual([]);
  });

  it("§88–§90: il secondo livello solo se la categoria lo richiede E ne esistono di attive", () => {
    expect(needsSubcategory(CATEGORIES, CATEGORIES[1])).toBe(true);
    expect(needsSubcategory(CATEGORIES, CATEGORIES[0])).toBe(false);
    // Richiede ma il server non ne ha mandate: nessuna schermata vuota.
    const lonely = category({ categoryId: "x", requiresSubcategory: true });
    expect(needsSubcategory([lonely], lonely)).toBe(false);
    expect(needsSubcategory(CATEGORIES, null)).toBe(false);
  });

  it("§91–§92: il campo dettagli solo se la categoria ammette testo libero", () => {
    expect(allowsDetails(CATEGORIES[0])).toBe(true);
    expect(allowsDetails(CATEGORIES[4])).toBe(false);
    expect(allowsDetails(null)).toBe(false);
  });
});

describe("passi e bozza — §90, §93, §98", () => {
  it("senza categoria si sceglie, con categoria si va ai dettagli", () => {
    expect(reportStep(EMPTY_REPORT_DRAFT)).toBe("category");
    expect(reportStep(chooseCategory(EMPTY_REPORT_DRAFT, "other"))).toBe("details");
  });

  it("§98 «Modifica»: si torna alla scelta e il testo resta", () => {
    const draft = setDetails(chooseCategory(EMPTY_REPORT_DRAFT, "spam"), "Vedi il link");
    const back = clearCategory(chooseSubcategory(draft, "spam.scam"));

    expect(reportStep(back)).toBe("category");
    expect(back).toMatchObject({ categoryId: null, details: "Vedi il link", subcategoryId: null });
  });

  it("un'altra categoria invalida la sottocategoria ma non il testo; la stessa la conserva", () => {
    const draft = setDetails(chooseSubcategory(chooseCategory(EMPTY_REPORT_DRAFT, "spam"), "spam.scam"), "x");

    expect(chooseCategory(draft, "other")).toMatchObject({ details: "x", subcategoryId: null });
    expect(chooseCategory(draft, "spam").subcategoryId).toBe("spam.scam");
  });
});

describe("testo libero — §91, §184", () => {
  it("toglie i caratteri di controllo, tiene a capo e tabulazioni", () => {
    expect(sanitizeDetails("Ciao\u0000 mondo\u0007\nSeconda\u0001 riga\t!")).toBe("Ciao mondo\nSeconda riga\t!");
  });

  it("taglia al limite dei 500 caratteri e il contatore lo dice (mockup 6)", () => {
    const long = "a".repeat(REPORT_DETAILS_MAX + 40);

    expect(sanitizeDetails(long)).toHaveLength(REPORT_DETAILS_MAX);
    expect(detailsCounter(0)).toBe("0/500");
    expect(detailsCounter(137)).toBe("137/500");
  });

  it("la digitazione non fa trim: uno spazio fra due parole è lecito", () => {
    expect(setDetails(EMPTY_REPORT_DRAFT, "due ").details).toBe("due ");
  });
});

describe("invio — §94–§97", () => {
  it("§95: senza categoria la CTA è disabilitata", () => {
    expect(submitBlockReason(EMPTY_REPORT_DRAFT, CATEGORIES)).toBe("no_category");
  });

  it("§95: con una sottocategoria obbligatoria mancante la CTA è disabilitata", () => {
    expect(submitBlockReason(chooseCategory(EMPTY_REPORT_DRAFT, "spam"), CATEGORIES)).toBe("no_subcategory");
  });

  it("una sottocategoria che non è figlia della categoria non vale", () => {
    const draft: ReportDraft = { ...chooseCategory(EMPTY_REPORT_DRAFT, "spam"), subcategoryId: "privacy" };

    expect(submitBlockReason(draft, CATEGORIES)).toBe("no_subcategory");
  });

  it("una categoria che il server non manda più (rimossa o disattivata) non si invia", () => {
    expect(submitBlockReason(chooseCategory(EMPTY_REPORT_DRAFT, "sparita"), CATEGORIES)).toBe("unknown_category");
  });

  it("§90 categoria semplice: si invia senza sottocategoria né dettagli", () => {
    const draft = chooseCategory(EMPTY_REPORT_DRAFT, "other");

    expect(submitBlockReason(draft, CATEGORIES)).toBeNull();
    expect(buildSubmission(draft, CATEGORIES)).toEqual({
      categoryId: "other",
      details: null,
      subcategoryId: null,
    });
  });

  it("§89 con sottocategoria: parte la sottocategoria, i dettagli puliti", () => {
    const draft = setDetails(
      chooseSubcategory(chooseCategory(EMPTY_REPORT_DRAFT, "spam"), "spam.scam"),
      "  Link sospetto nel post \u0007 ",
    );

    expect(buildSubmission(draft, CATEGORIES)).toEqual({
      categoryId: "spam",
      details: "Link sospetto nel post",
      subcategoryId: "spam.scam",
    });
  });

  it("§92: i dettagli sono facoltativi — vuoti o di soli spazi non partono", () => {
    const draft = setDetails(chooseCategory(EMPTY_REPORT_DRAFT, "other"), "   \n ");

    expect(buildSubmission(draft, CATEGORIES)?.details).toBeNull();
  });

  it("dettagli scritti e poi la categoria cambia in una che non li ammette: non partono (§91)", () => {
    const draft = setDetails(chooseCategory(EMPTY_REPORT_DRAFT, "privacy"), "testo");

    expect(buildSubmission(draft, CATEGORIES)?.details).toBeNull();
  });

  it("senza selezione valida non c'è nulla da inviare", () => {
    expect(buildSubmission(EMPTY_REPORT_DRAFT, CATEGORIES)).toBeNull();
  });

  it("la CTA risponde solo da modulo o da errore, e solo con la selezione completa (§95–§97)", () => {
    const ready = chooseCategory(EMPTY_REPORT_DRAFT, "other");

    expect(isSubmitEnabled({ categories: CATEGORIES, draft: ready, phase: "form" })).toBe(true);
    expect(isSubmitEnabled({ categories: CATEGORIES, draft: ready, phase: "error" })).toBe(true);
    // §96: dopo il tap non risponde più.
    expect(isSubmitEnabled({ categories: CATEGORIES, draft: ready, phase: "submitting" })).toBe(false);
    expect(isSubmitEnabled({ categories: CATEGORIES, draft: ready, phase: "success" })).toBe(false);
    expect(isSubmitEnabled({ categories: CATEGORIES, draft: EMPTY_REPORT_DRAFT, phase: "form" })).toBe(false);
  });
});

describe("chiave di idempotenza — §100–§101, §158, §262", () => {
  const submission = { categoryId: "other", details: "x", subcategoryId: null };
  const fingerprint = submissionFingerprint(submission);

  it("la prima volta nasce una chiave", () => {
    expect(nextOperationKey(EMPTY_REPORT_DRAFT, fingerprint, () => "k-1")).toBe("k-1");
  });

  it("retry dopo un errore o un timeout: STESSA chiave, nessun duplicato (§101, §158)", () => {
    const draft: ReportDraft = { ...EMPTY_REPORT_DRAFT, attemptedFingerprint: fingerprint, operationKey: "k-1" };

    expect(nextOperationKey(draft, fingerprint, () => "k-2")).toBe("k-1");
  });

  it("contenuto diverso: chiave nuova (con la stessa chiave non sarebbe un retry)", () => {
    const draft: ReportDraft = { ...EMPTY_REPORT_DRAFT, attemptedFingerprint: fingerprint, operationKey: "k-1" };
    const other = submissionFingerprint({ ...submission, details: "y" });

    expect(nextOperationKey(draft, other, () => "k-2")).toBe("k-2");
  });

  it("l'impronta distingue categoria, sottocategoria e dettagli", () => {
    const base = submissionFingerprint(submission);

    expect(submissionFingerprint({ ...submission, categoryId: "spam" })).not.toBe(base);
    expect(submissionFingerprint({ ...submission, subcategoryId: "spam.scam" })).not.toBe(base);
    expect(submissionFingerprint({ ...submission, details: null })).not.toBe(base);
  });
});

describe("esiti → fasi — §115, §127, §155, §159", () => {
  it("created → success; already_reported → duplicate; target_unavailable → unavailable", () => {
    expect(phaseForCreateStatus("created")).toBe("success");
    expect(phaseForCreateStatus("already_reported")).toBe("duplicate");
    expect(phaseForCreateStatus("target_unavailable")).toBe("unavailable");
    expect(phaseForCreateStatus("not_allowed")).toBe("not_allowed");
  });

  it("invalid_category non è un successo (§155): errore, categorie da rileggere", () => {
    expect(phaseForCreateStatus("invalid_category")).toBe("error");
  });

  it("lo stato del target all'apertura: sparito, già segnalato, non ammesso, o via libera", () => {
    expect(phaseForReportState({ alreadyReported: false, available: false, reportable: true })).toBe("unavailable");
    expect(phaseForReportState({ alreadyReported: true, available: true, reportable: true })).toBe("duplicate");
    expect(phaseForReportState({ alreadyReported: false, available: true, reportable: false })).toBe("not_allowed");
    expect(phaseForReportState({ alreadyReported: false, available: true, reportable: true })).toBeNull();
  });

  it("già segnalato vince sul target sparito: il report esiste comunque (§161); e `reportable` è già falso", () => {
    expect(phaseForReportState({ alreadyReported: true, available: false, reportable: false })).toBe("duplicate");
    expect(phaseForReportState({ alreadyReported: true, available: true, reportable: false })).toBe("duplicate");
  });

  it("success, duplicate, unavailable e not_allowed sono terminali; form, invio ed errore no", () => {
    for (const phase of ["success", "duplicate", "unavailable", "not_allowed"] as const) {
      expect(isTerminalPhase(phase)).toBe(true);
    }
    for (const phase of ["form", "submitting", "error"] as const) {
      expect(isTerminalPhase(phase)).toBe(false);
    }
  });

  it("§204: errore e terminali si annunciano; il modulo no", () => {
    expect(phaseAnnouncement("error", "CONTENT")).toBe(REPORT_SUBMIT_ERROR);
    expect(phaseAnnouncement("success", "CONTENT")).toContain("Segnalazione inviata");
    expect(phaseAnnouncement("duplicate", "COMMENT")).toBe("Hai già segnalato questo commento");
    expect(phaseAnnouncement("form", "CONTENT")).toBeNull();
    expect(phaseAnnouncement("submitting", "CONTENT")).toBeNull();
  });
});

describe("chiave del target — D1, §104", () => {
  it("un commento (anche una Risposta) si identifica per il proprio id; un contenuto per tipo e id", () => {
    expect(reportTargetKey({ contentType: "profile_post", targetId: "c-1", targetType: "COMMENT" })).toBe(
      "COMMENT:c-1",
    );
    expect(reportTargetKey({ contentType: "club_media", targetId: "p-1", targetType: "CONTENT" })).toBe(
      "CONTENT:club_media:p-1",
    );
  });

  it("il tipo del contenuto padre non cambia la chiave del commento", () => {
    expect(reportTargetKey({ contentType: "a", targetId: "c-1", targetType: "COMMENT" })).toBe(
      reportTargetKey({ contentType: "b", targetId: "c-1", targetType: "COMMENT" }),
    );
  });
});
