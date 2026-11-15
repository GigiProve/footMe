/**
 * Menu contestuale a tre punti (§20; HOM-04 §11–15, §130–132; HOM-11 §1–§13).
 *
 * Il foglio è UNO (HOM-04 `ContentActionSheet`): HOM-11 non crea un secondo menu (§1) e
 * ogni dominio fornisce le proprie voci (§2) che il foglio compone, mostrando solo
 * quelle realmente disponibili (§3):
 *   • HOM-07 → Salva / Rimuovi dai salvati (qui sotto, dallo store Salvati);
 *   • HOM-11 → Non mi interessa / Non seguire <nome> / Segnala (`content-feedback-actions`);
 *   • HOM-04 → Modifica, Dettagli e statistiche, Elimina (`management`).
 *
 * Ordine: Salva → Non mi interessa → Non seguire → divisore → Segnala, poi la gestione
 * (§11, Screen 1); «Elimina» resta l'ultima voce, preceduta da un divisore solo se c'è
 * altro sopra (HOM-04 §15, §29). Le voci per contenuti altrui NON compaiono sul proprio
 * o gestito (D5, §4–§7): la capability viene dal server, mai da `author == viewer` (§5).
 * Le tre azioni HOM-11 sono tre mutation indipendenti, ciascuna cablata in
 * `useContentManagement`; questo componente le sceglie e le chiama, senza conoscerne
 * gli effetti. Il trigger resta sempre (HOM-04 §130).
 *
 * «Elimina» apre la conferma: il delete parte solo da lì (§39) e il dialogo
 * resta aperto finché il server non risponde (§45, §69).
 *
 * HOM-07 §85–§87: «Salva» / «Rimuovi dai salvati» è l'azione di questo modulo
 * nel foglio unico, e vale per chiunque veda il contenuto — anche per chi lo
 * gestisce: il Salvataggio è privato dell'utente, non della Società (§70–§72).
 * Compare per prima; lo stato è quello dello store Salvati (§133).
 */

import { useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../../theme/tokens";
import { ActionSheet, type ActionSheetAction } from "../../../../ui";
import { useIsSourceUnfollowed } from "../../../following/unfollowed-sources-store";
import { followSourceKey } from "../../../following/follow-source";
import { reportTargetKey } from "../../../moderation/moderation-presentation";
import { useIsReported } from "../../../moderation/reported-store";
import {
  CONTENT_ACTION_IDS,
  CONTENT_KIND_COPY,
  buildContentActions,
  composeActionList,
  contentAnalyticsProps,
  hasManagementActions,
} from "../../content-actions-presentation";
import {
  FEEDBACK_ACTION_IDS,
  buildFeedbackInput,
  buildViewerFeedbackActions,
} from "../../content-feedback-actions";
import type { ContentManagement } from "../../content-management-types";
import { trackFeed } from "../../feed-analytics";
import { FEED_MENU_LABELS } from "../../feed-labels";
import { followSourceOfItem } from "../../feed-signal-cache";
import type { FeedItemType } from "../../feed-types";
import { useIsSaved } from "../../../saved/saved-store";
import type { SavedTarget } from "../../../saved/saved-types";
import { ContentActionSheet } from "../ContentActionSheet";
import { ContentDeleteDialog } from "../ContentDeleteDialog";

type FeedItemMenuProps = {
  itemType: FeedItemType;
  /** Il seme dal payload; lo stato mostrato è quello dello store Salvati (HOM-07 §133). */
  isSaved: boolean;
  /** Il target nello store Salvati: assente = si mostra `isSaved` così com'è. */
  savedTarget?: SavedTarget | null;
  canSave: boolean;
  onToggleSaved: () => void;
  authorName?: string | null;
  /**
   * HOM-04: azioni di gestione dal server; HOM-11: `feedback` per i contenuti altrui.
   * Assente = solo Salva.
   */
  management?: ContentManagement;
};

export function FeedItemMenu({
  itemType,
  isSaved: seedSaved,
  savedTarget = null,
  canSave,
  onToggleSaved,
  authorName,
  management,
}: FeedItemMenuProps) {
  const isSaved = useIsSaved(savedTarget, seedSaved);
  const [isOpen, setOpen] = useState(false);
  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const canManage = management ? hasManagementActions(management.capabilities) : false;

  // HOM-11 §62, §126: gli insiemi di sessione valgono prima che il refetch porti il dato
  // del server. Sono store di modulo: nessun provider richiesto.
  const feedback = management?.feedback ?? null;
  const feedbackSource = feedback ? followSourceOfItem(feedback.item) : null;
  const unfollowedInSession = useIsSourceUnfollowed(
    feedbackSource ? followSourceKey(feedbackSource) : null,
  );
  const reportedInSession = useIsReported(
    feedback
      ? reportTargetKey({
          contentType: feedback.item.payload.contentType,
          targetId: feedback.item.payload.postId,
          targetType: "CONTENT",
        })
      : null,
  );

  // HOM-07 §85–§87: Salva / Rimuovi dai salvati vale per chiunque veda il contenuto,
  // anche per chi lo gestisce (il Salvataggio è dell'utente, non della Società).
  const saveActions: ActionSheetAction[] = canSave
    ? [
        {
          icon: isSaved ? "bookmark" : "bookmark-outline",
          id: "save",
          label: isSaved ? FEED_MENU_LABELS.unsave : FEED_MENU_LABELS.save,
          onPress: onToggleSaved,
        },
      ]
    : [];

  // HOM-11: le voci per contenuti altrui. Il contenuto gestito non ne ha (D5, §131).
  const feedbackInput =
    feedback && management
      ? buildFeedbackInput(feedback.item, {
          isManaged: canManage,
          origin: management.target.origin,
          reportedInSession,
          surface: feedback.surface,
          unfollowedInSession,
        })
      : null;

  const feedbackActions: ActionSheetAction[] =
    feedback && feedbackInput
      ? buildViewerFeedbackActions(feedbackInput).map(
          (descriptor): ActionSheetAction => ({
            accessibilityHint: descriptor.accessibilityHint,
            accessibilityLabel: descriptor.accessibilityLabel,
            destructive: descriptor.destructive,
            disabled: descriptor.disabled,
            dividerBefore: descriptor.dividerBefore,
            icon: descriptor.icon,
            id: descriptor.id,
            label: descriptor.label,
            onPress: () => {
              if (descriptor.id === FEEDBACK_ACTION_IDS.notInterested && feedbackInput.origin) {
                feedback.onNotInterested({
                  contentId: feedbackInput.contentId,
                  contentType: feedbackInput.contentType,
                  origin: feedbackInput.origin,
                  reposter: feedbackInput.reposter,
                });
              } else if (descriptor.id === FEEDBACK_ACTION_IDS.unfollow && feedbackInput.unfollowSource) {
                feedback.onUnfollow({
                  origin: feedbackInput.origin,
                  source: feedbackInput.unfollowSource,
                  surface: "content",
                });
              } else if (descriptor.id === FEEDBACK_ACTION_IDS.report) {
                feedback.onReport({
                  contentType: feedbackInput.contentType,
                  origin: feedbackInput.origin,
                  parentContentId: null,
                  targetId: feedbackInput.contentId,
                  targetType: "CONTENT",
                });
              }
              // `reported` è non azionabile (D6): il foglio non lo rende premibile.
            },
          }),
        )
      : [];

  const managementActions: ActionSheetAction[] = management
    ? buildContentActions(management.target.visibleKind, management.capabilities).map(
        (descriptor): ActionSheetAction => ({
          destructive: descriptor.destructive,
          dividerBefore: descriptor.dividerBefore,
          icon: descriptor.icon,
          id: descriptor.id,
          label: descriptor.label,
          onPress: () => {
            const props = contentAnalyticsProps(management.target);
            if (descriptor.id === CONTENT_ACTION_IDS.edit) {
              trackFeed({ ...props, name: "edit_selected" });
              management.onEdit();
            } else if (descriptor.id === CONTENT_ACTION_IDS.insights) {
              trackFeed({ ...props, name: "insights_selected" });
              management.onInsights();
            } else {
              trackFeed({ ...props, name: "delete_selected" });
              setConfirmOpen(true);
            }
          },
        }),
      )
    : [];

  const actions = composeActionList(saveActions, feedbackActions, managementActions);

  const confirmDelete = async () => {
    if (!management || isDeleting) {
      return;
    }

    setDeleting(true);
    setDeleteError(null);
    const outcome = await management.onDelete();
    setDeleting(false);
    if (outcome === "failed") {
      setDeleteError(CONTENT_KIND_COPY[management.target.visibleKind].deleteFailed);
    }

    // Il dialogo si chiude se il contenuto non c'è più o se il permesso è stato
    // revocato (§71); dopo un fallimento resta aperto per riprovare (§69).
    if (outcome === "removed" || outcome === "permission_denied") {
      setConfirmOpen(false);
    }
  };

  const cancelDelete = () => {
    if (management) {
      trackFeed({ ...contentAnalyticsProps(management.target), name: "delete_cancelled" });
    }
    setDeleteError(null);
    setConfirmOpen(false);
  };

  return (
    <>
      <Pressable
        accessibilityLabel="Altre azioni"
        accessibilityRole="button"
        hitSlop={10}
        onPress={() => {
          trackFeed({ itemType, name: "feed_item_menu_open" });
          setOpen(true);
        }}
        style={styles.trigger}
      >
        <Ionicons color={colors.textMuted} name="ellipsis-horizontal" size={18} />
      </Pressable>

      {management ? (
        <ContentActionSheet
          actions={actions}
          content={contentAnalyticsProps(management.target)}
          onClose={() => setOpen(false)}
          visible={isOpen}
        />
      ) : (
        // Senza identità di contenuto (nessun `management`) resta il foglio di sempre.
        <ActionSheet
          actions={actions}
          onClose={() => setOpen(false)}
          title={authorName ?? undefined}
          visible={isOpen}
        />
      )}

      {management ? (
        <ContentDeleteDialog
          errorMessage={deleteError}
          isBusy={isDeleting}
          kind={management.target.visibleKind}
          onCancel={cancelDelete}
          onConfirm={() => void confirmDelete()}
          visible={isConfirmOpen}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
  },
});
