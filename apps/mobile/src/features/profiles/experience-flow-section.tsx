import { useEffect, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { KeyboardAwareForm } from "../../components/ui/keyboard-aware-form";
import { SelectField } from "../../components/ui/select-field";
import { WheelPicker } from "../../components/ui/wheel-picker";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { AppText, Button, Card, Input } from "../../ui";
import {
  MONTH_OPTIONS,
  PLAYER_CATEGORY_OPTIONS,
  type PlayerExperienceForm,
  type TeamAutocompleteOption,
} from "./player-sports";
import {
  type ExperienceBlockData,
  type SeasonDetail,
  YEAR_OPTIONS,
  areAllBlocksValid,
  blocksToExperienceForms,
  computeEndYearOptions,
  computeStartYearOptions,
  createBlockFromTeam,
  createEmptyBlock,
  getBlockConflicts,
  getComputedSeasons,
  getFullyUsedSeasons,
  getSavedSeasonLabels,
  getUsedSeasonsMap,
  isBlockComplete,
  syncSeasonDetails,
} from "./experience-flow";
import type { SelectOption } from "./profile-form-utils";

const TEAM_SEARCH_DEBOUNCE_MS = 250;

// ---------------------------------------------------------------------------
// TeamLogo (inline – avoids circular import with player-sports-section)
// ---------------------------------------------------------------------------

function TeamLogo({
  teamLogoUrl,
}: {
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

// ---------------------------------------------------------------------------
// TeamSearchInput
// ---------------------------------------------------------------------------

type TeamSearchInputProps = {
  onSelectTeam: (team: TeamAutocompleteOption) => void;
  searchTeams: (query: string) => Promise<TeamAutocompleteOption[]>;
  value: string;
  onChangeText: (value: string) => void;
  hasError?: boolean;
};

function TeamSearchInput({
  onSelectTeam,
  searchTeams,
  value,
  onChangeText,
  hasError,
}: TeamSearchInputProps) {
  const [suggestions, setSuggestions] = useState<TeamAutocompleteOption[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const timeout = setTimeout(() => {
      async function load() {
        const query = value.trim();
        if (query.length < 2) {
          if (isMounted) setSuggestions([]);
          return;
        }
        try {
          const results = await searchTeams(query);
          if (isMounted) setSuggestions(results);
        } catch {
          if (isMounted) setSuggestions([]);
        }
      }
      void load();
    }, TEAM_SEARCH_DEBOUNCE_MS);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, [isOpen, searchTeams, value]);

  const normalizedQuery = value.trim().toLowerCase();
  const shouldShow = isOpen && normalizedQuery.length >= 2;
  const hasExactMatch = suggestions.some(
    (s) => s.name.trim().toLowerCase() === normalizedQuery,
  );

  function handleSelect(team: TeamAutocompleteOption) {
    setIsOpen(false);
    setSuggestions([]);
    onSelectTeam(team);
  }

  return (
    <View style={styles.fieldGroup}>
      <AppText variant="titleSm">Squadra *</AppText>
      <Input
        autoCapitalize="words"
        onChangeText={(next) => {
          setIsOpen(true);
          onChangeText(next);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder="Cerca squadra..."
        value={value}
      />
      {hasError ? (
        <AppText variant="caption" color="danger">
          Inserisci la squadra.
        </AppText>
      ) : null}

      {shouldShow ? (
        <View style={styles.suggestionsSurface}>
          <ScrollView
            contentContainerStyle={styles.suggestionsContent}
            nestedScrollEnabled
          >
            {suggestions.map((s) => (
              <Pressable
                accessibilityRole="button"
                key={s.id ?? `${s.name}-${s.city ?? "na"}`}
                onPress={() => handleSelect(s)}
                style={({ pressed }) => [
                  styles.suggestionRow,
                  pressed ? styles.suggestionRowPressed : null,
                ]}
              >
                <TeamLogo teamLogoUrl={s.logoUrl ?? ""} />
                <View style={styles.suggestionCopy}>
                  <AppText variant="titleSm">{s.name}</AppText>
                  <AppText variant="bodySm" color="secondary">
                    {s.city?.trim() ||
                      (s.isCustom
                        ? "Aggiunta da altri giocatori"
                        : "Città non disponibile")}
                  </AppText>
                </View>
              </Pressable>
            ))}

            {!hasExactMatch && normalizedQuery ? (
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  handleSelect({
                    city: null,
                    id: null,
                    isCustom: true,
                    logoUrl: null,
                    name: value.trim(),
                  })
                }
                style={({ pressed }) => [
                  styles.suggestionRow,
                  pressed ? styles.suggestionRowPressed : null,
                ]}
              >
                <View style={[styles.teamLogo, styles.teamLogoFallback]}>
                  <Ionicons
                    color={colors.accentStrong}
                    name="add"
                    size={24}
                  />
                </View>
                <View style={styles.suggestionCopy}>
                  <AppText variant="titleSm">Aggiungi nuova squadra</AppText>
                  <AppText variant="bodySm" color="secondary">
                    {value.trim()}
                  </AppText>
                </View>
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// TeamBanner – displays selected team when locked (same-team flow)
// ---------------------------------------------------------------------------

function TeamBanner({
  block,
  onUnlock,
}: {
  block: ExperienceBlockData;
  onUnlock: () => void;
}) {
  return (
    <View style={styles.teamBanner}>
      <TeamLogo teamLogoUrl={block.teamLogoUrl} />
      <View style={styles.teamBannerCopy}>
        <AppText variant="titleMd">{block.teamName}</AppText>
        {block.teamCity ? (
          <AppText variant="bodySm" color="secondary">
            {block.teamCity}
          </AppText>
        ) : null}
      </View>
      <Pressable
        accessibilityLabel="Cambia squadra"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onUnlock}
        style={styles.teamBannerUnlock}
      >
        <Ionicons color={colors.textSecondary} name="pencil" size={14} />
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// DateRangeSelector
// ---------------------------------------------------------------------------

function DateRangeSelector({
  block,
  endYearOptions,
  startYearOptions,
  onDateChange,
  hasAttemptedSave,
}: {
  block: ExperienceBlockData;
  endYearOptions: SelectOption[];
  startYearOptions: SelectOption[];
  onDateChange: (block: ExperienceBlockData) => void;
  hasAttemptedSave: boolean;
}) {
  const missingStartYear = hasAttemptedSave && !block.startYear;
  const missingEndYear =
    hasAttemptedSave && !block.isOngoing && !block.endYear;

  return (
    <View style={styles.dateRangeWrapper}>
      <AppText variant="titleSm">Periodo *</AppText>

      <View style={styles.dateRow}>
        <View style={styles.dateField}>
          <SelectField
            fullScreen
            label="Anno inizio *"
            onChange={(val) => onDateChange({ ...block, startYear: val })}
            options={startYearOptions}
            placeholder="Anno"
            searchable
            searchPlaceholder="Cerca anno..."
            value={block.startYear}
          />
          {missingStartYear ? (
            <AppText variant="caption" color="danger">
              Obbligatorio.
            </AppText>
          ) : null}
        </View>
        <View style={styles.dateField}>
          <SelectField
            allowClear
            clearLabel="Rimuovi mese"
            label="Mese inizio"
            onChange={(val) => onDateChange({ ...block, startMonth: val })}
            options={MONTH_OPTIONS}
            placeholder="Mese"
            value={block.startMonth}
          />
        </View>
      </View>

      {!block.isOngoing ? (
        <View style={styles.dateRow}>
          <View style={styles.dateField}>
            <SelectField
              fullScreen
              label="Anno fine *"
              onChange={(val) => onDateChange({ ...block, endYear: val })}
              options={endYearOptions}
              placeholder="Anno"
              searchable
              searchPlaceholder="Cerca anno..."
              value={block.endYear}
            />
            {missingEndYear ? (
              <AppText variant="caption" color="danger">
                Obbligatorio.
              </AppText>
            ) : null}
          </View>
          <View style={styles.dateField}>
            <SelectField
              allowClear
              clearLabel="Rimuovi mese"
              label="Mese fine"
              onChange={(val) => onDateChange({ ...block, endMonth: val })}
              options={MONTH_OPTIONS}
              placeholder="Mese"
              value={block.endMonth}
            />
          </View>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={() =>
          onDateChange({
            ...block,
            isOngoing: !block.isOngoing,
            ...(block.isOngoing ? {} : { endYear: "", endMonth: "" }),
          })
        }
        style={styles.ongoingToggle}
      >
        <View
          style={[
            styles.ongoingCheckbox,
            block.isOngoing ? styles.ongoingCheckboxActive : null,
          ]}
        >
          {block.isOngoing ? (
            <Ionicons color={colors.surface} name="checkmark" size={14} />
          ) : null}
        </View>
        <AppText variant="bodySm">In corso (attuale)</AppText>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// SeasonDetailCard – per-season category + optional stats
// ---------------------------------------------------------------------------

function SeasonDetailCard({
  detail,
  hasConflict,
  onChange,
  hasAttemptedSave,
}: {
  detail: SeasonDetail;
  hasConflict: boolean;
  onChange: (updated: SeasonDetail) => void;
  hasAttemptedSave: boolean;
}) {
  const missingCategory = hasAttemptedSave && !detail.category.trim();

  if (hasConflict) {
    return (
      <Card style={[styles.seasonCard, styles.seasonCardConflict, styles.seasonCardDisabled]} variant="muted">
        <View style={styles.seasonCardHeader}>
          <View style={styles.seasonLabelBadgeConflict}>
            <AppText variant="caption" style={styles.seasonLabelTextConflict}>
              {detail.seasonLabel}
            </AppText>
          </View>
          <AppText variant="caption" color="danger">
            Stagione già utilizzata
          </AppText>
        </View>
      </Card>
    );
  }

  return (
    <Card style={styles.seasonCard} variant="muted">
      <View style={styles.seasonCardHeader}>
        <View style={styles.seasonLabelBadge}>
          <AppText variant="caption" style={styles.seasonLabelText}>
            {detail.seasonLabel}
          </AppText>
        </View>
      </View>

      <SelectField
        fullScreen
        label="Categoria *"
        onChange={(val) => onChange({ ...detail, category: val })}
        options={PLAYER_CATEGORY_OPTIONS}
        placeholder="Seleziona la categoria"
        searchable
        searchPlaceholder="Cerca categoria..."
        value={detail.category}
      />
      {missingCategory ? (
        <AppText variant="caption" color="danger">
          Seleziona una categoria.
        </AppText>
      ) : null}

      <AppText variant="caption" color="secondary">
        STATISTICHE (FACOLTATIVO)
      </AppText>
      <View style={styles.statsRow}>
        <View style={styles.statCell}>
          <WheelPicker
            compact
            label="Presenze"
            max={200}
            min={0}
            onChange={(val) => onChange({ ...detail, appearances: String(val) })}
            value={detail.appearances ? parseInt(detail.appearances, 10) : 0}
          />
        </View>
        <View style={styles.statCell}>
          <WheelPicker
            compact
            label="Gol"
            max={200}
            min={0}
            onChange={(val) => onChange({ ...detail, goals: String(val) })}
            value={detail.goals ? parseInt(detail.goals, 10) : 0}
          />
        </View>
        <View style={styles.statCell}>
          <WheelPicker
            compact
            label="Assist"
            max={200}
            min={0}
            onChange={(val) => onChange({ ...detail, assists: String(val) })}
            value={detail.assists ? parseInt(detail.assists, 10) : 0}
          />
        </View>
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// ExperienceBlock – progressive disclosure: team → dates → per-season details
// ---------------------------------------------------------------------------

function ExperienceBlock({
  block,
  conflicts,
  endYearOptions,
  startYearOptions,
  index,
  totalBlocks,
  onChange,
  onDelete,
  searchTeams,
  hasAttemptedSave,
}: {
  block: ExperienceBlockData;
  conflicts: Set<string>;
  endYearOptions: SelectOption[];
  startYearOptions: SelectOption[];
  index: number;
  totalBlocks: number;
  onChange: (block: ExperienceBlockData) => void;
  onDelete: () => void;
  searchTeams: (query: string) => Promise<TeamAutocompleteOption[]>;
  hasAttemptedSave: boolean;
}) {
  const hasTeam = Boolean(block.teamName.trim());
  const computedSeasons = getComputedSeasons(block);
  const hasSeasons = computedSeasons.length > 0;

  const blockLabel = block.teamName.trim()
    ? block.teamName
    : `Esperienza ${index + 1}`;

  // Sync seasonDetails whenever dates change (called from handleDateChange)
  function handleDateChange(updated: ExperienceBlockData) {
    const newSeasons = getComputedSeasons(updated);
    const synced = syncSeasonDetails(updated.seasonDetails, newSeasons);
    onChange({ ...updated, seasonDetails: synced });
  }

  function handleTeamSelect(team: TeamAutocompleteOption) {
    onChange({
      ...block,
      teamId: team.id,
      teamName: team.name,
      teamCity: team.city ?? "",
      teamLogoUrl: team.logoUrl ?? "",
    });
  }

  function handleTeamTextChange(value: string) {
    onChange({
      ...block,
      teamId: null,
      teamName: value,
      teamCity: "",
      teamLogoUrl: "",
    });
  }

  function handleUnlockTeam() {
    onChange({ ...block, isTeamLocked: false });
  }

  function handleSeasonDetailChange(
    seasonIndex: number,
    updated: SeasonDetail,
  ) {
    const nextDetails = block.seasonDetails.map((d, i) =>
      i === seasonIndex ? updated : d,
    );
    onChange({ ...block, seasonDetails: nextDetails });
  }

  return (
    <Card style={styles.blockCard}>
      <View style={styles.blockHeader}>
        <AppText variant="headingSm">{blockLabel}</AppText>
        {totalBlocks > 1 ? (
          <Pressable
            accessibilityLabel="Rimuovi esperienza"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onDelete}
            style={styles.blockDeleteButton}
          >
            <Ionicons color={colors.danger} name="trash-outline" size={16} />
          </Pressable>
        ) : null}
      </View>

      {/* Step 1 — Team selection (always visible) */}
      {block.isTeamLocked && block.teamName.trim() ? (
        <TeamBanner block={block} onUnlock={handleUnlockTeam} />
      ) : (
        <TeamSearchInput
          hasError={hasAttemptedSave && !block.teamName.trim()}
          onChangeText={handleTeamTextChange}
          onSelectTeam={handleTeamSelect}
          searchTeams={searchTeams}
          value={block.teamName}
        />
      )}

      {/* Step 2 — Date range (appears after team is selected) */}
      {hasTeam ? (
        <DateRangeSelector
          block={block}
          endYearOptions={endYearOptions}
          hasAttemptedSave={hasAttemptedSave}
          onDateChange={handleDateChange}
          startYearOptions={startYearOptions}
        />
      ) : null}

      {/* Step 3 — Per-season details (appear after valid dates) */}
      {hasTeam && hasSeasons ? (
        <View style={styles.seasonDetailsStack}>
          <AppText variant="titleSm">
            {computedSeasons.length === 1
              ? "Dettagli stagione"
              : `Dettagli per ${computedSeasons.length} stagioni`}
          </AppText>

          {block.seasonDetails.map((detail, seasonIndex) => (
            <SeasonDetailCard
              detail={detail}
              hasAttemptedSave={hasAttemptedSave}
              hasConflict={conflicts.has(detail.seasonLabel)}
              key={detail.seasonLabel}
              onChange={(updated) =>
                handleSeasonDetailChange(seasonIndex, updated)
              }
            />
          ))}
        </View>
      ) : null}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// AddExperienceActions
// ---------------------------------------------------------------------------

function AddExperienceActions({
  lastBlock,
  onAddSameTeam,
  onAddNewTeam,
}: {
  lastBlock: ExperienceBlockData | null;
  onAddSameTeam: () => void;
  onAddNewTeam: () => void;
}) {
  const hasTeam = Boolean(lastBlock?.teamName.trim());

  return (
    <View style={styles.addActions}>
      {hasTeam ? (
        <Button
          label={`Altra esperienza con ${lastBlock?.teamName}`}
          onPress={onAddSameTeam}
          variant="secondary"
        />
      ) : null}
      <Button
        label="Esperienza con un'altra squadra"
        onPress={onAddNewTeam}
        variant="tertiary"
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// ExperienceFlowScreen – main full-screen modal
// ---------------------------------------------------------------------------

type ExperienceFlowScreenProps = {
  existingExperiences?: PlayerExperienceForm[];
  onClose: () => void;
  onSave: (experiences: PlayerExperienceForm[]) => void;
  searchTeams: (query: string) => Promise<TeamAutocompleteOption[]>;
  visible: boolean;
};

export function ExperienceFlowScreen({
  existingExperiences = [],
  onClose,
  onSave,
  searchTeams,
  visible,
}: ExperienceFlowScreenProps) {
  const [blocks, setBlocks] = useState<ExperienceBlockData[]>([
    createEmptyBlock(),
  ]);
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false);

  const savedSeasons = getSavedSeasonLabels(existingExperiences);

  useEffect(() => {
    if (visible) {
      setBlocks([createEmptyBlock()]);
      setHasAttemptedSave(false);
    }
  }, [visible]);

  const lastBlock = blocks[blocks.length - 1] ?? null;
  const lastBlockUsedMap = lastBlock
    ? getUsedSeasonsMap(blocks, lastBlock.localId, savedSeasons)
    : new Map();
  const lastBlockConflicts = lastBlock
    ? getBlockConflicts(lastBlock, lastBlockUsedMap)
    : new Set<string>();
  const lastBlockComplete =
    lastBlock !== null && isBlockComplete(lastBlock, lastBlockConflicts);

  function updateBlock(index: number, updated: ExperienceBlockData) {
    setBlocks((prev) =>
      prev.map((b, i) => (i === index ? updated : b)),
    );
  }

  function deleteBlock(index: number) {
    setBlocks((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length === 0 ? [createEmptyBlock()] : next;
    });
  }

  function addBlockSameTeam() {
    const source = blocks[blocks.length - 1];
    setBlocks((prev) => [...prev, createBlockFromTeam(source)]);
  }

  function addBlockNewTeam() {
    setBlocks((prev) => [...prev, createEmptyBlock()]);
  }

  function handleSave() {
    if (!areAllBlocksValid(blocks, savedSeasons)) {
      setHasAttemptedSave(true);
      return;
    }

    const forms = blocksToExperienceForms(blocks);
    onSave(forms);
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      visible={visible}
    >
      <SafeAreaView style={styles.screenRoot}>
        {/* Header */}
        <View style={styles.screenHeader}>
          <Pressable
            accessibilityLabel="Chiudi"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onClose}
            style={styles.headerCloseButton}
          >
            <Ionicons color={colors.textPrimary} name="close" size={24} />
          </Pressable>

          <AppText variant="headingSm" style={styles.headerTitle}>
            Esperienze calcistiche
          </AppText>

          <Pressable
            accessibilityLabel="Conferma"
            accessibilityRole="button"
            hitSlop={8}
            onPress={handleSave}
            style={styles.headerSaveButton}
          >
            <Ionicons color={colors.surface} name="checkmark" size={22} />
          </Pressable>
        </View>

        {/* Scrollable content */}
        <KeyboardAwareForm
          contentContainerStyle={styles.screenScrollContent}
        >
          <AppText variant="bodySm" color="secondary">
            Aggiungi le tue esperienze calcistiche. Seleziona prima la squadra,
            poi il periodo: le stagioni vengono calcolate automaticamente.
          </AppText>

          {blocks.map((block, index) => {
            const usedMap = getUsedSeasonsMap(blocks, block.localId, savedSeasons);
            const blockConflicts = getBlockConflicts(block, usedMap);
            const fullyUsed = getFullyUsedSeasons(blocks, block.localId, savedSeasons);
            const startYearOpts = computeStartYearOptions(
              block.endYear,
              block.endMonth,
              block.isOngoing,
              fullyUsed,
            );
            const endYearOpts = computeEndYearOptions(
              block.startYear,
              block.startMonth,
              fullyUsed,
            );

            return (
              <ExperienceBlock
                block={block}
                conflicts={blockConflicts}
                endYearOptions={endYearOpts}
                hasAttemptedSave={hasAttemptedSave}
                index={index}
                key={block.localId}
                onChange={(updated) => updateBlock(index, updated)}
                onDelete={() => deleteBlock(index)}
                searchTeams={searchTeams}
                startYearOptions={startYearOpts}
                totalBlocks={blocks.length}
              />
            );
          })}

          {lastBlockComplete ? (
            <AddExperienceActions
              lastBlock={lastBlock}
              onAddNewTeam={addBlockNewTeam}
              onAddSameTeam={addBlockSameTeam}
            />
          ) : null}
        </KeyboardAwareForm>
      </SafeAreaView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // Screen
  screenRoot: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[12],
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[12],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerCloseButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
  },
  headerSaveButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.hero,
    alignItems: "center",
    justifyContent: "center",
  },
  screenScrollContent: {
    padding: spacing[20],
    gap: spacing[16],
    paddingBottom: spacing[48],
  },

  // Experience block card
  blockCard: {
    gap: spacing[16],
    padding: spacing[16],
  },
  blockHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  blockDeleteButton: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.dangerSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  // Team search
  fieldGroup: {
    gap: spacing[8],
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
  suggestionsSurface: {
    maxHeight: 220,
    borderRadius: radius[12],
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    padding: spacing[10],
  },
  suggestionsContent: {
    gap: spacing[8],
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[12],
    borderRadius: radius[12],
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[12],
  },
  suggestionRowPressed: {
    opacity: 0.8,
  },
  suggestionCopy: {
    flex: 1,
    gap: spacing[4],
  },

  // Team banner (locked team)
  teamBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[12],
    padding: spacing[14],
    borderRadius: radius[12],
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  teamBannerCopy: {
    flex: 1,
    gap: spacing[4],
  },
  teamBannerUnlock: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  // Date range
  dateRangeWrapper: {
    gap: spacing[10],
  },
  dateRow: {
    flexDirection: "row",
    gap: spacing[10],
  },
  dateField: {
    flex: 1,
  },
  ongoingToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[10],
    paddingVertical: spacing[4],
  },
  ongoingCheckbox: {
    width: 22,
    height: 22,
    borderRadius: radius[8],
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  ongoingCheckboxActive: {
    backgroundColor: colors.hero,
    borderColor: colors.hero,
  },

  // Season detail cards
  seasonDetailsStack: {
    gap: spacing[12],
  },
  seasonCard: {
    gap: spacing[12],
    padding: spacing[14],
  },
  seasonCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[8],
  },
  seasonCardConflict: {
    borderWidth: 1,
    borderColor: colors.danger,
  },
  seasonCardDisabled: {
    opacity: 0.5,
  },
  seasonLabelBadge: {
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[6],
    borderRadius: radius.full,
    backgroundColor: colors.heroSoft,
    borderWidth: 1,
    borderColor: colors.hero,
  },
  seasonLabelBadgeConflict: {
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[6],
    borderRadius: radius.full,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  seasonLabelText: {
    color: colors.hero,
  },
  seasonLabelTextConflict: {
    color: colors.danger,
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    gap: spacing[10],
  },
  statCell: {
    flex: 1,
  },

  // Add actions
  addActions: {
    gap: spacing[10],
  },
});
