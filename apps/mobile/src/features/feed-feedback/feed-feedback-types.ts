/**
 * Tipi del dominio FeedFeedback — «Non mi interessa» (HOM-11 §19–§53, §163–§167).
 *
 * È PERSONALIZZAZIONE, non relazione e non moderazione (§1 principio): un segnale
 * negativo per il ranking, in una tabella propria, senza effetti su Follow (§42) né
 * su Segnala (§41). Qui i tipi del client (camelCase); la forma snake_case delle
 * RPC e il mapper stanno in `feed-feedback-service.ts`.
 */

import type { ContentOrigin } from "../feed/content-routes";
import type { FeedContentType } from "../feed/feed-types";

/**
 * §47–§49: i motivi sono server-driven (`fetch_feed_feedback_reasons`). Il client non
 * li replica in nessun componente: mostra ciò che il server manda, nell'ordine
 * (`sortOrder`) che il server dà.
 */
export type FeedbackReason = {
  reasonId: string;
  label: string;
  sortOrder: number;
};

/**
 * §39–§40, §146: se l'elemento visto è un Simple Repost il segnale conserva il
 * reposter. L'originale resta il target (D4); il server ne deriva
 * `distribution_context = SIMPLE_REPOST`.
 */
export type NotInterestedReposter = {
  identityType: string;
  identityId: string;
};

export type MarkNotInterestedInput = {
  /** Idempotenza (§177): doppio tap e retry non creano segnali doppi. */
  operationKey: string;
  contentType: FeedContentType;
  contentId: string;
  origin: ContentOrigin;
  reposter: NotInterestedReposter | null;
};

/**
 * Esiti di `mark_content_not_interested`. `unavailable` = il contenuto non è più
 * leggibile (ritirato nel frattempo): per il viewer è comunque nascosto. `not_allowed`
 * = origin fuori whitelist o contenuto gestito dal viewer (D2, D5): è un errore.
 */
export type MarkNotInterestedStatus =
  | "recorded"
  | "already_recorded"
  | "unavailable"
  | "not_allowed";

export type MarkNotInterestedResult = {
  status: MarkNotInterestedStatus;
  /** Serve a Annulla e al motivo; `null` se il server non lo ha mandato. */
  feedbackId: string | null;
};

export type SetReasonStatus = "updated" | "not_found" | "invalid_reason";
export type UndoNotInterestedStatus = "removed" | "not_found";

/** Fase di un contenuto nascosto nello store di sessione. */
export type HiddenPhase = "pending" | "hidden";

/**
 * Un contenuto nascosto in questa sessione (§29–§36). `attempt` distingue due
 * nascondimenti dello stesso target (nascondi → annulla → nascondi), così la
 * risposta in ritardo del primo non tocca il secondo.
 */
export type HiddenEntry = {
  readonly attempt: number;
  readonly phase: HiddenPhase;
  readonly feedbackId: string | null;
  readonly reasonId: string | null;
};
