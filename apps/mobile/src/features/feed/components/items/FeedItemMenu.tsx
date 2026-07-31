/**
 * Menu contestuale a tre punti (§20).
 *
 * Il §20 chiede che il componente "possa supportare" Salva, Non mi interessa,
 * Nascondi, Non seguire e Segnala, ma vieta di implementare "logiche incomplete
 * o non approvate". Le cinque voci esistono quindi come struttura tipizzata con
 * un flag `enabled`: solo `save` è operativa (il toggle esiste già), le altre
 * quattro rispondono con lo stesso messaggio di prossima disponibilità.
 *
 * Aggiungere una voce in futuro significa cambiare `enabled` e passare un
 * handler: nessuna ristrutturazione.
 */

import { useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../../theme/tokens";
import { ActionSheet, useToast, type ActionSheetAction } from "../../../../ui";
import { trackFeed } from "../../feed-analytics";
import { FEED_MENU_LABELS, FEED_SOON_MESSAGES } from "../../feed-labels";
import type { FeedItemType } from "../../feed-types";

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
};

export function FeedItemMenu({
  itemType,
  isSaved,
  canSave,
  onToggleSaved,
  authorName,
}: FeedItemMenuProps) {
  const [isOpen, setOpen] = useState(false);
  const { showToast } = useToast();

  const entries: { id: FeedMenuEntryId; action: ActionSheetAction; enabled: boolean }[] = [
    {
      id: "save",
      enabled: canSave,
      action: {
        icon: isSaved ? "bookmark" : "bookmark-outline",
        label: isSaved ? FEED_MENU_LABELS.unsave : FEED_MENU_LABELS.save,
        onPress: onToggleSaved,
      },
    },
    {
      id: "not_interested",
      enabled: false,
      action: {
        icon: "eye-off-outline",
        label: FEED_MENU_LABELS.notInterested,
        onPress: () => showToast({ message: FEED_SOON_MESSAGES.notInterested }),
      },
    },
    {
      id: "hide",
      enabled: false,
      action: {
        icon: "remove-circle-outline",
        label: FEED_MENU_LABELS.hide,
        onPress: () => showToast({ message: FEED_SOON_MESSAGES.hide }),
      },
    },
    {
      id: "unfollow",
      enabled: false,
      action: {
        icon: "person-remove-outline",
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
        label: FEED_MENU_LABELS.report,
        onPress: () => showToast({ message: FEED_SOON_MESSAGES.report }),
      },
    },
  ];

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

      <ActionSheet
        actions={entries.filter((entry) => entry.id !== "save" || canSave).map((entry) => entry.action)}
        onClose={() => setOpen(false)}
        title={authorName ?? undefined}
        visible={isOpen}
      />
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
