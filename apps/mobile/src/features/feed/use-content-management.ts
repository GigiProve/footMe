/**
 * Cabla le azioni di gestione di un contenuto (HOM-04 §34–38, §45).
 *
 * Restituisce, per un elemento, il `ContentManagement` che il menu ••• riceve:
 * le capability come le ha calcolate il server (§21, §96), gli handler di
 * Modifica e Dettagli e statistiche, e l'eliminazione. Le destinazioni sono in
 * `content-routes.ts`; un tipo senza destinazione risponde «in arrivo», senza
 * schermate segnaposto (Luigi 2026-11-13).
 */

import { useRouter } from "expo-router";

import { useToast } from "../../ui";
import { CONTENT_ACTION_SOON, buildManageTarget } from "./content-actions-presentation";
import type { ContentManagement } from "./content-management-types";
import {
  contentManageParams,
  editContentHref,
  viewInsightsHref,
  type ContentOrigin,
} from "./content-routes";
import type { FeedContentItem } from "./feed-types";
import { useDeleteContent } from "./use-delete-content";

export function useContentManagement({ profileId }: { profileId: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const { deleteContent } = useDeleteContent({ profileId });

  const open = (href: string | null) => {
    if (href) {
      router.push(href as never);
    } else {
      showToast({ message: CONTENT_ACTION_SOON });
    }
  };

  return (item: FeedContentItem, origin: ContentOrigin): ContentManagement => {
    const target = buildManageTarget(item, origin);
    const params = contentManageParams(target);
    const { canDelete, canEdit, canViewInsights } = item.payload.capabilities;

    return {
      capabilities: { canDelete, canEdit, canViewInsights },
      onDelete: () => deleteContent(target),
      // HOM-06.2 §217: l'Articolo apre l'editor Articolo, il Post il composer.
      onEdit: () => open(editContentHref(params, target.visibleKind)),
      onInsights: () => open(viewInsightsHref(params)),
      target,
    };
  };
}
