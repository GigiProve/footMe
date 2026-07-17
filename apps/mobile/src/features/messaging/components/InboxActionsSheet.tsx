import { ActionSheet } from "../../../ui";

type InboxActionsSheetProps = {
  onClose: () => void;
  onMarkAllRead: () => void;
  visible: boolean;
};

export function InboxActionsSheet({
  onClose,
  onMarkAllRead,
  visible,
}: InboxActionsSheetProps) {
  return (
    <ActionSheet
      actions={[
        {
          icon: "checkmark-done-outline",
          label: "Segna tutto come letto",
          onPress: onMarkAllRead,
        },
        {
          icon: "options-outline",
          label: "Filtra conversazioni",
          onPress: () => {},
        },
        {
          icon: "archive-outline",
          label: "Archivia chat selezionate",
          onPress: () => {},
        },
        {
          icon: "notifications-outline",
          label: "Preferenze comunicazioni",
          onPress: () => {},
        },
      ]}
      cancelLabel="Annulla"
      onClose={onClose}
      title="Gestisci messaggi"
      visible={visible}
    />
  );
}
