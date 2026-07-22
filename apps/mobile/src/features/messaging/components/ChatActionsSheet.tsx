import { ActionSheet, type ActionSheetAction } from "../../../ui";

type ChatActionsSheetProps = {
  isArchived: boolean;
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
  onArchiveToggle,
  onBlockToggle,
  onClose,
  onOpenProfile,
  onReport,
  onSearch,
  visible,
}: ChatActionsSheetProps) {
  const actions: ActionSheetAction[] = [
    {
      icon: "person-circle-outline",
      label: "Apri profilo",
      onPress: onOpenProfile,
    },
    {
      icon: "search-outline",
      label: "Cerca nella conversazione",
      onPress: onSearch,
    },
    {
      icon: "archive-outline",
      label: isArchived ? "Ripristina chat" : "Archivia chat",
      onPress: onArchiveToggle,
    },
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
