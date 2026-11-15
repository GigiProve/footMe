/**
 * Derivazioni pure e copy di «Non mi interessa» (HOM-11 §19–§53, §198–§199).
 *
 * Tutto ciò che si calcola senza renderizzare vive qui: il copy centrale (mai
 * replicato nei componenti, §49), la whitelist delle origin (D2), la chiave del
 * target nascosto, l'ordine dei motivi, le condizioni per offrire il motivo.
 */

import type { ContentOrigin } from "../feed/content-routes";
import type { FeedContentType, FeedRepostContext } from "../feed/feed-types";
import type {
  FeedbackReason,
  HiddenEntry,
  NotInterestedReposter,
} from "./feed-feedback-types";

// ── Copy (§30, §44, §46, §52, §198) ─────────────────────────────
export const NOT_INTERESTED_LABEL = "Non mi interessa";
/** §198: annunciato dallo screen reader sulla voce del menu. */
export const NOT_INTERESTED_A11Y_HINT = "Nascondi questo contenuto e mostra meno contenuti simili";
/** §30: «Contenuto nascosto · Annulla». */
export const HIDDEN_PLACEHOLDER_LABEL = "Contenuto nascosto";
export const HIDDEN_UNDO_LABEL = "Annulla";
export const HIDDEN_UNDO_A11Y_LABEL = "Annulla: mostra di nuovo il contenuto";
/** §44: il link dopo l'hide, e §46 il titolo del foglio. */
export const REASONS_LINK_LABEL = "Aiutaci a migliorare i suggerimenti";
export const REASONS_SHEET_TITLE = REASONS_LINK_LABEL;
/** §46: sottotitolo del foglio. */
export const REASONS_SHEET_SUBTITLE = "Facoltativo";
export const REASONS_SHEET_BODY = "La tua scelta ci aiuta a proporti contenuti più rilevanti.";
export const REASONS_LOAD_ERROR = "Non è stato possibile caricare i motivi.";
export const REASONS_RETRY = "Riprova";
/** §52: lo stesso copy per l'hide, per il motivo e per l'Annulla falliti. */
export const NOT_INTERESTED_ERROR = "Non è stato possibile completare l'operazione.";

/**
 * D2, §21–§27: V1 offre «Non mi interessa» solo dove esiste una logica di
 * recommendation, cioè Home → Per te (e il dettaglio aperto da lì, §27). Mai da
 * Profilo (§23), Salvati (§24), Cerca (§25), Seguiti (§26). Specchio client della
 * whitelist del server (`footme_not_interested_origins()`): il server resta l'arbitro.
 */
export const NOT_INTERESTED_ORIGINS: readonly ContentOrigin[] = ["HOME_PER_TE"];

export function isNotInterestedOrigin(origin: ContentOrigin | null): origin is ContentOrigin {
  return origin !== null && NOT_INTERESTED_ORIGINS.includes(origin);
}

/** La chiave del target nello store di sessione: tipo e id insieme, mai l'id da solo. */
export function hiddenTargetKey(contentType: FeedContentType, contentId: string): string {
  return `${contentType}:${contentId}`;
}

/** §39, §146: il reposter del Simple Repost, nella forma che l'RPC vuole. */
export function reposterOf(repost: FeedRepostContext | null | undefined): NotInterestedReposter | null {
  return repost
    ? { identityId: repost.reposter.identityId, identityType: repost.reposter.identityType }
    : null;
}

/** §48: l'ordine è del server; qui solo una difesa contro un array arrivato in disordine. */
export function sortReasons(reasons: readonly FeedbackReason[]): FeedbackReason[] {
  return [...reasons].sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * §44–§45: il link «Aiutaci a migliorare i suggerimenti» compare solo a hide
 * confermato dal server (serve il `feedback_id`) e finché non è stato scelto un
 * motivo. Con l'hide ancora in volo non c'è nulla a cui associarlo.
 */
export function canOfferReasons(entry: HiddenEntry | undefined): boolean {
  return !!entry && entry.phase === "hidden" && entry.feedbackId !== null && entry.reasonId === null;
}

/** §199: il placeholder si annuncia da sé, con l'Annulla raggiungibile subito. */
export function placeholderAnnouncement(): string {
  return `${HIDDEN_PLACEHOLDER_LABEL}. ${HIDDEN_UNDO_LABEL}`;
}
