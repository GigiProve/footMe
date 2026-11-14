/**
 * Regole pure dell'editor Articolo (HOM-06.2 §7A–§7Z, §16–§27, §31–§40,
 * §117–§118, §133–§136). Niente React, niente rete.
 *
 *  • Modalità (§7A–§7B): il selector compare solo con due o più modalità
 *    autorizzate; con una sola si va diretti (fast path). Default «Scrivi su
 *    PROLINK» salvo ripristino di una bozza.
 *  • Bloccanti di Pubblica/Programma per modalità (§32, §7J, §7L, §7Q, §7W):
 *    il client spiega, il server decide.
 *  • Bozza significativa (§118): il selector aperto, da solo, non crea nulla.
 */

import { documentHasText, documentLimitIssue, urlDomain } from "./article-document";
import type {
  ArticleCover,
  ArticleDocument,
  ArticleLimits,
  ArticleProvenance,
  ArticleSourceSnapshot,
} from "./article-types";
import type { ArticleCreationMode } from "../publishing/publishing-types";

/* ------------------------------------------------------------------ */
/* Modalità                                                            */
/* ------------------------------------------------------------------ */

export type ModeOption = { mode: ArticleCreationMode; title: string; description: string };

/** §7A: copy delle tre righe del selector, in quest'ordine. */
export const MODE_OPTIONS: readonly ModeOption[] = [
  { description: "Crea e pubblica un articolo direttamente nell'app.", mode: "native", title: "Scrivi su PROLINK" },
  { description: "Mostra un'anteprima e rimanda alla fonte originale.", mode: "external_link", title: "Collega da un link" },
  { description: "Importa nell'editor un testo scritto altrove.", mode: "imported_text", title: "Incolla un articolo" },
];

/** §7B: le modalità utilizzabili da almeno una identity, nell'ordine del selector. */
export function availableModes(identities: readonly { modes: readonly ArticleCreationMode[] }[]): ArticleCreationMode[] {
  const allowed = new Set(identities.flatMap((identity) => identity.modes ?? []));
  return MODE_OPTIONS.map((option) => option.mode).filter((mode) => allowed.has(mode));
}

/** §7A ultimo capoverso: con una sola modalità niente selector inutile. */
export function modeEntry(modes: readonly ArticleCreationMode[]): { kind: "selector" } | { kind: "direct"; mode: ArticleCreationMode } | { kind: "none" } {
  if (modes.length === 0) return { kind: "none" };
  if (modes.length === 1) return { kind: "direct", mode: modes[0] };
  return { kind: "selector" };
}

export function defaultMode(modes: readonly ArticleCreationMode[], restored: ArticleCreationMode | null = null): ArticleCreationMode | null {
  if (restored && modes.includes(restored)) return restored;
  if (modes.includes("native")) return "native";
  return modes[0] ?? null;
}

/** Le identity che possono usare una modalità (§7B: niente eccezioni sulla label del ruolo). */
export function identitiesForMode<T extends { modes: readonly ArticleCreationMode[] }>(identities: readonly T[], mode: ArticleCreationMode): T[] {
  return identities.filter((identity) => (identity.modes ?? []).includes(mode));
}

/** Titolo dell'header dello schermo per modalità (§28, §7F, §7O, §218). */
export function editorHeaderTitle(mode: ArticleCreationMode, editing: "published" | "scheduled" | null): string {
  if (editing === "published") return "Modifica articolo";
  if (mode === "external_link") return "Collega da un link";
  return "Nuovo articolo";
}

/* ------------------------------------------------------------------ */
/* Identity di default (§21–§23)                                       */
/* ------------------------------------------------------------------ */

/**
 * §21: origin/identity contestuale → ultima compatibile → unica disponibile →
 * prima della lista (ordinata dal server). Un'identity non più autorizzata
 * non viene mai scelta.
 */
export function defaultIdentityId(
  identities: readonly { id: string }[],
  preferred: { contextual?: string | null; last?: string | null } = {},
): string | null {
  const has = (id: string | null | undefined) => Boolean(id) && identities.some((identity) => identity.id === id);
  if (has(preferred.contextual)) return preferred.contextual as string;
  if (has(preferred.last)) return preferred.last as string;
  return identities[0]?.id ?? null;
}

/* ------------------------------------------------------------------ */
/* Stato editoriale                                                    */
/* ------------------------------------------------------------------ */

export type ExternalSourceState =
  | { status: "empty" }
  | { status: "loading"; url: string }
  | {
      status: "ready";
      url: string;
      snapshotId: string;
      finalUrl: string;
      normalizedUrl: string | null;
      canonicalUrl: string | null;
      domain: string;
      siteName: string | null;
      snapshot: ArticleSourceSnapshot;
    }
  /** §7F errore recuperabile: l'URL resta (§7Y), Pubblica/Programma bloccati finché non si valida. */
  | { status: "failed"; url: string; reason: "invalid" | "blocked" | "unavailable"; domain: string | null };

export type ArticleDraftState = {
  mode: ArticleCreationMode;
  title: string;
  /** external_link: titolo manuale quando i metadata non l'hanno (§7J). */
  manualTitle: string;
  cover: ArticleCover | null;
  document: ArticleDocument;
  tagCount: number;
  source: ExternalSourceState;
  provenance: ArticleProvenance;
  rightsConfirmed: boolean;
};

export const EMPTY_PROVENANCE: ArticleProvenance = {
  noOriginalLink: false,
  originalAuthor: "",
  originalUrl: "",
  publishedElsewhere: null,
  sourceName: "",
};

/** Il titolo effettivo: metadata per external_link, altrimenti quello scritto. */
export function effectiveTitle(state: Pick<ArticleDraftState, "mode" | "title" | "manualTitle" | "source">): string {
  if (state.mode === "external_link") {
    const fromMeta = state.source.status === "ready" ? state.source.snapshot.title?.trim() ?? "" : "";
    return fromMeta.length > 0 ? fromMeta : state.manualTitle.trim();
  }
  return state.title.trim();
}

/** §7J: serve il titolo manuale quando la fonte è valida ma senza titolo. */
export function needsManualTitle(state: Pick<ArticleDraftState, "mode" | "source">): boolean {
  return state.mode === "external_link" && state.source.status === "ready" && !(state.source.snapshot.title?.trim());
}

/**
 * §118: bozza significativa.
 *  NATIVE/IMPORTED: titolo, body, cover, tag.
 *  EXTERNAL_LINK: URL validato, titolo (meta o manuale), tag.
 */
export function isSignificantArticle(state: ArticleDraftState): boolean {
  if (state.tagCount > 0) return true;
  if (state.mode === "external_link") {
    return state.source.status === "ready" || state.manualTitle.trim().length > 0;
  }
  return state.title.trim().length > 0 || documentHasText(state.document) || state.cover !== null;
}

export type ArticleBlocker =
  | "missing_title"
  | "title_too_long"
  | "empty_body"
  | "body_limits"
  | "source_missing"
  | "source_loading"
  | "source_invalid"
  | "provenance_choice"
  | "provenance_source"
  | "provenance_link"
  | "rights"
  | "cover_uploading";

/**
 * §32, §7J, §7L, §7P–§7Q, §7W: perché Pubblica/Programma non sono disponibili.
 * Il primo motivo è quello da mostrare; null = pubblicabile.
 */
export function articleBlocker(state: ArticleDraftState, limits: ArticleLimits): ArticleBlocker | null {
  if (state.mode === "external_link") {
    if (state.source.status === "empty") return "source_missing";
    if (state.source.status === "loading") return "source_loading";
    if (state.source.status === "failed") return "source_invalid";
  }

  const title = effectiveTitle(state);
  if (title.length === 0) return "missing_title";
  if (title.length > limits.maxTitleLength) return "title_too_long";

  if (state.mode !== "external_link") {
    if (!documentHasText(state.document)) return "empty_body";
    if (documentLimitIssue(state.document, limits)) return "body_limits";
    if (state.cover && state.cover.uploadStatus !== "uploaded") return "cover_uploading";
  }

  if (state.mode === "imported_text") {
    const provenance = state.provenance;
    if (provenance.publishedElsewhere === null) return "provenance_choice";
    if (provenance.publishedElsewhere) {
      if (provenance.sourceName.trim().length === 0) return "provenance_source";
      if (!provenance.noOriginalLink && provenance.originalUrl.trim().length === 0) return "provenance_link";
    }
    if (!state.rightsConfirmed) return "rights";
  }

  return null;
}

export function blockerCopy(blocker: ArticleBlocker): string {
  switch (blocker) {
    case "missing_title":
      return "Inserisci un titolo";
    case "title_too_long":
      return "Il titolo è troppo lungo.";
    case "empty_body":
      return "Scrivi il testo dell'articolo.";
    case "body_limits":
      return "L'articolo supera la lunghezza massima.";
    case "source_missing":
      return "Incolla il link dell'articolo";
    case "source_loading":
      return "Caricamento anteprima…";
    case "source_invalid":
      return "Non è stato possibile caricare l'anteprima. Controlla il link o inserisci i dati mancanti.";
    case "provenance_choice":
      return "Indica se il testo è già stato pubblicato altrove.";
    case "provenance_source":
      return "Indica la fonte originale.";
    case "provenance_link":
      return "Inserisci il link originale o seleziona «Nessun link disponibile».";
    case "rights":
      return "Conferma di avere i diritti o l'autorizzazione a pubblicare questo contenuto.";
    case "cover_uploading":
      return "Caricamento della copertina in corso.";
  }
}

/** §7Q: la riconferma dei diritti serve quando cambiano identity o fonte/autore/URL originali. */
export function rightsNeedReconfirm(
  before: { identityId: string | null; provenance: ArticleProvenance },
  after: { identityId: string | null; provenance: ArticleProvenance },
): boolean {
  return (
    before.identityId !== after.identityId ||
    before.provenance.sourceName.trim() !== after.provenance.sourceName.trim() ||
    before.provenance.originalAuthor.trim() !== after.provenance.originalAuthor.trim() ||
    before.provenance.originalUrl.trim() !== after.provenance.originalUrl.trim() ||
    before.provenance.publishedElsewhere !== after.provenance.publishedElsewhere
  );
}

/* ------------------------------------------------------------------ */
/* Cambio modalità (§7X)                                               */
/* ------------------------------------------------------------------ */

/** Dati che il cambio modalità non conserverebbe, per spiegarli all'utente (§7X). */
export function modeChangeLosses(state: ArticleDraftState, next: ArticleCreationMode): string[] {
  if (state.mode === next) return [];
  const losses: string[] = [];
  if (state.mode === "external_link") {
    if (state.source.status === "ready" || state.source.status === "failed") losses.push("il link della fonte e la sua anteprima");
  } else {
    if (documentHasText(state.document)) losses.push("il testo dell'articolo");
    if (state.cover) losses.push("la copertina");
  }
  if (state.mode === "imported_text" && state.provenance.publishedElsewhere !== null) {
    losses.push("la fonte e la conferma dei diritti");
  }
  return losses;
}

/* ------------------------------------------------------------------ */
/* Fonte e attribuzione pubblica (§7D, §7K, §7U)                        */
/* ------------------------------------------------------------------ */

/** «Fonte originale · dominio.it» (§7D). */
export function sourceLine(domain: string | null, siteName: string | null = null): string | null {
  const label = domain ?? siteName;
  return label ? `Fonte originale · ${label}` : null;
}

/** «Condiviso da [identity]» per external_link, «Pubblicato da» per un testo importato già pubblicato (§7D, §7U). */
export function publisherLine(mode: ArticleCreationMode, publisherName: string, publishedElsewhere: boolean): string | null {
  if (mode === "external_link") return `Condiviso da ${publisherName}`;
  if (mode === "imported_text" && publishedElsewhere) return `Pubblicato da ${publisherName}`;
  return null;
}

export function domainOrNull(url: string | null | undefined): string | null {
  return url ? urlDomain(url) : null;
}

/* ------------------------------------------------------------------ */
/* Uscita (§133–§136)                                                  */
/* ------------------------------------------------------------------ */

export type ExitDecision = "close" | "ask";

/** §133–§134: editor vuoto → chiude; con una bozza significativa → dialogo a tre azioni. */
export function exitDecision(significant: boolean, dirtySinceSave: boolean, hasServerDraft: boolean): ExitDecision {
  return significant || dirtySinceSave || hasServerDraft ? "ask" : "close";
}
