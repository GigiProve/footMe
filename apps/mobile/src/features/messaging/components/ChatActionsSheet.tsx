import { ActionSheet, type ActionSheetAction } from "../../../ui";

type ChatActionsSheetProps = {
  isArchived: boolean;
  /** DAS-REV-32 §25: nei GROUP non c'è un profilo da aprire né un utente da bloccare/segnalare. */
  isGroup?: boolean;
  isBlocked: boolean;
  onArchiveToggle: () => void;
  onBlockToggle: () => void;
  onClose: () => void;
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
  onOpenProfile,
  onReport,
  onSearch,
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
        archiveAction,
        {
          destructive: true,
          icon: "ban-outline",
          label: isBlocked ? "Sblocca utente" : "Blocca utente",
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
