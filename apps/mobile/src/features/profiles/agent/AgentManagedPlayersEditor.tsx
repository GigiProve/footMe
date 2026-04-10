import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import {
  createAgentManagedPlayerEntryDraft,
  createManagedPlayerDraftFromCandidate,
  type AgentManagedPlayerEntryDraft,
  type AgentPlayerCandidate,
} from "../agent-profile";
import { getPlayerPositionLabel, type PlayerPosition } from "../player-sports";
import { SelectField } from "../../../components/ui/select-field";
import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Avatar, Button, Input, Toggle } from "../../../ui";

const SEARCH_DEBOUNCE_MS = 250;

const POSITION_OPTIONS: { label: string; value: PlayerPosition }[] = [
  { label: "Portiere", value: "goalkeeper" },
  { label: "Difensore", value: "defender" },
  { label: "Centrocampista", value: "midfielder" },
  { label: "Attaccante", value: "forward" },
];

type AgentManagedPlayersEditorProps = {
  entries: AgentManagedPlayerEntryDraft[];
  errorMessage?: string;
  onChange: (entries: AgentManagedPlayerEntryDraft[]) => void;
  searchPlayers: (query: string) => Promise<AgentPlayerCandidate[]>;
};

export function AgentManagedPlayersEditor({
  entries,
  errorMessage,
  onChange,
  searchPlayers,
}: AgentManagedPlayersEditorProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AgentPlayerCandidate[]>([]);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [manualEntry, setManualEntry] = useState<AgentManagedPlayerEntryDraft>(
    createAgentManagedPlayerEntryDraft(),
  );

  useEffect(() => {
    let isMounted = true;

    const timeout = setTimeout(() => {
      async function loadSuggestions() {
        if (query.trim().length < 2) {
          if (isMounted) {
            setSuggestions([]);
          }
          return;
        }

        try {
          const results = await searchPlayers(query.trim());

          if (isMounted) {
            setSuggestions(results);
          }
        } catch {
          if (isMounted) {
            setSuggestions([]);
          }
        }
      }

      void loadSuggestions();
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, [query, searchPlayers]);

  const suggestionIds = useMemo(
    () => new Set(entries.map((entry) => entry.linked_profile_id).filter(Boolean)),
    [entries],
  );

  function handleAddCandidate(candidate: AgentPlayerCandidate) {
    if (suggestionIds.has(candidate.profile_id)) {
      setQuery("");
      setSuggestions([]);
      return;
    }

    onChange([...entries, createManagedPlayerDraftFromCandidate(candidate)]);
    setQuery("");
    setSuggestions([]);
  }

  function handleDelete(entryId: string) {
    onChange(entries.filter((entry) => entry.id !== entryId));
  }

  function handleAddManualEntry() {
    if (!manualEntry.display_name.trim()) {
      return;
    }

    onChange([
      ...entries,
      {
        ...manualEntry,
        display_name: manualEntry.display_name.trim(),
      },
    ]);
    setManualEntry(createAgentManagedPlayerEntryDraft());
    setIsManualOpen(false);
  }

  function updateManualEntry(patch: Partial<AgentManagedPlayerEntryDraft>) {
    setManualEntry((current) => ({ ...current, ...patch }));
  }

  return (
    <View style={styles.container}>
      <Input
        label="Cerca un calciatore su FootMe"
        onChangeText={setQuery}
        placeholder="Digita nome e cognome"
        value={query}
      />

      {suggestions.length > 0 ? (
        <View style={styles.suggestionsSurface}>
          <ScrollView
            contentContainerStyle={styles.suggestionsContent}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {suggestions.map((suggestion) => {
              const isAdded = suggestionIds.has(suggestion.profile_id);

              return (
                <Pressable
                  accessibilityRole="button"
                  disabled={isAdded}
                  key={suggestion.profile_id}
                  onPress={() => handleAddCandidate(suggestion)}
                  style={[styles.suggestionRow, isAdded ? styles.suggestionRowDisabled : null]}
                >
                  <Avatar name={suggestion.full_name} size="md" uri={suggestion.avatar_url} />
                  <View style={styles.suggestionText}>
                    <AppText variant="titleSm">{suggestion.full_name}</AppText>
                    <AppText color="secondary" variant="bodySm">
                      {buildPlayerSummaryLine({
                        birthYear: suggestion.birth_year,
                        categoryLabel: suggestion.category_label,
                        isFreeAgent: suggestion.is_free_agent,
                        primaryPosition: suggestion.primary_position,
                      })}
                    </AppText>
                  </View>
                  <Ionicons
                    color={isAdded ? colors.textMuted : colors.accent}
                    name={isAdded ? "checkmark-circle" : "add-circle-outline"}
                    size={22}
                  />
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : query.trim().length >= 2 ? (
        <View style={styles.emptyState}>
          <AppText color="secondary" variant="bodySm">
            Nessun profilo FootMe trovato con questo nome.
          </AppText>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={() => setIsManualOpen((current) => !current)}
        style={styles.manualToggle}
      >
        <Ionicons color={colors.accent} name="create-outline" size={18} />
        <AppText color="accent" variant="titleSm">
          {isManualOpen ? "Chiudi inserimento manuale" : "Aggiungi manualmente"}
        </AppText>
      </Pressable>

      {isManualOpen ? (
        <View style={styles.manualCard}>
          <Input
            label="Nome giocatore"
            onChangeText={(value) => updateManualEntry({ display_name: value })}
            placeholder="Es. Luca Bianchi"
            value={manualEntry.display_name}
          />

          <SelectField
            allowClear
            label="Ruolo"
            onChange={(value) =>
              updateManualEntry({ primary_position: value || null })
            }
            options={POSITION_OPTIONS}
            placeholder="Seleziona ruolo"
            value={manualEntry.primary_position ?? ""}
          />

          <View style={styles.inlineFields}>
            <View style={styles.inlineField}>
              <Input
                keyboardType="number-pad"
                label="Anno nascita"
                onChangeText={(value) =>
                  updateManualEntry({ birth_year: parseYear(value) })
                }
                placeholder="2004"
                value={manualEntry.birth_year ? String(manualEntry.birth_year) : ""}
              />
            </View>
            <View style={styles.inlineField}>
              <Input
                label="Categoria"
                onChangeText={(value) =>
                  updateManualEntry({ category_label: value.trim() || null })
                }
                placeholder="Serie D, Eccellenza..."
                value={manualEntry.category_label ?? ""}
              />
            </View>
          </View>

          <Toggle
            label="Giocatore attualmente svincolato"
            onValueChange={(value) => updateManualEntry({ is_free_agent: value })}
            value={manualEntry.is_free_agent}
          />

          <Button
            disabled={!manualEntry.display_name.trim()}
            label="Aggiungi al portfolio"
            onPress={handleAddManualEntry}
            variant="secondary"
          />
        </View>
      ) : null}

      <View style={styles.listHeader}>
        <AppText variant="titleSm">Portfolio attuale</AppText>
        <AppText color="secondary" variant="bodySm">
          {entries.length === 1 ? "1 giocatore" : `${entries.length} giocatori`}
        </AppText>
      </View>

      {entries.length === 0 ? (
        <View style={styles.emptyState}>
          <AppText color="secondary" variant="bodySm">
            Aggiungi almeno un calciatore per costruire il portfolio operativo.
          </AppText>
        </View>
      ) : (
        <View style={styles.entriesList}>
          {entries.map((entry, index) => (
            <View key={entry.id} style={styles.entryRow}>
              <Avatar name={entry.display_name} size="md" uri={entry.avatar_url} />
              <View style={styles.entryText}>
                <AppText variant="titleSm">{entry.display_name}</AppText>
                <AppText color="secondary" variant="bodySm">
                  {buildPlayerSummaryLine({
                    birthYear: entry.birth_year,
                    categoryLabel: entry.category_label,
                    isFreeAgent: entry.is_free_agent,
                    primaryPosition: entry.primary_position,
                  })}
                </AppText>
              </View>
              <Pressable
                accessibilityLabel={`Rimuovi giocatore ${index + 1}`}
                hitSlop={8}
                onPress={() => handleDelete(entry.id)}
                style={styles.iconButton}
              >
                <Ionicons color={colors.textSecondary} name="trash-outline" size={18} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {errorMessage ? (
        <AppText color="danger" variant="bodySm">
          {errorMessage}
        </AppText>
      ) : null}
    </View>
  );
}

function buildPlayerSummaryLine(input: {
  birthYear: number | null;
  categoryLabel: string | null;
  isFreeAgent: boolean;
  primaryPosition: PlayerPosition | null;
}) {
  return [
    input.primaryPosition ? getPlayerPositionLabel(input.primaryPosition) : null,
    input.categoryLabel?.trim() || null,
    input.birthYear ? String(input.birthYear) : null,
    input.isFreeAgent ? "Svincolato" : null,
  ]
    .filter(Boolean)
    .join(" • ");
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
  entriesList: {
    gap: spacing[10],
  },
  entryRow: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[12],
  },
  entryText: {
    flex: 1,
    gap: spacing[4],
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  inlineField: {
    flex: 1,
  },
  inlineFields: {
    flexDirection: "row",
    gap: spacing[10],
  },
  listHeader: {
    alignItems: "baseline",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  manualCard: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: 1,
    gap: spacing[12],
    padding: spacing[14],
  },
  manualToggle: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
  },
  suggestionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[10],
  },
  suggestionRowDisabled: {
    opacity: 0.55,
  },
  suggestionText: {
    flex: 1,
    gap: spacing[4],
  },
  suggestionsContent: {
    gap: spacing[4],
    paddingVertical: spacing[6],
  },
  suggestionsSurface: {
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: 1,
    maxHeight: 240,
    overflow: "hidden",
  },
});
