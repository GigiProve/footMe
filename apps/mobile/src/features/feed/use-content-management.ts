/**
 * Cabla le azioni di gestione di un contenuto (HOM-04 §34–38, §45) e quelle per i
 * contenuti altrui (HOM-11 §1–§3, §28, §58, §79).
 *
 * Restituisce, per un elemento, il `ContentManagement` che il menu ••• riceve:
 * le capability come le ha calcolate il server (§21, §96), gli handler di
 * Modifica e Dettagli e statistiche, e l'eliminazione. Le destinazioni sono in
 * `content-routes.ts`; un tipo senza destinazione risponde «in arrivo», senza
 * schermate segnaposto (Luigi 2026-11-13).
 *
 * HOM-11: lo stesso oggetto porta `feedback` — Non mi interessa (hide ottimistico),
 * Non seguire (Follow globale) e Segnala (la route del flow) —, ciascuno una mutation
 * indipendente e senza cascata (§166–§167). `surface` dice se il menu sta nella lista
 * del Feed o nel dettaglio: nel dettaglio «Non mi interessa» dipende dall'origin (§27).
 */

import { useRouter } from "expo-router";

import { useToast } from "../../ui";
import { useNotInterested } from "../feed-feedback/use-not-interested";
import { useUnfollowFromContent } from "../following/use-unfollow-from-content";
import { reportHref } from "../moderation/moderation-routes";
import { CONTENT_ACTION_SOON, buildManageTarget } from "./content-actions-presentation";
import type { FeedbackSurface } from "./content-feedback-actions";
import type { ContentManagement } from "./content-management-types";
import {
  contentManageParams,
  editContentHref,
  viewInsightsHref,
  type ContentOrigin,
} from "./content-routes";
import type { FeedContentItem } from "./feed-types";
import { useDeleteContent } from "./use-delete-content";

export function useContentManagement({
  profileId,
  surface = "feed",
}: {
  profileId: string;
  surface?: FeedbackSurface;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const { deleteContent } = useDeleteContent({ profileId });
  const notInterested = useNotInterested();
  const unfollow = useUnfollowFromContent();

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
      feedback: {
        item,
        onNotInterested: (notInterestedTarget) => void notInterested.mark(notInterestedTarget),
        onReport: (reportTarget) => router.push(reportHref(reportTarget) as never),
        onUnfollow: (request) => void unfollow.unfollow(request),
        surface,
      },
      onDelete: () => deleteContent(target),
      // HOM-06.2 §217: l'Articolo apre l'editor Articolo, il Post il composer.
      onEdit: () => open(editContentHref(params, target.visibleKind)),
      onInsights: () => open(viewInsightsHref(params)),
      target,
    };
  };
}
