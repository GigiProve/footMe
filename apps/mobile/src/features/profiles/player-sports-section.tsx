import { useEffect, useMemo, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { SelectField } from "../../components/ui/select-field";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { Button, Card, Input } from "../../ui";
import {
  PLAYER_CATEGORY_OPTIONS,
  PLAYER_POSITION_OPTIONS,
  PLAYER_SEASON_OPTIONS,
  PREFERRED_FOOT_OPTIONS,
  createEmptyPlayerExperienceForm,
  getPlayerExperienceBadges,
  getPlayerPositionLabel,
  getPreferredFootLabel,
  normalizeNumericInput,
  sortPlayerExperiencesBySeason,
  type PlayerExperienceForm,
  type PlayerPosition,
  type PreferredFoot,
  type TeamAutocompleteOption,
} from "./player-sports";

const TEAM_SEARCH_DEBOUNCE_MS = 250;

type TeamAutocompleteInputProps = {
  label: string;
  onChangeText: (value: string) => void;
  onSelectTeam: (team: TeamAutocompleteOption) => void;
  placeholder?: string;
  searchTeams: (query: string) => Promise<TeamAutocompleteOption[]>;
  value: string;
};

type StatsInputRowProps = {
  appearances: string;
  assists: string;
  goals: string;
  onAppearancesChange: (value: string) => void;
  onAssistsChange: (value: string) => void;
  onGoalsChange: (value: string) => void;
};

type ExperienceBadgeProps = {
  label: string;
};

type ExperienceStatsRowProps = {
  appearances: string;
  assists: string;
  goals: string;
};

type ExperienceCardProps = {
  editable?: boolean;
  experience: PlayerExperienceForm;
  onDelete?: () => void;
  onEdit?: () => void;
};

type AddPlayerExperienceFormProps = {
  experience: PlayerExperienceForm;
  onCancel: () => void;
  onChange: (experience: PlayerExperienceForm) => void;
  onSave: () => void;
  saveLabel?: string;
  searchTeams: (query: string) => Promise<TeamAutocompleteOption[]>;
  title?: string;
};

type PlayerCharacteristicsSectionProps = {
  editable?: boolean;
  onPreferredFootChange?: (value: PreferredFoot | "") => void;
  onPrimaryPositionChange?: (value: PlayerPosition) => void;
  onSecondaryPositionChange?: (value: PlayerPosition | "") => void;
  preferredFoot: PreferredFoot | "";
  primaryPosition: PlayerPosition;
  secondaryPosition: PlayerPosition | "";
};

type PlayerExperiencesSectionProps = {
  addButtonLabel?: string;
  editable?: boolean;
  emptyStateLabel?: string;
  experiences: PlayerExperienceForm[];
  onChange?: (experiences: PlayerExperienceForm[]) => void;
  searchTeams: (query: string) => Promise<TeamAutocompleteOption[]>;
  showHeader?: boolean;
};

function TeamLogo({
  name,
  teamLogoUrl,
}: {
  name: string;
  teamLogoUrl: string | null | undefined;
}) {
  if (teamLogoUrl?.trim()) {
    return <Image source={{ uri: teamLogoUrl }} style={styles.teamLogo} />;
  }

  return (
    <View style={[styles.teamLogo, styles.teamLogoFallback]}>
      <Ionicons color={colors.accentStrong} name="shield-outline" size={24} />
    </View>
  );
}

export function ExperienceBadge({ label }: ExperienceBadgeProps) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

export function ExperienceStatsRow({
  appearances,
  assists,
  goals,
}: ExperienceStatsRowProps) {
  return (
    <View style={styles.statsInlineRow}>
      <Text style={styles.statsInlineText}>
        {`${appearances || "0"} presenze • ${goals || "0"} gol • ${assists || "0"} assist`}
      </Text>
    </View>
  );
}

export function StatsInputRow({
  appearances,
  assists,
  goals,
  onAppearancesChange,
  onAssistsChange,
  onGoalsChange,
}: StatsInputRowProps) {
  return (
    <View style={styles.statsInputsWrapper}>
      <Text style={styles.subsectionLabel}>Statistiche</Text>
      <View style={styles.statsGrid}>
        <View style={styles.statsCell}>
          <Text style={styles.statsLabel}>Presenze</Text>
          <Input
            keyboardType="number-pad"
            onChangeText={(value) => onAppearancesChange(normalizeNumericInput(value))}
            placeholder="0"
            value={appearances}
          />
        </View>
        <View style={styles.statsCell}>
          <Text style={styles.statsLabel}>Gol</Text>
          <Input
            keyboardType="number-pad"
            onChangeText={(value) => onGoalsChange(normalizeNumericInput(value))}
            placeholder="0"
            value={goals}
          />
        </View>
        <View style={styles.statsCell}>
          <Text style={styles.statsLabel}>Assist</Text>
          <Input
            keyboardType="number-pad"
            onChangeText={(value) => onAssistsChange(normalizeNumericInput(value))}
            placeholder="0"
            value={assists}
          />
        </View>
      </View>
    </View>
  );
}

export function TeamAutocompleteInput({
  label,
  onChangeText,
  onSelectTeam,
  placeholder = "Cerca squadra",
  searchTeams,
  value,
}: TeamAutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<TeamAutocompleteOption[]>([]);

  useEffect(() => {
    let isMounted = true;
    const debounceTimeout = setTimeout(() => {
      async function loadSuggestions() {
        const query = value.trim();

        if (query.length < 2) {
          if (isMounted) {
            setSuggestions([]);
          }
          return;
        }

        try {
          const results = await searchTeams(query);

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
    }, TEAM_SEARCH_DEBOUNCE_MS);

    return () => {
      isMounted = false;
      clearTimeout(debounceTimeout);
    };
  }, [searchTeams, value]);

  const normalizedQuery = value.trim().toLowerCase();
  const shouldShowSuggestions = normalizedQuery.length >= 2;
  const hasExactMatch = suggestions.some(
    (suggestion) => suggestion.name.trim().toLowerCase() === normalizedQuery,
  );

  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.subsectionLabel}>{label}</Text>
      <Input
        autoCapitalize="words"
        onChangeText={onChangeText}
        placeholder={placeholder}
        value={value}
      />

      {shouldShowSuggestions ? (
        <View style={styles.suggestionsSurface} testID="team-autocomplete-suggestions">
          <ScrollView contentContainerStyle={styles.suggestionsContent} nestedScrollEnabled>
            {suggestions.map((suggestion) => (
              <Pressable
                accessibilityRole="button"
                key={suggestion.id ?? `${suggestion.name}-${suggestion.city ?? "na"}`}
                onPress={() => onSelectTeam(suggestion)}
                style={({ pressed }) => [
                  styles.suggestionButton,
                  pressed ? styles.suggestionButtonPressed : null,
                ]}
                testID={`team-autocomplete-suggestion-${suggestion.name}`}
              >
                <TeamLogo name={suggestion.name} teamLogoUrl={suggestion.logoUrl ?? ""} />
                <View style={styles.suggestionCopy}>
                  <Text style={styles.suggestionName}>{suggestion.name}</Text>
                  <Text style={styles.suggestionMeta}>
                    {suggestion.city?.trim() || "Città non disponibile"}
                  </Text>
                </View>
              </Pressable>
            ))}

            {!hasExactMatch && normalizedQuery ? (
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  onSelectTeam({
                    city: null,
                    id: null,
                    isCustom: true,
                    logoUrl: null,
                    name: value.trim(),
                  })
                }
                style={({ pressed }) => [
                  styles.suggestionButton,
                  pressed ? styles.suggestionButtonPressed : null,
                ]}
                testID="team-autocomplete-create-option"
              >
                <View style={[styles.teamLogo, styles.teamLogoFallback]}>
                  <Ionicons color={colors.accentStrong} name="add" size={24} />
                </View>
                <View style={styles.suggestionCopy}>
                  <Text style={styles.suggestionName}>Aggiungi nuova squadra</Text>
                  <Text style={styles.suggestionMeta}>{value.trim()}</Text>
                </View>
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

export function ExperienceCard({
  editable = false,
  experience,
  onDelete,
  onEdit,
}: ExperienceCardProps) {
  const badges = useMemo(
    () => getPlayerExperienceBadges(experience),
    [experience],
  );

  return (
    <Card style={styles.experienceCard} variant="muted">
      <View style={styles.experienceHeader}>
        <View style={styles.experienceIdentity}>
          <TeamLogo name={experience.clubName} teamLogoUrl={experience.teamLogoUrl} />
          <View style={styles.experienceCopy}>
            <Text style={styles.experienceTeamName}>
              {experience.clubName.trim() || "Squadra da completare"}
            </Text>
            <Text style={styles.experienceMeta}>
              {(experience.category.trim() || "Categoria da definire") +
                " • " +
                (experience.seasonLabel.trim() || "Stagione da completare")}
            </Text>
          </View>
        </View>

        {editable ? (
          <View style={styles.experienceActions}>
            <Button label="Modifica" onPress={onEdit} size="sm" variant="secondary" />
            <Button
              destructive
              label="Elimina"
              onPress={onDelete}
              size="sm"
              variant="link"
            />
          </View>
        ) : null}
      </View>

      <ExperienceStatsRow
        appearances={experience.appearances}
        assists={experience.assists}
        goals={experience.goals}
      />

      {badges.length > 0 ? (
        <View style={styles.badgesRow}>
          {badges.map((badge) => (
            <ExperienceBadge key={badge} label={badge} />
          ))}
        </View>
      ) : null}
    </Card>
  );
}

export function AddPlayerExperienceForm({
  experience,
  onCancel,
  onChange,
  onSave,
  saveLabel = "Salva esperienza",
  searchTeams,
  title = "Aggiungi esperienza calcistica",
}: AddPlayerExperienceFormProps) {
  return (
    <View style={styles.modalBody}>
      <Text style={styles.modalTitle}>{title}</Text>
      <Text style={styles.modalDescription}>
        Compila una stagione alla volta con squadra, categoria e numeri chiave.
      </Text>

      <TeamAutocompleteInput
        label="Squadra"
        onChangeText={(value) =>
          onChange({
            ...experience,
            clubId: null,
            clubName: value,
            teamCity: "",
            teamLogoUrl: "",
          })
        }
        onSelectTeam={(team) =>
          onChange({
            ...experience,
            clubId: team.id,
            clubName: team.name,
            teamCity: team.city ?? "",
            teamLogoUrl: team.logoUrl ?? "",
          })
        }
        searchTeams={searchTeams}
        value={experience.clubName}
      />

      <SelectField
        label="Stagione"
        onChange={(value) => onChange({ ...experience, seasonLabel: value })}
        options={PLAYER_SEASON_OPTIONS}
        placeholder="Seleziona la stagione"
        value={experience.seasonLabel}
      />

      <SelectField
        label="Categoria"
        onChange={(value) => onChange({ ...experience, category: value })}
        options={PLAYER_CATEGORY_OPTIONS}
        placeholder="Seleziona la categoria"
        value={experience.category}
      />

      <StatsInputRow
        appearances={experience.appearances}
        assists={experience.assists}
        goals={experience.goals}
        onAppearancesChange={(value) => onChange({ ...experience, appearances: value })}
        onAssistsChange={(value) => onChange({ ...experience, assists: value })}
        onGoalsChange={(value) => onChange({ ...experience, goals: value })}
      />

      <Input
        keyboardType="number-pad"
        label="Minuti giocati (facoltativo)"
        onChangeText={(value) =>
          onChange({ ...experience, minutesPlayed: normalizeNumericInput(value) })
        }
        placeholder="0"
        value={experience.minutesPlayed}
      />

      <Input
        label="Note o premi (facoltativo)"
        multiline
        onChangeText={(value) => onChange({ ...experience, awards: value })}
        placeholder="Es. playoff vinti, miglior marcatore"
        value={experience.awards}
      />

      <View style={styles.modalActions}>
        <Button label="Annulla" onPress={onCancel} variant="secondary" />
        <Button label={saveLabel} onPress={onSave} variant="primary" />
      </View>
    </View>
  );
}

export function PlayerCharacteristicsSection({
  editable = false,
  onPreferredFootChange,
  onPrimaryPositionChange,
  onSecondaryPositionChange,
  preferredFoot,
  primaryPosition,
  secondaryPosition,
}: PlayerCharacteristicsSectionProps) {
  return (
    <View style={styles.sectionStack}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Caratteristiche del giocatore</Text>
        <Text style={styles.sectionDescription}>
          Ruolo e piede preferito leggibili in meno di 5 secondi.
        </Text>
      </View>

      {editable ? (
        <>
          <SelectField
            label="Ruolo principale"
            onChange={(value) => onPrimaryPositionChange?.(value as PlayerPosition)}
            options={PLAYER_POSITION_OPTIONS}
            placeholder="Seleziona il ruolo principale"
            value={primaryPosition}
          />
          <SelectField
            allowClear
            clearLabel="Nessun ruolo secondario"
            label="Ruolo secondario"
            onChange={(value) => onSecondaryPositionChange?.(value as PlayerPosition | "")}
            options={PLAYER_POSITION_OPTIONS}
            placeholder="Seleziona il ruolo secondario"
            value={secondaryPosition}
          />
          <SelectField
            allowClear
            clearLabel="Rimuovi piede preferito"
            label="Piede preferito"
            onChange={(value) => onPreferredFootChange?.(value as PreferredFoot | "")}
            options={PREFERRED_FOOT_OPTIONS}
            placeholder="Seleziona il piede preferito"
            value={preferredFoot}
          />
        </>
      ) : (
        <View style={styles.readonlyGrid}>
          {[
            {
              label: "Ruolo principale",
              value: getPlayerPositionLabel(primaryPosition),
            },
            {
              label: "Ruolo secondario",
              value: secondaryPosition
                ? getPlayerPositionLabel(secondaryPosition)
                : "Nessuno",
            },
            {
              label: "Piede preferito",
              value: preferredFoot ? getPreferredFootLabel(preferredFoot) : "Da completare",
            },
          ].map((item) => (
            <View key={item.label} style={styles.readonlyItem}>
              <Text style={styles.readonlyLabel}>{item.label}</Text>
              <Text style={styles.readonlyValue}>{item.value}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export function PlayerExperiencesSection({
  addButtonLabel = "Aggiungi esperienza calcistica",
  editable = false,
  emptyStateLabel = "Nessuna esperienza calcistica salvata.",
  experiences,
  onChange,
  searchTeams,
  showHeader = true,
}: PlayerExperiencesSectionProps) {
  const [draft, setDraft] = useState<PlayerExperienceForm>(createEmptyPlayerExperienceForm());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const sortedExperiences = useMemo(
    () => sortPlayerExperiencesBySeason(experiences),
    [experiences],
  );

  function closeModal() {
    setDraft(createEmptyPlayerExperienceForm());
    setEditingIndex(null);
    setIsModalOpen(false);
  }

  function openNewExperience() {
    setDraft(createEmptyPlayerExperienceForm());
    setEditingIndex(null);
    setIsModalOpen(true);
  }

  function openExistingExperience(index: number) {
    setDraft(sortedExperiences[index]);
    setEditingIndex(index);
    setIsModalOpen(true);
  }

  function handleSave() {
    if (!onChange) {
      closeModal();
      return;
    }

    const nextExperiences =
      editingIndex === null
        ? [...sortedExperiences, draft]
        : sortedExperiences.map((experience, index) =>
            index === editingIndex ? draft : experience,
          );

    onChange(sortPlayerExperiencesBySeason(nextExperiences));
    closeModal();
  }

  function handleDelete(index: number) {
    if (!onChange) {
      return;
    }

    onChange(sortedExperiences.filter((_, currentIndex) => currentIndex !== index));
  }

  return (
    <View style={styles.sectionStack}>
      {showHeader ? (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Esperienze calcistiche</Text>
          <Text style={styles.sectionDescription}>
            Timeline ordinata dalla stagione più recente, con squadra, categoria e statistiche.
          </Text>
        </View>
      ) : null}

      {editable ? (
        <Button label={addButtonLabel} onPress={openNewExperience} variant="secondary" />
      ) : null}

      {sortedExperiences.length > 0 ? (
        <View style={styles.experiencesList}>
          {sortedExperiences.map((experience, index) => (
            <ExperienceCard
              editable={editable}
              experience={experience}
              key={experience.id ?? `${experience.seasonLabel}-${experience.clubName}-${index}`}
              onDelete={editable ? () => handleDelete(index) : undefined}
              onEdit={editable ? () => openExistingExperience(index) : undefined}
            />
          ))}
        </View>
      ) : (
        <Card variant="muted">
          <Text style={styles.emptyState}>{emptyStateLabel}</Text>
        </Card>
      )}

      <Modal
        animationType="slide"
        onRequestClose={closeModal}
        transparent
        visible={isModalOpen}
      >
        <Pressable onPress={closeModal} style={styles.modalOverlay}>
          <Pressable onPress={(event) => event.stopPropagation()} style={styles.modalCard}>
            <ScrollView contentContainerStyle={styles.modalScrollContent}>
              <AddPlayerExperienceForm
                experience={draft}
                onCancel={closeModal}
                onChange={setDraft}
                onSave={handleSave}
                saveLabel={editingIndex === null ? "Aggiungi esperienza" : "Aggiorna esperienza"}
                searchTeams={searchTeams}
                title={
                  editingIndex === null
                    ? "Aggiungi esperienza calcistica"
                    : "Modifica esperienza calcistica"
                }
              />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[4],
    borderRadius: radius.full,
    backgroundColor: colors.accentSoft,
  },
  badgeText: {
    color: colors.accentStrong,
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.bold,
  },
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[6],
  },
  emptyState: {
    color: colors.textSecondary,
    lineHeight: typography.lineHeight[22],
  },
  experiencesList: {
    gap: spacing[10],
  },
  experienceActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[6],
    flexWrap: "wrap",
  },
  experienceCard: {
    gap: spacing[10],
    paddingVertical: spacing[14],
  },
  experienceCopy: {
    flex: 1,
    gap: spacing[4],
  },
  experienceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing[10],
    alignItems: "center",
  },
  experienceIdentity: {
    flexDirection: "row",
    gap: spacing[10],
    flex: 1,
    alignItems: "center",
  },
  experienceMeta: {
    color: colors.textSecondary,
    fontSize: typography.fontSize[12],
    lineHeight: typography.lineHeight[22],
  },
  experienceTeamName: {
    color: colors.textPrimary,
    fontSize: typography.fontSize[16],
    fontWeight: typography.fontWeight.heavy,
  },
  fieldGroup: {
    gap: spacing[8],
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing[10],
    flexWrap: "wrap",
  },
  modalBody: {
    gap: spacing[16],
  },
  modalCard: {
    maxHeight: "88%",
    borderRadius: radius[24],
    backgroundColor: colors.surface,
    padding: spacing[18],
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalDescription: {
    color: colors.textSecondary,
    lineHeight: typography.lineHeight[22],
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    padding: spacing[16],
  },
  modalScrollContent: {
    gap: spacing[16],
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: typography.fontSize[20],
    fontWeight: typography.fontWeight.heavy,
  },
  readonlyGrid: {
    gap: spacing[10],
  },
  readonlyItem: {
    gap: spacing[4],
    padding: spacing[14],
    borderRadius: radius[18],
    backgroundColor: colors.surfaceMuted,
  },
  readonlyLabel: {
    color: colors.textSecondary,
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.bold,
    textTransform: "uppercase",
  },
  readonlyValue: {
    color: colors.textPrimary,
    fontSize: typography.fontSize[16],
    fontWeight: typography.fontWeight.bold,
  },
  sectionDescription: {
    color: colors.textSecondary,
    lineHeight: typography.lineHeight[22],
  },
  sectionHeader: {
    gap: spacing[4],
  },
  sectionStack: {
    gap: spacing[12],
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: typography.fontSize[18],
    fontWeight: typography.fontWeight.heavy,
  },
  statsCell: {
    flex: 1,
    minWidth: 80,
    gap: spacing[6],
  },
  statsGrid: {
    flexDirection: "row",
    gap: spacing[10],
    flexWrap: "wrap",
  },
  statsInputsWrapper: {
    gap: spacing[8],
  },
  statsLabel: {
    color: colors.textSecondary,
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.bold,
    textTransform: "uppercase",
  },
  statsInlineRow: {
    paddingHorizontal: spacing[4],
  },
  statsInlineText: {
    color: colors.textPrimary,
    fontSize: typography.fontSize[12],
    lineHeight: typography.lineHeight[22],
    fontWeight: typography.fontWeight.bold,
  },
  subsectionLabel: {
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.bold,
  },
  suggestionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[12],
    borderRadius: radius[16],
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[12],
  },
  suggestionButtonPressed: {
    opacity: 0.8,
  },
  suggestionCopy: {
    flex: 1,
    gap: spacing[4],
  },
  suggestionMeta: {
    color: colors.textSecondary,
  },
  suggestionName: {
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.bold,
  },
  suggestionsContent: {
    gap: spacing[8],
  },
  suggestionsSurface: {
    maxHeight: 220,
    borderRadius: radius[20],
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: spacing[10],
  },
  teamLogo: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
  },
  teamLogoFallback: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
});
