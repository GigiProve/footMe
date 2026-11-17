import { ActionSheet, type ActionSheetAction } from "../../../ui";
import { blockMenuLabel, unblockA11yLabel } from "../../blocking/blocking-presentation";
import { NOTIFICATIONS_COPY } from "../mute/mute-presentation";

/** «Sblocca {nome}» come voce di menu (stessa forma dell'etichetta accessibile del pulsante). */
function unblockActionLabel(name: string | null | undefined): string {
  return unblockA11yLabel(name);
}

type ChatActionsSheetProps = {
  isArchived: boolean;
  /** DAS-REV-32 §25: nei GROUP non c'è un profilo da aprire né un utente da bloccare/segnalare. */
  isGroup?: boolean;
  isBlocked: boolean;
  /** HOM-12 §15: «Blocca {nome}» / «Sblocca {nome}»; assente = ripiego generico. */
  otherName?: string | null;
  onArchiveToggle: () => void;
  onBlockToggle: () => void;
  onClose: () => void;
  /**
   * DAS-REV-34 §9: voce «Notifiche» della DIRECT, che apre lo stesso sheet
   * delle GROUP (nei GROUP il punto d'ingresso è la riga di Info gruppo).
   */
  onOpenNotifications?: () => void;
  onOpenProfile: () => void;
  onReport: () => void;
  onSearch: () => void;
  visible: boolean;
};

export function ChatActionsSheet({
  isArchived,
  isBlocked,
  isGroup = false,
  onArchiveToggle,
  onBlockToggle,
  onClose,
  onOpenNotifications,
  onOpenProfile,
  onReport,
  onSearch,
  otherName,
  visible,
}: ChatActionsSheetProps) {
  const searchAction: ActionSheetAction = {
    icon: "search-outline",
    label: "Cerca nella conversazione",
    onPress: onSearch,
  };
  const archiveAction: ActionSheetAction = {
    icon: "archive-outline",
    label: isArchived ? "Ripristina chat" : "Archivia chat",
    onPress: onArchiveToggle,
  };
  const actions: ActionSheetAction[] = isGroup
    ? [searchAction, archiveAction]
    : [
        {
          icon: "person-circle-outline",
          label: "Apri profilo",
          onPress: onOpenProfile,
        },
        searchAction,
        ...(onOpenNotifications
          ? [
              {
                icon: "notifications-outline" as const,
                label: NOTIFICATIONS_COPY.rowLabel,
                onPress: onOpenNotifications,
              },
            ]
          : []),
        archiveAction,
        {
          destructive: true,
          icon: "ban-outline",
          label: isBlocked ? unblockActionLabel(otherName) : blockMenuLabel(otherName),
          onPress: onBlockToggle,
        },
        {
          destructive: true,
          icon: "flag-outline",
          label: "Segnala conversazione",
          onPress: onReport,
        },
      ];

  return (
    <ActionSheet
      actions={actions}
      onClose={onClose}
      title="Azioni chat"
      visible={visible}
    />
  );
}
