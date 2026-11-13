/**
 * Menu contestuale a tre punti (§20; HOM-04 §11–15, §130–132).
 *
 * Il §20 chiede che il componente "possa supportare" Salva, Non mi interessa,
 * Nascondi, Non seguire e Segnala, ma vieta di implementare "logiche incomplete
 * o non approvate". Le cinque voci esistono quindi come struttura tipizzata con
 * un flag `enabled`: solo `save` è operativa (il toggle esiste già), le altre
 * quattro rispondono con lo stesso messaggio di prossima disponibilità.
 *
 * HOM-04: il menu aggrega anche le azioni di gestione (Modifica, Dettagli e
 * statistiche, Elimina) dalle capability che il server ha già calcolato
 * (`management`). Le due liste si compongono per id, senza duplicati (§132);
 * «Elimina» resta l'ultima voce, preceduta da un divisore solo se c'è altro
 * sopra (§15, §29). Le voci «per contenuti altrui» (Non mi interessa, Nascondi,
 * Non seguire, Segnala: §131) non hanno senso sul proprio contenuto e non si
 * mostrano quando ci sono azioni di gestione; il trigger resta sempre (§130).
 *
 * «Elimina» apre la conferma: il delete parte solo da lì (§39) e il dialogo
 * resta aperto finché il server non risponde (§45, §69).
 */

import { useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../../theme/tokens";
import { ActionSheet, useToast, type ActionSheetAction } from "../../../../ui";
import {
  CONTENT_ACTION_IDS,
  CONTENT_KIND_COPY,
  buildContentActions,
  composeActionList,
  contentAnalyticsProps,
  hasManagementActions,
} from "../../content-actions-presentation";
import type { ContentManagement } from "../../content-management-types";
import { trackFeed } from "../../feed-analytics";
import { FEED_MENU_LABELS, FEED_SOON_MESSAGES } from "../../feed-labels";
import type { FeedItemType } from "../../feed-types";
import { ContentActionSheet } from "../ContentActionSheet";
import { ContentDeleteDialog } from "../ContentDeleteDialog";

export type FeedMenuEntryId =
  | "save"
  | "not_interested"
  | "hide"
  | "unfollow"
  | "report";

type FeedItemMenuProps = {
  itemType: FeedItemType;
  isSaved: boolean;
  canSave: boolean;
  onToggleSaved: () => void;
  authorName?: string | null;
  /** HOM-04: azioni di gestione dal server. Assente = solo le voci per contenuti altrui. */
  management?: ContentManagement;
};

export function FeedItemMenu({
  itemType,
  isSaved,
  canSave,
  onToggleSaved,
  authorName,
  management,
}: FeedItemMenuProps) {
  const [isOpen, setOpen] = useState(false);
  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { showToast } = useToast();

  const canManage = management ? hasManagementActions(management.capabilities) : false;

  const entries: { id: FeedMenuEntryId; action: ActionSheetAction; enabled: boolean }[] = [
    {
      id: "save",
      enabled: canSave,
      action: {
        icon: isSaved ? "bookmark" : "bookmark-outline",
        id: "save",
        label: isSaved ? FEED_MENU_LABELS.unsave : FEED_MENU_LABELS.save,
        onPress: onToggleSaved,
      },
    },
    {
      id: "not_interested",
      enabled: false,
      action: {
        icon: "eye-off-outline",
        id: "not_interested",
        label: FEED_MENU_LABELS.notInterested,
        onPress: () => showToast({ message: FEED_SOON_MESSAGES.notInterested }),
      },
    },
    {
      id: "hide",
      enabled: false,
      action: {
        icon: "remove-circle-outline",
        id: "hide",
        label: FEED_MENU_LABELS.hide,
        onPress: () => showToast({ message: FEED_SOON_MESSAGES.hide }),
      },
    },
    {
      id: "unfollow",
      enabled: false,
      action: {
        icon: "person-remove-outline",
        id: "unfollow",
        label: FEED_MENU_LABELS.unfollow,
        onPress: () => showToast({ message: FEED_SOON_MESSAGES.unfollow }),
      },
    },
    {
      id: "report",
      enabled: false,
      action: {
        destructive: true,
        icon: "flag-outline",
        id: "report",
        label: FEED_MENU_LABELS.report,
        onPress: () => showToast({ message: FEED_SOON_MESSAGES.report }),
      },
    },
  ];

  const otherActions = entries
    // Con azioni gestionali il foglio mostra solo quelle (§26–27, mockup 1–2):
    // Salva e le altre voci «per altri» appartengono a HOM-07/HOM-11 (§131).
    .filter((entry) => !canManage && (entry.id === "save" ? canSave : true))
    .map((entry) => entry.action);

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

  const actions = composeActionList(otherActions, managementActions);

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
