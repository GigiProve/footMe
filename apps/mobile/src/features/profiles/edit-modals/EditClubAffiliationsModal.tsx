import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing, typography } from "../../../theme/tokens";
import { AppText, Button, Input, SectionCard } from "../../../ui";
import {
  saveClubAffiliations,
  searchClubsForAffiliation,
  type ClubAffiliationSummary,
} from "../../clubs/club-service";
import { EditModalShell } from "./EditModalShell";

type AffiliationDraft = {
  category: string | null;
  city: string;
  id: string;
  name: string;
  relationshipLabel: string;
};

type EditClubAffiliationsModalProps = {
  clubId: string;
  initialAffiliations: ClubAffiliationSummary[];
  onClose: () => void;
  onSaved: () => void;
  visible: boolean;
};

export function EditClubAffiliationsModal({
  clubId,
  initialAffiliations,
  onClose,
  onSaved,
  visible,
}: EditClubAffiliationsModalProps) {
  const [drafts, setDrafts] = useState<AffiliationDraft[]>(() =>
    initialAffiliations.map(toDraft),
  );
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClubAffiliationSummary[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setDrafts(initialAffiliations.map(toDraft));
      setQuery("");
      setResults([]);
      setIsSaving(false);
      setIsSearching(false);
    }
  }, [initialAffiliations, visible]);

  async function handleSearch() {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    setIsSearching(true);

    try {
      const nextResults = await searchClubsForAffiliation(query, clubId);
      const selectedIds = new Set(drafts.map((draft) => draft.id));
      setResults(nextResults.filter((club) => !selectedIds.has(club.id)));
    } catch {
      Alert.alert("Errore", "Ricerca società non riuscita.");
    } finally {
      setIsSearching(false);
    }
  }

  function handleAdd(club: ClubAffiliationSummary) {
    setDrafts((prev) => [
      ...prev,
      {
        category: club.category,
        city: club.city,
        id: club.id,
        name: club.name,
        relationshipLabel: club.relationship_label ?? "",
      },
    ]);
    setResults((prev) => prev.filter((result) => result.id !== club.id));
  }

  function handleRemove(clubIdToRemove: string) {
    setDrafts((prev) => prev.filter((draft) => draft.id !== clubIdToRemove));
  }

  function handleRelationshipChange(index: number, value: string) {
    setDrafts((prev) =>
      prev.map((draft, draftIndex) =>
        draftIndex === index ? { ...draft, relationshipLabel: value } : draft,
      ),
    );
  }

  async function handleSave() {
    setIsSaving(true);

    try {
      await saveClubAffiliations(
        clubId,
        drafts.map((draft, index) => ({
          affiliateClubId: draft.id,
          relationshipLabel: draft.relationshipLabel.trim() || null,
          sortOrder: index,
        })),
      );
      onSaved();
    } catch {
      Alert.alert("Errore", "Impossibile salvare le società affiliate.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <EditModalShell
      isSaving={isSaving}
      onClose={onClose}
      onSave={handleSave}
      title="Società affiliate"
      visible={visible}
    >
      <SectionCard
        description="Collega academy, scuole calcio o centri tecnici già presenti su footMe."
        title="Cerca società"
      >
        <Input
          label="Nome società"
          onChangeText={setQuery}
          placeholder="Cerca per nome"
          value={query}
        />
        <Button
          disabled={isSearching}
          label={isSearching ? "Ricerca..." : "Cerca"}
          onPress={handleSearch}
          size="sm"
          variant="secondary"
        />
        {results.map((club) => (
          <Pressable
            accessibilityRole="button"
            key={club.id}
            onPress={() => handleAdd(club)}
            style={styles.resultRow}
          >
            <View style={styles.resultIcon}>
              <Ionicons color={colors.textMuted} name="shield-outline" size={18} />
            </View>
            <View style={styles.resultText}>
              <AppText variant="bodySm" style={styles.resultTitle}>
                {club.name}
              </AppText>
              <AppText color="secondary" numberOfLines={1} variant="caption">
                {club.category ?? club.city}
              </AppText>
            </View>
            <Ionicons color={colors.accent} name="add-circle-outline" size={20} />
          </Pressable>
        ))}
      </SectionCard>

      <SectionCard title="Affiliate collegate">
        {drafts.length === 0 ? (
          <AppText color="muted" variant="bodySm">
            Nessuna società affiliata collegata.
          </AppText>
        ) : (
          drafts.map((draft, index) => (
            <View key={draft.id} style={styles.draftCard}>
              <View style={styles.draftHeader}>
                <View style={styles.resultText}>
                  <AppText variant="titleSm">{draft.name}</AppText>
                  <AppText color="secondary" numberOfLines={1} variant="caption">
                    {draft.category ?? draft.city}
                  </AppText>
                </View>
                <Pressable
                  accessibilityLabel={`Rimuovi ${draft.name}`}
                  accessibilityRole="button"
                  onPress={() => handleRemove(draft.id)}
                  style={styles.removeButton}
                >
                  <Ionicons color={colors.danger} name="trash-outline" size={17} />
                </Pressable>
              </View>
              <Input
                label="Tipo collegamento"
                onChangeText={(value) => handleRelationshipChange(index, value)}
                placeholder="Es. Scuola calcio affiliata"
                value={draft.relationshipLabel}
              />
            </View>
          ))
        )}
      </SectionCard>
    </EditModalShell>
  );
}

function toDraft(affiliation: ClubAffiliationSummary): AffiliationDraft {
  return {
    category: affiliation.category,
    city: affiliation.city,
    id: affiliation.id,
    name: affiliation.name,
    relationshipLabel: affiliation.relationship_label ?? "",
  };
}

const styles = StyleSheet.create({
  draftCard: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing[12],
    paddingBottom: spacing[14],
  },
  draftHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
  },
  removeButton: {
    alignItems: "center",
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.full,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  resultIcon: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  resultRow: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius[8],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    padding: spacing[12],
  },
  resultText: {
    flex: 1,
    gap: spacing[4],
  },
  resultTitle: {
    fontWeight: typography.fontWeight.semibold,
  },
});
