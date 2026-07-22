import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { ActionSheet, AppText, Badge, Input, Radio } from "../../../ui";
import { colors, radius, spacing } from "../../../theme/tokens";
import {
  getEvaluationStatusLabel,
  getPriorityLabel,
  type ShortlistEvaluationStatus,
  type ShortlistPriority,
} from "../shortlist-service";
import { getPriorityBadgeVariant } from "../shortlist-display-helpers";

const PRIORITIES: ShortlistPriority[] = ["alta", "media", "bassa"];

const STATUSES: ShortlistEvaluationStatus[] = [
  "da_valutare",
  "interessante",
  "da_contattare",
  "contattato",
  "non_prioritario",
  "scartato",
];

type EvaluationFieldsProps = {
  canEditNote: boolean;
  canEditStatus: boolean;
  note: string;
  onNoteChange: (note: string) => void;
  onPriorityChange: (priority: ShortlistPriority) => void;
  onStatusChange: (status: ShortlistEvaluationStatus) => void;
  priority: ShortlistPriority;
  status: ShortlistEvaluationStatus;
};

export function EvaluationFields({
  canEditNote,
  canEditStatus,
  note,
  onNoteChange,
  onPriorityChange,
  onStatusChange,
  priority,
  status,
}: EvaluationFieldsProps) {
  const [isStatusSheetOpen, setStatusSheetOpen] = useState(false);

  return (
    <View style={styles.container}>
      <View style={styles.group}>
        <AppText color="muted" variant="caption">
          Priorità
        </AppText>
        {PRIORITIES.map((option) => (
          <View key={option} style={styles.radioRow}>
            <View style={styles.radioLabel}>
              <Radio
                checked={priority === option}
                disabled={!canEditStatus}
                label={getPriorityLabel(option)}
                onPress={() => onPriorityChange(option)}
              />
            </View>
            <Badge label={getPriorityLabel(option)} variant={getPriorityBadgeVariant(option)} />
          </View>
        ))}
      </View>

      <View style={styles.group}>
        <AppText color="muted" variant="caption">
          Stato valutazione
        </AppText>
        <Pressable
          disabled={!canEditStatus}
          onPress={() => setStatusSheetOpen(true)}
          style={[styles.statusField, !canEditStatus ? styles.disabledField : null]}
        >
          <AppText variant="bodyLg">{getEvaluationStatusLabel(status)}</AppText>
          <Ionicons color={colors.textMuted} name="chevron-down" size={18} />
        </Pressable>
      </View>

      {canEditNote ? (
        <View style={styles.group}>
          <Input
            label="Nota interna"
            multiline
            onChangeText={onNoteChange}
            placeholder="Aggiungi una nota interna..."
            value={note}
          />
          <View style={styles.lockRow}>
            <Ionicons color={colors.textMuted} name="lock-closed-outline" size={14} />
            <AppText color="muted" variant="caption">
              Questa nota è visibile solo agli utenti autorizzati della società.
            </AppText>
          </View>
        </View>
      ) : null}

      <ActionSheet
        actions={STATUSES.map((option) => ({
          label: getEvaluationStatusLabel(option),
          onPress: () => onStatusChange(option),
        }))}
        onClose={() => setStatusSheetOpen(false)}
        title="Stato valutazione"
        visible={isStatusSheetOpen}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[20],
  },
  disabledField: {
    opacity: 0.6,
  },
  group: {
    gap: spacing[8],
  },
  lockRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
  },
  radioLabel: {
    flex: 1,
  },
  radioRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
  },
  statusField: {
    alignItems: "center",
    backgroundColor: colors.inputBackground,
    borderColor: colors.border,
    borderRadius: radius[6],
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 52,
    paddingHorizontal: spacing[16],
  },
});
