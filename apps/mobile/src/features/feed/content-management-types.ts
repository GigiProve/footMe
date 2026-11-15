/**
 * Ciò che il menu ••• riceve per gestire un contenuto (HOM-04 §13) e per agire su un
 * contenuto altrui (HOM-11 §1–§3).
 *
 * Il menu non conosce i permessi (§13, §21): riceve le capability già calcolate
 * dal server e gli handler già cablati. Navigazione, mutazione e analytics
 * stanno in `use-content-management.ts`; il componente disegna e chiama.
 */

import type { NotInterestedTarget } from "../feed-feedback/use-not-interested";
import type { UnfollowRequest } from "../following/use-unfollow-from-content";
import type { ReportTarget } from "../moderation/moderation-types";
import type { ContentManageCapabilities } from "./content-actions-presentation";
import type { FeedbackSurface } from "./content-feedback-actions";
import type { FeedContentItem } from "./feed-types";
import type { DeleteContentOutcome, DeleteContentTarget } from "./use-delete-content";

/**
 * HOM-11 §1–§3: le azioni per i contenuti altrui — Non mi interessa, Non seguire, Segna
 * la — viaggiano nello STESSO oggetto che il menu già riceve, così nessuno dei quattro
 * componenti che lo inoltrano cambia firma e non nasce un secondo menu (§1, §229).
 * Il menu le compone con Salva e con la gestione HOM-04 (`composeActionList`).
 */
export type ContentFeedback = {
  /** L'elemento: da qui il menu ricava autore, Follow, reposter, capability e «già segnalato». */
  item: FeedContentItem;
  /** Lista del Feed o dettaglio: «Non mi interessa» nel dettaglio dipende dall'origin (§27). */
  surface: FeedbackSurface;
  onNotInterested: (target: NotInterestedTarget) => void;
  onUnfollow: (request: UnfollowRequest) => void;
  onReport: (target: ReportTarget) => void;
};

export type ContentManagement = {
  target: DeleteContentTarget;
  capabilities: ContentManageCapabilities;
  onEdit: () => void;
  onInsights: () => void;
  /** `null`: una richiesta per questo contenuto è già in volo (doppio tap). */
  onDelete: () => Promise<DeleteContentOutcome | null>;
  /** HOM-11: assente = nessuna voce per contenuti altrui (come un server pre-HOM-11). */
  feedback?: ContentFeedback;
};
