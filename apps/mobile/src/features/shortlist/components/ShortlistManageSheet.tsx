import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { AppText, BottomSheet, Button, ListItem } from "../../../ui";
import { colors, spacing } from "../../../theme/tokens";
import {
  getEvaluationStatusLabel,
  getPriorityLabel,
  type ProfileShortlistMembership,
} from "../shortlist-service";

type ShortlistManageSheetProps = {
  canAddToOtherList: boolean;
  canEditEvaluation: boolean;
  memberships: ProfileShortlistMembership[];
  onAddToOtherList: () => void;
  onClose: () => void;
  onDismiss?: () => void;
  onEditEvaluation: (membership: ProfileShortlistMembership) => void;
  onViewInShortlist: (membership: ProfileShortlistMembership) => void;
  profileFullName: string;
  visible: boolean;
};

export function ShortlistManageSheet({
  canAddToOtherList,
  canEditEvaluation,
  memberships,
  onAddToOtherList,
  onClose,
  onDismiss,
  onEditEvaluation,
  onViewInShortlist,
  profileFullName,
  visible,
}: ShortlistManageSheetProps) {
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setSelectedEntryId(memberships[0]?.entry_id ?? null);
    }
  }, [visible, memberships]);

  const selectedMembership =
    memberships.find((membership) => membership.entry_id === selectedEntryId) ??
    memberships[0] ??
    null;

  return (
    <BottomSheet onClose={onClose} onDismiss={onDismiss} title={`${profileFullName} è in shortlist`} visible={visible}>
      <AppText color="muted" style={styles.label} variant="caption">
        Liste correnti
      </AppText>

      <View style={styles.list}>
        {memberships.map((membership) => (
          <ListItem
            key={membership.entry_id}
            onPress={
              memberships.length > 1
                ? () => setSelectedEntryId(membership.entry_id)
                : undefined
            }
            right={
              <Ionicons
                color={
                  selectedMembership?.entry_id === membership.entry_id
                    ? colors.success
                    : colors.border
                }
                name="checkmark-circle"
                size={20}
              />
            }
            subtitle={`${getPriorityLabel(membership.priority)} • ${getEvaluationStatusLabel(
              membership.evaluation_status,
            )}`}
            title={membership.shortlist_name}
          />
        ))}
      </View>

      <View style={styles.actions}>
        <Button
          disabled={!selectedMembership}
          fullWidth
          label="Vedi nella shortlist"
          onPress={() => {
            if (selectedMembership) {
              onViewInShortlist(selectedMembership);
            }
          }}
          variant="primary"
        />
        {canEditEvaluation ? (
          <Button
            disabled={!selectedMembership}
            fullWidth
            label="Modifica valutazione"
            onPress={() => {
              if (selectedMembership) {
                onEditEvaluation(selectedMembership);
              }
            }}
            variant="outline"
          />
        ) : null}
        {canAddToOtherList ? (
          <Button fullWidth label="Aggiungi ad altra lista" onPress={onAddToOtherList} variant="link" />
        ) : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing[10],
  },
  label: {
    marginTop: spacing[8],
  },
  list: {
    marginBottom: spacing[16],
    marginTop: spacing[8],
  },
});
