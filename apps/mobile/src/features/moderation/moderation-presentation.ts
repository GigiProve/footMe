/**
 * Derivazioni pure e copy di Segnala (HOM-11 §74–§162, §184, §202–§204, §212–§216).
 *
 * La macchina di stato del flow è qui, senza React: categoria → (sottocategoria +
 * dettagli | dettagli) → invio → successo | già segnalato | non disponibile | errore.
 * È ciò che rende testabili il passo successivo (§90), la CTA disabilitata (§95), la
 * pulizia del testo libero (§184), la chiave di idempotenza stabile (§100–§101) e il
 * copy per tipo di target (§80–§81, §127, §159–§160) senza renderizzare niente.
 *
 * Mai codici tecnici a schermo (§86, §113): id di categoria, enum di moderazione e
 * stati backend non compaiono nel copy.
 */

import type {
  CreateReportStatus,
  ReportCategory,
  ReportDraft,
  ReportPhase,
  ReportState,
  ReportStep,
  ReportTarget,
  ReportTargetType,
} from "./moderation-types";

// ── Copy comune (§80, §94, §115, §156) ──────────────────────────
export const REPORT_HEADER_TITLE = "Segnala contenuto";
export const REPORT_PRIVACY_NOTICE =
  "La tua segnalazione è riservata e ci aiuta a mantenere PROLINK un ambiente sicuro.";
export const REPORT_SELECTED_CATEGORY_LABEL = "Categoria selezionata";
export const REPORT_EDIT_CATEGORY = "Modifica";
export const REPORT_SUBCATEGORY_TITLE = "In cosa consiste il problema?";
export const REPORT_DETAILS_LABEL = "Aggiungi dettagli";
export const REPORT_DETAILS_OPTIONAL = "(facoltativo)";
/** §203: l'etichetta parlata della textarea, associata al campo. */
export const REPORT_DETAILS_A11Y_LABEL = "Aggiungi dettagli, facoltativo";
export const REPORT_DETAILS_PLACEHOLDER =
  "Fornisci qualsiasi informazione utile per aiutarci a comprendere meglio il problema.";
export const REPORT_SUBMIT = "Invia segnalazione";
export const REPORT_DONE = "Fine";
/** §115, §120–§121: la ricezione, mai una promessa di provvedimento. */
export const REPORT_SUCCESS_TITLE = "Segnalazione inviata";
export const REPORT_SUCCESS_BODY = "Valuteremo il contenuto secondo le regole di PROLINK.";
/** §156, §204: l'errore di invio, annunciato; i dati restano (§157). */
export const REPORT_SUBMIT_ERROR = "Non è stato possibile inviare la segnalazione. Riprova.";
export const REPORT_CATEGORIES_ERROR = "Non è stato possibile caricare le categorie.";
export const REPORT_RETRY = "Riprova";
/** Limite del testo libero (§91, mockup 6: «0/500»); il server taglia comunque a 500. */
export const REPORT_DETAILS_MAX = 500;

// ── Menu (§126–§131, D6) ────────────────────────────────────────
export const REPORT_ACTION_LABEL = "Segnala";
/** §130: stato non azionabile «Segnalazione inviata ✓». */
export const REPORTED_ACTION_LABEL = "Segnalazione inviata ✓";
/** §201: lo screen reader legge la frase, non il segno di spunta. */
export const REPORTED_ACTION_A11Y_LABEL = "Segnalazione inviata";

/** Un commento segnalato si ripiega in una riga (§134–§135, Screen 8). */
export const COMMENT_REPORTED_LABEL = "Commento segnalato";

export type ReportCopy = {
  /** §80–§81: il titolo del primo passo. */
  title: string;
  /** §127: già segnalato. */
  duplicate: string;
  /** §159–§160: il target non c'è più. */
  unavailable: string;
  /** Il server non ammette la segnalazione (target proprio o gestito, D5). */
  notAllowed: string;
};

/** §80–§81, §127, §159–§160: lo stesso engine, il copy cambia per tipo di target. */
export const REPORT_COPY: Record<ReportTargetType, ReportCopy> = {
  COMMENT: {
    duplicate: "Hai già segnalato questo commento",
    notAllowed: "Non puoi segnalare questo commento.",
    title: "Perché vuoi segnalare questo commento?",
    unavailable: "Il commento non è più disponibile",
  },
  CONTENT: {
    duplicate: "Hai già segnalato questo contenuto",
    notAllowed: "Non puoi segnalare questo contenuto.",
    title: "Perché vuoi segnalare questo contenuto?",
    unavailable: "Il contenuto non è più disponibile",
  },
};

export function reportCopy(targetType: ReportTargetType): ReportCopy {
  return REPORT_COPY[targetType];
}

/** Il messaggio di una fase terminale (§115, §127, §159–§160), o `null` se non lo è. */
export function terminalTitle(phase: ReportPhase, targetType: ReportTargetType): string | null {
  switch (phase) {
    case "success":
      return REPORT_SUCCESS_TITLE;
    case "duplicate":
      return REPORT_COPY[targetType].duplicate;
    case "unavailable":
      return REPORT_COPY[targetType].unavailable;
    case "not_allowed":
      return REPORT_COPY[targetType].notAllowed;
    default:
      return null;
  }
}

export function isTerminalPhase(phase: ReportPhase): boolean {
  return terminalTitle(phase, "CONTENT") !== null;
}

// ── Chiave del target (bozze e stato «segnalato» di sessione) ───

/**
 * Tipo, tipo contenuto e id insieme: lo stesso uuid non identifica un target da solo.
 * Un commento è identificato dal proprio id (§104); un contenuto da tipo + id.
 */
export function reportTargetKey(
  target: Pick<ReportTarget, "targetType" | "contentType" | "targetId">,
): string {
  return target.targetType === "COMMENT"
    ? `COMMENT:${target.targetId}`
    : `CONTENT:${target.contentType}:${target.targetId}`;
}

// ── Categorie (§83–§90) ─────────────────────────────────────────

function bySortOrder(a: ReportCategory, b: ReportCategory): number {
  return a.sortOrder - b.sortOrder;
}

/** Il primo livello, nell'ordine del server (§83). */
export function rootCategories(categories: readonly ReportCategory[]): ReportCategory[] {
  return categories.filter((category) => category.parentId === null).sort(bySortOrder);
}

/** Il secondo livello di una categoria (§88–§89). */
export function subcategoriesOf(
  categories: readonly ReportCategory[],
  categoryId: string,
): ReportCategory[] {
  return categories.filter((category) => category.parentId === categoryId).sort(bySortOrder);
}

export function findCategory(
  categories: readonly ReportCategory[],
  categoryId: string | null,
): ReportCategory | null {
  return categoryId ? (categories.find((category) => category.categoryId === categoryId) ?? null) : null;
}

/**
 * §88–§90: il secondo livello si mostra solo se la categoria lo richiede E il server
 * ne ha mandate di attive. Una categoria semplice va dritta ai dettagli, senza
 * schermate inutili.
 */
export function needsSubcategory(
  categories: readonly ReportCategory[],
  category: ReportCategory | null,
): boolean {
  return !!category && category.requiresSubcategory && subcategoriesOf(categories, category.categoryId).length > 0;
}

/**
 * §91–§92: il campo dettagli compare se la categoria ammette testo libero. Vale
 * quello della categoria scelta (la madre), non quello delle sottocategorie.
 */
export function allowsDetails(category: ReportCategory | null): boolean {
  return !!category && category.allowsFreeText;
}

// ── Bozza e passi (§98–§99) ─────────────────────────────────────

export const EMPTY_REPORT_DRAFT: ReportDraft = {
  attemptedFingerprint: null,
  categoryId: null,
  details: "",
  operationKey: null,
  subcategoryId: null,
};

/** Il passo mostrato: senza categoria la scelta, con categoria i dettagli. */
export function reportStep(draft: ReportDraft): ReportStep {
  return draft.categoryId ? "details" : "category";
}

/** §93: sceglie la categoria. Un'altra categoria invalida la sottocategoria, non il testo. */
export function chooseCategory(draft: ReportDraft, categoryId: string): ReportDraft {
  return {
    ...draft,
    categoryId,
    subcategoryId: draft.categoryId === categoryId ? draft.subcategoryId : null,
  };
}

/** §93 «Modifica» e la freccia indietro: si torna alla scelta, il testo resta (§98). */
export function clearCategory(draft: ReportDraft): ReportDraft {
  return { ...draft, categoryId: null, subcategoryId: null };
}

export function chooseSubcategory(draft: ReportDraft, subcategoryId: string): ReportDraft {
  return { ...draft, subcategoryId };
}

/**
 * §184: il testo libero è input privato di moderazione. Via i caratteri di controllo
 * (restano a capo e tabulazione), taglio al limite. Lo trim lo fa l'invio, non la
 * digitazione: l'utente può scrivere uno spazio fra due parole.
 */
export function sanitizeDetails(value: string): string {
  const withoutControls = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  return withoutControls.slice(0, REPORT_DETAILS_MAX);
}

export function setDetails(draft: ReportDraft, value: string): ReportDraft {
  return { ...draft, details: sanitizeDetails(value) };
}

/** «0/500» (mockup 6). */
export function detailsCounter(length: number): string {
  return `${length}/${REPORT_DETAILS_MAX}`;
}

// ── Invio (§94–§97, §100–§101) ──────────────────────────────────

export type SubmitBlock = "no_category" | "no_subcategory" | "unknown_category";

/**
 * §95: perché «Invia segnalazione» è disabilitato, o `null`. Manca una selezione
 * obbligatoria: la categoria, o la sottocategoria se la categoria la richiede.
 */
export function submitBlockReason(
  draft: ReportDraft,
  categories: readonly ReportCategory[],
): SubmitBlock | null {
  if (!draft.categoryId) {
    return "no_category";
  }

  const category = findCategory(categories, draft.categoryId);
  if (!category) {
    return "unknown_category";
  }

  if (needsSubcategory(categories, category)) {
    const sub = findCategory(categories, draft.subcategoryId);
    if (!sub || sub.parentId !== category.categoryId) {
      return "no_subcategory";
    }
  }

  return null;
}

export type Submission = {
  categoryId: string;
  subcategoryId: string | null;
  details: string | null;
};

/**
 * Ciò che parte verso il server. I dettagli solo se la categoria li ammette e non sono
 * vuoti dopo il trim (§91–§92); la sottocategoria solo se la categoria la richiede.
 */
export function buildSubmission(
  draft: ReportDraft,
  categories: readonly ReportCategory[],
): Submission | null {
  if (submitBlockReason(draft, categories) !== null || !draft.categoryId) {
    return null;
  }

  const category = findCategory(categories, draft.categoryId);
  const details = allowsDetails(category) ? sanitizeDetails(draft.details).trim() : "";

  return {
    categoryId: draft.categoryId,
    details: details.length > 0 ? details : null,
    subcategoryId: needsSubcategory(categories, category) ? draft.subcategoryId : null,
  };
}

export function submissionFingerprint(submission: Submission): string {
  return JSON.stringify([submission.categoryId, submission.subcategoryId, submission.details]);
}

/**
 * §100–§101, §158: la chiave resta quella dell'ultimo tentativo finché il contenuto
 * inviato è identico (doppio tap, retry, timeout ambiguo); con un contenuto diverso ne
 * serve una nuova — lo stesso `operation_key` con un payload diverso non sarebbe un
 * retry. Anche con la chiave nuova il server evita il doppione (`already_reported`).
 */
export function nextOperationKey(
  draft: ReportDraft,
  fingerprint: string,
  makeKey: () => string,
): string {
  return draft.operationKey && draft.attemptedFingerprint === fingerprint
    ? draft.operationKey
    : makeKey();
}

/** L'esito del server → la fase del flow (§115, §127, §155, §159). */
export function phaseForCreateStatus(status: CreateReportStatus): ReportPhase {
  switch (status) {
    case "created":
      return "success";
    case "already_reported":
      return "duplicate";
    case "target_unavailable":
      return "unavailable";
    case "not_allowed":
      return "not_allowed";
    default:
      // `invalid_category`: le categorie del client erano vecchie. Non è un successo
      // (§155): l'errore dice «Riprova» e il flow rilegge le categorie.
      return "error";
  }
}

/**
 * §126, §159, D5: lo stato del target all'apertura del flow → una fase terminale, o
 * `null` se si può procedere. Un target sparito vale «non disponibile»; già segnalato
 * vale «già segnalato» (§127); non segnalabile (proprio o gestito) «non ammesso».
 */
export function phaseForReportState(state: ReportState): ReportPhase | null {
  // «Già segnalato» prima di tutto: il server lo valuta prima della disponibilità (§161: il
  // report esiste anche se il target è sparito) e `reportable` è già falso se già segnalato.
  if (state.alreadyReported) {
    return "duplicate";
  }
  if (!state.available) {
    return "unavailable";
  }
  return state.reportable ? null : "not_allowed";
}

/** §95–§97: la CTA non risponde se manca una selezione o se un invio è già partito. */
export function isSubmitEnabled(input: {
  draft: ReportDraft;
  categories: readonly ReportCategory[];
  phase: ReportPhase;
}): boolean {
  return (
    (input.phase === "form" || input.phase === "error") &&
    submitBlockReason(input.draft, input.categories) === null
  );
}

/** §204: gli errori si annunciano; una stringa per lo screen reader. */
export function phaseAnnouncement(phase: ReportPhase, targetType: ReportTargetType): string | null {
  if (phase === "error") {
    return REPORT_SUBMIT_ERROR;
  }
  if (phase === "success") {
    return `${REPORT_SUCCESS_TITLE}. ${REPORT_SUCCESS_BODY}`;
  }
  return terminalTitle(phase, targetType);
}
