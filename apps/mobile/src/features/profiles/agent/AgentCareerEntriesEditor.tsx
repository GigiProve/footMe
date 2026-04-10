import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import {
  createAgentCareerEntryDraft,
  type AgentCareerEntryDraft,
} from "../agent-profile";
import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button, Input } from "../../../ui";

type AgentCareerEntriesEditorProps = {
  addButtonLabel?: string;
  entries: AgentCareerEntryDraft[];
  emptyLabel?: string;
  onChange: (entries: AgentCareerEntryDraft[]) => void;
};

export function AgentCareerEntriesEditor({
  addButtonLabel = "Aggiungi esperienza",
  entries,
  emptyLabel = "Nessuna esperienza precedente inserita.",
  onChange,
}: AgentCareerEntriesEditorProps) {
  function handleAdd() {
    onChange([...entries, createAgentCareerEntryDraft()]);
  }

  function handleUpdate(
    entryId: string,
    patch: Partial<AgentCareerEntryDraft>,
  ) {
    onChange(
      entries.map((entry) =>
        entry.id === entryId ? { ...entry, ...patch } : entry,
      ),
    );
  }

  function handleDelete(entryId: string) {
    onChange(entries.filter((entry) => entry.id !== entryId));
  }

  return (
    <View style={styles.container}>
      {entries.length === 0 ? (
        <View style={styles.emptyState}>
          <AppText color="secondary" variant="bodySm">
            {emptyLabel}
          </AppText>
        </View>
      ) : (
        entries.map((entry, index) => (
          <View key={entry.id} style={styles.entryCard}>
            <View style={styles.entryHeader}>
              <AppText variant="titleSm">{`Esperienza ${index + 1}`}</AppText>
              <Pressable
                accessibilityLabel={`Rimuovi esperienza ${index + 1}`}
                hitSlop={8}
                onPress={() => handleDelete(entry.id)}
                style={styles.iconButton}
              >
                <Ionicons color={colors.textSecondary} name="trash-outline" size={18} />
              </Pressable>
            </View>

            <Input
              label="Agenzia"
              onChangeText={(value) => handleUpdate(entry.id, { agency_name: value })}
              placeholder="Es. MB Football Management"
              value={entry.agency_name}
            />

            <Input
              label="Ruolo"
              onChangeText={(value) => handleUpdate(entry.id, { role: value })}
              placeholder="Es. Agent scout, consulente, partner"
              value={entry.role}
            />

            <View style={styles.yearsRow}>
              <View style={styles.yearField}>
                <Input
                  keyboardType="number-pad"
                  label="Dal"
                  onChangeText={(value) =>
                    handleUpdate(entry.id, {
                      period_start_year: parseYear(value),
                    })
                  }
                  placeholder="2021"
                  value={entry.period_start_year ? String(entry.period_start_year) : ""}
                />
              </View>
              <View style={styles.yearField}>
                <Input
                  keyboardType="number-pad"
                  label="Al"
                  onChangeText={(value) =>
                    handleUpdate(entry.id, {
                      period_end_year: parseYear(value),
                    })
                  }
                  placeholder="2023"
                  value={entry.period_end_year ? String(entry.period_end_year) : ""}
                />
              </View>
            </View>
          </View>
        ))
      )}

      <Button
        label={addButtonLabel}
        onPress={handleAdd}
        variant="secondary"
      />
    </View>
  );
}

function parseYear(value: string) {
  const digits = value.replace(/[^\d]/g, "").slice(0, 4);

  if (!digits) {
    return null;
  }

  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : null;
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[12],
  },
  emptyState: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[12],
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[12],
  },
  entryCard: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: 1,
    gap: spacing[12],
    padding: spacing[14],
  },
  entryHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  yearField: {
    flex: 1,
  },
  yearsRow: {
    flexDirection: "row",
    gap: spacing[10],
  },
});
