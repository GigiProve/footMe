import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { SelectField } from "../../../components/ui/select-field";
import { WheelPicker } from "../../../components/ui/wheel-picker";
import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button, Toggle } from "../../../ui";
import type { TeamAutocompleteOption } from "../../profiles/player-sports";
import { TeamAutocompleteInput } from "../../profiles/player-sports-section";
import type {
  CareerExperience,
  CareerExperiencePeriod,
  DurationType,
  SeasonStats,
} from "./career-types";
import {
  createEmptyStats,
  formatSeasonShort,
  getCategoryOptions,
  getOlderSeasonOptions,
  getSeasonOptions,
  getYearOptions,
  MONTH_OPTIONS,
  validateExperience,
  type CareerExperienceErrors,
} from "./career-utils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type ExperienceFormProps = {
  experience: CareerExperience;
  isEditing: boolean;
  onCancel: () => void;
  onSave: (experience: CareerExperience) => void;
  searchTeams: (query: string) => Promise<TeamAutocompleteOption[]>;
};

// ---------------------------------------------------------------------------
// SegmentedControl — SEASON vs PERIOD toggle
// ---------------------------------------------------------------------------

type SegmentedControlProps = {
  options: { label: string; value: DurationType }[];
  onChange: (value: DurationType) => void;
  value: DurationType;
};

function SegmentedControl({ options, onChange, value }: SegmentedControlProps) {
  return (
    <View style={segmentStyles.container}>
      {options.map((option) => {
        const isActive = option.value === value;

        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[
              segmentStyles.segment,
              isActive ? segmentStyles.segmentActive : null,
            ]}
          >
            <AppText
              variant="bodySm"
              style={isActive ? segmentStyles.textActive : segmentStyles.text}
            >
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const segmentStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderRadius: radius[8],
    backgroundColor: colors.surfaceMuted,
    padding: spacing[4],
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing[10],
    borderRadius: radius[6],
  },
  segmentActive: {
    backgroundColor: colors.surface,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 3,
    elevation: 2,
  },
  text: {
    color: colors.textSecondary,
  },
  textActive: {
    color: colors.textPrimary,
    fontWeight: "600",
  },
});

// ---------------------------------------------------------------------------
// SeasonChipGrid — multi-select season chips
// ---------------------------------------------------------------------------

function SeasonChipGrid({
  selectedSeasons,
  onToggle,
}: {
  selectedSeasons: string[];
  onToggle: (season: string) => void;
}) {
  const allSeasons = getSeasonOptions();
  const selectedSet = new Set(selectedSeasons);

  // Older seasons that were selected but aren't in the standard chip range
  const olderSelected = selectedSeasons.filter((s) => !allSeasons.includes(s));
  const olderSeasonOptions = getOlderSeasonOptions();
  // Filter out already-selected older seasons from the picker
  const availableOlderOptions = olderSeasonOptions.filter(
    (o) => !selectedSet.has(o.value),
  );

  return (
    <View style={chipGridStyles.container}>
      {allSeasons.map((season) => {
        const isSelected = selectedSet.has(season);

        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            key={season}
            onPress={() => onToggle(season)}
            style={[
              chipGridStyles.chip,
              isSelected ? chipGridStyles.chipSelected : null,
            ]}
          >
            <AppText
              variant="bodySm"
              style={
                isSelected
                  ? chipGridStyles.chipTextSelected
                  : chipGridStyles.chipText
              }
            >
              {formatSeasonShort(season)}
            </AppText>
          </Pressable>
        );
      })}

      {/* Show chips for selected older seasons */}
      {olderSelected.map((season) => (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: true }}
          key={season}
          onPress={() => onToggle(season)}
          style={[chipGridStyles.chip, chipGridStyles.chipSelected]}
        >
          <AppText variant="bodySm" style={chipGridStyles.chipTextSelected}>
            {formatSeasonShort(season)}
          </AppText>
        </Pressable>
      ))}

      {/* Picker for older seasons */}
      {availableOlderOptions.length > 0 ? (
        <View style={chipGridStyles.olderPickerRow}>
          <SelectField
            label="Aggiungi stagione precedente"
            onChange={(val) => {
              if (val) {
                onToggle(val);
              }
            }}
            options={availableOlderOptions}
            placeholder="Prima del 2010..."
            searchable
            searchPlaceholder="Cerca anno..."
            value=""
          />
        </View>
      ) : null}
    </View>
  );
}

const chipGridStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  chip: {
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[10],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    color: colors.textPrimary,
  },
  chipTextSelected: {
    color: colors.inkInvert,
    fontWeight: "600",
  },
  olderPickerRow: {
    width: "100%",
    marginTop: spacing[4],
  },
});

// ---------------------------------------------------------------------------
// PeriodSelector — start/end month+year
// ---------------------------------------------------------------------------

function PeriodSelector({
  period,
  onChange,
  error,
}: {
  period: CareerExperiencePeriod | null;
  onChange: (period: CareerExperiencePeriod) => void;
  error?: string;
}) {
  const yearOptions = getYearOptions();
  const current: CareerExperiencePeriod = period ?? {
    startMonth: "",
    startYear: "",
    endMonth: "",
    endYear: "",
  };

  function update(patch: Partial<CareerExperiencePeriod>) {
    onChange({ ...current, ...patch });
  }

  return (
    <View style={periodStyles.container}>
      <View style={periodStyles.row}>
        <View style={periodStyles.field}>
          <SelectField
            allowClear
            clearLabel="Rimuovi mese"
            label="Dal (Mese)"
            onChange={(val) => update({ startMonth: val })}
            options={MONTH_OPTIONS}
            placeholder="Mese"
            value={current.startMonth}
          />
        </View>
        <View style={periodStyles.field}>
          <SelectField
            fullScreen
            label="Dal (Anno) *"
            onChange={(val) => update({ startYear: val })}
            options={yearOptions}
            placeholder="Anno"
            searchable
            searchPlaceholder="Cerca anno..."
            value={current.startYear}
          />
        </View>
      </View>

      <View style={periodStyles.row}>
        <View style={periodStyles.field}>
          <SelectField
            allowClear
            clearLabel="Rimuovi mese"
            label="Al (Mese)"
            onChange={(val) => update({ endMonth: val })}
            options={MONTH_OPTIONS}
            placeholder="Mese"
            value={current.endMonth}
          />
        </View>
        <View style={periodStyles.field}>
          <SelectField
            fullScreen
            label="Al (Anno) *"
            onChange={(val) => update({ endYear: val })}
            options={yearOptions}
            placeholder="Anno"
            searchable
            searchPlaceholder="Cerca anno..."
            value={current.endYear}
          />
        </View>
      </View>

      {error ? (
        <AppText variant="caption" color="danger">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const periodStyles = StyleSheet.create({
  container: {
    gap: spacing[10],
  },
  row: {
    flexDirection: "row",
    gap: spacing[10],
  },
  field: {
    flex: 1,
  },
});

// ---------------------------------------------------------------------------
// SeasonStatsFields — per-season or single stats entry
// ---------------------------------------------------------------------------

function SeasonStatsFields({
  label,
  stats,
  onChange,
}: {
  label: string | null;
  stats: SeasonStats;
  onChange: (stats: SeasonStats) => void;
}) {
  return (
    <View style={statsFieldStyles.container}>
      {label ? (
        <View style={statsFieldStyles.labelBadge}>
          <AppText variant="caption" style={statsFieldStyles.labelText}>
            {formatSeasonShort(label)}
          </AppText>
        </View>
      ) : null}

      <View style={statsFieldStyles.row}>
        <View style={statsFieldStyles.cell}>
          <WheelPicker
            compact
            label="Presenze"
            max={200}
            min={0}
            onChange={(val) => onChange({ ...stats, appearances: String(val) })}
            value={stats.appearances ? parseInt(stats.appearances, 10) : 0}
          />
        </View>
        <View style={statsFieldStyles.cell}>
          <WheelPicker
            compact
            label="Gol"
            max={200}
            min={0}
            onChange={(val) => onChange({ ...stats, goals: String(val) })}
            value={stats.goals ? parseInt(stats.goals, 10) : 0}
          />
        </View>
        <View style={statsFieldStyles.cell}>
          <WheelPicker
            compact
            label="Assist"
            max={200}
            min={0}
            onChange={(val) => onChange({ ...stats, assists: String(val) })}
            value={stats.assists ? parseInt(stats.assists, 10) : 0}
          />
        </View>
      </View>
    </View>
  );
}

const statsFieldStyles = StyleSheet.create({
  container: {
    gap: spacing[10],
  },
  labelBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[4],
    borderRadius: radius.full,
    backgroundColor: colors.heroSoft,
    borderWidth: 1,
    borderColor: colors.hero,
  },
  labelText: {
    color: colors.hero,
  },
  row: {
    flexDirection: "row",
    gap: spacing[10],
  },
  cell: {
    flex: 1,
  },
});

// ---------------------------------------------------------------------------
// ExperienceForm — main form component
// ---------------------------------------------------------------------------

const durationOptions: { label: string; value: DurationType }[] = [
  { label: "Stagioni complete", value: "SEASON" },
  { label: "Periodo specifico", value: "PERIOD" },
];

export function ExperienceForm({
  experience,
  isEditing,
  onCancel,
  onSave,
  searchTeams,
}: ExperienceFormProps) {
  const [form, setForm] = useState<CareerExperience>(experience);
  const [errors, setErrors] = useState<CareerExperienceErrors>({});

  const categoryOptions = getCategoryOptions(form.type);

  function updateField<K extends keyof CareerExperience>(
    key: K,
    value: CareerExperience[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({
      ...prev,
      [key === "seasons" || key === "period" ? "duration" : key]: undefined,
    }));
  }

  function handleDurationTypeChange(durationType: DurationType) {
    setForm((prev) => ({
      ...prev,
      durationType,
      // Reset duration data when switching
      seasons: durationType === "SEASON" ? prev.seasons : [],
      period:
        durationType === "PERIOD"
          ? (prev.period ?? {
              startMonth: "",
              startYear: "",
              endMonth: "",
              endYear: "",
            })
          : null,
    }));
    setErrors((prev) => ({ ...prev, duration: undefined }));
  }

  function handleToggleSeason(season: string) {
    setForm((prev) => {
      const currentSeasons = prev.seasons;
      const isSelected = currentSeasons.includes(season);
      const nextSeasons = isSelected
        ? currentSeasons.filter((s) => s !== season)
        : [...currentSeasons, season];

      // Sync stats: add empty stats for new seasons, keep existing
      const nextStats = { ...prev.stats };

      if (!isSelected && prev.statsEnabled && !nextStats[season]) {
        nextStats[season] = createEmptyStats();
      }

      if (isSelected) {
        delete nextStats[season];
      }

      return { ...prev, seasons: nextSeasons, stats: nextStats };
    });
    setErrors((prev) => ({ ...prev, duration: undefined }));
  }

  function handleStatsToggle(enabled: boolean) {
    setForm((prev) => {
      if (!enabled) {
        return { ...prev, statsEnabled: false, stats: {} };
      }

      // Initialize empty stats for all current seasons or "period"
      const nextStats: Record<string, SeasonStats> = {};

      if (prev.durationType === "SEASON") {
        for (const season of prev.seasons) {
          nextStats[season] = prev.stats[season] ?? createEmptyStats();
        }
      } else {
        nextStats["period"] = prev.stats["period"] ?? createEmptyStats();
      }

      return { ...prev, statsEnabled: true, stats: nextStats };
    });
  }

  function handleSeasonStatsChange(key: string, stats: SeasonStats) {
    setForm((prev) => ({
      ...prev,
      stats: { ...prev.stats, [key]: stats },
    }));
  }

  function handlePeriodChange(period: CareerExperiencePeriod) {
    setForm((prev) => ({ ...prev, period }));
    setErrors((prev) => ({ ...prev, duration: undefined }));
  }

  function handleSave() {
    const validationErrors = validateExperience(form);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    onSave(form);
  }

  // Determine which seasons need stats (for multi-season display)
  const statsSeasons =
    form.durationType === "SEASON" && form.seasons.length > 1
      ? form.seasons
      : null;

  return (
    <View style={formStyles.container}>
      <AppText variant="headingMd">
        {isEditing ? "Modifica esperienza" : "Dettagli esperienza"}
      </AppText>

      {/* Team name */}
      <TeamAutocompleteInput
        label="Nome squadra *"
        onChangeText={(val) => updateField("teamName", val)}
        onSelectTeam={(team) => updateField("teamName", team.name)}
        placeholder="Es. ASD Pro Calcio"
        searchTeams={searchTeams}
        value={form.teamName}
      />
      {errors.teamName ? (
        <AppText variant="caption" color="danger">
          {errors.teamName}
        </AppText>
      ) : null}

      {/* Category */}
      <View style={formStyles.fieldGroup}>
        <SelectField
          label="Categoria *"
          onChange={(val) => updateField("category", val)}
          options={categoryOptions}
          placeholder="Seleziona categoria"
          value={form.category}
        />
        {errors.category ? (
          <AppText variant="caption" color="danger">
            {errors.category}
          </AppText>
        ) : null}
      </View>

      {/* Duration type toggle */}
      <View style={formStyles.fieldGroup}>
        <AppText variant="caption" color="muted">
          Durata dell&apos;esperienza
        </AppText>
        <SegmentedControl
          onChange={handleDurationTypeChange}
          options={durationOptions}
          value={form.durationType}
        />
      </View>

      {/* Duration content */}
      {form.durationType === "SEASON" ? (
        <View style={formStyles.fieldGroup}>
          <AppText variant="caption" color="muted">
            Stagioni (seleziona tutte quelle applicabili)
          </AppText>
          <SeasonChipGrid
            onToggle={handleToggleSeason}
            selectedSeasons={form.seasons}
          />
          {errors.duration ? (
            <AppText variant="caption" color="danger">
              {errors.duration}
            </AppText>
          ) : null}
        </View>
      ) : (
        <PeriodSelector
          error={errors.duration}
          onChange={handlePeriodChange}
          period={form.period}
        />
      )}

      {/* Stats toggle */}
      <Toggle
        label="Aggiungi statistiche"
        onValueChange={handleStatsToggle}
        subtitle="Inserisci presenze, gol, assist per questa esperienza."
        value={form.statsEnabled}
      />

      {/* Stats fields */}
      {form.statsEnabled ? (
        <View style={formStyles.statsSection}>
          {statsSeasons ? (
            // Multi-season: stats per season
            statsSeasons.map((season) => (
              <SeasonStatsFields
                key={season}
                label={season}
                onChange={(stats) => handleSeasonStatsChange(season, stats)}
                stats={form.stats[season] ?? createEmptyStats()}
              />
            ))
          ) : (
            // Single season or period: single stats block
            <SeasonStatsFields
              label={null}
              onChange={(stats) =>
                handleSeasonStatsChange(
                  form.durationType === "SEASON" && form.seasons.length === 1
                    ? form.seasons[0]
                    : "period",
                  stats,
                )
              }
              stats={
                form.stats[
                  form.durationType === "SEASON" && form.seasons.length === 1
                    ? form.seasons[0]
                    : "period"
                ] ?? createEmptyStats()
              }
            />
          )}
        </View>
      ) : null}

      {/* Action buttons */}
      <Button
        label={isEditing ? "Salva modifiche" : "Salva esperienza"}
        onPress={handleSave}
        variant="primary"
      />
      <Button label="Annulla" onPress={onCancel} variant="tertiary" />
    </View>
  );
}

const formStyles = StyleSheet.create({
  container: {
    gap: spacing[18],
  },
  fieldGroup: {
    gap: spacing[8],
  },
  statsSection: {
    gap: spacing[16],
    padding: spacing[16],
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[8],
  },
});
