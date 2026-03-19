import { useEffect, useMemo, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { KeyboardAwareScrollView } from "../../components/ui/keyboard-aware-scroll-view";
import { SelectField } from "../../components/ui/select-field";
import { WheelPicker } from "../../components/ui/wheel-picker";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { Button, Card, Input } from "../../ui";
import { FootballPositionPicker } from "./football-position-picker";
import {
  MONTH_OPTIONS,
  PLAYER_CATEGORY_OPTIONS,
  PLAYER_SEASON_OPTIONS,
  PREFERRED_FOOT_OPTIONS,
  SEASON_PERIOD_OPTIONS,
  createEmptyMultiSeasonDraft,
  createEmptySeasonEntry,
  experienceToMultiSeasonDraft,
  getMonthShortLabel,
  getPlayerExperienceBadges,
  getPlayerPositionLabel,
  getPlayerPositionLabels,
  getPreferredFootLabel,
  isMultiSeasonDraftValid,
  multiSeasonDraftToExperiences,
  normalizeNumericInput,
  sortPlayerExperiencesBySeason,
  type MultiSeasonDraft,
  type PlayerExperienceForm,
  type PlayerPosition,
  type PreferredFoot,
  type SeasonEntry,
  type SeasonPeriod,
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

type SeasonEntryCardProps = {
  hasAttemptedSave: boolean;
  index: number;
  onChange: (season: SeasonEntry) => void;
  onDelete?: () => void;
  season: SeasonEntry;
  usedSeasons: Set<string>;
};

type AddExperienceScreenProps = {
  draft: MultiSeasonDraft;
  editingIndex: number | null;
  onClose: () => void;
  onDraftChange: (draft: MultiSeasonDraft) => void;
  onSave: () => void;
  searchTeams: (query: string) => Promise<TeamAutocompleteOption[]>;
  usedSeasons: Set<string>;
};

type PlayerCharacteristicsSectionProps = {
  editable?: boolean;
  onPreferredFootChange?: (value: PreferredFoot | "") => void;
  onPrimaryPositionChange?: (value: PlayerPosition) => void;
  onSecondaryPositionsChange?: (value: PlayerPosition[]) => void;
  primaryPositionError?: string;
  preferredFoot: PreferredFoot | "";
  primaryPosition: PlayerPosition | "";
  secondaryPositions: PlayerPosition[];
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

const noop = () => {};

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
      <View style={styles.statsWheelRow}>
        <View style={styles.statsWheelCell}>
          <WheelPicker
            compact
            label="Presenze"
            max={99}
            min={0}
            onChange={(value) => onAppearancesChange(String(value))}
            value={Number(appearances) || 0}
          />
        </View>
        <View style={styles.statsWheelCell}>
          <WheelPicker
            compact
            label="Gol"
            max={99}
            min={0}
            onChange={(value) => onGoalsChange(String(value))}
            value={Number(goals) || 0}
          />
        </View>
        <View style={styles.statsWheelCell}>
          <WheelPicker
            compact
            label="Assist"
            max={99}
            min={0}
            onChange={(value) => onAssistsChange(String(value))}
            value={Number(assists) || 0}
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
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

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
  }, [isOpen, searchTeams, value]);

  const normalizedQuery = value.trim().toLowerCase();
  const shouldShowSuggestions = isOpen && normalizedQuery.length >= 2;
  const hasExactMatch = suggestions.some(
    (suggestion) => suggestion.name.trim().toLowerCase() === normalizedQuery,
  );

  function handleSelectTeam(team: TeamAutocompleteOption) {
    setIsOpen(false);
    setSuggestions([]);
    onSelectTeam(team);
  }

  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.subsectionLabel}>{label}</Text>
      <Input
        autoCapitalize="words"
        onChangeText={(nextValue) => {
          setIsOpen(true);
          onChangeText(nextValue);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        value={value}
      />

      {shouldShowSuggestions ? (
        <View
          style={styles.suggestionsSurface}
          testID="team-autocomplete-suggestions"
        >
          <ScrollView
            contentContainerStyle={styles.suggestionsContent}
            nestedScrollEnabled
          >
            {suggestions.map((suggestion) => (
              <Pressable
                accessibilityRole="button"
                key={
                  suggestion.id ??
                  `${suggestion.name}-${suggestion.city ?? "na"}`
                }
                onPress={() => handleSelectTeam(suggestion)}
                style={({ pressed }) => [
                  styles.suggestionButton,
                  pressed ? styles.suggestionButtonPressed : null,
                ]}
                testID={`team-autocomplete-suggestion-${suggestion.name}`}
              >
                <TeamLogo
                  name={suggestion.name}
                  teamLogoUrl={suggestion.logoUrl ?? ""}
                />
                <View style={styles.suggestionCopy}>
                  <Text style={styles.suggestionName}>{suggestion.name}</Text>
                  <Text style={styles.suggestionMeta}>
                    {suggestion.city?.trim() ||
                      (suggestion.isCustom
                        ? "Aggiunta da altri giocatori"
                        : "Città non disponibile")}
                  </Text>
                </View>
              </Pressable>
            ))}

            {!hasExactMatch && normalizedQuery ? (
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  handleSelectTeam({
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
                  <Text style={styles.suggestionName}>
                    Aggiungi nuova squadra
                  </Text>
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
          <TeamLogo
            name={experience.clubName}
            teamLogoUrl={experience.teamLogoUrl}
          />
          <View style={styles.experienceCopy}>
            <Text style={styles.experienceTeamName}>
              {experience.clubName.trim() || "Squadra da completare"}
            </Text>
            <Text style={styles.experienceMeta}>
              {(experience.category.trim() || "Categoria da definire") +
                " • " +
                (experience.seasonLabel.trim() || "Stagione da completare") +
                (experience.seasonPeriod === "partial" &&
                experience.periodStartMonth &&
                experience.periodEndMonth
                  ? ` (${getMonthShortLabel(experience.periodStartMonth)} – ${getMonthShortLabel(experience.periodEndMonth)})`
                  : "")}
            </Text>
          </View>
        </View>

        {editable ? (
          <View style={styles.experienceActions}>
            <Pressable
              accessibilityLabel="Modifica esperienza"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onEdit}
              style={styles.experienceIconButton}
            >
              <Ionicons color={colors.textSecondary} name="pencil" size={16} />
            </Pressable>
            <Pressable
              accessibilityLabel="Elimina esperienza"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onDelete}
              style={styles.experienceIconButton}
            >
              <Ionicons color={colors.danger} name="trash-outline" size={16} />
            </Pressable>
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

function SeasonEntryCard({
  hasAttemptedSave,
  index,
  onChange,
  onDelete,
  season,
  usedSeasons,
}: SeasonEntryCardProps) {
  const missingSeason = hasAttemptedSave && !season.seasonLabel.trim();
  const missingCategory = hasAttemptedSave && !season.category.trim();
  const missingStartMonth =
    hasAttemptedSave &&
    season.seasonPeriod === "partial" &&
    !season.periodStartMonth;
  const missingEndMonth =
    hasAttemptedSave &&
    season.seasonPeriod === "partial" &&
    !season.periodEndMonth;

  return (
    <Card style={styles.seasonEntryCard}>
      <View style={styles.seasonEntryHeader}>
        <Text style={styles.seasonEntryTitle}>
          {season.seasonLabel.trim() || `Stagione ${index + 1}`}
        </Text>
        {onDelete ? (
          <Pressable
            accessibilityLabel="Rimuovi stagione"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onDelete}
            style={styles.experienceIconButton}
          >
            <Ionicons color={colors.danger} name="trash-outline" size={16} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.subsectionLabel}>Stagione *</Text>
        <View style={styles.seasonGrid}>
          {PLAYER_SEASON_OPTIONS.map((option) => {
            const isSelected = season.seasonLabel === option.value;
            const isUsed = usedSeasons.has(option.value) && !isSelected;
            return (
              <Pressable
                accessibilityRole="button"
                disabled={isUsed}
                key={option.value}
                onPress={() =>
                  onChange({ ...season, seasonLabel: option.value })
                }
                style={[
                  styles.seasonChip,
                  isSelected ? styles.seasonChipSelected : null,
                  isUsed ? styles.seasonChipDisabled : null,
                ]}
              >
                <Text
                  style={[
                    styles.seasonChipText,
                    isSelected ? styles.seasonChipTextSelected : null,
                    isUsed ? styles.seasonChipTextDisabled : null,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {missingSeason ? (
          <Text style={styles.fieldError}>Seleziona una stagione.</Text>
        ) : null}
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.subsectionLabel}>Periodo *</Text>
        <View style={styles.periodToggleRow}>
          {SEASON_PERIOD_OPTIONS.map((option) => {
            const isSelected = season.seasonPeriod === option.value;
            return (
              <Pressable
                accessibilityRole="button"
                key={option.value}
                onPress={() =>
                  onChange({
                    ...season,
                    seasonPeriod: option.value as SeasonPeriod,
                    ...(option.value === "full"
                      ? { periodStartMonth: "", periodEndMonth: "" }
                      : {}),
                  })
                }
                style={[
                  styles.periodChip,
                  isSelected ? styles.periodChipSelected : null,
                ]}
              >
                <Text
                  style={[
                    styles.periodChipText,
                    isSelected ? styles.periodChipTextSelected : null,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {season.seasonPeriod === "partial" ? (
          <View style={styles.periodMonthsRow}>
            <View style={styles.periodMonthField}>
              <SelectField
                label="Mese inizio *"
                onChange={(value) =>
                  onChange({ ...season, periodStartMonth: value })
                }
                options={MONTH_OPTIONS}
                placeholder="Mese"
                value={season.periodStartMonth}
              />
              {missingStartMonth ? (
                <Text style={styles.fieldError}>Obbligatorio.</Text>
              ) : null}
            </View>
            <View style={styles.periodMonthField}>
              <SelectField
                label="Mese fine *"
                onChange={(value) =>
                  onChange({ ...season, periodEndMonth: value })
                }
                options={MONTH_OPTIONS}
                placeholder="Mese"
                value={season.periodEndMonth}
              />
              {missingEndMonth ? (
                <Text style={styles.fieldError}>Obbligatorio.</Text>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>

      <SelectField
        label="Categoria *"
        onChange={(value) => onChange({ ...season, category: value })}
        options={PLAYER_CATEGORY_OPTIONS}
        placeholder="Seleziona la categoria"
        searchable
        searchPlaceholder="Cerca categoria..."
        value={season.category}
      />
      {missingCategory ? (
        <Text style={styles.fieldError}>Seleziona una categoria.</Text>
      ) : null}

      <StatsInputRow
        appearances={season.appearances}
        assists={season.assists}
        goals={season.goals}
        onAppearancesChange={(value) =>
          onChange({ ...season, appearances: value })
        }
        onAssistsChange={(value) => onChange({ ...season, assists: value })}
        onGoalsChange={(value) => onChange({ ...season, goals: value })}
      />

      <Input
        keyboardType="number-pad"
        label="Minuti giocati (facoltativo)"
        onChangeText={(value) =>
          onChange({ ...season, minutesPlayed: normalizeNumericInput(value) })
        }
        placeholder="0"
        value={season.minutesPlayed}
      />

      <Input
        label="Note o premi (facoltativo)"
        multiline
        onChangeText={(value) => onChange({ ...season, awards: value })}
        placeholder="Es. playoff vinti, miglior marcatore"
        value={season.awards}
      />
    </Card>
  );
}

function AddExperienceScreen({
  draft,
  editingIndex,
  onClose,
  onDraftChange,
  onSave,
  searchTeams,
  usedSeasons,
}: AddExperienceScreenProps) {
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false);

  const missingClub = hasAttemptedSave && !draft.clubName.trim();

  function handleSave() {
    if (!isMultiSeasonDraftValid(draft)) {
      setHasAttemptedSave(true);
      return;
    }
    onSave();
  }

  function updateSeason(seasonIndex: number, updated: SeasonEntry) {
    onDraftChange({
      ...draft,
      seasons: draft.seasons.map((s, i) => (i === seasonIndex ? updated : s)),
    });
  }

  function addSeason() {
    onDraftChange({
      ...draft,
      seasons: [...draft.seasons, createEmptySeasonEntry()],
    });
  }

  function removeSeason(seasonIndex: number) {
    const nextSeasons = draft.seasons.filter((_, i) => i !== seasonIndex);
    if (nextSeasons.length === 0) {
      onClose();
      return;
    }
    onDraftChange({ ...draft, seasons: nextSeasons });
  }

  function getUsedSeasonsForCard(cardIndex: number) {
    const combined = new Set(usedSeasons);
    for (let i = 0; i < draft.seasons.length; i++) {
      if (i !== cardIndex && draft.seasons[i].seasonLabel.trim()) {
        combined.add(draft.seasons[i].seasonLabel);
      }
    }
    return combined;
  }

  const title =
    editingIndex !== null
      ? "Modifica esperienza calcistica"
      : "Aggiungi esperienza calcistica";

  const saveLabel =
    editingIndex !== null ? "Aggiorna esperienze" : "Salva esperienze";

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible>
      <SafeAreaView style={styles.fullScreenRoot}>
        <View style={styles.fullScreenHeader}>
          <Pressable
            accessibilityLabel="Chiudi"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onClose}
            style={styles.closeButton}
          >
            <Ionicons color={colors.textPrimary} name="close" size={24} />
          </Pressable>
          <Text style={styles.fullScreenTitle} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <KeyboardAwareScrollView
          contentContainerStyle={styles.fullScreenScrollContent}
        >
          <Text style={styles.fullScreenDescription}>
            Seleziona la squadra e aggiungi una o più stagioni con categoria e
            statistiche.
          </Text>

          <TeamAutocompleteInput
            label="Squadra *"
            onChangeText={(value) =>
              onDraftChange({
                ...draft,
                clubId: null,
                clubName: value,
                teamCity: "",
                teamLogoUrl: "",
              })
            }
            onSelectTeam={(team) =>
              onDraftChange({
                ...draft,
                clubId: team.id,
                clubName: team.name,
                teamCity: team.city ?? "",
                teamLogoUrl: team.logoUrl ?? "",
              })
            }
            searchTeams={searchTeams}
            value={draft.clubName}
          />
          {missingClub ? (
            <Text style={styles.fieldError}>Inserisci la squadra.</Text>
          ) : null}

          {draft.seasons.map((season, index) => (
            <SeasonEntryCard
              hasAttemptedSave={hasAttemptedSave}
              index={index}
              key={index}
              onChange={(updated) => updateSeason(index, updated)}
              onDelete={
                draft.seasons.length > 1 ? () => removeSeason(index) : undefined
              }
              season={season}
              usedSeasons={getUsedSeasonsForCard(index)}
            />
          ))}

          <Button
            label="Aggiungi un'altra stagione"
            onPress={addSeason}
            variant="secondary"
          />
        </KeyboardAwareScrollView>

        <View style={styles.fullScreenFooter}>
          <Button label={saveLabel} onPress={handleSave} variant="primary" />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

export function PlayerCharacteristicsSection({
  editable = false,
  onPreferredFootChange,
  onPrimaryPositionChange,
  onSecondaryPositionsChange,
  primaryPositionError,
  preferredFoot,
  primaryPosition,
  secondaryPositions,
}: PlayerCharacteristicsSectionProps) {
  const secondaryPositionLabels = getPlayerPositionLabels(secondaryPositions);

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
          <FootballPositionPicker
            errorMessage={primaryPositionError}
            mode="single"
            onSelect={(values) =>
              onPrimaryPositionChange?.(values[0] as PlayerPosition)
            }
            selectedPositions={primaryPosition ? [primaryPosition] : []}
            title="Ruolo principale"
          />
          <FootballPositionPicker
            mode="multiple"
            onSelect={onSecondaryPositionsChange ?? noop}
            selectedPositions={secondaryPositions}
            title="Ruoli secondari"
          />
          <SelectField
            allowClear
            clearLabel="Rimuovi piede preferito"
            label="Piede preferito"
            onChange={(value) =>
              onPreferredFootChange?.(value as PreferredFoot | "")
            }
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
              label: "Ruoli secondari",
              value:
                secondaryPositionLabels.length > 0
                  ? secondaryPositionLabels.join(", ")
                  : "Nessuno",
            },
            {
              label: "Piede preferito",
              value: preferredFoot
                ? getPreferredFootLabel(preferredFoot)
                : "Da completare",
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
  const [draft, setDraft] = useState<MultiSeasonDraft | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const isScreenOpen = draft !== null;

  const sortedExperiences = useMemo(
    () => sortPlayerExperiencesBySeason(experiences),
    [experiences],
  );

  const usedSeasons = useMemo(() => {
    const seasons = new Set<string>();
    for (const experience of sortedExperiences) {
      if (experience.seasonLabel.trim()) {
        seasons.add(experience.seasonLabel);
      }
    }
    // When editing, remove the edited entry's season so it can be re-selected
    if (editingIndex !== null && sortedExperiences[editingIndex]) {
      seasons.delete(sortedExperiences[editingIndex].seasonLabel);
    }
    return seasons;
  }, [editingIndex, sortedExperiences]);

  function closeScreen() {
    setDraft(null);
    setEditingIndex(null);
  }

  function openNewExperience() {
    setDraft(createEmptyMultiSeasonDraft());
    setEditingIndex(null);
  }

  function openExistingExperience(index: number) {
    setDraft(experienceToMultiSeasonDraft(sortedExperiences[index]));
    setEditingIndex(index);
  }

  function handleSave() {
    if (!onChange || !draft) {
      closeScreen();
      return;
    }

    const newEntries = multiSeasonDraftToExperiences(draft);

    const nextExperiences =
      editingIndex === null
        ? [...sortedExperiences, ...newEntries]
        : [
            ...sortedExperiences.slice(0, editingIndex),
            ...newEntries,
            ...sortedExperiences.slice(editingIndex + 1),
          ];

    onChange(sortPlayerExperiencesBySeason(nextExperiences));
    closeScreen();
  }

  function handleDelete(index: number) {
    if (!onChange) {
      return;
    }

    onChange(
      sortedExperiences.filter((_, currentIndex) => currentIndex !== index),
    );
  }

  return (
    <View style={styles.sectionStack}>
      {showHeader ? (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Esperienze calcistiche</Text>
          <Text style={styles.sectionDescription}>
            Timeline ordinata dalla stagione più recente, con squadra, categoria
            e statistiche.
          </Text>
        </View>
      ) : null}

      {editable ? (
        <Button
          label={addButtonLabel}
          onPress={openNewExperience}
          variant="secondary"
        />
      ) : null}

      {sortedExperiences.length > 0 ? (
        <View style={styles.experiencesList}>
          {sortedExperiences.map((experience, index) => (
            <ExperienceCard
              editable={editable}
              experience={experience}
              key={
                experience.id ??
                `${experience.seasonLabel}-${experience.clubName}-${index}`
              }
              onDelete={editable ? () => handleDelete(index) : undefined}
              onEdit={
                editable ? () => openExistingExperience(index) : undefined
              }
            />
          ))}
        </View>
      ) : (
        <Card variant="muted">
          <Text style={styles.emptyState}>{emptyStateLabel}</Text>
        </Card>
      )}

      {isScreenOpen ? (
        <AddExperienceScreen
          draft={draft}
          editingIndex={editingIndex}
          onClose={closeScreen}
          onDraftChange={setDraft}
          onSave={handleSave}
          searchTeams={searchTeams}
          usedSeasons={usedSeasons}
        />
      ) : null}
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
    gap: spacing[8],
  },
  experienceIconButton: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
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
    alignItems: "flex-start",
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
  fieldError: {
    color: colors.danger,
    fontSize: typography.fontSize[12],
    fontWeight: typography.fontWeight.bold,
  },
  fieldGroup: {
    gap: spacing[8],
  },
  periodChip: {
    flex: 1,
    paddingVertical: spacing[10],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  periodChipSelected: {
    borderColor: colors.hero,
    backgroundColor: colors.heroSoft,
  },
  periodChipText: {
    color: colors.textPrimary,
    fontSize: typography.fontSize[14],
    fontWeight: typography.fontWeight.regular,
  },
  periodChipTextSelected: {
    color: colors.hero,
    fontWeight: typography.fontWeight.bold,
  },
  periodMonthField: {
    flex: 1,
  },
  periodMonthsRow: {
    flexDirection: "row",
    gap: spacing[10],
  },
  periodToggleRow: {
    flexDirection: "row",
    gap: spacing[8],
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  fullScreenDescription: {
    color: colors.textSecondary,
    lineHeight: typography.lineHeight[22],
  },
  fullScreenFooter: {
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[12],
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  fullScreenHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[12],
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[12],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  fullScreenRoot: {
    flex: 1,
    backgroundColor: colors.background,
  },
  fullScreenScrollContent: {
    padding: spacing[20],
    gap: spacing[16],
  },
  fullScreenTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.fontSize[18],
    fontWeight: typography.fontWeight.heavy,
    textAlign: "center",
  },
  headerSpacer: {
    width: 44,
  },
  seasonEntryCard: {
    gap: spacing[16],
    padding: spacing[16],
  },
  seasonEntryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  seasonEntryTitle: {
    color: colors.textPrimary,
    fontSize: typography.fontSize[16],
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
  seasonChip: {
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[8],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  seasonChipDisabled: {
    opacity: 0.35,
  },
  seasonChipSelected: {
    borderColor: colors.hero,
    backgroundColor: colors.heroSoft,
  },
  seasonChipText: {
    color: colors.textPrimary,
    fontSize: typography.fontSize[14],
    fontWeight: typography.fontWeight.regular,
  },
  seasonChipTextDisabled: {
    color: colors.textMuted,
  },
  seasonChipTextSelected: {
    color: colors.hero,
    fontWeight: typography.fontWeight.bold,
  },
  seasonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
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
  statsWheelCell: {
    flex: 1,
  },
  statsWheelRow: {
    flexDirection: "row",
    gap: spacing[10],
  },
  statsInputsWrapper: {
    gap: spacing[8],
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
