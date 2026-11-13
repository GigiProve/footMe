/**
 * Ciò che il menu ••• riceve per gestire un contenuto (HOM-04 §13).
 *
 * Il menu non conosce i permessi (§13, §21): riceve le capability già calcolate
 * dal server e gli handler già cablati. Navigazione, mutazione e analytics
 * stanno in `use-content-management.ts`; il componente disegna e chiama.
 */

import type { ContentManageCapabilities } from "./content-actions-presentation";
import type { DeleteContentOutcome, DeleteContentTarget } from "./use-delete-content";

export type ContentManagement = {
  target: DeleteContentTarget;
  capabilities: ContentManageCapabilities;
  onEdit: () => void;
  onInsights: () => void;
  /** `null`: una richiesta per questo contenuto è già in volo (doppio tap). */
  onDelete: () => Promise<DeleteContentOutcome | null>;
};
