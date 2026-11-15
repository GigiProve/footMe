/**
 * Tipi del dominio ModerationReport — «Segnala» (HOM-11 §74–§162, §163–§167, §180–§184).
 *
 * È MODERAZIONE (Trust & Safety), non personalizzazione né relazione: un oggetto
 * account-scoped (D1, §75), con target generico (`CONTENT` | `COMMENT`, §103–§105),
 * categorie server-driven (§83–§89) e snapshot generato dal server (§106–§111, §183).
 * Qui i tipi del client (camelCase); la forma snake_case delle RPC e il mapper stanno
 * in `moderation-service.ts`.
 *
 * Il client NON può falsificare autore del target, snapshot né stato di moderazione
 * (§180): non esistono nei tipi di input.
 */

import type { ContentOrigin } from "../feed/content-routes";
import type { InteractionIdentityType } from "../interactions/interaction-types";

/** §103–§105: due target in V1, l'enum è estendibile lato server senza un secondo engine. */
export type ReportTargetType = "CONTENT" | "COMMENT";

/**
 * Il bersaglio di una segnalazione. Per CONTENT `contentType` è il tipo del contenuto;
 * per COMMENT è il tipo del contenuto PADRE e `parentContentId` il suo id (§104: una
 * Risposta è un COMMENT con il proprio id).
 */
export type ReportTarget = {
  targetType: ReportTargetType;
  targetId: string;
  contentType: string;
  parentContentId: string | null;
  /** Da dove si è aperto il flow (§118); assente = nessuna provenienza nota. */
  origin: ContentOrigin | null;
};

/** §84: il modello di una categoria. Mai mostrare id o enum all'utente (§86). */
export type ReportCategory = {
  categoryId: string;
  /** `null` per una categoria di primo livello; l'id della madre per una sottocategoria. */
  parentId: string | null;
  label: string;
  description: string | null;
  sortOrder: number;
  requiresSubcategory: boolean;
  allowsFreeText: boolean;
};

/** §126, §159, D6: lo stato della segnalazione di questo target per il viewer. */
export type ReportState = {
  reportable: boolean;
  alreadyReported: boolean;
  available: boolean;
};

/** §75–§77: l'identità di interazione Home corrente, SOLO come metadata contestuale. */
export type ContextualIdentity = {
  type: InteractionIdentityType;
  id: string;
};

export type CreateReportInput = {
  /** §100–§101: stabile per bozza, così un retry dopo un timeout non duplica. */
  operationKey: string;
  target: ReportTarget;
  categoryId: string;
  subcategoryId: string | null;
  /** Testo libero già pulito; `null` se assente o non ammesso (§91–§92, §184). */
  details: string | null;
  contextualIdentity: ContextualIdentity | null;
};

export type CreateReportStatus =
  | "created"
  | "already_reported"
  | "target_unavailable"
  | "invalid_category"
  | "not_allowed";

export type CreateReportResult = {
  status: CreateReportStatus;
  reportId: string | null;
};

/**
 * La bozza del flow per target (§98–§99, §157). Sopravvive a un errore di rete: il
 * retry riparte da qui, senza ricominciare.
 */
export type ReportDraft = {
  categoryId: string | null;
  subcategoryId: string | null;
  details: string;
  /** Chiave dell'ultimo tentativo; `null` finché non si è mai inviato. */
  operationKey: string | null;
  /** Il contenuto inviato con quella chiave: se cambia, serve una chiave nuova. */
  attemptedFingerprint: string | null;
};

/**
 * Le fasi del flow oltre al modulo. `success`, `duplicate`, `unavailable` e
 * `not_allowed` sono schermate terminali: solo «Fine» (§115–§122).
 */
export type ReportPhase =
  | "form"
  | "submitting"
  | "success"
  | "duplicate"
  | "unavailable"
  | "not_allowed"
  | "error";

export type ReportStep = "category" | "details";
