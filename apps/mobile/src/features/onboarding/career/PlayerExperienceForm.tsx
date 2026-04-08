import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { WheelPicker } from "../../../components/ui/wheel-picker";
import { SelectField } from "../../../components/ui/select-field";
import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button, Input, Toggle } from "../../../ui";
import {
  SENIOR_CATEGORY_OPTIONS,
  YOUTH_CATEGORY_OPTIONS,
} from "../../profiles/player-sports";
import type { TeamAutocompleteOption } from "../../profiles/player-sports";
import { TeamAutocompleteInput } from "../../profiles/player-sports-section";
import type { PlayerCareerEntry, PlayerSeasonDetail } from "./player-career-types";
import {
  MONTH_OPTIONS,
  computePlayerSeasonsFromPeriod,
  emptyPlayerSeasonDetail,
  formatSeasonShort,
  generatePlayerEntryId,
  getOccupiedPlayerSeasonLabels,
  getOlderPlayerSeasonSelectOptions,
  getPlayerEndYearOptions,
  getPlayerPeriodOverlapSeasons,
  getPlayerSeasonSelectOptions,
  getPlayerStartYearOptions,
  sanitizePlayerPeriodSelection,
} from "./player-career-utils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type PlayerExperienceFormProps = {
  categoryLabel?: string;
  categoryPlaceholder?: string;
  entry: PlayerCareerEntry;
  existingEntries?: PlayerCareerEntry[];
  isEditing: boolean;
  onCancel: () => void;
  onSave: (entry: PlayerCareerEntry) => void;
  searchTeams: (query: string) => Promise<TeamAutocompleteOption[]>;
  teamLabel?: string;
  teamPlaceholder?: string;
  title?: string;
};

const PLAYER_EXPERIENCE_CATEGORY_OPTIONS = [
  ...SENIOR_CATEGORY_OPTIONS,
  ...YOUTH_CATEGORY_OPTIONS,
];

type FormErrors = {
  category?: string;
  teamName?: string;
  seasons?: string;
  startYear?: string;
  endYear?: string;
  period?: string;
  seasonDetails?: string;
};

// ---------------------------------------------------------------------------
// SeasonChipGrid — multi-select chips
// ---------------------------------------------------------------------------

function SeasonChipGrid({
  disabledSeasons,
  selectedSeasons,
  onToggle,
}: {
  disabledSeasons?: Set<string>;
  selectedSeasons: string[];
  onToggle: (season: string) => void;
}) {
  const allSeasons = getPlayerSeasonSelectOptions(disabledSeasons ?? new Set());
  const selectedSet = new Set(selectedSeasons);

  const olderSelected = selectedSeasons.filter(
    (season) => !allSeasons.some((option) => option.value === season),
  );
  const olderSeasonOptions = getOlderPlayerSeasonSelectOptions(
    disabledSeasons ?? new Set(),
  );
  const availableOlderOptions = olderSeasonOptions.filter(
    (o) => !selectedSet.has(o.value),
  );

  return (
    <View style={chipStyles.container}>
      {allSeasons.map((seasonOption) => {
        const isSelected = selectedSet.has(seasonOption.value);
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{
              disabled: seasonOption.disabled === true,
              selected: isSelected,
            }}
            disabled={seasonOption.disabled === true}
            key={seasonOption.value}
            onPress={() => onToggle(seasonOption.value)}
            style={[
              chipStyles.chip,
              seasonOption.disabled ? chipStyles.chipDisabled : null,
              isSelected ? chipStyles.chipSelected : null,
            ]}
          >
            <AppText
              variant="bodySm"
              style={[
                isSelected ? chipStyles.chipTextSelected : chipStyles.chipText,
                seasonOption.disabled ? chipStyles.chipTextDisabled : null,
              ]}
            >
              {seasonOption.label}
            </AppText>
          </Pressable>
        );
      })}

      {olderSelected.map((season) => (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: true }}
          key={season}
          onPress={() => onToggle(season)}
          style={[chipStyles.chip, chipStyles.chipSelected]}
        >
          <AppText variant="bodySm" style={chipStyles.chipTextSelected}>
            {formatSeasonShort(season)}
          </AppText>
        </Pressable>
      ))}

      {availableOlderOptions.length > 0 ? (
        <View style={chipStyles.olderPickerRow}>
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

const chipStyles = StyleSheet.create({
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
  chipDisabled: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    opacity: 0.5,
  },
  chipText: {
    color: colors.textPrimary,
  },
  chipTextSelected: {
    color: colors.inkInvert,
    fontWeight: "600",
  },
  chipTextDisabled: {
    color: colors.textMuted,
  },
  olderPickerRow: {
    width: "100%",
    marginTop: spacing[4],
  },
});

// ---------------------------------------------------------------------------
// PeriodSelector
// ---------------------------------------------------------------------------

type Period = NonNullable<PlayerCareerEntry["period"]>;

function PeriodSelector({
  endYearOptions,
  period,
  onChange,
  startYearOptions,
  startYearError,
  endYearError,
  periodError,
}: {
  endYearOptions: { label: string; value: string; disabled?: boolean }[];
  period: Period | null;
  onChange: (period: Period) => void;
  startYearOptions: { label: string; value: string; disabled?: boolean }[];
  startYearError?: string;
  endYearError?: string;
  periodError?: string;
}) {
  const current: Period = period ?? {
    startMonth: "",
    startYear: "",
    endMonth: "",
    endYear: "",
  };

  function update(patch: Partial<Period>) {
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
            label="Dal (Anno) *"
            onChange={(val) => update({ startYear: val })}
            options={startYearOptions}
            placeholder="Anno"
            searchable
            searchPlaceholder="Cerca anno..."
            value={current.startYear}
          />
        </View>
      </View>
      {startYearError ? (
        <AppText variant="caption" color="danger">
          {startYearError}
        </AppText>
      ) : null}

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
            label="Al (Anno) *"
            onChange={(val) => update({ endYear: val })}
            options={endYearOptions}
            placeholder="Anno"
            searchable
            searchPlaceholder="Cerca anno..."
            value={current.endYear}
          />
        </View>
      </View>
      {endYearError ? (
        <AppText variant="caption" color="danger">
          {endYearError}
        </AppText>
      ) : null}
      {periodError ? (
        <AppText variant="caption" color="danger">
          {periodError}
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
// StatsFields — 2x2 WheelPicker grid + awards input
// ---------------------------------------------------------------------------

function StatsFields({
  detail,
  onChange,
}: {
  detail: PlayerSeasonDetail;
  onChange: (field: keyof PlayerSeasonDetail, value: string) => void;
}) {
  return (
    <View style={statsStyles.container}>
      <View style={statsStyles.grid}>
        <View style={statsStyles.cell}>
          <WheelPicker
            compact
            label="Presenze"
            max={200}
            min={0}
            onChange={(val) => onChange("appearances", String(val))}
            value={Number(detail.appearances || "0")}
          />
        </View>
        <View style={statsStyles.cell}>
          <WheelPicker
            compact
            label="Gol"
            max={200}
            min={0}
            onChange={(val) => onChange("goals", String(val))}
            value={Number(detail.goals || "0")}
          />
        </View>
        <View style={statsStyles.cell}>
          <WheelPicker
            compact
            label="Assist"
            max={200}
            min={0}
            onChange={(val) => onChange("assists", String(val))}
            value={Number(detail.assists || "0")}
          />
        </View>
      </View>
      <Input
        label="Premi (opzionale)"
        onChangeText={(val) => onChange("awards", val)}
        placeholder="Es. Capocannoniere"
        value={detail.awards}
      />
    </View>
  );
}

const statsStyles = StyleSheet.create({
  container: {
    gap: spacing[14],
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[10],
  },
  cell: {
    width: "48%",
  },
});

// ---------------------------------------------------------------------------
// SeasonDetailCard — per-season card for multi-season entries
// ---------------------------------------------------------------------------

function SeasonDetailCard({
  categoryOptions,
  detail,
  onChange,
  season,
}: {
  categoryOptions: { label: string; value: string }[];
  detail: PlayerSeasonDetail;
  onChange: (field: keyof PlayerSeasonDetail, value: string) => void;
  season: string;
}) {
  return (
    <View style={seasonDetailStyles.container}>
      <View style={seasonDetailStyles.labelBadge}>
        <AppText variant="caption" style={seasonDetailStyles.labelText}>
          {formatSeasonShort(season)}
        </AppText>
      </View>

      <SelectField
        label="Categoria *"
        onChange={(val) => onChange("category", val)}
        options={categoryOptions}
        placeholder="Seleziona categoria"
        searchable
        searchPlaceholder="Cerca categoria..."
        value={detail.category}
      />

      <StatsFields detail={detail} onChange={onChange} />
    </View>
  );
}

const seasonDetailStyles = StyleSheet.create({
  container: {
    gap: spacing[10],
    padding: spacing[14],
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[8],
    borderWidth: 1,
    borderColor: colors.border,
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
});

// ---------------------------------------------------------------------------
// PlayerExperienceForm
// ---------------------------------------------------------------------------

export function PlayerExperienceForm({
  categoryLabel = "Categoria *",
  categoryPlaceholder = "Seleziona categoria",
  entry,
  existingEntries = [],
  isEditing,
  onCancel,
  onSave,
  searchTeams,
  teamLabel = "Squadra *",
  teamPlaceholder = "Es. ASD Pro Calcio",
  title,
}: PlayerExperienceFormProps) {
  const [form, setForm] = useState<PlayerCareerEntry>(entry);
  const [errors, setErrors] = useState<FormErrors>({});
  const [statsEnabled, setStatsEnabled] = useState(false);
  const occupiedSeasons = useMemo(
    () => getOccupiedPlayerSeasonLabels(existingEntries, entry.id),
    [existingEntries, entry.id],
  );
  const seasonOptions = useMemo(
    () => getPlayerSeasonSelectOptions(occupiedSeasons),
    [occupiedSeasons],
  );
  const startYearOptions = useMemo(
    () =>
      getPlayerStartYearOptions(
        form.period?.endYear ?? "",
        form.period?.endMonth ?? "",
        form.period?.startMonth ?? "",
        occupiedSeasons,
      ),
    [form.period?.endMonth, form.period?.endYear, form.period?.startMonth, occupiedSeasons],
  );
  const endYearOptions = useMemo(
    () =>
      getPlayerEndYearOptions(
        form.period?.startYear ?? "",
        form.period?.startMonth ?? "",
        occupiedSeasons,
      ),
    [form.period?.startMonth, form.period?.startYear, occupiedSeasons],
  );

  const effectiveSeasons = useMemo(() => {
    if (form.type === "MULTI_SEASON") {
      return form.seasons.length > 1 ? form.seasons : [];
    }
    if (form.type === "CUSTOM_PERIOD" && form.period) {
      const seasons = computePlayerSeasonsFromPeriod(form.period);
      return seasons.length > 1 ? seasons : [];
    }
    return [];
  }, [form.type, form.seasons, form.period]);

  const isMultiSeason = effectiveSeasons.length > 1;

  // Single-season inline stats — stored on entry.seasonDetails[seasons[0]] or directly on form.category/stats
  const singleSeasonKey = form.seasons[0] ?? "";
  const singleSeasonDetail: PlayerSeasonDetail =
    form.seasonDetails[singleSeasonKey] ?? emptyPlayerSeasonDetail();

  function updateField<K extends keyof PlayerCareerEntry>(
    key: K,
    value: PlayerCareerEntry[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function handleToggleSeason(season: string) {
    setForm((prev) => {
      const isSelected = prev.seasons.includes(season);
      const nextSeasons = isSelected
        ? prev.seasons.filter((s) => s !== season)
        : [...prev.seasons, season];

      const nextDetails = { ...prev.seasonDetails };
      if (!isSelected && !nextDetails[season]) {
        nextDetails[season] = { ...emptyPlayerSeasonDetail(), category: prev.category };
      }
      if (isSelected) {
        delete nextDetails[season];
      }

      return { ...prev, seasons: nextSeasons, seasonDetails: nextDetails };
    });
    setErrors((prev) => ({ ...prev, seasons: undefined }));
  }

  function handlePeriodChange(period: NonNullable<PlayerCareerEntry["period"]>) {
    const nextPeriod = sanitizePlayerPeriodSelection(period, occupiedSeasons);

    setForm((prev) => {
      const newSeasons = computePlayerSeasonsFromPeriod(nextPeriod);
      if (newSeasons.length <= 1) {
        return { ...prev, period: nextPeriod, seasonDetails: {} };
      }
      const nextDetails: Record<string, PlayerSeasonDetail> = {};
      for (const season of newSeasons) {
        nextDetails[season] = prev.seasonDetails[season] ?? {
          ...emptyPlayerSeasonDetail(),
          category: prev.category,
        };
      }
      return { ...prev, period: nextPeriod, seasonDetails: nextDetails };
    });
    setErrors((prev) => ({
      ...prev,
      startYear: undefined,
      endYear: undefined,
      period: undefined,
    }));
  }

  function handleSeasonDetailChange(
    season: string,
    field: keyof PlayerSeasonDetail,
    value: string,
  ) {
    setForm((prev) => ({
      ...prev,
      seasonDetails: {
        ...prev.seasonDetails,
        [season]: {
          ...(prev.seasonDetails[season] ?? emptyPlayerSeasonDetail()),
          [field]: value,
        },
      },
    }));
    setErrors((prev) => ({ ...prev, seasonDetails: undefined }));
  }

  function handleSingleSeasonDetailChange(
    field: keyof PlayerSeasonDetail,
    value: string,
  ) {
    if (!singleSeasonKey) return;
    handleSeasonDetailChange(singleSeasonKey, field, value);
  }

  function handleSingleSeasonSelect(val: string) {
    setForm((prev) => {
      const nextSeasons = val ? [val] : [];
      const nextDetails = { ...prev.seasonDetails };
      // Remove old season detail key
      for (const oldSeason of prev.seasons) {
        if (oldSeason !== val) {
          delete nextDetails[oldSeason];
        }
      }
      return { ...prev, seasons: nextSeasons, seasonDetails: nextDetails };
    });
    setErrors((prev) => ({ ...prev, seasons: undefined }));
  }

  function handleSave() {
    const nextErrors: FormErrors = {};

    if (!form.teamName.trim()) {
      nextErrors.teamName = "La squadra è obbligatoria.";
    }

    if (!isMultiSeason && !form.category.trim()) {
      nextErrors.category = "Seleziona una categoria.";
    }

    if (isMultiSeason) {
      for (const season of effectiveSeasons) {
        const detail = form.seasonDetails[season];
        if (!detail?.category) {
          nextErrors.seasonDetails = `Seleziona una categoria per la stagione ${formatSeasonShort(season)}.`;
          break;
        }
      }
    }

    if (form.type === "MULTI_SEASON" && form.seasons.length === 0) {
      nextErrors.seasons = "Seleziona almeno una stagione.";
    }

    if (form.type === "SINGLE_SEASON" && form.seasons.length === 0) {
      nextErrors.seasons = "Seleziona una stagione.";
    }

    if (form.type === "CUSTOM_PERIOD") {
      if (!form.period?.startYear) {
        nextErrors.startYear = "L'anno di inizio è obbligatorio.";
      }
      if (!form.period?.endYear) {
        nextErrors.endYear = "L'anno di fine è obbligatorio.";
      }
      const overlappingSeasons = getPlayerPeriodOverlapSeasons(
        form.period,
        occupiedSeasons,
      );
      if (overlappingSeasons.length > 0) {
        const seasonLabels = overlappingSeasons.map(formatSeasonShort).join(", ");
        nextErrors.period =
          overlappingSeasons.length === 1
            ? `Il periodo personalizzato si sovrappone alla stagione ${seasonLabels} gia' inserita.`
            : `Il periodo personalizzato si sovrappone alle stagioni ${seasonLabels} gia' inserite.`;
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const entryToSave: PlayerCareerEntry = {
      ...form,
      id: form.id || generatePlayerEntryId(),
    };

    onSave(entryToSave);
  }

  return (
    <View style={formStyles.container}>
      <AppText variant="headingMd">
        {title ?? (isEditing ? "Modifica esperienza" : "Dettagli esperienza")}
      </AppText>

      {/* Team name */}
      <View style={formStyles.fieldGroup}>
        <TeamAutocompleteInput
          label={teamLabel}
          onChangeText={(val) =>
            setForm((prev) => ({
              ...prev,
              clubId: null,
              teamCity: "",
              teamLogoUrl: "",
              teamName: val,
            }))
          }
          onSelectTeam={(team) =>
            setForm((prev) => ({
              ...prev,
              clubId: team.id,
              teamCity: team.city ?? "",
              teamLogoUrl: team.logoUrl ?? "",
              teamName: team.name,
            }))
          }
          placeholder={teamPlaceholder}
          searchTeams={searchTeams}
          value={form.teamName}
        />
        {errors.teamName ? (
          <AppText variant="caption" color="danger">
            {errors.teamName}
          </AppText>
        ) : null}
      </View>

      {/* Category — only shown when single season */}
      {!isMultiSeason ? (
        <View style={formStyles.fieldGroup}>
          <SelectField
            label={categoryLabel}
            onChange={(val) => updateField("category", val)}
            options={PLAYER_EXPERIENCE_CATEGORY_OPTIONS}
            placeholder={categoryPlaceholder}
            searchable
            searchPlaceholder="Cerca categoria..."
            value={form.category}
          />
          {errors.category ? (
            <AppText variant="caption" color="danger">
              {errors.category}
            </AppText>
          ) : null}
        </View>
      ) : null}

      {/* Duration content by type */}
      {form.type === "MULTI_SEASON" ? (
        <View style={formStyles.fieldGroup}>
          <AppText variant="caption" color="muted">
            Stagioni (seleziona tutte quelle applicabili)
          </AppText>
          <SeasonChipGrid
            disabledSeasons={occupiedSeasons}
            onToggle={handleToggleSeason}
            selectedSeasons={form.seasons}
          />
          {errors.seasons ? (
            <AppText variant="caption" color="danger">
              {errors.seasons}
            </AppText>
          ) : null}
        </View>
      ) : null}

      {form.type === "SINGLE_SEASON" ? (
        <View style={formStyles.fieldGroup}>
          <SelectField
            label="Stagione"
            onChange={handleSingleSeasonSelect}
            options={seasonOptions}
            placeholder="Seleziona stagione"
            searchable
            searchPlaceholder="Cerca stagione..."
            value={form.seasons[0] ?? ""}
          />
          {errors.seasons ? (
            <AppText variant="caption" color="danger">
              {errors.seasons}
            </AppText>
          ) : null}
        </View>
      ) : null}

      {form.type === "CUSTOM_PERIOD" ? (
        <PeriodSelector
          endYearOptions={endYearOptions}
          endYearError={errors.endYear}
          onChange={handlePeriodChange}
          period={form.period}
          periodError={errors.period}
          startYearOptions={startYearOptions}
          startYearError={errors.startYear}
        />
      ) : null}

      {/* Per-season category + stats — only when multiple seasons selected */}
      {isMultiSeason ? (
        <View style={formStyles.fieldGroup}>
          <AppText variant="caption" color="muted">
            Categoria e statistiche per stagione
          </AppText>
          <View style={formStyles.seasonDetailsSection}>
            {effectiveSeasons.map((season) => (
              <SeasonDetailCard
                key={season}
                categoryOptions={PLAYER_EXPERIENCE_CATEGORY_OPTIONS}
                detail={
                  form.seasonDetails[season] ?? {
                    ...emptyPlayerSeasonDetail(),
                    category: form.category,
                  }
                }
                onChange={(field, value) =>
                  handleSeasonDetailChange(season, field, value)
                }
                season={season}
              />
            ))}
          </View>
          {errors.seasonDetails ? (
            <AppText variant="caption" color="danger">
              {errors.seasonDetails}
            </AppText>
          ) : null}
        </View>
      ) : null}

      {/* Optional stats toggle for single season */}
      {!isMultiSeason && form.seasons.length > 0 ? (
        <View style={formStyles.fieldGroup}>
          <Toggle
            label="Aggiungi statistiche"
            onValueChange={setStatsEnabled}
            value={statsEnabled}
          />
          {statsEnabled ? (
            <StatsFields
              detail={singleSeasonDetail}
              onChange={handleSingleSeasonDetailChange}
            />
          ) : null}
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
  seasonDetailsSection: {
    gap: spacing[12],
  },
});
